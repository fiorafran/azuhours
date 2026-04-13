import { AuthConfig } from './types'

// connectionData requires preview, WIT endpoints use stable 7.0
const VERSION_PREVIEW = '7.0-preview.1'
const VERSION_STABLE = '7.0'

function makeAuthHeader(pat: string): string {
  const encoded = Buffer.from(`:${pat}`).toString('base64')
  return `Basic ${encoded}`
}

export async function azureRequest<T>(
  config: AuthConfig,
  path: string,
  options: RequestInit = {},
  apiVersion = VERSION_STABLE
): Promise<T> {
  const org = encodeURIComponent(config.org.trim())
  const baseUrl = `https://dev.azure.com/${org}`
  const url = `${baseUrl}${path}${path.includes('?') ? '&' : '?'}api-version=${apiVersion}`

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: makeAuthHeader(config.pat),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Azure DevOps API error ${res.status} [${url}]: ${text.substring(0, 300)}`)
  }

  if (res.status === 204) return {} as T
  return res.json()
}

export function projectPath(config: AuthConfig) {
  return `/${encodeURIComponent(config.project.trim())}`
}

export async function getCurrentUser(config: AuthConfig) {
  const data = await azureRequest<{
    authenticatedUser: Record<string, unknown>
  }>(config, `/_apis/connectionData`, {}, VERSION_PREVIEW)
  const auth = data.authenticatedUser
  return {
    id: auth['id'] as string,
    displayName: (auth['providerDisplayName'] || auth['displayName']) as string,
    uniqueName: auth['uniqueName'] as string | undefined,
  }
}

export async function filterWorkItemsByAssignedToMe(config: AuthConfig, ids: number[]): Promise<{ id: number }[]> {
  if (ids.length === 0) return []
  const wiql = {
    query: `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${ids.join(',')}) AND [System.AssignedTo] = @Me`,
  }
  const result = await azureRequest<{ workItems: { id: number }[] }>(
    config,
    `${projectPath(config)}/_apis/wit/wiql`,
    { method: 'POST', body: JSON.stringify(wiql) }
  )
  return result.workItems || []
}

export async function getWorkItemsByWeek(config: AuthConfig, weekTitle: string): Promise<{ id: number }[]> {
  // Escape single quotes for WIQL
  const safe = weekTitle.replace(/'/g, "''")
  const wiql = {
    query: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.WorkItemType] = 'Task' AND [System.Title] = '${safe}' ORDER BY [System.ChangedDate] DESC`,
  }

  const result = await azureRequest<{ workItems: { id: number }[] }>(
    config,
    `${projectPath(config)}/_apis/wit/wiql`,
    { method: 'POST', body: JSON.stringify(wiql) }
  )

  return result.workItems || []
}

export async function getWorkItemTypeFields(
  config: AuthConfig,
  typeName: string
): Promise<Array<{ referenceName: string; name: string }>> {
  const result = await azureRequest<{ value: Array<{ referenceName: string; name: string }> }>(
    config,
    `${projectPath(config)}/_apis/wit/workitemtypes/${encodeURIComponent(typeName)}/fields`
  )
  return result.value || []
}

export function extractParentId(
  relations: { rel: string; url: string }[] | undefined
): number | null {
  if (!relations) return null
  const parent = relations.find((r) => r.rel === 'System.LinkTypes.Hierarchy-Reverse')
  if (!parent) return null
  const parts = parent.url.split('/')
  const id = parseInt(parts[parts.length - 1])
  return isNaN(id) ? null : id
}

export async function getWorkItemsBatch(config: AuthConfig, ids: number[], fields?: string[]) {
  if (ids.length === 0) return []

  const defaultFields = [
    'System.Id',
    'System.Title',
    'System.WorkItemType',
    'System.State',
    'System.AssignedTo',
    'Microsoft.VSTS.Scheduling.OriginalEstimate',
    'Microsoft.VSTS.Scheduling.CompletedWork',
  ]

  const result = await azureRequest<{ value: Record<string, unknown>[] }>(
    config,
    `${projectPath(config)}/_apis/wit/workitemsbatch`,
    {
      method: 'POST',
      body: JSON.stringify({ ids, fields: fields || defaultFields }),
    }
  )

  return result.value || []
}

