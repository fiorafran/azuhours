import { getWorkItemTypeFields } from './azure-client'
import { AuthConfig } from './types'

// Shared module-level cache used by multiple API routes
const cache = new Map<string, Record<string, string>>()

export async function getLineaFieldMap(config: AuthConfig): Promise<Record<string, string>> {
  const key = `${config.org}/${config.project}/linea`
  if (cache.has(key)) return cache.get(key)!
  const fields = await getWorkItemTypeFields(config, 'linea')
  const map: Record<string, string> = {}
  for (const f of fields) map[f.name.toLowerCase().trim()] = f.referenceName
  cache.set(key, map)
  return map
}

export async function getTaskFieldMap(config: AuthConfig): Promise<Record<string, string>> {
  const key = `${config.org}/${config.project}/task`
  if (cache.has(key)) return cache.get(key)!
  const fields = await getWorkItemTypeFields(config, 'Task')
  const map: Record<string, string> = {}
  for (const f of fields) map[f.name.toLowerCase().trim()] = f.referenceName
  cache.set(key, map)
  return map
}

export function resolveField(map: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    const found = map[c.toLowerCase().trim()]
    if (found) return found
  }
  return `Custom.${candidates[0].replace(/\s+/g, '')}`
}
