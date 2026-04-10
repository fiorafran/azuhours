import { NextRequest, NextResponse } from 'next/server'
import {
  azureRequest,
  projectPath,
  getWorkItemTypeFields,
  getWorkItemWithChildren,
  getWorkItemsBatch,
  extractParentId,
} from '@/lib/azure-client'
import { getLineaFieldMap, resolveField } from '@/lib/field-cache'
import { AuthConfig } from '@/lib/types'

const backlogFieldCache = new Map<string, Record<string, string>>()

async function getBacklogFieldMap(config: AuthConfig): Promise<Record<string, string>> {
  const key = `${config.org}/${config.project}`
  if (backlogFieldCache.has(key)) return backlogFieldCache.get(key)!
  const fields = await getWorkItemTypeFields(config, 'Product Backlog Item')
  const map: Record<string, string> = {}
  for (const f of fields) map[f.name.toLowerCase().trim()] = f.referenceName
  backlogFieldCache.set(key, map)
  return map
}

function makeConfig(req: NextRequest): AuthConfig {
  return {
    pat: req.headers.get('x-azure-pat') || '',
    org: req.headers.get('x-azure-org') || 'IsbelSA',
    project: req.headers.get('x-azure-project') || 'Proyectos',
  }
}

// Concurrent batching — skips items that fail (404/403)
async function batchMap<T, R>(arr: T[], fn: (item: T) => Promise<R>, size = 10): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < arr.length; i += size) {
    const settled = await Promise.allSettled(arr.slice(i, i + size).map(fn))
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value)
    }
  }
  return results
}

// Fetch each item individually so a single 404 doesn't fail the whole batch
async function fetchIndividual(config: AuthConfig, ids: number[], fields: string[]) {
  const items = await batchMap(ids, (id) => getWorkItemsBatch(config, [id], fields).then((r) => r[0]))
  return items.filter(Boolean)
}

// getWorkItemsBatch with internal 200-item chunking
async function batchFetch(config: AuthConfig, ids: number[], fields?: string[]) {
  if (ids.length === 0) return []
  const results: Record<string, unknown>[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const items = await getWorkItemsBatch(config, ids.slice(i, i + 200), fields)
    results.push(...items)
  }
  return results
}

