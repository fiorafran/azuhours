import { NextRequest, NextResponse } from 'next/server'
import { getWorkItemTypeFields } from '@/lib/azure-client'
import { AuthConfig } from '@/lib/types'

function makeConfig(req: NextRequest): AuthConfig {
  return {
    pat: req.headers.get('x-azure-pat') || '',
    org: req.headers.get('x-azure-org') || 'IsbelSA',
    project: req.headers.get('x-azure-project') || 'Proyectos',
  }
}

export async function GET(req: NextRequest) {
  const config = makeConfig(req)
  if (!config.pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

  const type = req.nextUrl.searchParams.get('type') || 'Product Backlog Item'

  try {
    const fields = await getWorkItemTypeFields(config, type)
    return NextResponse.json({ type, fields })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
