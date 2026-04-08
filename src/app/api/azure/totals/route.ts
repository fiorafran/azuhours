import { NextRequest, NextResponse } from 'next/server'
import { azureRequest, projectPath } from '@/lib/azure-client'
import { getLineaFieldMap, resolveField } from '@/lib/field-cache'
import { AuthConfig } from '@/lib/types'

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

  const fromRaw = req.nextUrl.searchParams.get('from')
  const toRaw = req.nextUrl.searchParams.get('to')

  // Validate date params to prevent WIQL injection
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const from = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : null
  const to = toRaw && DATE_RE.test(toRaw) ? toRaw : null

  if ((fromRaw && !from) || (toRaw && !to)) {
    return NextResponse.json({ error: 'Formato de fecha inválido. Usá YYYY-MM-DD.' }, { status: 400 })
  }

  try {
    // 1. Discover field reference names
    const fieldMap = await getLineaFieldMap(config)
    const horasRef = resolveField(fieldMap, 'horas linea proyecto', 'horas', 'horaslineaproyecto')
    const clienteRef = resolveField(fieldMap, 'cliente')
    const fechaRef = resolveField(fieldMap, 'fecha linea', 'fechalinea', 'fecha')
    const tipoRef = resolveField(fieldMap, 'tipo hora', 'tipohora')

    // 2. WIQL: get all lineas assigned to @Me
    let dateFilter = ''
    if (from) dateFilter += ` AND [${fechaRef}] >= '${from}'`
    if (to) dateFilter += ` AND [${fechaRef}] <= '${to}'`

    const wiql = {
      query: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.WorkItemType] = 'linea'${dateFilter} ORDER BY [${fechaRef}] DESC`,
    }

    const result = await azureRequest<{ workItems: { id: number }[] }>(
      config,
      `${projectPath(config)}/_apis/wit/wiql`,
      { method: 'POST', body: JSON.stringify(wiql) }
    )

    const ids = (result.workItems || []).map((w) => w.id)
    if (ids.length === 0) return NextResponse.json([])

    // 3. Batch fetch linea details with custom fields
    const batchSize = 200
    const allItems: Record<string, unknown>[] = []
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const batchResult = await azureRequest<{ value: Record<string, unknown>[] }>(
        config,
        `${projectPath(config)}/_apis/wit/workitemsbatch`,
        {
          method: 'POST',
          body: JSON.stringify({
            ids: batch,
            fields: ['System.Id', 'System.Title', horasRef, clienteRef, fechaRef, tipoRef],
          }),
        }
      )
      allItems.push(...(batchResult.value || []))
    }

    // 4. Group by client, sum hours
    const grouped = new Map<string, { cliente: string; totalHoras: number; lineas: unknown[] }>()

    for (const item of allItems) {
      const f = item.fields as Record<string, unknown>
      const cliente = (f[clienteRef] as string) || 'Sin cliente'
      const horas = (f[horasRef] as number) || 0
      const fecha = f[fechaRef] as string | undefined
      const tipo = (f[tipoRef] as string) || ''

      if (!grouped.has(cliente)) {
        grouped.set(cliente, { cliente, totalHoras: 0, lineas: [] })
      }
      const group = grouped.get(cliente)!
      group.totalHoras += horas
      group.lineas.push({
        id: item['id'],
        title: f['System.Title'],
        horas,
        tipo,
        fecha: fecha ? fecha.split('T')[0] : '',
      })
    }

    const sorted = Array.from(grouped.values()).sort((a, b) => b.totalHoras - a.totalHoras)
    return NextResponse.json(sorted)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
