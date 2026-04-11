'use client'

import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Calendar, Plus, Trash2, Check, X } from 'lucide-react'
import { WeekTask as WeekTaskType, TaskItem as TaskItemType } from '@/lib/types'
import { TaskItemComponent } from './task-item'
import { AuthConfig } from '@/lib/types'
import { toast } from 'sonner'

interface WeekTaskProps {
  weekTask: WeekTaskType
  config: AuthConfig
  defaultCliente?: string
  onHoursChange?: (delta: number) => void
  defaultExpanded?: boolean
  onDelete?: () => void
  canDeleteTasks?: boolean
}

function DeleteConfirm({ onConfirm, label }: { onConfirm: (e: React.MouseEvent) => void; label: string }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <span
        className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5 animate-in fade-in-0 zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-red-600 font-medium whitespace-nowrap">¿Eliminar {label}?</span>
        <button
          onClick={(e) => { onConfirm(e); setConfirming(false) }}
          className="text-red-500 hover:text-red-700 transition-colors p-0.5 rounded hover:bg-red-100"
          title="Confirmar"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(false) }}
          className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded hover:bg-gray-100"
          title="Cancelar"
        >
          <X className="w-4 h-4" />
        </button>
      </span>
    )
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
      className="text-gray-300 hover:text-red-500 transition-colors"
      title={`Eliminar ${label}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}

function makeHeaders(config: AuthConfig) {
  return {
    'Content-Type': 'application/json',
    'x-azure-pat': config.pat,
    'x-azure-org': config.org,
    'x-azure-project': config.project,
  }
}

export function WeekTaskComponent({ weekTask, config, defaultCliente, onHoursChange, defaultExpanded = true, onDelete, canDeleteTasks }: WeekTaskProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [tasks, setTasks] = useState<TaskItemType[]>((weekTask.tasks || []) as TaskItemType[])
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [savingTask, setSavingTask] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleDeleteTask(taskId: number) {
    const taskToDelete = tasks.find((t) => t.id === taskId)
    const res = await fetch(`/api/azure/task?id=${taskId}`, {
      method: 'DELETE',
      headers: makeHeaders(config),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Error al eliminar tarea')
      return
    }
    if (taskToDelete && onHoursChange) {
      const taskHours = (taskToDelete.lineas || []).reduce(
        (sum, l) => sum + (((l as { horasLineaProyecto?: number }).horasLineaProyecto) || 0),
        0
      )
      if (taskHours > 0) onHoursChange(-taskHours)
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    toast.success('Tarea eliminada')
  }

  function openNewTask(e: React.MouseEvent) {
    e.stopPropagation()
    setNewTaskTitle('')
    setShowNewTask(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function handleSaveTask() {
    if (!newTaskTitle.trim()) return
    setSavingTask(true)
    try {
      const res = await fetch('/api/azure/task', {
        method: 'POST',
        headers: makeHeaders(config),
        body: JSON.stringify({ parentId: weekTask.id, title: newTaskTitle.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear tarea')
      setTasks((prev) => [...prev, data as TaskItemType])
      setShowNewTask(false)
      setNewTaskTitle('')
      toast.success('Tarea creada correctamente')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear tarea')
    } finally {
      setSavingTask(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50/50">
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-100/60 rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-700 flex-1">{weekTask.title}</span>
        {onDelete && <DeleteConfirm onConfirm={(e) => { e.stopPropagation(); onDelete() }} label="semana" />}
        <Badge variant="outline" className="text-xs text-gray-500">#{weekTask.id}</Badge>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-200/60">
          {tasks.length === 0 && !showNewTask ? (
            <p className="text-sm text-gray-400 py-2 text-center">Sin tareas en esta semana</p>
          ) : (
            <div className="pt-2 space-y-2">
              {tasks.map((task) => (
                <TaskItemComponent
                  key={task.id}
                  task={task}
                  config={config}
                  defaultCliente={defaultCliente}
                  onHoursChange={onHoursChange}
                  onDelete={canDeleteTasks ? () => handleDeleteTask(task.id) : undefined}
                />
              ))}
            </div>
          )}

          {showNewTask ? (
            <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTask()
                  if (e.key === 'Escape') { setShowNewTask(false); setNewTaskTitle('') }
                }}
                placeholder="Nombre de la tarea..."
                className="flex-1 text-sm border border-blue-300 rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                disabled={savingTask}
              />
              <Button
                size="sm"
                onClick={handleSaveTask}
                disabled={savingTask || !newTaskTitle.trim()}
                className="shrink-0"
              >
                {savingTask ? 'Guardando...' : 'Crear'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowNewTask(false); setNewTaskTitle('') }}
                disabled={savingTask}
                className="shrink-0 text-gray-400"
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 w-full justify-start"
              onClick={openNewTask}
            >
              <Plus className="w-4 h-4 mr-1" />
              Crear tarea
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
