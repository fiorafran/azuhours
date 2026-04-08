import { NextRequest, NextResponse } from 'next/server'
import {
  getWorkItemWithChildren,
  extractChildIds,
  getWorkItemsBatch,
} from '@/lib/azure-client'
import { AuthConfig } from '@/lib/types'
import { getLineaFieldMap, resolveField } from '@/lib/field-cache'

function getConfig(req: NextRequest): AuthConfig {
  return {
    pat: req.headers.get('x-azure-pat') || '',
    org: req.headers.get('x-azure-org') || 'IsbelSA',
    project: req.headers.get('x-azure-project') || 'Proyectos',
  }
}

export async function GET(req: NextRequest) {
  const config = getConfig(req)
  if (!config.pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

  const parentId = req.nextUrl.searchParams.get('parentId')
  if (!parentId) return NextResponse.json({ error: 'Missing parentId' }, { status: 400 })

  try {
    const parent = await getWorkItemWithChildren(config, parseInt(parentId))
    const childIds = extractChildIds(parent.relations)
    if (childIds.length === 0) return NextResponse.json([])

    // Discover linea custom field names
    const fieldMap = await getLineaFieldMap(config)
    const horasRef = resolveField(fieldMap, 'horas linea proyecto', 'horas', 'horaslineaproyecto')
    const tipoRef = resolveField(fieldMap, 'tipo hora', 'tipohora')
    const fechaRef = resolveField(fieldMap, 'fecha linea', 'fechalinea', 'fecha')
    const clienteRef = resolveField(fieldMap, 'cliente')

    const children = await getWorkItemsBatch(config, childIds, [
      'System.Id',
      'System.Title',
      'System.WorkItemType',
      'System.State',
      'Microsoft.VSTS.Scheduling.OriginalEstimate',
      horasRef,
      tipoRef,
      fechaRef,
      clienteRef,
    ])

    const mapped = children.map((item) => {
      const f = item.fields as Record<string, unknown>
      return {
        id: item['id'] as number,
        title: f['System.Title'] as string,
        type: f['System.WorkItemType'] as string,
        state: f['System.State'] as string,
        estimatedHours: f['Microsoft.VSTS.Scheduling.OriginalEstimate'] as number | undefined,
        horasLineaProyecto: f[horasRef] as number | undefined,
        tipoHora: f[tipoRef] as string | undefined,
        fechaLinea: f[fechaRef] as string | undefined,
        cliente: f[clienteRef] as string | undefined,
      }
    })

    return NextResponse.json(mapped)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
