import { useEffect, useState } from 'react'
import { FS, PREFS_PATH, DEFAULT_PREFS } from './constants.js'

// The shell supplies a short-lived token scoped to this app. The Editor's
// manifest explicitly grants that identity filesystem_access; the backend
// checks the live app row on every /api/fs request so the grant is immediately
// revocable without exposing the owner's login token to the frame.
let _filesystemToken = ''

export function configureFilesystemToken(token) {
  _filesystemToken = typeof token === 'string' ? token : ''
}

function requireFilesystemToken() {
  if (!_filesystemToken) throw new FsError('Filesystem access is unavailable. Reopen the Editor and try again.', 401)
  return _filesystemToken
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
class FsError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// Every filesystem request has the same security and failure contract. Keep it
// here so new operations cannot accidentally omit the scoped token or invent a
// different backend-error parser.
async function fsRequest(pathQuery, init = {}, failure = 'Request failed') {
  const token = requireFilesystemToken()
  const response = await fetch(`${FS}${pathQuery}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  })
  if (response.ok) return response

  let detail = `${failure} (${response.status}).`
  try { detail = (await response.json()).detail || detail } catch { /* non-JSON body */ }
  throw new FsError(detail, response.status)
}

async function fsJSON(pathQuery, init, failure) {
  return (await fsRequest(pathQuery, init, failure)).json()
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
  return (await fsRequest(`/read?path=${encodeURIComponent(path)}`, {}, 'Could not read the file')).text()
}

// Peek the first chunk of a TEXT file that is over the server's inline/preview
// cap (which would otherwise 413). Returns { text, truncated, total } — text is
// the leading bytes the server sent, truncated is true when it withheld the
// rest, total is the full size in bytes (from the X-Mobius-Total-Size header).
// On an OLD server (no head support) the request 413s like a normal read; the
// caller catches that and shows the "too large — ask the agent" notice, so this
// is a pure enhancement. Never used for binaries.
export async function fsReadHead(path) {
  const response = await fsRequest(
    `/read?path=${encodeURIComponent(path)}&head=1`,
    {},
    'Could not read the file',
  )
  const truncated = response.headers.get('X-Mobius-Truncated') === '1'
  const total = Number(response.headers.get('X-Mobius-Total-Size')) || null
  return { text: await response.text(), truncated, total }
}

// Read a file as a Blob (for image preview / thumbnails). <img src> can't carry
// an auth header, so we fetch the bytes and convert to an object URL at the
// call site. cache: 'reload' bypasses the HTTP cache so an image the agent
// regenerated at the same path returns its FRESH bytes.
export async function fsReadBlob(path) {
  return (await fsRequest(
    `/read?path=${encodeURIComponent(path)}`,
    { cache: 'reload' },
    'Could not load the file',
  )).blob()
}

// Write text to a path under /data. 403 = denied/root-owned/protected;
// 413 = too big. Body is raw text/plain (the route reads it as a string body).
export async function fsWrite(path, content) {
  return fsJSON(`/write?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: content,
  }, 'Could not save')
}

// Delete a file at `path` under /data. 403 = denied/root-owned/protected;
// 404 = already gone (the caller treats either as "it's no longer there").
export async function fsDelete(path) {
  await fsRequest(`/delete?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  }, 'Could not delete')
  // 204/empty bodies are fine — callers don't need a payload.
  return true
}

// Disk usage of the /data filesystem (statvfs) → { total, used, free, path } in
// bytes. Returns null when the server doesn't support it (old build → 404) so
// the status-bar gauge is a pure enhancement, feature-detected. Honest label:
// this is the mount holding /data, not a Möbius quota and not the container's
// root filesystem. Where /data has its own volume, `used` is Möbius's own
// footprint and `total` is a real ceiling.
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
function currentOnline() {
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
// Per-app UI prefs (view mode, sort, folders-first, hidden files, bookmarks,
// and recents) persisted via window.mobius.storage. Best-effort — a failure
// just means we open with defaults. chat_id.json is owned by the chat helper's
// `persist`, not written here.
// ----------------------------------------------------------------------
function storageApi() {
  return (typeof window !== 'undefined' && window.mobius && window.mobius.storage) || null
}

function currentPrefs(stored) {
  const source = stored && typeof stored === 'object' ? stored : {}
  const prefs = {}
  for (const [key, fallback] of Object.entries(DEFAULT_PREFS)) {
    prefs[key] = source[key] ?? fallback
  }
  return prefs
}

// Load prefs merged over the defaults so a partial/old blob still yields every
// field. Never rejects.
export function loadPrefs() {
  const ms = storageApi()
  if (!ms || typeof ms.get !== 'function') return Promise.resolve({ ...DEFAULT_PREFS })
  return ms.get(PREFS_PATH)
    .then(currentPrefs)
    .catch(() => ({ ...DEFAULT_PREFS }))
}

export function savePrefs(prefs) {
  const ms = storageApi()
  if (!ms || typeof ms.set !== 'function') return
  ms.set(PREFS_PATH, prefs).catch(() => {})
}
