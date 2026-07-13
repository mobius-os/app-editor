import { useEffect, useState } from 'react'
import { FS, PREFS_PATH, DEFAULT_PREFS } from './constants.js'

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
// `counts` opts into the server adding an immediate child_count to each
// DIRECTORY entry (one bounded scandir per subdir on the returned page). The
// server ignores the param on an old build, so entries simply arrive without
// child_count and the UI degrades to no item count — feature-detected, not
// version-gated.
export function fsTree(path, cursor, { counts = false } = {}) {
  const q = new URLSearchParams({ path: path || '' })
  if (cursor) q.set('cursor', cursor)
  if (counts) q.set('counts', '1')
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

// Peek the first chunk of a TEXT file that is over the server's inline/preview
// cap (which would otherwise 413). Returns { text, truncated, total } — text is
// the leading bytes the server sent, truncated is true when it withheld the
// rest, total is the full size in bytes (from the X-Mobius-Total-Size header).
// On an OLD server (no head support) the request 413s like a normal read; the
// caller catches that and shows the "too large — ask the agent" notice, so this
// is a pure enhancement. Never used for binaries.
export async function fsReadHead(path) {
  const tok = ownerToken()
  if (!tok) throw new FsError('Not signed in as the owner.', 401)
  const r = await fetch(`${FS}/read?path=${encodeURIComponent(path)}&head=1`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  if (!r.ok) {
    let detail = `Could not read the file (${r.status}).`
    try { detail = (await r.json()).detail || detail } catch { /* text body */ }
    throw new FsError(detail, r.status)
  }
  const truncated = r.headers.get('X-Mobius-Truncated') === '1'
  const total = Number(r.headers.get('X-Mobius-Total-Size')) || null
  return { text: await r.text(), truncated, total }
}

// Read a file as a Blob (for image preview / thumbnails). <img src> can't carry
// an auth header, so we fetch the bytes and convert to an object URL at the
// call site. cache: 'reload' bypasses the HTTP cache so an image the agent
// regenerated at the same path returns its FRESH bytes.
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

// Disk usage of the /data filesystem (statvfs) → { total, used, free, path } in
// bytes. Returns null when the server doesn't support it (old build → 404) so
// the status-bar gauge is a pure enhancement, feature-detected. Honest label:
// this is the HOST /data filesystem, not a Möbius quota.
export async function fsDisk() {
  try {
    return await fsJSON('/disk')
  } catch (e) {
    if (e && e.status === 404) return null  // endpoint not deployed yet
    throw e
  }
}

// Recursive disk usage of a directory subtree (MiXplorer's "Recursive data") →
// { path, bytes, files, dirs, truncated }. The server walks the subtree under
// bounded caps (wall-clock + entry count + symlink-skip + deny-prune), so
// `truncated` marks a lower-bound total. Returns null when the endpoint isn't
// deployed (404) — the Properties sheet then just omits the recursive line.
export async function fsDu(path) {
  try {
    return await fsJSON(`/du?path=${encodeURIComponent(path || '')}`)
  } catch (e) {
    if (e && e.status === 404) return null  // endpoint not deployed yet
    throw e
  }
}

// ----------------------------------------------------------------------
// Online/offline. /api/fs/* needs the network — there is no offline mirror —
// so prefer the shell's probed reachability verdict when available. The browser
// online/offline events remain as a standalone/old-runtime fallback.
// ----------------------------------------------------------------------
export function currentOnline() {
  const mobiusOnline = typeof window !== 'undefined' ? window.mobius?.online : undefined
  if (typeof mobiusOnline === 'boolean') return mobiusOnline
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

export function useOnline() {
  const [online, setOnline] = useState(() => currentOnline())
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (typeof window.mobius?.onOnlineChange === 'function') {
      return window.mobius.onOnlineChange((next) => setOnline(next !== false))
    }
    const sync = () => setOnline(currentOnline())
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync) }
  }, [])
  return online
}

// ----------------------------------------------------------------------
// Per-app UI prefs (view mode, sort, folders-first, bookmarks, recents, last
// directory) persisted via window.mobius.storage so a reopen lands where the
// owner left off with their chosen layout. Best-effort — a failure just means
// we open at the root with defaults. chat_id.json is owned by the chat helper's
// `persist`, not written here.
// ----------------------------------------------------------------------
function storageApi() {
  return (typeof window !== 'undefined' && window.mobius && window.mobius.storage) || null
}

// Load prefs merged over the defaults so a partial/old blob still yields every
// field. Never rejects.
export function loadPrefs() {
  const ms = storageApi()
  if (!ms || typeof ms.get !== 'function') return Promise.resolve({ ...DEFAULT_PREFS })
  return ms.get(PREFS_PATH)
    .then((p) => ({ ...DEFAULT_PREFS, ...(p && typeof p === 'object' ? p : {}) }))
    .catch(() => ({ ...DEFAULT_PREFS }))
}

export function savePrefs(prefs) {
  const ms = storageApi()
  if (!ms || typeof ms.set !== 'function') return
  ms.set(PREFS_PATH, prefs).catch(() => {})
}
