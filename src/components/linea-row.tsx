'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { LineaItem } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface LineaRowProps {
  linea: LineaItem
  onEdit: () => void
  onDelete: () => Promise<void>
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return '-'
  try {
    // Parse YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ without timezone shifting
    const [datePart] = dateStr.split('T')
    const [year, month, day] = datePart.split('-')
    return `${day}/${month}/${String(year).slice(-2)}`
  } catch {
    return dateStr
  }
}

export function LineaRow({ linea, onEdit, onDelete }: LineaRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50 group">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Badge variant="secondary" className="font-mono text-sm shrink-0 bg-blue-100 text-blue-800">
            {linea.horasLineaProyecto}h
          </Badge>
          <span className="text-sm text-gray-600 shrink-0">{linea.tipoHora || 'Estandar'}</span>
          <span className="text-sm text-gray-500 shrink-0">
            {formatDate(linea.fechaLinea)}
          </span>
          {linea.cliente && (
            <span className="text-sm text-gray-400 truncate">{linea.cliente}</span>
          )}
          {linea.title && linea.title !== String(linea.horasLineaProyecto) && (
            <span className="text-sm text-gray-400 truncate italic">{linea.title}</span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
            onClick={onEdit}
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
            onClick={() => setConfirmDelete(true)}
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar línea</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            ¿Estás seguro de eliminar la línea de{' '}
            <strong>{linea.horasLineaProyecto}h</strong>
            {linea.fechaLinea ? ` del ${formatDate(linea.fechaLinea)}` : ''}?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
