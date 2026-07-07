import { useEffect, useState } from 'react'
import { FS, PREFS_PATH, CHAT_HEIGHT_VERSION, CHAT_MIN_PX } from './constants.js'

// The owner JWT — written by the shell at login. /api/fs/* is owner-only and
// the app `token` prop is app-scoped (would 401), so we read the owner token
// here. Read fresh on every call: a 30-day token can be rotated mid-session by
// a re-login in another tab, and caching a stale copy would 401 silently.
export function ownerToken() {
  try {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
  } catch {
    return ''
  }
}

// Fire-and-forget analytics for Reflection. window.mobius.signal buffers in
// memory and flushes to the app's signals.jsonl; it never throws, but it may be
// absent in an old shell, so guard the call. Payloads stay flat primitives, no
// PII (paths/file names never go through here).
export function emitSignal(name, payload) {
  try { window.mobius?.signal?.(name, payload) } catch { /* analytics never breaks the app */ }
}

// A thrown FsError carries the HTTP status so callers can branch (403 → "ask
// the agent", 404 → "deleted", 413 → "too big") instead of string-matching.
export class FsError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function fsJSON(pathQuery) {
  const tok = ownerToken()
  if (!tok) throw new FsError('Not signed in as the owner.', 401)
  const r = await fetch(`${FS}${pathQuery}`, { headers: { Authorization: `Bearer ${tok}` } })
  if (!r.ok) {
    let detail = `Request failed (${r.status}).`
    try { detail = (await r.json()).detail || detail } catch { /* non-JSON body */ }
    throw new FsError(detail, r.status)
  }
  return r.json()
}

// List one directory level. `path` is relative to the FS root ("" = root).
export function fsTree(path, cursor) {
  const q = new URLSearchParams({ path: path || '' })
  if (cursor) q.set('cursor', cursor)
  return fsJSON(`/tree?${q.toString()}`)
}

// Metadata for a file (size, mime, is_binary, writable) without the body, so
// the UI decides how to render before pulling a big log or a binary.
export function fsMeta(path) {
  return fsJSON(`/read?path=${encodeURIComponent(path)}&meta=1`)
}

// Read a file's text. Returns the plaintext string; throws FsError on
// 403/404/413/etc. (the caller has already checked meta for binary/size).
export async function fsReadText(path) {
  const tok = ownerToken()
  if (!tok) throw new FsError('Not signed in as the owner.', 401)
  const r = await fetch(`${FS}/read?path=${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  if (!r.ok) {
    let detail = `Could not read the file (${r.status}).`
    try { detail = (await r.json()).detail || detail } catch { /* may be a text body */ }
    throw new FsError(detail, r.status)
  }
  return r.text()
}

// Read a file as a Blob (for image preview). <img src> can't carry an auth
// header, so we fetch the bytes and convert to an object URL at the call site.
// cache: 'reload' bypasses the HTTP cache so an image the agent regenerated at
// the same path returns its FRESH bytes — without it the browser would serve
// the stale cached body and the preview would show the old image until reopened.
export async function fsReadBlob(path) {
  const tok = ownerToken()
  if (!tok) throw new FsError('Not signed in as the owner.', 401)
  const r = await fetch(`${FS}/read?path=${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${tok}` },
    cache: 'reload',
  })
  if (!r.ok) throw new FsError(`Could not load the file (${r.status}).`, r.status)
  return r.blob()
}

// Write text to a path under /data. 403 = denied/root-owned/protected;
// 413 = too big. Body is raw text/plain (the route reads it as a string body).
export async function fsWrite(path, content) {
  const tok = ownerToken()
  if (!tok) throw new FsError('Not signed in as the owner.', 401)
  const r = await fetch(`${FS}/write?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'text/plain' },
    body: content,
  })
  if (!r.ok) {
    let detail = `Could not save (${r.status}).`
    try { detail = (await r.json()).detail || detail } catch { /* non-JSON */ }
    throw new FsError(detail, r.status)
  }
  return r.json()
}

