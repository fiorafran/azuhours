import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/azure-client'
import { AuthConfig } from '@/lib/types'

export async function GET(req: NextRequest) {
  const pat = req.headers.get('x-azure-pat')
  const org = req.headers.get('x-azure-org') || 'IsbelSA'
  const project = req.headers.get('x-azure-project') || 'Proyectos'

  if (!pat) {
    return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })
  }

  const config: AuthConfig = { pat, org, project }

  try {
    const user = await getCurrentUser(config)
    return NextResponse.json(user)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
