import { NextRequest, NextResponse } from 'next/server'
import { azureRequest, projectPath, getWorkItemsBatch } from '@/lib/azure-client'
import { AuthConfig } from '@/lib/types'

function makeConfig(req: NextRequest): AuthConfig {
  return {
    pat: req.headers.get('x-azure-pat') || '',
    org: req.headers.get('x-azure-org') || 'IsbelSA',
    project: req.headers.get('x-azure-project') || 'Proyectos',
  }
}

// GET /api/azure/backlog-items
// Returns all BacklogItems assigned to the authenticated user
export async function GET(req: NextRequest) {
  const config = makeConfig(req)
  if (!config.pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

  try {
    const wiql = {
      query: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.WorkItemType] NOT IN ('Task', 'linea') ORDER BY [System.ChangedDate] DESC`,
    }

    const result = await azureRequest<{ workItems: { id: number }[] }>(
      config,
      `${projectPath(config)}/_apis/wit/wiql`,
      { method: 'POST', body: JSON.stringify(wiql) }
    )

    const ids = (result.workItems || []).map((w) => w.id)
    if (ids.length === 0) return NextResponse.json([])

    const items = await getWorkItemsBatch(config, ids, [
      'System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.BoardColumn',
    ])

    return NextResponse.json(
      items.map((item) => {
        const f = (item['fields'] as Record<string, unknown>) || {}
        return {
          id: item['id'] as number,
          title: f['System.Title'] as string,
          type: f['System.WorkItemType'] as string,
          state: f['System.State'] as string,
          boardColumn: (f['System.BoardColumn'] as string) || null,
        }
      })
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
