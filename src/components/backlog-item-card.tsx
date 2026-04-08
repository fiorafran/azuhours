'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Briefcase } from 'lucide-react'
import { BacklogItem, WeekTask as WeekTaskType } from '@/lib/types'
import { WeekTaskComponent } from './week-task'
import { AuthConfig } from '@/lib/types'

interface BacklogItemCardProps {
  item: BacklogItem
  config: AuthConfig
  onHoursChange?: (delta: number) => void
}

export function BacklogItemCard({ item, config, onHoursChange }: BacklogItemCardProps) {
  const [expanded, setExpanded] = useState(false)

  const weekTasks = (item.weekTasks || []) as WeekTaskType[]

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader className="pb-2 pt-4 px-4">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <button className="text-gray-400 shrink-0">
            {expanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
          <Briefcase className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Badge variant="outline" className="text-xs text-gray-400 font-mono shrink-0">
              #{item.id}
            </Badge>
            <span className="font-semibold text-gray-900 truncate">{item.title}</span>
          </div>
          <Badge
            className={`shrink-0 text-xs ${
              item.state === 'Closed'
                ? 'bg-gray-100 text-gray-500'
                : 'bg-blue-100 text-blue-700'
            }`}
            variant="secondary"
          >
            {item.state}
          </Badge>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="ml-6 space-y-2">
            {weekTasks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">Sin semanas asignadas</p>
            ) : (
              weekTasks.map((weekTask) => (
                <WeekTaskComponent
                  key={weekTask.id}
                  weekTask={weekTask}
                  config={config}
                  defaultCliente={item.clienteName || item.title}
                  onHoursChange={onHoursChange}
                />
              ))
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
