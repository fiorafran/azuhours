'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { BacklogItem } from '@/lib/types'
import { BacklogItemCard } from '@/components/backlog-item-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { LogOut, RefreshCw, User, Search, Calendar, BarChart2, Filter, ClockArrowUp, ChevronLeft, ChevronRight, Briefcase, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { TotalsView, ClienteGroup } from '@/components/totals-view'
import { WeekProgress } from '@/components/week-progress'
import { ProyectosView, ProyectoRow } from '@/components/proyectos-view'
import { TicketsView, TicketItem } from '@/components/tickets-view'

type Tab = 'semana' | 'tickets' | 'totales' | 'proyectos'

export default function DashboardPage() {
  const { config, user, loaded, logout } = useAuth()
  const router = useRouter()

  // Semana tab state
  const [items, setItems] = useState<BacklogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [weekInput, setWeekInput] = useState('')
  const [activeWeek, setActiveWeek] = useState('')
  const [weeklyHours, setWeeklyHours] = useState(0)
  const [nameFilter, setNameFilter] = useState('')
  const [navDate, setNavDate] = useState<Date>(() => new Date())

  // Totales tab state — lifted here so it persists across tab switches
  const [totalesData, setTotalesData] = useState<ClienteGroup[]>([])
  const [totalesFrom, setTotalesFrom] = useState('')
  const [totalesTo, setTotalesTo] = useState('')

  // Proyectos tab state — lifted here so it persists across tab switches
  const [proyectosData, setProyectosData] = useState<ProyectoRow[]>([])
  const [showIncompleteProyectos, setShowIncompleteProyectos] = useState(false)

  // Tickets tab state — lifted here so it persists across tab switches
  const [ticketsItems, setTicketsItems] = useState<TicketItem[]>([])

  const [tab, setTab] = useState<Tab>('semana')

  useEffect(() => {
    if (loaded && !config) router.push('/')
    if (loaded && config) {
      const label = getWeekLabel(new Date())
      setWeekInput(label)
      setActiveWeek(label)
      loadItems(label)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  async function loadItems(week: string) {
    if (!config || !week.trim()) return
    setLoading(true)
    setError('')
    setItems([])
    setWeeklyHours(0)
    setNameFilter('')
    try {
      const params = new URLSearchParams({ week: week.trim() })
      const res = await fetch(`/api/azure/work-items?${params}`, {
        headers: {
          'x-azure-pat': config.pat,
          'x-azure-org': config.org,
          'x-azure-project': config.project,
        },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al cargar')
        return
      }
      setItems(data)
      // Calculate initial weekly hours from pre-loaded lineas
      const total = data.reduce((sum: number, ticket: BacklogItem) =>
        sum + (ticket.weekTasks || []).reduce((s2, wt) =>
          s2 + (wt.tasks || []).reduce((s3, task) =>
            s3 + ((task.lineas as { horasLineaProyecto?: number }[]) || [])
              .reduce((s4, l) => s4 + (l.horasLineaProyecto || 0), 0)
          , 0)
        , 0)
      , 0)
      setWeeklyHours(total)
      if (data.length === 0) toast.info(`No se encontraron tareas para "${week.trim()}"`)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!weekInput.trim()) return
    setActiveWeek(weekInput.trim())
    loadItems(weekInput.trim())
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

  function handleNavWeek(direction: -1 | 1) {
    const next = new Date(navDate)
    next.setDate(navDate.getDate() + direction * 7)
    setNavDate(next)
    const label = getWeekLabel(next)
    setWeekInput(label)
    setActiveWeek(label)
    loadItems(label)
  }

  function handleLogout() {
    logout()
    router.push('/')
  }

  if (!loaded) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white rounded-lg p-1.5">
              <ClockArrowUp className="w-5 h-5" />
            </div>
            <span className="font-bold text-gray-900">AzuHours</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user.displayName}</span>
              </div>
            )}
            {tab === 'semana' && activeWeek && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadItems(activeWeek)}
                disabled={loading}
                className="text-gray-500"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            {tab === 'semana' ? 'Mis tareas' : tab === 'tickets' ? 'Mis tickets' : tab === 'totales' ? 'Horas por proyecto' : 'Proyectos'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{config?.org} / {config?.project}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('semana')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'semana' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Por semana
          </button>
          <button
            onClick={() => setTab('tickets')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'tickets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            Tickets
          </button>
          <button
            onClick={() => setTab('totales')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'totales' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Totales
          </button>
          <button
            onClick={() => setTab('proyectos')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'proyectos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Proyectos (beta)
          </button>
        </div>

        {/* Tickets tab */}
        {tab === 'tickets' && (
          <TicketsView
            config={config!}
            items={ticketsItems}
            setItems={setTicketsItems}
          />
        )}

        {/* Proyectos tab */}
        {tab === 'proyectos' && (
          <ProyectosView
            config={config!}
            data={proyectosData}
            setData={setProyectosData}
            showIncomplete={showIncompleteProyectos}
            setShowIncomplete={setShowIncompleteProyectos}
          />
        )}

        {/* Totales tab */}
        {tab === 'totales' && (
          <TotalsView
            config={config!}
            data={totalesData}
            from={totalesFrom}
            to={totalesTo}
            setData={setTotalesData}
            setFrom={setTotalesFrom}
            setTo={setTotalesTo}
          />
        )}

        {/* Semana tab */}
        {tab === 'semana' && (
          <>
            {/* Week date navigator */}
            <div className="flex items-center gap-1.5 mb-3 w-fit">
              <button
                type="button"
                onClick={() => handleNavWeek(-1)}
                disabled={loading}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:border-gray-300 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { const l = getWeekLabel(navDate); setWeekInput(l); setActiveWeek(l); loadItems(l) }}
                disabled={loading}
                className="text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg py-1.5 px-4 hover:border-gray-300 hover:text-gray-900 disabled:opacity-40 transition-colors"
              >
                {getWeekLabel(navDate)}
              </button>
              <button
                type="button"
                onClick={() => handleNavWeek(1)}
                disabled={loading}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:border-gray-300 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={weekInput}
                    onChange={(e) => setWeekInput(e.target.value)}
                    placeholder="Semana, ej: 6/4 - 10/4"
                    className="pl-9"
                  />
                </div>
                <Button type="submit" disabled={loading || !weekInput.trim()}>
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Escribí el nombre exacto de la tarea semanal como aparece en Azure DevOps
              </p>
            </form>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-4 mb-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : !activeWeek ? (
              <div className="text-center py-16 text-gray-400">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-base">Ingresá la semana para ver tus tareas</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-base">
                  No se encontraron tareas para{' '}
                  <strong className="text-gray-600">&ldquo;{activeWeek}&rdquo;</strong>
                </p>
                <p className="text-sm mt-1">
                  Verificá que el nombre coincida exactamente con la tarea en Azure DevOps
                </p>
              </div>
            ) : (
              <>
                {/* Weekly progress bar */}
                <WeekProgress
                  totalHours={weeklyHours}
                  breakdown={items
                    .map((item) => ({
                      title: item.title,
                      hours: Math.round(
                        (item.weekTasks || []).reduce((s, wt) =>
                          s + (wt.tasks || []).reduce((s2, t) =>
                            s2 + ((t.lineas as { horasLineaProyecto?: number }[]) || [])
                              .reduce((s3, l) => s3 + (l.horasLineaProyecto || 0), 0)
                          , 0)
                        , 0) * 100) / 100,
                    }))
                    .filter((p) => p.hours > 0)
                    .sort((a, b) => b.hours - a.hours)
                  }
                />

                {/* Name filter */}
                <div className="relative mb-3">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    placeholder="Filtrar por nombre..."
                    className="pl-9 bg-white"
                  />
                </div>

                <div className="space-y-3">
                  {items
                    .filter((item) => {
                      if (!nameFilter.trim()) return true
                      const q = nameFilter.toLowerCase()
                      return (
                        item.title.toLowerCase().includes(q) ||
                        (item.weekTasks || []).some((wt) =>
                          (wt.tasks || []).some((t) => t.title.toLowerCase().includes(q))
                        )
                      )
                    })
                    .map((item) => (
                      <BacklogItemCard
                        key={item.id}
                        item={item}
                        config={config!}
                        onHoursChange={(delta) => setWeeklyHours((h) => h + delta)}
                      />
                    ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
