import {
  AUDIO_EXTENSIONS,
  CODE_EXTENSIONS,
  IMAGE_EXTENSIONS,
  TEXT_EXTENSIONS,
  VIDEO_EXTENSIONS,
  LOCATIONS,
} from './constants.js'

export function normalizePath(path) {
  return String(path || '').replace(/^\/+|\/+$/g, '').replace(/^\.\//, '')
}

export function baseName(path) {
  const clean = normalizePath(path)
  if (!clean) return 'All files'
  return clean.slice(clean.lastIndexOf('/') + 1)
}

export function parentPath(path) {
  const clean = normalizePath(path)
  const index = clean.lastIndexOf('/')
  return index < 0 ? '' : clean.slice(0, index)
}

export function pathSegments(path) {
  const parts = normalizePath(path).split('/').filter(Boolean)
  const segments = []
  let current = ''
  for (const part of parts) {
    current = current ? `${current}/${part}` : part
    const location = LOCATIONS.find((item) => item.path === current)
    segments.push({ label: location?.label || part, path: current })
  }
  return segments
}

export function extension(name) {
  const value = String(name || '')
  const index = value.lastIndexOf('.')
  return index > 0 ? value.slice(index + 1).toLowerCase() : ''
}

export function fileKind(name, mime = '') {
  const ext = extension(name)
  if (IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/')) return 'image'
  if (AUDIO_EXTENSIONS.has(ext) || mime.startsWith('audio/')) return 'audio'
  if (VIDEO_EXTENSIONS.has(ext) || mime.startsWith('video/')) return 'video'
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (CODE_EXTENSIONS.has(ext)) return 'code'
  if (TEXT_EXTENSIONS.has(ext) || mime.startsWith('text/')) return 'text'
  return 'file'
}

export function previewKind(path, mime = '') {
  const kind = fileKind(path, mime)
  return ['image', 'audio', 'video', 'pdf'].includes(kind) ? kind : null
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

export function relativeTime(value, now = Date.now()) {
  const timestamp = Date.parse(value || '')
  if (!Number.isFinite(timestamp)) return ''
  const elapsed = Math.max(0, now - timestamp)
  if (elapsed < 45_000) return 'just now'
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)}d ago`
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: new Date(timestamp).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  }).format(new Date(timestamp))
}

const GENERATED_FOLDERS = new Set(['__pycache__', 'dist', 'node_modules', 'playwright-report', 'test-results'])

export function visibleEntries(entries, query = '', { hideRuntime = false, hideGenerated = false } = {}) {
  const needle = String(query || '').trim().toLocaleLowerCase()
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => {
      const name = String(entry?.name || '')
      if (!entry || name === '.keep' || name.startsWith('.')) return false
      if (hideGenerated && entry.type === 'directory' && GENERATED_FOLDERS.has(name)) return false
      return !hideRuntime || (!name.startsWith('_') && !/^\d+$/.test(name))
    })
    .filter((entry) => !needle || String(entry.name || '').toLocaleLowerCase().includes(needle))
    .sort((a, b) => {
      const aDirectory = a.type === 'directory'
      const bDirectory = b.type === 'directory'
      if (aDirectory !== bDirectory) return aDirectory ? -1 : 1
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
        sensitivity: 'base', numeric: true,
      })
    })
}

export function entryMeta(entry, now = Date.now()) {
  const pieces = []
  if (entry.type === 'directory' && Number.isFinite(entry.child_count)) {
    pieces.push(`${entry.child_count} item${entry.child_count === 1 ? '' : 's'}`)
  }
  if (entry.type !== 'directory' && Number.isFinite(entry.size)) pieces.push(formatBytes(entry.size))
  const modified = relativeTime(entry.modified_at, now)
  if (modified) pieces.push(modified)
  return pieces.join(' · ')
}