export async function GET(req: NextRequest) {
  const config = makeConfig(req)
  if (!config.pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

  try {
    // 1. Discover fields in parallel
    const [backlogFields, lineaFieldMap] = await Promise.all([
      getBacklogFieldMap(config),
      getLineaFieldMap(config),
    ])
    const horasComercialRef = resolveField(backlogFields, 'horas propuesta', 'horaspropuesta', 'horas propuesta comercial')
    const horasRef = resolveField(lineaFieldMap, 'horas linea proyecto', 'horas', 'horaslineaproyecto')

    // 2. Get all week tasks (Tasks) assigned to @Me — same source as "Por semana" view
    const weekTaskResult = await azureRequest<{ workItems: { id: number }[] }>(
      config,
      `${projectPath(config)}/_apis/wit/wiql`,
      {
        method: 'POST',
        body: JSON.stringify({
          query: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.WorkItemType] = 'Task' AND [System.Title] CONTAINS ' - ' ORDER BY [System.ChangedDate] DESC`,
        }),
      }
    )

    const weekTaskIds = (weekTaskResult.workItems || []).map((w) => w.id)
    if (weekTaskIds.length === 0) return NextResponse.json([])

    // 3. Expand week tasks to get their parent backlog item IDs
    const weekTasksExpanded = await batchMap(weekTaskIds, (id) => getWorkItemWithChildren(config, id))
    const backlogIds = [...new Set(
      weekTasksExpanded
        .map((wt) => extractParentId(wt.relations))
        .filter((id): id is number => id !== null)
    )]

    if (backlogIds.length === 0) return NextResponse.json([])

    // 4. Fetch backlog items individually (handles 404/403 per item gracefully)
    //    Filter out those tagged "100%"
    const backlogItems = (
      await fetchIndividual(config, backlogIds, [
        'System.Id', 'System.Title', 'System.State', 'System.Tags',
        horasComercialRef,
      ])
    ).filter((item) => {
      const tags = ((item.fields as Record<string, unknown>)['System.Tags'] as string) || ''
      return !tags.split(';').map((t) => t.trim()).includes('100%')
    })

    if (backlogItems.length === 0) return NextResponse.json([])
    const validBacklogIds = new Set(backlogItems.map((i) => i['id'] as number))

    // 5. Get all lineas assigned to @Me
    const lineaResult = await azureRequest<{ workItems: { id: number }[] }>(
      config,
      `${projectPath(config)}/_apis/wit/wiql`,
      {
        method: 'POST',
        body: JSON.stringify({
          query: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.WorkItemType] = 'linea' ORDER BY [System.Id] ASC`,
        }),
      }
    )

    const lineaIds = (lineaResult.workItems || []).map((w) => w.id)
    const lineaHoursMap = new Map<number, number>()

    if (lineaIds.length > 0) {
      // 6. Traverse linea → task → week task → backlog item
      const lineasExpanded = await batchMap(lineaIds, (id) => getWorkItemWithChildren(config, id))
      const lineaToTask = new Map<number, number>()
      for (const l of lineasExpanded) {
        const taskId = extractParentId(l.relations)
        if (taskId !== null) lineaToTask.set(l.id, taskId)
      }

      const uniqueTaskIds = [...new Set(lineaToTask.values())]
      const tasksExpanded = await batchMap(uniqueTaskIds, (id) => getWorkItemWithChildren(config, id))
      const taskToWeekTask = new Map<number, number>()
      for (const t of tasksExpanded) {
        const wtId = extractParentId(t.relations)
        if (wtId !== null) taskToWeekTask.set(t.id, wtId)
      }

      const uniqueWeekTaskIds = [...new Set(taskToWeekTask.values())]
      const weekTasksForLineas = await batchMap(uniqueWeekTaskIds, (id) => getWorkItemWithChildren(config, id))
      const weekTaskToBacklog = new Map<number, number>()
      for (const wt of weekTasksForLineas) {
        const backlogId = extractParentId(wt.relations)
        if (backlogId !== null && validBacklogIds.has(backlogId)) {
          weekTaskToBacklog.set(wt.id, backlogId)
        }
      }

      const lineaToBacklog = new Map<number, number>()
      for (const [lineaId, taskId] of lineaToTask) {
        const wtId = taskToWeekTask.get(taskId)
        if (wtId === undefined) continue
        const backlogId = weekTaskToBacklog.get(wtId)
        if (backlogId !== undefined) lineaToBacklog.set(lineaId, backlogId)
      }

      // 7. Fetch linea hours and accumulate per backlog item
      const lineaDetails = await batchFetch(config, lineaIds, ['System.Id', horasRef])
      for (const linea of lineaDetails) {
        const lineaId = linea['id'] as number
        const horas = ((linea.fields as Record<string, unknown>)[horasRef] as number) || 0
        const backlogId = lineaToBacklog.get(lineaId)
        if (backlogId !== undefined) {
          lineaHoursMap.set(backlogId, (lineaHoursMap.get(backlogId) || 0) + horas)
        }
      }
    }

    // 8. Build response
    const result = backlogItems
      .map((item) => {
        const f = item.fields as Record<string, unknown>
        const id = item['id'] as number
        return {
          id,
          title: f['System.Title'] as string,
          state: f['System.State'] as string,
          horasComercial: (f[horasComercialRef] as number) || 0,
          horasConsumidas: lineaHoursMap.get(id) || 0,
        }
      })
      .sort((a, b) => b.horasConsumidas - a.horasConsumidas)

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
