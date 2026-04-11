import { NextRequest, NextResponse } from 'next/server'
import {
  getWorkItemWithChildren,
  getWorkItemsBatch,
  extractChildIds,
} from '@/lib/azure-client'
import { AuthConfig } from '@/lib/types'
import { getLineaFieldMap, resolveField } from '@/lib/field-cache'

function makeConfig(req: NextRequest): AuthConfig {
  return {
    pat: req.headers.get('x-azure-pat') || '',
    org: req.headers.get('x-azure-org') || 'IsbelSA',
    project: req.headers.get('x-azure-project') || 'Proyectos',
  }
}

async function batchMap<T, R>(arr: T[], fn: (item: T) => Promise<R>, size = 10): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < arr.length; i += size) {
    results.push(...(await Promise.all(arr.slice(i, i + size).map(fn))))
  }
  return results
}

// GET /api/azure/item-tree?parentId={id}
// Returns the full week task → task → linea tree for a given BacklogItem
export async function GET(req: NextRequest) {
  const config = makeConfig(req)
  if (!config.pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

  const parentIdStr = req.nextUrl.searchParams.get('parentId')
  const parentId = parseInt(parentIdStr ?? '')
  if (isNaN(parentId) || parentId <= 0)
    return NextResponse.json({ error: 'Missing parentId' }, { status: 400 })

  try {
    const fieldMap = await getLineaFieldMap(config)
    const horasRef = resolveField(fieldMap, 'horas linea proyecto', 'horas', 'horaslineaproyecto')
    const tipoRef = resolveField(fieldMap, 'tipo hora', 'tipohora')
    const fechaRef = resolveField(fieldMap, 'fecha linea', 'fechalinea', 'fecha')
    const clienteRef = resolveField(fieldMap, 'cliente')

    // 1. Get BacklogItem's direct children (week tasks)
    const parentExpanded = await getWorkItemWithChildren(config, parentId)
    const weekTaskIds = extractChildIds(parentExpanded.relations)
    if (weekTaskIds.length === 0) return NextResponse.json([])

    // 2. Fetch week task details + expand each to find task children
    const [weekTaskDetails, weekTasksExpanded] = await Promise.all([
      getWorkItemsBatch(config, weekTaskIds),
      batchMap(weekTaskIds, (id) => getWorkItemWithChildren(config, id)),
    ])

    const weekTaskDetailMap = new Map(weekTaskDetails.map((t) => [t['id'] as number, t]))

    // 3. Collect all task IDs
    const allTaskIds = [...new Set(weekTasksExpanded.flatMap((wt) => extractChildIds(wt.relations)))]

    // 4. Fetch task details + expand tasks to find linea children
    const [taskDetails, tasksExpanded] = allTaskIds.length > 0
      ? await Promise.all([
          getWorkItemsBatch(config, allTaskIds),
          batchMap(allTaskIds, (id) => getWorkItemWithChildren(config, id)),
        ])
      : [[], []] as [Awaited<ReturnType<typeof getWorkItemsBatch>>, Awaited<ReturnType<typeof getWorkItemWithChildren>>[]]

    const taskDetailMap = new Map(taskDetails.map((t) => [t['id'] as number, t]))
    const taskLineaMap = new Map(tasksExpanded.map((t) => [t.id, extractChildIds(t.relations)]))

    // 5. Fetch all lineas
    const allLineaIds = [...new Set(tasksExpanded.flatMap((t) => extractChildIds(t.relations)))]
    const lineaDetails = allLineaIds.length > 0
      ? await getWorkItemsBatch(config, allLineaIds, [
          'System.Id', 'System.Title', 'System.WorkItemType', 'System.State',
          horasRef, tipoRef, fechaRef, clienteRef,
        ])
      : []

    const lineaMap = new Map(
      lineaDetails.map((l) => {
        const f = (l['fields'] as Record<string, unknown>) || {}
        return [
          l['id'] as number,
          {
            id: l['id'] as number,
            title: f['System.Title'] as string,
            type: f['System.WorkItemType'] as string,
            state: f['System.State'] as string,
            horasLineaProyecto: (f[horasRef] as number) || 0,
            tipoHora: f[tipoRef] as string,
            fechaLinea: f[fechaRef] as string,
            cliente: f[clienteRef] as string,
            lineas: [],
          },
        ]
      })
    )

    // 6. Assemble
    const weekTasksFull = weekTaskIds.map((wtId) => {
      const wtExpanded = weekTasksExpanded.find((wt) => wt.id === wtId)
      const wtDetail = weekTaskDetailMap.get(wtId)
      const wtf = wtDetail ? ((wtDetail['fields'] as Record<string, unknown>) || {}) : {}
      const taskIds = wtExpanded ? extractChildIds(wtExpanded.relations) : []

      const tasks = taskIds.map((tid) => {
        const td = taskDetailMap.get(tid)
        const tf = td ? ((td['fields'] as Record<string, unknown>) || {}) : {}
        const lineaIds = taskLineaMap.get(tid) || []
        return {
          id: tid,
          title: (tf['System.Title'] as string) ?? `#${tid}`,
          type: (tf['System.WorkItemType'] as string) ?? 'Task',
          state: (tf['System.State'] as string) ?? '',
          estimatedHours: tf['Microsoft.VSTS.Scheduling.OriginalEstimate'] as number | undefined,
          lineas: lineaIds.map((lid) => lineaMap.get(lid)).filter(Boolean),
        }
      })

      return {
        id: wtId,
        title: (wtf['System.Title'] as string) ?? `#${wtId}`,
        type: (wtf['System.WorkItemType'] as string) ?? 'Task',
        state: (wtf['System.State'] as string) ?? '',
        tasks,
      }
    })

    return NextResponse.json(weekTasksFull)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