export async function getWorkItemWithChildren(config: AuthConfig, id: number) {
  return azureRequest<{
    id: number
    fields: Record<string, unknown>
    relations?: { rel: string; url: string; attributes: Record<string, unknown> }[]
  }>(config, `${projectPath(config)}/_apis/wit/workitems/${id}?$expand=relations`)
}

export function extractChildIds(
  relations: { rel: string; url: string }[] | undefined
): number[] {
  if (!relations) return []
  return relations
    .filter((r) => r.rel === 'System.LinkTypes.Hierarchy-Forward')
    .map((r) => {
      const parts = r.url.split('/')
      return parseInt(parts[parts.length - 1])
    })
    .filter((id) => !isNaN(id))
}

export async function createLinea(
  config: AuthConfig,
  parentId: number,
  data: {
    title: string
    horas: number
    tipoHora: string
    fecha: string
    cliente: string
    horasRef: string
    tipoRef: string
    fechaRef: string
    clienteRef: string
  }
) {
  const org = encodeURIComponent(config.org.trim())
  const proj = encodeURIComponent(config.project.trim())

  const ops = [
    { op: 'add', path: '/fields/System.Title', value: data.title },
    { op: 'add', path: `/fields/${data.horasRef}`, value: data.horas },
    { op: 'add', path: `/fields/${data.tipoRef}`, value: data.tipoHora },
    { op: 'add', path: `/fields/${data.fechaRef}`, value: data.fecha },
    { op: 'add', path: `/fields/${data.clienteRef}`, value: data.cliente },
    {
      op: 'add',
      path: '/relations/-',
      value: {
        rel: 'System.LinkTypes.Hierarchy-Reverse',
        url: `https://dev.azure.com/${org}/${proj}/_apis/wit/workitems/${parentId}`,
        attributes: { comment: '' },
      },
    },
  ]

  return azureRequest<{ id: number; fields: Record<string, unknown> }>(
    config,
    `${projectPath(config)}/_apis/wit/workitems/$linea`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(ops),
    }
  )
}

export async function updateLinea(
  config: AuthConfig,
  lineaId: number,
  data: {
    title?: string
    horas?: number
    tipoHora?: string
    fecha?: string
    cliente?: string
    horasRef: string
    tipoRef: string
    fechaRef: string
    clienteRef: string
  }
) {
  const ops: { op: string; path: string; value: unknown }[] = []
  if (data.title !== undefined) ops.push({ op: 'replace', path: '/fields/System.Title', value: data.title })
  if (data.horas !== undefined) ops.push({ op: 'replace', path: `/fields/${data.horasRef}`, value: data.horas })
  if (data.tipoHora !== undefined) ops.push({ op: 'replace', path: `/fields/${data.tipoRef}`, value: data.tipoHora })
  if (data.fecha !== undefined) ops.push({ op: 'replace', path: `/fields/${data.fechaRef}`, value: data.fecha })
  if (data.cliente !== undefined) ops.push({ op: 'replace', path: `/fields/${data.clienteRef}`, value: data.cliente })

  return azureRequest<{ id: number; fields: Record<string, unknown> }>(
    config,
    `${projectPath(config)}/_apis/wit/workitems/${lineaId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(ops),
    }
  )
}

export async function createTask(
  config: AuthConfig,
  parentId: number,
  title: string,
  assignedTo?: string
) {
  const org = encodeURIComponent(config.org.trim())
  const proj = encodeURIComponent(config.project.trim())

  const ops: { op: string; path: string; value: unknown }[] = [
    { op: 'add', path: '/fields/System.Title', value: title },
  ]

  if (assignedTo) {
    ops.push({ op: 'add', path: '/fields/System.AssignedTo', value: assignedTo })
  }

  ops.push({
    op: 'add',
    path: '/relations/-',
    value: {
      rel: 'System.LinkTypes.Hierarchy-Reverse',
      url: `https://dev.azure.com/${org}/${proj}/_apis/wit/workitems/${parentId}`,
      attributes: { comment: '' },
    },
  })

  return azureRequest<{ id: number; fields: Record<string, unknown> }>(
    config,
    `${projectPath(config)}/_apis/wit/workitems/$Task`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(ops),
    }
  )
}

export async function deleteWorkItem(config: AuthConfig, id: number) {
  return azureRequest<void>(
    config,
    `${projectPath(config)}/_apis/wit/workitems/${id}`,
    { method: 'DELETE' }
  )
}
