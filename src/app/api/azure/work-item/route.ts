import { NextRequest, NextResponse } from 'next/server'
import { azureRequest, projectPath } from '@/lib/azure-client'
import { AuthConfig } from '@/lib/types'
import { checkRequest } from '@/lib/rate-limit'

function makeConfig(req: NextRequest): AuthConfig {
  return {
    pat: req.headers.get('x-azure-pat') || '',
    org: req.headers.get('x-azure-org') || 'IsbelSA',
    project: req.headers.get('x-azure-project') || 'Proyectos',
  }
}

// GET /api/azure/work-item?id={id}
export async function GET(req: NextRequest) {
  const err = checkRequest(req)
  if (err) return err
  const config = makeConfig(req)

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const result = await azureRequest<{ id: number; fields: Record<string, unknown> }>(
      config,
      `${projectPath(config)}/_apis/wit/workitems/${id}?fields=System.Title,System.State,System.BoardColumn,System.WorkItemType`
    )
    return NextResponse.json({
      id: result.id,
      title: result.fields['System.Title'] as string,
      state: result.fields['System.State'] as string,
      boardColumn: (result.fields['System.BoardColumn'] as string | null) ?? null,
      workItemType: (result.fields['System.WorkItemType'] as string | null) ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// PATCH /api/azure/work-item
export async function PATCH(req: NextRequest) {
  const err = checkRequest(req)
  if (err) return err
  const config = makeConfig(req)

  const body = await req.json()
  const { id, title, boardColumn } = body as {
    id: number
    title?: string
    boardColumn?: string
  }

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    let updatedFields: Record<string, unknown> | null = null

    // 1. Actualizar título via WIT API
    if (title !== undefined) {
      const ops = [{ op: 'replace', path: '/fields/System.Title', value: title }]
      const r = await azureRequest<{ id: number; fields: Record<string, unknown> }>(
        config,
        `${projectPath(config)}/_apis/wit/workitems/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json-patch+json' },
          body: JSON.stringify(ops),
        }
      )
      updatedFields = r.fields
    }

    // 2. Mover columna: buscar el campo WEF Kanban.Column del work item y actualizarlo
    // System.BoardColumn es read-only, el campo real es algo como WEF_<teamGuid>_Kanban.Column
    if (boardColumn !== undefined) {
      // Obtener todos los campos del work item para encontrar el campo Kanban.Column
      const expanded = await azureRequest<{ id: number; fields: Record<string, unknown> }>(
        config,
        `${projectPath(config)}/_apis/wit/workitems/${id}?$expand=fields`
      )

      // Buscar el campo cuyo nombre termine en Kanban.Column
      const kanbanColumnField = Object.keys(expanded.fields).find(
        (key) => key.endsWith('Kanban.Column') && !key.endsWith('Kanban.Column.Done')
      )

      if (kanbanColumnField) {
        const ops = [{ op: 'replace', path: `/fields/${kanbanColumnField}`, value: boardColumn }]
        const r = await azureRequest<{ id: number; fields: Record<string, unknown> }>(
          config,
          `${projectPath(config)}/_apis/wit/workitems/${id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json-patch+json' },
            body: JSON.stringify(ops),
          }
        )
        updatedFields = r.fields
      }
    }

    // Si no tenemos campos actualizados aún, leer el estado actual
    if (!updatedFields) {
      const r = await azureRequest<{ id: number; fields: Record<string, unknown> }>(
        config,
        `${projectPath(config)}/_apis/wit/workitems/${id}?fields=System.Title,System.State,System.BoardColumn`
      )
      updatedFields = r.fields
    }

    return NextResponse.json({
      id,
      title: updatedFields['System.Title'] as string,
      state: updatedFields['System.State'] as string,
      boardColumn: (updatedFields['System.BoardColumn'] as string | null) ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
