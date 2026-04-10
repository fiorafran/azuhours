'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, Pencil, RotateCcw, ChevronDown } from 'lucide-react'

const DEFAULT_GOAL = 40
const STORAGE_KEY = 'azuhours_weekly_goal'

interface ProjectBreakdown {
  title: string
  hours: number
}

interface WeekProgressProps {
  totalHours: number
  breakdown?: ProjectBreakdown[]
}

export function WeekProgress({ totalHours, breakdown = [] }: WeekProgressProps) {
  const [goal, setGoal] = useState(DEFAULT_GOAL)
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const breakdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored)
      if (!isNaN(parsed) && parsed > 0) setGoal(parsed)
    }
  }, [])

  useEffect(() => {
    if (editing) {
      setInputVal(String(goal))
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [editing, goal])

  function commitEdit() {
    const parsed = parseInt(inputVal)
    if (!isNaN(parsed) && parsed > 0) {
      setGoal(parsed)
      localStorage.setItem(STORAGE_KEY, String(parsed))
    }
    setEditing(false)
  }

  function resetGoal() {
    setGoal(DEFAULT_GOAL)
    localStorage.removeItem(STORAGE_KEY)
    setEditing(false)
  }

  const pct = Math.min((totalHours / goal) * 100, 100)
  const over = totalHours > goal
  const color =
    pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'
  const textColor =
    pct >= 100 ? 'text-green-700' : pct >= 75 ? 'text-blue-700' : pct >= 50 ? 'text-yellow-700' : 'text-red-600'

  const mid = Math.round(goal / 2)

  return (
    <div className="mb-5 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>Progreso semanal</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold font-mono ${textColor}`}>
            {totalHours}h /&nbsp;
          </span>

          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="number"
                min={1}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditing(false)
                }}
                onBlur={commitEdit}
                className="w-14 text-sm font-semibold font-mono text-center border border-blue-400 rounded px-1 py-0 outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className={`text-sm font-semibold font-mono ${textColor}`}>h</span>
              {goal !== DEFAULT_GOAL && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); resetGoal() }}
                  className="text-gray-400 hover:text-gray-600 ml-1"
                  title="Volver a 40h"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className={`flex items-center gap-1 text-sm font-semibold font-mono ${textColor} hover:opacity-70 group`}
              title="Cambiar meta semanal"
            >
              {goal}h
              {over && (
                <span className="text-xs font-normal text-gray-400 ml-1">
                  (+{totalHours - goal}h extra)
                </span>
              )}
              <Pencil className="w-3 h-3 text-gray-300 group-hover:text-gray-500 ml-0.5" />
            </button>
          )}
        </div>
      </div>

      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-300 mt-1">
        <span>0h</span>
        <span>{mid}h</span>
        <span>{goal}h</span>
      </div>

      {breakdown.length > 0 && (
        <div className="mt-2 border-t border-gray-100">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between pt-2 pb-0.5 text-xs text-gray-400 hover:text-gray-600 transition-colors group"
          >
            <span className="font-medium">
              {breakdown.length} proyecto{breakdown.length !== 1 ? 's' : ''} con horas
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>

          <div
            style={{
              display: 'grid',
              gridTemplateRows: expanded ? '1fr' : '0fr',
              transition: 'grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div ref={breakdownRef} className="overflow-hidden">
              <div className="space-y-2 pt-2 pb-0.5">
                {breakdown.map((p) => {
                  const pPct = Math.min((p.hours / totalHours) * 100, 100)
                  return (
                    <div key={p.title} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 truncate flex-1 min-w-0">{p.title}</span>
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full bg-blue-400 transition-all duration-500"
                          style={{ width: expanded ? `${pPct}%` : '0%' }}
                        />
                      </div>
                      <span className="text-xs font-mono font-medium text-gray-600 w-10 text-right shrink-0">
                        {p.hours}h
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
