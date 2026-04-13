import { NextRequest, NextResponse } from 'next/server'
import { azureRequest } from '@/lib/azure-client'
import { AuthConfig } from '@/lib/types'

function makeConfig(req: NextRequest): AuthConfig {
  return {
    pat: req.headers.get('x-azure-pat') || '',
    org: req.headers.get('x-azure-org') || 'IsbelSA',
    project: req.headers.get('x-azure-project') || 'Proyectos',
  }
}

export interface BoardColumn {
  id: string   // UUID de la columna en el tablero
  name: string
  state: string
}

export interface BoardColumnsResult {
  columns: BoardColumn[]
  teamName: string
  boardId: string
  boardName: string
}

export async function GET(req: NextRequest) {
  const config = makeConfig(req)
  if (!config.pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

  try {
    const proj = encodeURIComponent(config.project.trim())

    const teamsResult = await azureRequest<{ value: { id: string; name: string }[] }>(
      config,
      `/_apis/projects/${proj}/teams`
    )

    const teams = teamsResult.value ?? []
    if (teams.length === 0) return NextResponse.json({ columns: [], teamName: '', boardId: '' })

    type RawBoard = { teamName: string; boardId: string; boardName: string; columns: BoardColumn[] }
    const results: RawBoard[] = []

    await Promise.all(
      teams.map(async (team) => {
        const teamEnc = encodeURIComponent(team.name)
        try {
          const boardsResult = await azureRequest<{ value: { id: string; name: string }[] }>(
            config,
            `/${proj}/${teamEnc}/_apis/work/boards`
          )
          await Promise.all(
            (boardsResult.value ?? []).map(async (board) => {
              try {
                const detail = await azureRequest<{
                  columns: {
                    id: string
                    name: string
                    columnType: string
                    stateMappings: Record<string, string>
                  }[]
                }>(
                  config,
                  `/${proj}/${teamEnc}/_apis/work/boards/${encodeURIComponent(board.id)}`
                )
                const cols: BoardColumn[] = (detail.columns ?? [])
                  .filter((c) => c.name)
                  .map((c) => ({
                    id: c.id,
                    name: c.name,
                    state:
                      c.stateMappings?.['Product Backlog Item'] ??
                      c.stateMappings?.['Backlog Item'] ??
                      Object.values(c.stateMappings ?? {})[0] ??
                      '',
                  }))
                if (cols.length > 0) {
                  results.push({ teamName: team.name, boardId: board.id, boardName: board.name, columns: cols })
                }
              } catch {
                // ignorar tableros individuales que fallen
              }
            })
          )
        } catch {
          // ignorar equipos que fallen
        }
      })
    )

    if (results.length === 0) return NextResponse.json({ columns: [], teamName: '', boardId: '', boardName: '' })

    results.sort((a, b) => b.columns.length - a.columns.length)
    const best = results[0]

    return NextResponse.json({
      columns: best.columns,
      teamName: best.teamName,
      boardId: best.boardId,
      boardName: best.boardName,
    } satisfies BoardColumnsResult)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
