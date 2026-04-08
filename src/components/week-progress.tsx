'use client'

import { Clock } from 'lucide-react'

const WEEKLY_GOAL = 40

interface WeekProgressProps {
  totalHours: number
}

export function WeekProgress({ totalHours }: WeekProgressProps) {
  const pct = Math.min((totalHours / WEEKLY_GOAL) * 100, 100)
  const over = totalHours > WEEKLY_GOAL
  const color =
    pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'
  const textColor =
    pct >= 100 ? 'text-green-700' : pct >= 75 ? 'text-blue-700' : pct >= 50 ? 'text-yellow-700' : 'text-red-600'

  return (
    <div className="mb-5 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>Progreso semanal</span>
        </div>
        <span className={`text-sm font-semibold font-mono ${textColor}`}>
          {totalHours}h / {WEEKLY_GOAL}h
          {over && (
            <span className="text-xs font-normal text-gray-400 ml-1">
              (+{totalHours - WEEKLY_GOAL}h extra)
            </span>
          )}
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-300 mt-1">
        <span>0h</span>
        <span>20h</span>
        <span>40h</span>
      </div>
    </div>
  )
}
