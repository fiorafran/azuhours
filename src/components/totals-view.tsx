'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, ChevronRight, Clock, Search } from 'lucide-react'
import { AuthConfig } from '@/lib/types'

export interface LineaEntry {
  id: number
  title: string
  horas: number
  tipo: string
  fecha: string
}

export interface ClienteGroup {
  cliente: string
  totalHoras: number
  lineas: LineaEntry[]
}

interface TotalsViewProps {
  config: AuthConfig
  data: ClienteGroup[]
  from: string
  to: string
  setData: (d: ClienteGroup[]) => void
  setFrom: (v: string) => void
  setTo: (v: string) => void
  refreshTrigger?: number
}

function ClienteCard({ group }: { group: ClienteGroup }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="shadow-sm border-gray-200 py-0 gap-0">
      <div
        className="flex items-center gap-3 py-3 px-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="font-semibold text-gray-900 flex-1">{group.cliente}</span>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-800 font-mono text-sm gap-1">
            <Clock className="w-3 h-3" />
            {group.totalHoras}h
          </Badge>
          <span className="text-xs text-gray-400">{group.lineas.length} líneas</span>
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-3">
          <div className="border-t border-gray-100 pt-2 space-y-1">
            <div className="grid grid-cols-4 text-xs font-medium text-gray-400 px-2 pb-1">
              <span>Fecha</span>
              <span>Horas</span>
              <span>Tipo</span>
              <span>Descripción</span>
            </div>
            {group.lineas.map((l) => {
              const [year, month, day] = (l.fecha || '').split('-')
              const fechaFmt = l.fecha ? `${day}/${month}/${String(year).slice(-2)}` : '-'
              return (
                <div key={l.id} className="grid grid-cols-4 text-sm py-1.5 px-2 rounded hover:bg-gray-50">
                  <span className="text-gray-600">{fechaFmt}</span>
                  <span className="font-medium text-blue-700">{l.horas}h</span>
                  <span className="text-gray-500">{l.tipo}</span>
                  <span className="text-gray-400 truncate">{l.title}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function TotalsView({ config, data, from, to, setData, setFrom, setTo, refreshTrigger }: TotalsViewProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(data.length > 0)

  const totalGeneral = data.reduce((sum, g) => sum + g.totalHoras, 0)

  async function fetchTotals() {
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/azure/totals?${params}`, {
        headers: {
          'x-azure-pat': config.pat,
          'x-azure-org': config.org,
          'x-azure-project': config.project,
        },
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Error al cargar')
        return
      }
      setData(json)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchTotals()
  }

  useEffect(() => {
    if (!refreshTrigger || !searched) return
    fetchTotals()
  }, [refreshTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-sm">Desde</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-sm">Hasta</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button type="submit" disabled={loading}>
            <Search className="w-4 h-4 mr-2" />
            {loading ? 'Cargando...' : 'Consultar'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Dejá vacío para ver todas las horas cargadas</p>
      </form>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : searched && data.length === 0 && !error ? (
        <div className="text-center py-12 text-gray-400">
          <p>No se encontraron líneas{from || to ? ' en el período seleccionado' : ''}</p>
        </div>
      ) : data.length > 0 ? (
        <>
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-blue-800">
              Total · {data.length} proyecto{data.length !== 1 ? 's' : ''}
            </span>
            <Badge className="bg-blue-600 text-white text-base px-3 py-1 font-mono">
              {totalGeneral}h
            </Badge>
          </div>
          <div className="space-y-2">
            {data.map((group) => (
              <ClienteCard key={group.cliente} group={group} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
