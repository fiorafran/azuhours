'use client'

interface CircularProgressProps {
  pct: number // 0-100+
  size?: number
  stroke?: number
}

export function CircularProgress({ pct, size = 64, stroke = 6 }: CircularProgressProps) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.min(pct, 100)
  const offset = circ - (clamped / 100) * circ

  const color =
    pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  )
}
