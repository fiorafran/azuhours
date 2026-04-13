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
import { checkRequest } from '@/lib/rate-limit'

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

async function fetchIndividual(config: AuthConfig, ids: number[], fields: string[]) {
  const items = await batchMap(ids, (id) => getWorkItemsBatch(config, [id], fields).then((r) => r[0]))
  return items.filter(Boolean)
}

export async function GET(req: NextRequest) {
  const err = checkRequest(req, 'heavy')
  if (err) return err
  const config = makeConfig(req)

  try {
    // 1. Discover fields
    const [backlogFields, lineaFieldMap] = await Promise.all([
      getBacklogFieldMap(config),
      getLineaFieldMap(config),
    ])
    const horasComercialRef = resolveField(backlogFields, 'horas propuesta', 'horaspropuesta', 'horas propuesta comercial')
    const horasRef = resolveField(lineaFieldMap, 'horas linea proyecto', 'horas', 'horaslineaproyecto')
    const clienteRef = resolveField(lineaFieldMap, 'cliente')

    // 2. Get week tasks assigned to @Me → find their parent backlog items
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

    const weekTasksExpanded = await batchMap(weekTaskIds, (id) => getWorkItemWithChildren(config, id))
    const backlogIds = [...new Set(
      weekTasksExpanded
        .map((wt) => extractParentId(wt.relations))
        .filter((id): id is number => id !== null)
    )]

    if (backlogIds.length === 0) return NextResponse.json([])

    // 3. Fetch backlog items individually (handles 404/403), filter "100%" tag
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

    // 4. Get consumed hours from totals (same source as Totales tab — groups by cliente field)
    //    This is the reliable source: it's what Totales shows, grouped by linea.cliente
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

    // Accumulate hours by cliente name (same logic as totals endpoint)
    const horasByCliente = new Map<string, number>()

    if (lineaIds.length > 0) {
      const batchSize = 200
      for (let i = 0; i < lineaIds.length; i += batchSize) {
        const batch = lineaIds.slice(i, i + batchSize)
        const details = await getWorkItemsBatch(config, batch, ['System.Id', horasRef, clienteRef])
        for (const linea of details) {
          const f = linea.fields as Record<string, unknown>
          const cliente = ((f[clienteRef] as string) || '').trim().toLowerCase()
          const horas = (f[horasRef] as number) || 0
          if (cliente) horasByCliente.set(cliente, (horasByCliente.get(cliente) || 0) + horas)
        }
      }
    }

    // 5. Match backlog item title to cliente name and build response
    const result = backlogItems
      .map((item) => {
        const f = item.fields as Record<string, unknown>
        const id = item['id'] as number
        const title = f['System.Title'] as string
        const horasConsumidas = horasByCliente.get(title.trim().toLowerCase()) || 0
        return {
          id,
          title,
          state: f['System.State'] as string,
          horasComercial: (f[horasComercialRef] as number) || 0,
          horasConsumidas,
        }
      })
      .sort((a, b) => b.horasConsumidas - a.horasConsumidas)

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
