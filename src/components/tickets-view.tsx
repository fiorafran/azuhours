'use client'

import { useEffect, useRef, useState } from 'react'
import { AuthConfig } from '@/lib/types'
import { WeekTask as WeekTaskType } from '@/lib/types'
import { WeekTaskComponent } from './week-task'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Briefcase, Calendar, ChevronDown, ChevronRight, Filter, Plus } from 'lucide-react'
import { toast } from 'sonner'

export interface TicketItem {
  id: number
  title: string
  state: string
  type: string
  boardColumn?: string | null
}

interface TicketsViewProps {
  config: AuthConfig
  items: TicketItem[]
  setItems: React.Dispatch<React.SetStateAction<TicketItem[]>>
}

function getWeekLabel(date: Date): string {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`
  return `${fmt(monday)} - ${fmt(friday)}`
}

function makeHeaders(config: AuthConfig) {
  return {
    'Content-Type': 'application/json',
    'x-azure-pat': config.pat,
    'x-azure-org': config.org,
    'x-azure-project': config.project,
  }
}

// ---- Column color helper ----
const COLUMN_COLORS: Record<string, string> = {}
const PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-green-100 text-green-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
]
let paletteIndex = 0
function columnClass(col: string | null | undefined): string {
  if (!col) return 'bg-gray-100 text-gray-500'
  if (!COLUMN_COLORS[col]) {
    COLUMN_COLORS[col] = PALETTE[paletteIndex % PALETTE.length]
    paletteIndex++
  }
  return COLUMN_COLORS[col]
}

// ---- TicketCard ----
interface TicketCardProps {
  item: TicketItem
  config: AuthConfig
  weekFilter: string
  tree?: WeekTaskType[]
  onLoad: (data: WeekTaskType[]) => void
}

function TicketCard({ item, config, weekFilter, tree, onLoad }: TicketCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingWeekId, setDeletingWeekId] = useState<number | null>(null)
  const [showCreateWeek, setShowCreateWeek] = useState(false)
  const [newWeekTitle, setNewWeekTitle] = useState('')
  const [savingWeek, setSavingWeek] = useState(false)
  const createInputRef = useRef<HTMLInputElement>(null)

  async function loadTree() {
    if (tree !== undefined || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/azure/item-tree?parentId=${item.id}`, {
        headers: makeHeaders(config),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar')
      onLoad(data as WeekTaskType[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar tareas')
    } finally {
      setLoading(false)
    }
  }

  function handleToggle() {
    const next = !expanded
    setExpanded(next)
    if (next) loadTree()
  }

  function openCreateWeek(e: React.MouseEvent) {
    e.stopPropagation()
    setNewWeekTitle(getWeekLabel(new Date()))
    setShowCreateWeek(true)
    setTimeout(() => createInputRef.current?.focus(), 0)
  }

  async function handleDeleteWeekTask(weekTaskId: number) {
    setDeletingWeekId(weekTaskId)
    try {
      const res = await fetch(`/api/azure/task?id=${weekTaskId}`, {
        method: 'DELETE',
        headers: makeHeaders(config),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      onLoad((tree || []).filter((wt) => wt.id !== weekTaskId))
      toast.success('Semana eliminada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar semana')
    } finally {
      setDeletingWeekId(null)
    }
  }

  async function handleCreateWeek() {
    if (!newWeekTitle.trim()) return
    setSavingWeek(true)
    try {
      const res = await fetch('/api/azure/task', {
        method: 'POST',
        headers: makeHeaders(config),
        body: JSON.stringify({ parentId: item.id, title: newWeekTitle.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear')
      const newWeekTask = { ...data, tasks: [] } as WeekTaskType
      onLoad([newWeekTask, ...(tree || [])])
      setShowCreateWeek(false)
      setNewWeekTitle('')
      toast.success('Tarea semanal creada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear tarea semanal')
    } finally {
      setSavingWeek(false)
    }
  }

  const weekTasks = tree ?? null
  const treeLoading = loading && tree === undefined

  const visibleWeekTasks = weekTasks
    ? weekFilter.trim()
      ? weekTasks.filter((wt) =>
          wt.title.toLowerCase().includes(weekFilter.toLowerCase().trim())
        )
      : weekTasks
    : []

  return (
    <Card className="shadow-sm border-gray-200 py-0 gap-0">
      <div
        className="flex items-center gap-2 py-4 px-4 cursor-pointer select-none"
        onClick={handleToggle}
      >
        <span className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </span>
        <Briefcase className="w-4 h-4 text-blue-500 shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge variant="outline" className="text-xs text-gray-400 font-mono shrink-0">
            #{item.id}
          </Badge>
          <span className="font-semibold text-gray-900 truncate">{item.title}</span>
        </div>
        <Badge
          className={`shrink-0 text-xs ${columnClass(item.boardColumn)}`}
          variant="secondary"
        >
          {item.boardColumn || item.state}
        </Badge>
      </div>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="ml-6 space-y-2">
            {/* Create week task */}
            {showCreateWeek ? (
              <div
                className="flex items-center gap-2 pb-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  ref={createInputRef}
                  type="text"
                  value={newWeekTitle}
                  onChange={(e) => setNewWeekTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateWeek()
                    if (e.key === 'Escape') setShowCreateWeek(false)
                  }}
                  placeholder="Nombre de la semana, ej: 7/4 - 11/4"
                  className="flex-1 text-sm border border-blue-300 rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  disabled={savingWeek}
                />
                <Button
                  size="sm"
                  onClick={handleCreateWeek}
                  disabled={savingWeek || !newWeekTitle.trim()}
                  className="shrink-0"
                >
                  {savingWeek ? 'Creando...' : 'Crear'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCreateWeek(false)}
                  disabled={savingWeek}
                  className="shrink-0 text-gray-400"
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 justify-start w-full"
                onClick={openCreateWeek}
              >
                <Plus className="w-4 h-4 mr-1" />
                Crear tarea semanal
              </Button>
            )}

            {/* Week tasks */}
            {treeLoading ? (
              <div className="space-y-2 pt-1">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : visibleWeekTasks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">
                {weekFilter.trim()
                  ? `Sin semanas que coincidan con "${weekFilter}"`
                  : weekTasks !== null
                  ? 'Sin semanas asignadas'
                  : ''}
              </p>
            ) : (
              visibleWeekTasks.map((weekTask) => (
                <WeekTaskComponent
                  key={weekTask.id}
                  weekTask={weekTask}
                  config={config}
                  defaultCliente={item.title}
                  defaultExpanded={false}
                  onDelete={deletingWeekId === weekTask.id ? undefined : () => handleDeleteWeekTask(weekTask.id)}
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

// ---- TicketsView ----
export function TicketsView({ config, items, setItems }: TicketsViewProps) {
  const [loading, setLoading] = useState(false)
  const [weekFilter, setWeekFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [hiddenStates, setHiddenStates] = useState<Set<string>>(new Set())
  const [treesMap, setTreesMap] = useState<Record<number, WeekTaskType[]>>({})
  const preloadingRef = useRef(false)

  useEffect(() => {
    if (items.length === 0) loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Background preload trees as soon as we have the items list
  useEffect(() => {
    if (items.length === 0 || preloadingRef.current) return
    preloadingRef.current = true

    async function preload() {
      const BATCH = 4
      for (let i = 0; i < items.length; i += BATCH) {
        await Promise.all(
          items.slice(i, i + BATCH).map(async (item) => {
            if (treesMap[item.id] !== undefined) return
            try {
              const res = await fetch(`/api/azure/item-tree?parentId=${item.id}`, {
                headers: makeHeaders(config),
              })
              if (!res.ok) return
              const data = await res.json()
              setTreesMap((prev) => ({ ...prev, [item.id]: data as WeekTaskType[] }))
            } catch {
              // silently skip failed preloads
            }
          })
        )
      }
    }

    preload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  async function loadItems() {
    setLoading(true)
    try {
      const res = await fetch('/api/azure/backlog-items', {
        headers: makeHeaders(config),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar')
      setItems(data as TicketItem[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar tickets')
    } finally {
      setLoading(false)
    }
  }

  const allColumns = [...new Set(
    items.map((i) => i.boardColumn || i.state).filter(Boolean)
  )]

  function toggleState(col: string) {
    setHiddenStates((prev) => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
  }

  const filteredItems = items.filter((i) => {
    const col = i.boardColumn || i.state
    if (hiddenStates.has(col)) return false
    if (nameFilter.trim() && !i.title.toLowerCase().includes(nameFilter.toLowerCase().trim()))
      return false
    if (weekFilter.trim() && treesMap[i.id] !== undefined) {
      const q = weekFilter.toLowerCase().trim()
      const hasMatch = treesMap[i.id].some((wt) => wt.title.toLowerCase().includes(q))
      if (!hasMatch) return false
    }
    return true
  })

  return (
    <div>
      {/* Column filter pills */}
      {allColumns.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {allColumns.map((col) => {
            const visible = !hiddenStates.has(col)
            return (
              <button
                key={col}
                onClick={() => toggleState(col)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  visible
                    ? `${columnClass(col)} border-transparent`
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 line-through'
                }`}
              >
                {col}
              </button>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Filtrar por nombre..."
            className="pl-9 bg-white"
          />
        </div>
        <div className="relative flex-1">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            placeholder="Filtrar por semana..."
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-base">No hay tickets disponibles</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <TicketCard
              key={item.id}
              item={item}
              config={config}
              weekFilter={weekFilter}
              tree={treesMap[item.id]}
              onLoad={(data) =>
                setTreesMap((prev) => ({ ...prev, [item.id]: data }))
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
