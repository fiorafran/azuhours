import { NextRequest, NextResponse } from 'next/server'
import {
  getWorkItemsByWeek,
  getWorkItemWithChildren,
  getWorkItemsBatch,
  extractChildIds,
  extractParentId,
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

export async function GET(req: NextRequest) {
  const config = makeConfig(req)
  if (!config.pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

  const week = req.nextUrl.searchParams.get('week')
  if (!week) return NextResponse.json([])

  try {
    // Discover linea custom fields once
    const fieldMap = await getLineaFieldMap(config)
    const horasRef = resolveField(fieldMap, 'horas linea proyecto', 'horas', 'horaslineaproyecto')
    const tipoRef = resolveField(fieldMap, 'tipo hora', 'tipohora')
    const fechaRef = resolveField(fieldMap, 'fecha linea', 'fechalinea', 'fecha')
    const clienteRef = resolveField(fieldMap, 'cliente')

    // 1. Week tasks matching the filter
    const weekTaskRefs = await getWorkItemsByWeek(config, week)
    if (weekTaskRefs.length === 0) return NextResponse.json([])

    // 2. Expand week tasks → get parent id + child task ids
    const weekTasksExpanded = await batchMap(weekTaskRefs, (r) => getWorkItemWithChildren(config, r.id))

    // 3. Fetch parent (ticket) details
    const parentIds = [...new Set(
      weekTasksExpanded.map((wt) => extractParentId(wt.relations)).filter((id): id is number => id !== null)
    )]
    const parentDetails = parentIds.length > 0
      ? await getWorkItemsBatch(config, parentIds, [
          'System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.BoardColumn',
        ])
      : []
    const parentMap = new Map(parentDetails.map((p) => [
      p['id'] as number,
      {
        id: p['id'] as number,
        title: (p.fields as Record<string, unknown>)['System.Title'] as string,
        type: (p.fields as Record<string, unknown>)['System.WorkItemType'] as string,
        state: (p.fields as Record<string, unknown>)['System.State'] as string,
        boardColumn: (p.fields as Record<string, unknown>)['System.BoardColumn'] as string | null ?? null,
      },
    ]))

    // 4. Collect all task ids across all week tasks
    const allTaskIds = weekTasksExpanded.flatMap((wt) => extractChildIds(wt.relations))
    const uniqueTaskIds = [...new Set(allTaskIds)]

    // 5. Fetch all task details in one batch
    const taskDetails = uniqueTaskIds.length > 0
      ? await getWorkItemsBatch(config, uniqueTaskIds)
      : []
    const taskDetailMap = new Map(taskDetails.map((t) => [t['id'] as number, t]))

    // 6. Expand all tasks to get linea ids
    const tasksExpanded = await batchMap(uniqueTaskIds, (id) => getWorkItemWithChildren(config, id))
    const allLineaIds = tasksExpanded.flatMap((t) => extractChildIds(t.relations))
    const uniqueLineaIds = [...new Set(allLineaIds)]

    // 7. Fetch all lineas in one batch with custom fields
    const lineaDetails = uniqueLineaIds.length > 0
      ? await getWorkItemsBatch(config, uniqueLineaIds, [
          'System.Id', 'System.Title', 'System.WorkItemType', 'System.State',
          horasRef, tipoRef, fechaRef, clienteRef,
        ])
      : []

    // Build linea map keyed by id
    const lineaMap = new Map(lineaDetails.map((l) => {
      const f = l.fields as Record<string, unknown>
      return [l['id'] as number, {
        id: l['id'] as number,
        title: f['System.Title'] as string,
        type: f['System.WorkItemType'] as string,
        state: f['System.State'] as string,
        horasLineaProyecto: f[horasRef] as number | undefined,
        tipoHora: f[tipoRef] as string | undefined,
        fechaLinea: f[fechaRef] as string | undefined,
        cliente: f[clienteRef] as string | undefined,
        lineas: [],
      }]
    }))

    // Build task expanded map (id → linea ids)
    const taskLineaMap = new Map(tasksExpanded.map((t) => [t.id, extractChildIds(t.relations)]))

    // 8. Assemble week tasks with tasks with lineas
    const weekTasksFull = weekTasksExpanded.map((wt) => {
      const taskIds = extractChildIds(wt.relations)
      const tasks = taskIds.map((tid) => {
        const td = taskDetailMap.get(tid)
        const tf = td ? (td.fields as Record<string, unknown>) : {}
        const lineaIds = taskLineaMap.get(tid) || []
        return {
          id: tid,
          title: tf['System.Title'] as string ?? `#${tid}`,
          type: tf['System.WorkItemType'] as string ?? 'Task',
          state: tf['System.State'] as string ?? '',
          estimatedHours: tf['Microsoft.VSTS.Scheduling.OriginalEstimate'] as number | undefined,
          lineas: lineaIds.map((lid) => lineaMap.get(lid)).filter(Boolean),
        }
      })
      const wtf = wt.fields as Record<string, unknown>
      return {
        id: wt.id,
        title: wtf['System.Title'] as string,
        type: wtf['System.WorkItemType'] as string,
        state: wtf['System.State'] as string,
        parentId: extractParentId(wt.relations),
        tasks,
      }
    })

    // 9. Group by parent ticket
    const grouped = new Map<number, { id: number; title: string; type: string; state: string; boardColumn: string | null; weekTasks: typeof weekTasksFull }>()
    for (const wt of weekTasksFull) {
      const pid = wt.parentId
      if (!pid) continue
      const parent = parentMap.get(pid) ?? { id: pid, title: `#${pid}`, type: 'Unknown', state: '', boardColumn: null }
      if (!grouped.has(pid)) grouped.set(pid, { ...parent, weekTasks: [] })
      grouped.get(pid)!.weekTasks.push(wt)
    }

    return NextResponse.json(Array.from(grouped.values()))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
