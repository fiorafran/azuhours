'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { LineaItem } from '@/lib/types'

interface LineaFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: LineaFormValues) => Promise<void>
  defaultCliente?: string
  editLinea?: LineaItem | null
}

export interface LineaFormValues {
  horas: number
  tipoHora: string
  fecha: string
  cliente: string
  title?: string
}

const TIPOS_HORA = ['Estandar', 'Extra', 'Feriado', 'Guardia']

export function LineaForm({ open, onClose, onSave, defaultCliente, editLinea }: LineaFormProps) {
  const [horas, setHoras] = useState('')
  const [tipoHora, setTipoHora] = useState('Estandar')
  const [fecha, setFecha] = useState('')
  const [cliente, setCliente] = useState(defaultCliente || '')
  const [customTitle, setCustomTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (editLinea) {
        setHoras(String(editLinea.horasLineaProyecto || ''))
        setTipoHora(editLinea.tipoHora || 'Estandar')
        setFecha(editLinea.fechaLinea ? editLinea.fechaLinea.split('T')[0] : today())
        setCliente(editLinea.cliente || defaultCliente || '')
        // If the existing title differs from the hours value, pre-enable custom title
        const existingTitle = editLinea.title || ''
        const isCustom = existingTitle !== String(editLinea.horasLineaProyecto || '')
        setCustomTitle(isCustom)
        setTitle(isCustom ? existingTitle : '')
      } else {
        setHoras('')
        setTipoHora('Estandar')
        setFecha(today())
        setCliente(defaultCliente || '')
        setCustomTitle(false)
        setTitle('')
      }
      setError('')
    }
  }, [open, editLinea, defaultCliente])

  function today() {
    return new Date().toISOString().split('T')[0]
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!horas || !tipoHora || !fecha) {
      setError('Completá todos los campos obligatorios.')
      return
    }
    const horasNum = parseFloat(horas)
    if (isNaN(horasNum) || horasNum <= 0) {
      setError('Las horas deben ser un número positivo.')
      return
    }

    setError('')
    setLoading(true)
    try {
      await onSave({
        horas: horasNum,
        tipoHora,
        fecha,
        cliente,
        title: customTitle && title.trim() ? title.trim() : undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editLinea ? 'Editar horas' : 'Agregar horas'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="horas">
                Horas <span className="text-red-500">*</span>
              </Label>
              <Input
                id="horas"
                type="number"
                step="0.5"
                min="0.5"
                value={horas}
                onChange={(e) => setHoras(e.target.value)}
                placeholder="ej: 3"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tipoHora">
                Tipo de hora <span className="text-red-500">*</span>
              </Label>
              <Select value={tipoHora} onValueChange={(v) => setTipoHora(v ?? 'Estandar')}>
                <SelectTrigger id="tipoHora">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_HORA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="fecha">
                Fecha <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Cliente"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="customTitleSwitch" className="text-sm text-gray-600 cursor-pointer">
                Título personalizado
              </Label>
              <Switch
                id="customTitleSwitch"
                checked={customTitle}
                onCheckedChange={(v: boolean) => {
                  setCustomTitle(v)
                  if (!v) setTitle('')
                }}
              />
            </div>
            {customTitle && (
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título de la línea"
              />
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 max-h-28 overflow-y-auto break-all">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editLinea ? (
                'Guardar cambios'
              ) : (
                'Agregar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
