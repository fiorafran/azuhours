'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface DueDatePickerProps {
  // "yyyy-mm-dd" o '' si no hay fecha
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const WEEK_DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type Segment = 'd' | 'm' | 'y'
type Segments = Record<Segment, string>

const SEGMENT_ORDER: Segment[] = ['d', 'm', 'y']
const EMPTY: Segments = { d: '', m: '', y: '' }

function valueToSegments(value: string): Segments {
  if (!value) return EMPTY
  const [y, m, d] = value.split('-')
  return { d, m, y }
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

// Segmentos completos → "yyyy-mm-dd" (ajusta el día al último del mes, ej. 31/02 → 28/02)
function segmentsToValue(s: Segments): string | null {
  if (!s.d || !s.m || s.y.length !== 4) return null
  const year = Number(s.y)
  const month = Number(s.m)
  if (year < 2000 || year > 2099 || month < 1 || month > 12) return null
  const day = Math.min(Math.max(1, Number(s.d)), daysInMonth(year, month))
  return `${year}-${pad(month)}-${pad(day)}`
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // lunes = 0
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

export function DueDatePicker({ value, onChange, disabled }: DueDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [segs, setSegs] = useState<Segments>(() => valueToSegments(value))
  const [viewMonth, setViewMonth] = useState(() => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date()
    return { year: base.getFullYear(), month: base.getMonth() }
  })
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRefs = useRef<Record<Segment, HTMLInputElement | null>>({ d: null, m: null, y: null })
  // Al entrar a un segmento, el primer dígito reemplaza el contenido (como el input nativo)
  const freshRef = useRef(true)
  // finish/cancel ya resolvieron el valor: el blur que provocan no debe volver a guardar
  const skipBlurRef = useRef(false)

  // Sincronizar si el valor cambia desde afuera (guardado / rollback)
  useEffect(() => {
    setSegs(valueToSegments(value))
  }, [value])

  // El calendario sigue al mes/año que se va escribiendo
  useEffect(() => {
    const month = Number(segs.m)
    if (segs.y.length === 4 && month >= 1 && month <= 12) {
      setViewMonth({ year: Number(segs.y), month: month - 1 })
    }
  }, [segs.m, segs.y])

  function commit(next: string) {
    if (next !== value) onChange(next)
    setSegs(valueToSegments(next))
  }

  // Guardar lo escrito si está completo; vacío = quitar; incompleto = volver al valor anterior
  function commitSegments(current: Segments = segs) {
    if (!current.d && !current.m && !current.y) {
      commit('')
      return
    }
    const next = segmentsToValue(current)
    if (next) commit(next)
    else setSegs(valueToSegments(value))
  }

  function finish(current: Segments = segs) {
    setOpen(false)
    commitSegments(current)
    skipBlurRef.current = true
    ;(document.activeElement as HTMLElement | null)?.blur()
    skipBlurRef.current = false
  }

  function cancel() {
    setOpen(false)
    setSegs(valueToSegments(value))
    skipBlurRef.current = true
    ;(document.activeElement as HTMLElement | null)?.blur()
    skipBlurRef.current = false
  }

  function openPicker() {
    if (disabled || open) return
    const base = segmentsToValue(segs) ?? value
    const d = base ? new Date(`${base}T00:00:00`) : new Date()
    setViewMonth({ year: d.getFullYear(), month: d.getMonth() })
    setOpen(true)
  }

  function focusSegment(seg: Segment) {
    inputRefs.current[seg]?.focus()
  }

  function moveSegment(from: Segment, delta: number) {
    const next = SEGMENT_ORDER[SEGMENT_ORDER.indexOf(from) + delta]
    if (next) focusSegment(next)
  }

  function typeDigit(seg: Segment, digit: string) {
    const current = freshRef.current ? '' : segs[seg]
    freshRef.current = false
    let next = current + digit
    let advance = false

    if (seg === 'd') {
      // "4".."9" no pueden empezar un día de dos cifras → se completa solo
      if (next.length === 2 || Number(next) > 3) {
        next = pad(Math.min(31, Math.max(1, Number(next))))
        advance = true
      }
    } else if (seg === 'm') {
      if (next.length === 2 || Number(next) > 1) {
        next = pad(Math.min(12, Math.max(1, Number(next))))
        advance = true
      }
    } else {
      next = next.slice(0, 4)
    }

    const updated = { ...segs, [seg]: next }
    setSegs(updated)
    if (advance) moveSegment(seg, 1)
    else if (seg === 'y' && next.length === 4 && segmentsToValue(updated)) finish(updated)
  }

  function stepSegment(seg: Segment, delta: number) {
    const now = new Date()
    const limits = { d: [1, 31], m: [1, 12], y: [2000, 2099] }[seg]
    const fallback = { d: now.getDate(), m: now.getMonth() + 1, y: now.getFullYear() }[seg]
    const cur = segs[seg] ? Number(segs[seg]) : fallback - delta
    let next = cur + delta
    if (next > limits[1]) next = limits[0]
    if (next < limits[0]) next = limits[1]
    freshRef.current = true
    setSegs({ ...segs, [seg]: seg === 'y' ? String(next) : pad(next) })
  }

  function handleKeyDown(seg: Segment, e: React.KeyboardEvent<HTMLInputElement>) {
    if (/^\d$/.test(e.key)) {
      e.preventDefault()
      typeDigit(seg, e.key)
      return
    }
    switch (e.key) {
      case 'Tab':
        // Tab / Shift+Tab recorren día → mes → año; al salir del último se guarda (onBlur)
        return
      case 'Backspace':
      case 'Delete':
        e.preventDefault()
        if (!segs[seg]) moveSegment(seg, -1)
        else setSegs({ ...segs, [seg]: freshRef.current ? '' : segs[seg].slice(0, -1) })
        freshRef.current = false
        return
      case 'ArrowLeft':
        e.preventDefault()
        moveSegment(seg, -1)
        return
      case 'ArrowRight':
      case '/':
      case '-':
      case '.':
        e.preventDefault()
        moveSegment(seg, 1)
        return
      case 'ArrowUp':
        e.preventDefault()
        stepSegment(seg, 1)
        return
      case 'ArrowDown':
        e.preventDefault()
        stepSegment(seg, -1)
        return
      case 'Enter':
        e.preventDefault()
        finish()
        return
      case 'Escape':
        e.preventDefault()
        cancel()
        return
      default:
        // Bloquear cualquier otro caracter (letras, etc.)
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) e.preventDefault()
    }
  }

  // Posicionar el calendario debajo del control (fixed, para no quedar recortado por las cards)
  useLayoutEffect(() => {
    if (!open) return
    function update() {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = 240
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
      const below = rect.bottom + 6
      const top = below + 290 > window.innerHeight ? Math.max(8, rect.top - 296) : below
      setPosition({ top, left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  function shiftMonth(delta: number) {
    setViewMonth(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const todayValue = toValue(new Date())
  const selected = segmentsToValue(segs) ?? value
  const grid = buildMonthGrid(viewMonth.year, viewMonth.month)
  const hasAny = !!(segs.d || segs.m || segs.y)

  return (
    <div
      ref={anchorRef}
      className={`flex items-center gap-1 rounded-md border px-1.5 h-6 text-xs transition-colors ${
        value
          ? 'border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40'
          : 'border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'
      } ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-violet-400 dark:hover:border-violet-600'} ${
        open ? 'border-violet-400 dark:border-violet-600' : ''
      }`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        // Click fuera de los segmentos (ícono, borde, separadores): enfocar el día y abrir
        if (disabled || (e.target as HTMLElement).closest('input, button')) return
        e.preventDefault()
        if (!anchorRef.current?.contains(document.activeElement)) focusSegment('d')
        openPicker()
      }}
      onBlur={(e) => {
        if (skipBlurRef.current) return
        const next = e.relatedTarget as Node | null
        if (next && (anchorRef.current?.contains(next) || popoverRef.current?.contains(next))) return
        if (open || hasAny || value) {
          setOpen(false)
          commitSegments()
        }
      }}
      title={value ? 'Día asignado' : 'Asignar día'}
    >
      <CalendarDays className="w-3 h-3 shrink-0" />
      <div className="flex items-center tabular-nums">
        {SEGMENT_ORDER.map((seg, i) => (
          <span key={seg} className="flex items-center">
            {i > 0 && <span className={hasAny ? '' : 'text-gray-400 dark:text-gray-500'}>/</span>}
            <input
              ref={(el) => { inputRefs.current[seg] = el }}
              type="text"
              inputMode="numeric"
              value={segs[seg]}
              placeholder={seg === 'y' ? 'aaaa' : seg === 'd' ? 'dd' : 'mm'}
              onChange={(e) => {
                // Fallback para entradas sin keydown (teclados móviles, pegado): tomar el último dígito
                const digit = e.target.value.replace(/\D/g, '').slice(-1)
                if (digit) typeDigit(seg, digit)
              }}
              onKeyDown={(e) => handleKeyDown(seg, e)}
              onFocus={(e) => {
                freshRef.current = true
                e.target.select()
                openPicker()
              }}
              onClick={(e) => e.currentTarget.select()}
              disabled={disabled}
              aria-label={seg === 'd' ? 'Día' : seg === 'm' ? 'Mes' : 'Año'}
              className={`bg-transparent outline-none text-xs text-center cursor-pointer rounded-sm caret-transparent focus:bg-violet-200 dark:focus:bg-violet-800 selection:bg-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                seg === 'y' ? 'w-[4.2ch]' : 'w-[2.4ch]'
              }`}
            />
          </span>
        ))}
      </div>
      {value && (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(false); commit('') }}
          disabled={disabled}
          tabIndex={-1}
          className="hover:text-red-500 transition-colors"
          title="Quitar día"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {open && position && createPortal(
        <div
          ref={popoverRef}
          style={{ top: position.top, left: position.left }}
          className="fixed z-50 w-60 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 animate-in fade-in-0 zoom-in-95 duration-100"
          // Mantener el foco en el input mientras se usa el calendario
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1.5">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {MONTHS[viewMonth.month]} {viewMonth.year}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEK_DAYS.map((d) => (
              <span key={d} className="text-[10px] font-medium text-gray-400 dark:text-gray-500 py-0.5">{d}</span>
            ))}
            {grid.map((d) => {
              const v = toValue(d)
              const inMonth = d.getMonth() === viewMonth.month
              const isSelected = v === selected
              const isToday = v === todayValue
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <button
                  key={v}
                  onClick={() => { finish(valueToSegments(v)) }}
                  className={`h-7 rounded text-xs transition-colors ${
                    isSelected
                      ? 'bg-violet-600 text-white font-semibold'
                      : isToday
                        ? 'ring-1 ring-blue-500 text-blue-600 dark:text-blue-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800'
                        : `hover:bg-gray-100 dark:hover:bg-gray-800 ${
                            inMonth
                              ? isWeekend ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'
                              : 'text-gray-300 dark:text-gray-600'
                          }`
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
          <div className="flex justify-between mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => { finish(valueToSegments(todayValue)) }}
              className="text-xs text-violet-600 dark:text-violet-400 hover:underline px-1"
            >
              Hoy
            </button>
            {value && (
              <button
                onClick={() => { finish(EMPTY) }}
                className="text-xs text-gray-400 hover:text-red-500 px-1"
              >
                Quitar
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
