'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, Pencil, RotateCcw } from 'lucide-react'

const DEFAULT_GOAL = 40
const STORAGE_KEY = 'azuhours_weekly_goal'

interface WeekProgressProps {
  totalHours: number
}

export function WeekProgress({ totalHours }: WeekProgressProps) {
  const [goal, setGoal] = useState(DEFAULT_GOAL)
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

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
    </div>
  )
}
