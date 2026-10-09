'use client'

import { useMemo, useState } from 'react'
import { BacklogItem, WeekTask, TaskItem } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, ChevronDown, ChevronRight } from 'lucide-react'

interface WeekCalendarProps {
  items: BacklogItem[]
  navDate: Date
  className?: string
}

interface CalendarTask {
  id: number
  title: string
  estimatedHours?: number
  projectTitle: string
  projectId: number
}

interface DayData {
  date: Date
  label: string    // "Lun 13/4"
  isToday: boolean
  tasks: CalendarTask[]
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Colores por proyecto (cycling palette)
const PROJECT_PALETTE = [
  { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  { bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-400', badge: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  { bg: 'bg-green-50 dark:bg-green-950/40', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400', badge: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  { bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-400', badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-400', badge: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
  { bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', badge: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  { bg: 'bg-teal-50 dark:bg-teal-950/40', border: 'border-teal-200 dark:border-teal-800', text: 'text-teal-700 dark:text-teal-400', badge: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300' },
]

function getMondayOf(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function isSameDay(a: Date, b: Date): boolean {
  // Usar getFullYear/Month/Date (local) para evitar problemas de timezone
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// Parsear fecha ISO respetando timezone local (no UTC)
function parseLocalDate(iso: string): Date {
  // Azure DevOps devuelve "2026-04-17T00:00:00Z" — convertir a local
  return new Date(iso)
}

export function WeekCalendar({ items, navDate, className = '' }: WeekCalendarProps) {
  const [open, setOpen] = useState(true)
  const { days, projectColorMap } = useMemo(() => {
    const monday = getMondayOf(navDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Build Mon-Fri day slots
    const days: DayData[] = Array.from({ length: 5 }, (_, i) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      return {
        date,
        label: `${DAY_NAMES[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`,
        isToday: isSameDay(date, today),
        tasks: [],
      }
    })

    // Assign a color index per project
    const projectColorMap = new Map<number, number>()
    let colorIdx = 0

    // Walk the tree and place tasks into days
    for (const item of items) {
      if (!projectColorMap.has(item.id)) {
        projectColorMap.set(item.id, colorIdx++ % PROJECT_PALETTE.length)
      }

      for (const weekTask of (item.weekTasks || []) as WeekTask[]) {
        for (const task of (weekTask.tasks || []) as TaskItem[]) {
          if (!task.dueDate) continue
          const due = parseLocalDate(task.dueDate)
          const daySlot = days.find((d) => isSameDay(d.date, due))
          if (!daySlot) continue
          daySlot.tasks.push({
            id: task.id,
            title: task.title,
            estimatedHours: task.estimatedHours,
            projectTitle: item.title,
            projectId: item.id,
          })
        }
      }
    }

    return { days, projectColorMap }
  }, [items, navDate])

  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 mb-3 w-full text-left group"
      >
        <CalendarDays className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex-1">Calendario de la semana</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-transform duration-300 ${open ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>
      <div className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden"><div className="grid grid-cols-5 gap-2 pb-1">
          {days.map((day) => {
            // Group tasks by project within this day
            const byProject = new Map<number, { title: string; colorIdx: number; tasks: CalendarTask[] }>()
            for (const task of day.tasks) {
              if (!byProject.has(task.projectId)) {
                byProject.set(task.projectId, {
                  title: task.projectTitle,
                  colorIdx: projectColorMap.get(task.projectId) ?? 0,
                  tasks: [],
                })
              }
              byProject.get(task.projectId)!.tasks.push(task)
            }

            return (
              <div key={day.label} className="min-w-0">
                {/* Day header */}
                <div
                  className={`text-center text-xs font-semibold mb-1.5 py-1 rounded-md ${day.isToday
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800'
                    }`}
                >
                  {day.label}
                </div>

                {/* Tasks */}
                <div className="space-y-1.5 min-h-[40px]">
                  {day.tasks.length === 0 ? (
                    <div className="h-8 rounded border border-dashed border-gray-200 dark:border-gray-700" />
                  ) : (
                    Array.from(byProject.values()).map((proj) => {
                      const palette = PROJECT_PALETTE[proj.colorIdx]
                      return (
                        <div
                          key={proj.title}
                          className={`rounded-md border px-2 py-1.5 ${palette.bg} ${palette.border}`}
                        >
                          {/* Project name */}
                          <p className={`text-[10px] font-semibold uppercase tracking-wide truncate mb-1 ${palette.text}`}>
                            {proj.title}
                          </p>
                          {/* Tasks */}
                          <div className="space-y-1">
                            {proj.tasks.map((task) => (
                              <div key={task.id} className="flex items-start justify-between gap-1">
                                <span className="text-xs text-gray-700 dark:text-gray-200 leading-tight truncate flex-1">
                                  {task.title}
                                </span>
                                {task.estimatedHours != null && (
                                  <Badge
                                    variant="secondary"
                                    className={`shrink-0 text-[10px] px-1 py-0 h-4 ${palette.badge}`}
                                  >
                                    {task.estimatedHours}h
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div></div></div>
    </div>
  )
}
