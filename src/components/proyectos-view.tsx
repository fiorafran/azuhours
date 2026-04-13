'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CircularProgress } from './circular-progress'
import { AuthConfig } from '@/lib/types'
import { RefreshCw, Pencil, Check, X, Eye, EyeOff } from 'lucide-react'

export interface ProyectoRow {
  id: number
  title: string
  state: string
  horasComercial: number
  horasConsumidas: number
  horasContratadas: number
}

const STORAGE_KEY = 'azuhours_contracted_hours'

function loadOverrides(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function saveOverrides(map: Record<number, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

interface ProyectosViewProps {
  config: AuthConfig
  data: ProyectoRow[]
  setData: (rows: ProyectoRow[]) => void
  showIncomplete: boolean
  setShowIncomplete: (v: boolean) => void
  refreshTrigger?: number
}

export function ProyectosView({ config, data, setData, showIncomplete, setShowIncomplete, refreshTrigger }: ProyectosViewProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  // Only fetch on first mount if no data yet
  const didFetch = useRef(false)
  useEffect(() => {
    if (didFetch.current || data?.length > 0) return
    didFetch.current = true
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!refreshTrigger) return
    fetchData()
  }, [refreshTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editingId !== null) setTimeout(() => editInputRef.current?.select(), 0)
  }, [editingId])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/azure/proyectos', {
        headers: {
          'x-azure-pat': config.pat,
          'x-azure-org': config.org,
          'x-azure-project': config.project,
        },
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Error al cargar'); return }

      const overrides = loadOverrides()
      const mapped: ProyectoRow[] = json.map((p: Omit<ProyectoRow, 'horasContratadas'>) => ({
        ...p,
        horasContratadas: overrides[p.id] ?? p.horasComercial,
      }))
      setData(mapped)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(id: number, current: number) {
    setEditingId(id)
    setEditVal(current > 0 ? String(current) : '')
  }

  function commitEdit(id: number) {
    const parsed = parseFloat(editVal)
    const value = isNaN(parsed) || parsed <= 0 ? 0 : parsed
    const overrides = loadOverrides()
    if (value > 0) overrides[id] = value
    else delete overrides[id]
    saveOverrides(overrides)
    setData(data?.map((r) => r.id === id
      ? { ...r, horasContratadas: value > 0 ? value : r.horasComercial }
      : r
    ))
    setEditingId(null)
  }

  const completeRows = data?.filter((r) => r.horasConsumidas > 0 && r.horasContratadas > 0) || []
  const incompleteRows = data?.filter((r) => r.horasConsumidas === 0 || r.horasContratadas === 0) || []
  const visibleRows = showIncomplete ? data : completeRows

  const totalConsumidas = round2(completeRows.reduce((s, r) => s + r.horasConsumidas, 0))
  const totalContratadas = round2(completeRows.reduce((s, r) => s + r.horasContratadas, 0))
  const totalPct = totalContratadas > 0 ? (totalConsumidas / totalContratadas) * 100 : 0

  return (
    <div>
      {/* Summary header */}
      <div className="flex items-center justify-between mb-4">
        {totalContratadas > 0 ? (
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <CircularProgress pct={totalPct} size={52} stroke={5} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                {Math.round(totalPct)}%
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total general</p>
              <p className="text-sm font-semibold text-gray-800">
                {totalConsumidas}h <span className="font-normal text-gray-400">/ {totalContratadas}h contratadas</span>
              </p>
              <p className="text-xs text-gray-400">{round2(totalContratadas - totalConsumidas)}h restantes</p>
            </div>
          </div>
        ) : <div />}
        <div className="flex items-center gap-1">
          {incompleteRows.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowIncomplete(!showIncomplete)}
              className={`gap-1.5 text-sm ${showIncomplete ? 'text-blue-600' : 'text-gray-400'}`}
              title={showIncomplete ? 'Ocultar incompletos' : `Ver todos (${incompleteRows.length} sin datos)`}
            >
              {showIncomplete ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="text-xs">{incompleteRows.length}</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading} className="text-gray-500">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 mb-4 text-sm text-red-700 break-all">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : data?.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-400">
          <p>No hay proyectos activos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRows.map((row) => {
            const pct = row.horasContratadas > 0 ? (row.horasConsumidas / row.horasContratadas) * 100 : 0
            const restantes = row.horasContratadas > 0 ? round2(row.horasContratadas - row.horasConsumidas) : null
            const isEditing = editingId === row.id
            const barColor = pct >= 100 ? 'bg-red-400' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-500'

            return (
              <div key={row.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <CircularProgress pct={pct} size={60} stroke={6} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                      {row.horasContratadas > 0 ? `${Math.round(pct)}%` : '—'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 truncate">{row.title}</p>
                      <span className="text-xs text-gray-400 shrink-0">{row.state}</span>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-sm text-gray-500">
                        Consumidas: <span className="font-medium text-gray-800">{row.horasConsumidas}h</span>
                      </span>

                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        Propuesta:&nbsp;
                        {isEditing ? (
                          <span className="flex items-center gap-1">
                            <Input
                              ref={editInputRef}
                              type="number"
                              min={0}
                              step="any"
                              value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(row.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              onBlur={() => commitEdit(row.id)}
                              className="w-20 h-6 text-sm px-1 py-0"
                            />
                            <span>h</span>
                            <button onMouseDown={(e) => { e.preventDefault(); commitEdit(row.id) }} className="text-green-600 hover:text-green-800">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onMouseDown={(e) => { e.preventDefault(); setEditingId(null) }} className="text-gray-400 hover:text-gray-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => startEdit(row.id, row.horasContratadas)}
                            className="flex items-center gap-1 font-medium text-gray-800 hover:opacity-70 group"
                          >
                            {row.horasContratadas > 0 ? `${row.horasContratadas}h` : 'Sin datos'}
                            <Pencil className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
                          </button>
                        )}
                      </span>

                      {restantes !== null && (
                        <span className={`text-sm font-medium ${restantes < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {restantes < 0
                            ? `${Math.abs(restantes)}h excedidas`
                            : `${restantes}h restantes`}
                        </span>
                      )}
                    </div>

                    {row.horasContratadas > 0 && (
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
