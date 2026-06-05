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

export async function GET(req: NextRequest) {
  const err = checkRequest(req)
  if (err) return err
  const config = makeConfig(req)

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const result = await azureRequest<{
      comments: Array<{ id: number; text: string; createdBy: { displayName: string }; createdDate: string }>
    }>(
      config,
      `${projectPath(config)}/_apis/wit/workitems/${id}/comments`,
      {},
      '7.0-preview'
    )
    return NextResponse.json(result.comments || [])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const err = checkRequest(req)
  if (err) return err
  const config = makeConfig(req)

  const body = await req.json()
  const { id, text } = body as { id: number; text: string }

  if (!id || !text) return NextResponse.json({ error: 'Missing id or text' }, { status: 400 })

  try {
    const result = await azureRequest<{
      id: number
      text: string
      createdBy: { displayName: string }
      createdDate: string
    }>(
      config,
      `${projectPath(config)}/_apis/wit/workitems/${id}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      },
      '7.0-preview'
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}