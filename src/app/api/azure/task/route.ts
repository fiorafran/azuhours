import { NextRequest, NextResponse } from 'next/server'
import { createTask, getCurrentUser, deleteWorkItem } from '@/lib/azure-client'
import { AuthConfig } from '@/lib/types'

function getConfig(req: NextRequest): AuthConfig {
  return {
    pat: req.headers.get('x-azure-pat') || '',
    org: req.headers.get('x-azure-org') || 'IsbelSA',
    project: req.headers.get('x-azure-project') || 'Proyectos',
  }
}

// POST /api/azure/task - Create a Task work item as child of a week task
export async function POST(req: NextRequest) {
  const config = getConfig(req)
  if (!config.pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

  try {
    const body = await req.json()
    const { parentId, title } = body
    const parentIdNum = parseInt(parentId)
    if (!parentId || isNaN(parentIdNum) || parentIdNum <= 0)
      return NextResponse.json({ error: 'Missing or invalid parentId' }, { status: 400 })
    if (!title || !String(title).trim())
      return NextResponse.json({ error: 'Missing title' }, { status: 400 })

    const user = await getCurrentUser(config)
    const assignedTo = user.uniqueName || user.displayName

    const task = await createTask(config, parentIdNum, String(title).trim(), assignedTo)
    const f = task.fields as Record<string, unknown>
    return NextResponse.json({
      id: task.id,
      title: f['System.Title'] as string,
      type: f['System.WorkItemType'] as string,
      state: f['System.State'] as string,
      lineas: [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// DELETE /api/azure/task?id=123
export async function DELETE(req: NextRequest) {
  const config = getConfig(req)
  if (!config.pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  const deleteId = parseInt(id ?? '')
  if (!id || isNaN(deleteId) || deleteId <= 0)
    return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 })

  try {
    await deleteWorkItem(config, deleteId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
