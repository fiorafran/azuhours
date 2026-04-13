'use client'

import { useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Briefcase, Pencil, Check, X, Loader2 } from 'lucide-react'
import { BacklogItem, WeekTask as WeekTaskType } from '@/lib/types'
import { WeekTaskComponent } from './week-task'
import { AuthConfig } from '@/lib/types'
import { toast } from 'sonner'

interface BoardColumn {
  id: string
  name: string
  state: string
}

interface BoardContext {
  columns: BoardColumn[]
  teamName: string
  boardId: string
  boardName: string
}

interface BacklogItemCardProps {
  item: BacklogItem
  config: AuthConfig
  onHoursChange?: (delta: number) => void
  onUpdate?: (id: number, updates: { title: string; state: string; boardColumn: string | null }) => void
}

function makeHeaders(config: AuthConfig) {
  return {
    'Content-Type': 'application/json',
    'x-azure-pat': config.pat,
    'x-azure-org': config.org,
    'x-azure-project': config.project,
  }
}

export function BacklogItemCard({ item, config, onHoursChange, onUpdate }: BacklogItemCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.title)
  const [editColumn, setEditColumn] = useState<string>('')
  const [currentColumn, setCurrentColumn] = useState<string | null>(null)
  const [boardCtx, setBoardCtx] = useState<BoardContext | null>(null)
  const [loadingContext, setLoadingContext] = useState(false)
  const [saving, setSaving] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const contextLoaded = useRef(false)

  const weekTasks = (item.weekTasks || []) as WeekTaskType[]
  const displayColumn = item.boardColumn || item.state

  async function openEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditTitle(item.title)
    setIsEditing(true)
    setTimeout(() => titleInputRef.current?.focus(), 0)

    if (!contextLoaded.current) {
      setLoadingContext(true)
      try {
        const [itemRes, colsRes] = await Promise.all([
          fetch(`/api/azure/work-item?id=${item.id}`, { headers: makeHeaders(config) }),
          fetch('/api/azure/board-columns', { headers: makeHeaders(config) }),
        ])

        let fetchedColumn: string | null = item.boardColumn ?? null
        if (itemRes.ok) {
          const d = await itemRes.json()
          fetchedColumn = d.boardColumn ?? null
        }

        let ctx: BoardContext = { columns: [], teamName: '', boardId: '', boardName: '' }
        if (colsRes.ok) {
          const d = await colsRes.json()
          const cols: BoardColumn[] = d.columns ?? []
          // Agregar columna actual si no está en la lista
          if (fetchedColumn && !cols.some((c) => c.name === fetchedColumn)) {
            cols.unshift({ id: '', name: fetchedColumn, state: item.state })
          }
          ctx = { columns: cols, teamName: d.teamName ?? '', boardId: d.boardId ?? '', boardName: d.boardName ?? '' }
        }

        setCurrentColumn(fetchedColumn)
        setEditColumn(fetchedColumn ?? (ctx.columns[0]?.name ?? ''))
        setBoardCtx(ctx)
        contextLoaded.current = true
      } catch {
        // silently ignorar
      } finally {
        setLoadingContext(false)
      }
    } else {
      setEditColumn(currentColumn ?? '')
    }
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setIsEditing(false)
  }

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    const newTitle = editTitle.trim()
    if (!newTitle) return

    const titleChanged = newTitle !== item.title
    const columnChanged = editColumn !== (currentColumn ?? '')
    if (!titleChanged && !columnChanged) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/azure/work-item', {
        method: 'PATCH',
        headers: makeHeaders(config),
        body: JSON.stringify({
          id: item.id,
          ...(titleChanged ? { title: newTitle } : {}),
          ...(columnChanged ? { boardColumn: editColumn } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al actualizar')

      setCurrentColumn(data.boardColumn)
      onUpdate?.(item.id, { title: data.title, state: data.state, boardColumn: data.boardColumn })
      setIsEditing(false)
      toast.success('Ticket actualizado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="shadow-sm border-gray-200 py-0 gap-0">
      {isEditing ? (
        <div
          className="flex items-center gap-2 py-3 px-4"
          onClick={(e) => e.stopPropagation()}
        >
          <Briefcase className="w-4 h-4 text-blue-500 shrink-0" />
          <Badge variant="outline" className="text-xs text-gray-400 font-mono shrink-0">
            #{item.id}
          </Badge>
          <input
            ref={titleInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave(e as unknown as React.MouseEvent)
              if (e.key === 'Escape') cancelEdit(e as unknown as React.MouseEvent)
            }}
            disabled={saving}
            className="flex-1 min-w-0 text-sm font-semibold border border-blue-300 rounded-md px-2.5 py-1 outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          />
          {loadingContext ? (
            <div className="flex items-center gap-1.5 shrink-0 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Cargando…</span>
            </div>
          ) : boardCtx && boardCtx.columns.length > 0 ? (
            <div className="shrink-0 flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-400 leading-none pl-1">
                Actual:{' '}
                <span className="font-medium text-gray-600">{currentColumn || '—'}</span>
              </span>
              <select
                value={editColumn}
                onChange={(e) => setEditColumn(e.target.value)}
                disabled={saving}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 bg-white text-gray-700 max-w-[200px]"
              >
                {boardCtx.columns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loadingContext || !editTitle.trim()}
            className="shrink-0 h-7 px-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </Button>
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          className="group flex items-center gap-2 py-4 px-4 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-gray-400 shrink-0">
            {expanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </span>
          <Briefcase className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Badge variant="outline" className="text-xs text-gray-400 font-mono shrink-0">
              #{item.id}
            </Badge>
            <span className="font-semibold text-gray-900 truncate">{item.title}</span>
          </div>
          <Badge
            className={`shrink-0 text-xs ${
              item.state === 'Closed'
                ? 'bg-gray-100 text-gray-500'
                : 'bg-blue-100 text-blue-700'
            }`}
            variant="secondary"
          >
            {displayColumn}
          </Badge>
          <button
            onClick={openEdit}
            className="text-gray-300 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
            title="Editar ticket"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {expanded && !isEditing && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="ml-6 space-y-2">
            {weekTasks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">Sin semanas asignadas</p>
            ) : (
              weekTasks.map((weekTask) => (
                <WeekTaskComponent
                  key={weekTask.id}
                  weekTask={weekTask}
                  config={config}
                  defaultCliente={item.clienteName || item.title}
                  onHoursChange={onHoursChange}
                  canDeleteTasks
                />
              ))
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
