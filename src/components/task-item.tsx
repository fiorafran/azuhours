'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Plus, Clock, Trash2, Check, X } from 'lucide-react'
import { TaskItem as TaskItemType, LineaItem } from '@/lib/types'
import { LineaRow } from './linea-row'
import { LineaForm, LineaFormValues } from './linea-form'
import { toast } from 'sonner'
import { AuthConfig } from '@/lib/types'

interface TaskItemProps {
  task: TaskItemType
  config: AuthConfig
  defaultCliente?: string
  onHoursChange?: (delta: number) => void
  onDelete?: () => void
}

function DeleteConfirm({ onConfirm }: { onConfirm: (e: React.MouseEvent) => void }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <span
        className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5 animate-in fade-in-0 zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-red-600 font-medium whitespace-nowrap">¿Eliminar?</span>
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
      className="text-gray-300 hover:text-red-500 transition-colors ml-1"
      title="Eliminar tarea"
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

export function TaskItemComponent({ task, config, defaultCliente, onHoursChange, onDelete }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [lineas, setLineas] = useState<LineaItem[]>((task.lineas as LineaItem[]) || [])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editLinea, setEditLinea] = useState<LineaItem | null>(null)

  const totalHoras = lineas.reduce((sum, l) => sum + (l.horasLineaProyecto || 0), 0)

  async function handleAddLinea(values: LineaFormValues) {
    const res = await fetch('/api/azure/linea', {
      method: 'POST',
      headers: makeHeaders(config),
      body: JSON.stringify({
        parentId: task.id,
        horas: values.horas,
        tipoHora: values.tipoHora,
        fecha: values.fecha,
        cliente: values.cliente,
        title: values.title,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al crear línea')
    const newLinea = data as LineaItem
    setLineas((prev) => [...prev, newLinea])
    onHoursChange?.(newLinea.horasLineaProyecto || 0)
    toast.success('Horas cargadas correctamente')
  }

  async function handleEditLinea(values: LineaFormValues) {
    if (!editLinea) return
    const res = await fetch('/api/azure/linea', {
      method: 'PATCH',
      headers: makeHeaders(config),
      body: JSON.stringify({
        id: editLinea.id,
        horas: values.horas,
        tipoHora: values.tipoHora,
        fecha: values.fecha,
        cliente: values.cliente,
        title: values.title,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al actualizar línea')
    const updated = data as LineaItem
    setLineas((prev) => prev.map((l) => (l.id === editLinea.id ? updated : l)))
    onHoursChange?.((updated.horasLineaProyecto || 0) - (editLinea.horasLineaProyecto || 0))
    toast.success('Línea actualizada')
    setEditLinea(null)
  }

  async function handleDeleteLinea(lineaId: number) {
    const res = await fetch(`/api/azure/linea?id=${lineaId}`, {
      method: 'DELETE',
      headers: makeHeaders(config),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al eliminar línea')
    const deleted = lineas.find((l) => l.id === lineaId)
    setLineas((prev) => prev.filter((l) => l.id !== lineaId))
    onHoursChange?.(-(deleted?.horasLineaProyecto || 0))
    toast.success('Línea eliminada')
  }

  return (
    <div className="border border-gray-100 rounded-lg bg-white">
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">{task.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {totalHoras > 0 && (
            <Badge variant="outline" className="text-xs gap-1 text-blue-700 border-blue-200">
              <Clock className="w-3 h-3" />
              {totalHoras}h cargadas
            </Badge>
          )}
          {task.estimatedHours != null && task.estimatedHours > 0 && (
            <Badge variant="secondary" className="text-xs text-gray-500">
              {task.estimatedHours}h est.
            </Badge>
          )}
          {onDelete && <DeleteConfirm onConfirm={(e) => { e.stopPropagation(); onDelete() }} />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-50">
          <div className="pt-1">
            {lineas.length === 0 && (
              <p className="text-sm text-gray-400 py-2 text-center">Sin horas cargadas aún</p>
            )}
            <div className="divide-y divide-gray-50">
              {lineas.map((linea) => (
                <LineaRow
                  key={linea.id}
                  linea={linea}
                  onEdit={() => setEditLinea(linea)}
                  onDelete={() => handleDeleteLinea(linea.id)}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 w-full justify-start"
              onClick={(e) => { e.stopPropagation(); setShowAddForm(true) }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Agregar horas
            </Button>
          </div>
        </div>
      )}

      <LineaForm
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSave={handleAddLinea}
        defaultCliente={defaultCliente}
      />
      <LineaForm
        open={!!editLinea}
        onClose={() => setEditLinea(null)}
        onSave={handleEditLinea}
        defaultCliente={defaultCliente}
        editLinea={editLinea}
      />
    </div>
  )
}
