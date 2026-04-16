import { NextRequest, NextResponse } from 'next/server'

// ── In-memory sliding window store ──────────────────────────────────────────
interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

// Prune expired entries every 2 minutes
const PRUNE_INTERVAL = 120_000
let pruneTimer: ReturnType<typeof setInterval> | null = null
function ensurePruner() {
  if (pruneTimer) return
  pruneTimer = setInterval(() => {
    const now = Date.now()
    for (const [k, v] of store) if (v.resetAt < now) store.delete(k)
  }, PRUNE_INTERVAL)
}

function consume(key: string, limit: number, windowMs: number): boolean {
  ensurePruner()
  const now = Date.now()
  const bucket = store.get(key)
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count++
  return true
}

// ── IP extraction ────────────────────────────────────────────────────────────
export function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'local'
  )
}

// ── PAT validation ───────────────────────────────────────────────────────────
// Azure DevOps PATs are base64url strings, typically 52–84 chars
const PAT_RE = /^[A-Za-z0-9+/=]{20,100}$/
export function isValidPat(pat: string): boolean {
  return PAT_RE.test(pat)
}

// ── Limits ───────────────────────────────────────────────────────────────────
const WINDOW_MS = 60_000 // 1 minute

// Reads: generous limit (calendar, preloads, etc.)
const READ_LIMIT = 120
// Writes: strict (create/update/delete lineas, tasks)
const WRITE_LIMIT = 30
// Heavy reads: WIQL + batch fetches (work-items full tree)
// Tickets tab preloads ~N item-trees in parallel — needs room for a full load
const HEAVY_READ_LIMIT = 60

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

type RouteKind = 'read' | 'write' | 'heavy'

/**
 * Call at the top of every route handler.
 * Returns a 429/401/400 NextResponse on failure, or null if OK.
 */
export function checkRequest(req: NextRequest, kind: RouteKind = 'read'): NextResponse | null {
  const pat = req.headers.get('x-azure-pat') || ''

  // PAT must be present and look valid
  if (!pat || !isValidPat(pat)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // org / project: non-empty, reasonable length, no shell-injection chars
  const org = req.headers.get('x-azure-org') || ''
  const project = req.headers.get('x-azure-project') || ''
  if (!org || org.length > 100 || !project || project.length > 100) {
    return NextResponse.json({ error: 'Invalid org/project' }, { status: 400 })
  }

  // Rate limit keyed by PAT prefix (first 8 chars) so each user has their own bucket
  const patKey = pat.slice(0, 8)
  const method = req.method.toUpperCase()
  const effectiveKind = WRITE_METHODS.has(method) ? 'write' : kind

  const [limit, bucketSuffix] =
    effectiveKind === 'write'
      ? [WRITE_LIMIT, 'w']
      : effectiveKind === 'heavy'
      ? [HEAVY_READ_LIMIT, 'h']
      : [READ_LIMIT, 'r']

  const allowed = consume(`${patKey}:${bucketSuffix}`, limit, WINDOW_MS)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  return null
}

// ── Input validation helpers ─────────────────────────────────────────────────

export function parsePositiveInt(val: string | null | undefined): number | null {
  if (!val) return null
  const n = parseInt(val, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function sanitizeString(val: unknown, maxLen = 200): string | null {
  if (typeof val !== 'string') return null
  const s = val.trim()
  return s.length > 0 && s.length <= maxLen ? s : null
}
