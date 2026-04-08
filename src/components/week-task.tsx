'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Calendar } from 'lucide-react'
import { WeekTask as WeekTaskType, TaskItem as TaskItemType } from '@/lib/types'
import { TaskItemComponent } from './task-item'
import { AuthConfig } from '@/lib/types'

interface WeekTaskProps {
  weekTask: WeekTaskType
  config: AuthConfig
  defaultCliente?: string
  onHoursChange?: (delta: number) => void
}

export function WeekTaskComponent({ weekTask, config, defaultCliente, onHoursChange }: WeekTaskProps) {
  const [expanded, setExpanded] = useState(true)
  const tasks = (weekTask.tasks || []) as TaskItemType[]

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
        <Badge variant="outline" className="text-xs text-gray-500">#{weekTask.id}</Badge>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-200/60">
          {tasks.length === 0 ? (
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
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
