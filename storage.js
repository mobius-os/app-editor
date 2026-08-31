import {
  DIRECTORY_ENTRY_LIMIT,
  DIRECTORY_PAGE_LIMIT,
  FS_ROOT,
} from './constants.js'
import { normalizePath } from './domain.js'

let filesystemToken = ''

export function configureFilesystemToken(token) {
  filesystemToken = typeof token === 'string' ? token : ''
}

export class FilesystemError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, init = {}, fallback = 'Could not load files') {
  if (!filesystemToken) throw new FilesystemError('Reopen Files and try again.', 401)
  const response = await fetch(`${FS_ROOT}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${filesystemToken}` },
  })
  if (response.ok) return response
  let detail = `${fallback} (${response.status}).`
  try { detail = (await response.json()).detail || detail } catch { /* non-JSON response */ }
  throw new FilesystemError(detail, response.status)
}

export async function listDirectory(path) {
  const clean = normalizePath(path)
  let cursor = null
  let entries = []
  let redacted = []
  let pages = 0
  let truncated = false
  do {
    const query = new URLSearchParams({ path: clean, counts: '1' })
    if (cursor) query.set('cursor', cursor)
    // The server intentionally paginates large folders. Keep the UI bounded
    // while still making normal source trees complete.
    // eslint-disable-next-line no-await-in-loop
    const data = await (await request(`/tree?${query.toString()}`)).json()
    if (pages === 0) redacted = Array.isArray(data.redacted) ? data.redacted : []
    entries = entries.concat(data.entries || [])
    cursor = data.next_cursor || null
    pages += 1
    if (entries.length >= DIRECTORY_ENTRY_LIMIT || pages >= DIRECTORY_PAGE_LIMIT) {
      truncated = Boolean(cursor)
      break
    }
  } while (cursor)

  return {
    entries: entries.slice(0, DIRECTORY_ENTRY_LIMIT).map((entry) => (
      entry?.path?.startsWith('./') ? { ...entry, path: entry.path.slice(2) } : entry
    )),
    redacted,
    truncated,
  }
}

export async function readMetadata(path) {
  return (await request(`/read?path=${encodeURIComponent(normalizePath(path))}&meta=1`, {}, 'Could not inspect the file')).json()
}

export async function readText(path) {
  return (await request(`/read?path=${encodeURIComponent(normalizePath(path))}`, {}, 'Could not preview the file')).text()
}

export async function readTextHead(path) {
  const response = await request(`/read?path=${encodeURIComponent(normalizePath(path))}&head=1`, {}, 'Could not preview the file')
  return {
    text: await response.text(),
    total: Number(response.headers.get('X-Mobius-Total-Size')) || null,
    truncated: response.headers.get('X-Mobius-Truncated') === '1',
  }
}

export async function readBlob(path) {
  return (await request(`/read?path=${encodeURIComponent(normalizePath(path))}`, { cache: 'reload' }, 'Could not download the file')).blob()
}