// Delete a file at `path` under /data. 403 = denied/root-owned/protected;
// 404 = already gone (the caller treats either as "it's no longer there").
export async function fsDelete(path) {
  const tok = ownerToken()
  if (!tok) throw new FsError('Not signed in as the owner.', 401)
  const r = await fetch(`${FS}/delete?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tok}` },
  })
  if (!r.ok) {
    let detail = `Could not delete (${r.status}).`
    try { detail = (await r.json()).detail || detail } catch { /* non-JSON */ }
    throw new FsError(detail, r.status)
  }
  // 204/empty bodies are fine — callers don't need a payload.
  return true
}

// Git status for the repo containing `path`. Throws FsError(404) when there's
// no repo between `path` and the root — the caller treats that as "no repo".
export function fsGit(path) {
  return fsJSON(`/git?path=${encodeURIComponent(path || '')}`)
}

// ----------------------------------------------------------------------
// Online/offline. /api/fs/* needs the network — there is no offline mirror —
// so we track navigator.onLine to show a clean "needs a connection" state
// rather than letting calls fail into a dead UI.
// ----------------------------------------------------------------------
export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const sync = () => setOnline(navigator.onLine !== false)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync) }
  }, [])
  return online
}

// ----------------------------------------------------------------------
// Per-app UI prefs (last-opened path, expanded dirs) persisted via
// window.mobius.storage so a reopen lands where the owner left off. Best-effort
// — a failure just means we open at the root. chat_id.json is owned by the
// chat helper's `persist`, not written here.
// ----------------------------------------------------------------------

export function loadPrefs() {
  const ms = (typeof window !== 'undefined' && window.mobius && window.mobius.storage) || null
  if (!ms || typeof ms.get !== 'function') return Promise.resolve(null)
  return ms.get(PREFS_PATH).catch(() => null)
}

export function savePrefs(prefs) {
  const ms = (typeof window !== 'undefined' && window.mobius && window.mobius.storage) || null
  if (!ms || typeof ms.set !== 'function') return
  ms.set(PREFS_PATH, prefs).catch(() => {})
}

// ----------------------------------------------------------------------
// Chat/editor split height. Persisted to localStorage (keyed by app) rather
// than ui-prefs.json — it's a px layout preference that changes on every drag
// and we don't want each pixel hitting the storage round-trip the way the
// expanded-dir set does.
//
// Resize bounds are PIXELS derived from the embed's composer pill, never a
// fraction of the column. The chat-pane MINIMUM equals the composer
// input-pill band (CHAT_MIN_PX): dragging the divider all the way down
// collapses the chat TRANSCRIPT to zero but leaves the pill fully visible
// (the composer is pinned at the bottom of the chat iframe — "full vibe
// writing"), and the chat can never shrink below it. The MAXIMUM is the
// column height minus the divider, so the editor pane above CAN collapse to
// zero while the pill — and the divider you grab to come back — stay on
// screen. CHAT_MIN_PX = the embed pill (≈48px) + its 8px/8px foot padding
// ≈ 64px; the shell publishes the live foot height as the `--composer-h`
// CSS var (default 80px in ChatView.css), but the embed strips the device
// safe-area gutter, so the steadier ~64px constant is what the panel floors
// to rather than reading a relayed height across three frames.
// Nothing stored yet → readChatHeight returns null and the first open spawns
// the chat at half the main column (the house 50/50 split latex/webstudio
// use); CHAT_DEFAULT_PX only backstops an unmeasurable container.
// ----------------------------------------------------------------------

export function chatHeightKey(appId) {
  return `editor:${appId}:chat-height:v${CHAT_HEIGHT_VERSION}`
}

export function readChatHeight(appId) {
  if (typeof localStorage === 'undefined') return null
  const raw = Number(localStorage.getItem(chatHeightKey(appId)))
  if (!Number.isFinite(raw) || raw <= 0) return null
  return Math.max(CHAT_MIN_PX, raw)
}
