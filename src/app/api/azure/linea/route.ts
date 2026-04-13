import { NextRequest, NextResponse } from 'next/server'
import { createLinea, updateLinea, deleteWorkItem } from '@/lib/azure-client'
import { AuthConfig } from '@/lib/types'
import { getLineaFieldMap, resolveField } from '@/lib/field-cache'
import { checkRequest, sanitizeString, parsePositiveInt } from '@/lib/rate-limit'

// Append T12:00:00 so the date doesn't shift when Azure DevOps interprets it as UTC
function toNoonUtc(dateStr: string): string {
  if (!dateStr) return dateStr
  // Already has time component, leave it
  if (dateStr.includes('T')) return dateStr
  return `${dateStr}T12:00:00Z`
}

function getConfig(req: NextRequest): AuthConfig {
  return {
    pat: req.headers.get('x-azure-pat') || '',
    org: req.headers.get('x-azure-org') || 'IsbelSA',
    project: req.headers.get('x-azure-project') || 'Proyectos',
  }
}

function mapLineaFields(fields: Record<string, unknown>, horasRef: string, tipoRef: string, fechaRef: string, clienteRef: string) {
  return {
    horasLineaProyecto: fields[horasRef] as number,
    tipoHora: fields[tipoRef] as string,
    fechaLinea: fields[fechaRef] as string,
    cliente: fields[clienteRef] as string,
  }
}

// POST /api/azure/linea - Create
export async function POST(req: NextRequest) {
  const err = checkRequest(req)
  if (err) return err
  const config = getConfig(req)

  try {
    const body = await req.json()
    const { parentId, horas, tipoHora, fecha, cliente, title } = body
    const parentIdNum = parsePositiveInt(String(parentId ?? ''))
    if (!parentIdNum) return NextResponse.json({ error: 'Missing or invalid parentId' }, { status: 400 })
    if (typeof horas !== 'number' || horas <= 0 || horas > 24) return NextResponse.json({ error: 'Invalid horas' }, { status: 400 })
    if (sanitizeString(tipoHora, 100) === null) return NextResponse.json({ error: 'Invalid tipoHora' }, { status: 400 })
    if (sanitizeString(fecha, 20) === null) return NextResponse.json({ error: 'Invalid fecha' }, { status: 400 })

    const fieldMap = await getLineaFieldMap(config)
    const horasRef = resolveField(fieldMap, 'horas linea proyecto', 'horas', 'horaslineaproyecto')
    const tipoRef = resolveField(fieldMap, 'tipo hora', 'tipohora')
    const fechaRef = resolveField(fieldMap, 'fecha linea', 'fechalinea', 'fecha')
    const clienteRef = resolveField(fieldMap, 'cliente')

    const linea = await createLinea(config, parentIdNum, {
      title: title ? String(title) : String(horas),
      horas: Number(horas),
      tipoHora,
      fecha: toNoonUtc(fecha),
      cliente,
      horasRef,
      tipoRef,
      fechaRef,
      clienteRef,
    })

    const f = linea.fields as Record<string, unknown>
    return NextResponse.json({
      id: linea.id,
      title: f['System.Title'] as string,
      type: f['System.WorkItemType'] as string,
      state: f['System.State'] as string,
      ...mapLineaFields(f, horasRef, tipoRef, fechaRef, clienteRef),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// PATCH /api/azure/linea - Update
export async function PATCH(req: NextRequest) {
  const err = checkRequest(req)
  if (err) return err
  const config = getConfig(req)

  try {
    const body = await req.json()
    const { id, horas, tipoHora, fecha, cliente, title } = body
    const idNum = parsePositiveInt(String(id ?? ''))
    if (!idNum) return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 })
    if (horas !== undefined && (typeof horas !== 'number' || horas <= 0 || horas > 24)) return NextResponse.json({ error: 'Invalid horas' }, { status: 400 })

    const fieldMap = await getLineaFieldMap(config)
    const horasRef = resolveField(fieldMap, 'horas linea proyecto', 'horas', 'horaslineaproyecto')
    const tipoRef = resolveField(fieldMap, 'tipo hora', 'tipohora')
    const fechaRef = resolveField(fieldMap, 'fecha linea', 'fechalinea', 'fecha')
    const clienteRef = resolveField(fieldMap, 'cliente')

    const linea = await updateLinea(config, idNum, {
      title: title !== undefined ? String(title) : horas !== undefined ? String(horas) : undefined,
      horas: horas !== undefined ? Number(horas) : undefined,
      tipoHora,
      fecha: fecha ? toNoonUtc(fecha) : undefined,
      cliente,
      horasRef,
      tipoRef,
      fechaRef,
      clienteRef,
    })

    const f = linea.fields as Record<string, unknown>
    return NextResponse.json({
      id: linea.id,
      title: f['System.Title'] as string,
      type: f['System.WorkItemType'] as string,
      state: f['System.State'] as string,
      ...mapLineaFields(f, horasRef, tipoRef, fechaRef, clienteRef),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// DELETE /api/azure/linea?id=123
export async function DELETE(req: NextRequest) {
  const err = checkRequest(req)
  if (err) return err
  const config = getConfig(req)

  const id = req.nextUrl.searchParams.get('id')
  const deleteId = parseInt(id ?? '')
  if (!id || isNaN(deleteId) || deleteId <= 0) return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 })

  try {
    await deleteWorkItem(config, deleteId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
