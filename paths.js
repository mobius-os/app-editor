// ----------------------------------------------------------------------
// Pure path / name / format helpers — no React, no network, no CodeMirror or
// KaTeX. Split out of domain.js (which also carries the CodeMirror + markdown +
// KaTeX editor engine) so these can be unit-tested under a plain `node --test`
// on a fresh clone: domain.js's top-level `katex` / `@codemirror/*` bare imports
// are only resolvable through the app-frame importmap, so it can't be imported
// in a bare Node process. These helpers can.
//
// Paths are FS-root-relative, '/'-joined, no leading slash.
// ----------------------------------------------------------------------
import {
  MARKDOWN_EXTS, IMAGE_EXTS, RECENT_MS, RECENTS_MAX,
  SORT_NAME, SORT_SIZE, SORT_MODIFIED, SORT_KIND,
} from './constants.js'

export function baseName(path) {
  const p = String(path || '')
  const i = p.lastIndexOf('/')
  return i >= 0 ? p.slice(i + 1) : p
}

export function dirName(path) {
  const p = String(path || '')
  const i = p.lastIndexOf('/')
  return i > 0 ? p.slice(0, i) : ''
}

export function extOf(name) {
  const dot = String(name || '').lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function isMarkdownPath(path) {
  return MARKDOWN_EXTS.has(extOf(baseName(path)))
}

export function isImagePath(path) {
  return IMAGE_EXTS.has(extOf(baseName(path)))
}

// A short glyph per file kind for the row/grid. Single chars keep the rows
// dense on mobile.
export function fileGlyph(name) {
  const e = extOf(name)
  if (MARKDOWN_EXTS.has(e)) return 'M'
  if (IMAGE_EXTS.has(e)) return 'i'
  if (e === 'py') return 'py'
  if (e === 'js' || e === 'jsx' || e === 'ts' || e === 'tsx') return 'js'
  if (e === 'json') return '{}'
  if (e === 'css') return '#'
  if (e === 'html') return '<>'
  if (e === 'sh' || e === 'bash') return '$'
  if (e === 'log') return 'L'
  if (e === 'csv' || e === 'tsv') return '▦'
  if (e === 'yml' || e === 'yaml' || e === 'toml') return '⚙'
  return '·'
}

// A human "kind" label for the Properties sheet and (on desktop) the Kind
// column. Directories are handled by the caller; this is file-kind only.
const KIND_LABELS = {
  py: 'Python', js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
  json: 'JSON', css: 'CSS', html: 'HTML', sh: 'Shell', bash: 'Shell',
  md: 'Markdown', markdown: 'Markdown', log: 'Log', txt: 'Text',
  csv: 'CSV', tsv: 'TSV', yml: 'YAML', yaml: 'YAML', toml: 'TOML',
  png: 'PNG image', jpg: 'JPEG image', jpeg: 'JPEG image', gif: 'GIF image',
  webp: 'WebP image', svg: 'SVG image', avif: 'AVIF image', ico: 'Icon',
  pdf: 'PDF', zip: 'Archive', gz: 'Archive', db: 'Database', sqlite: 'Database',
}
export function kindLabel(name) {
  const e = extOf(name)
  if (!e) return 'File'
  return KIND_LABELS[e] || `${e.toUpperCase()} file`
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// "just now" / "5m ago" / "2h ago" / "3d ago" / "Jun 4" / "Jun 4 2025" for a
// modified_at ISO string. `now` is injectable for deterministic tests. A bad or
// missing date returns '' (the row just omits the timestamp).
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const diff = now - t
  if (diff < 0) return 'just now'         // clock skew — don't show "in the future"
  if (diff < 45 * 1000) return 'just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(diff / 3600000)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(diff / 86400000)
  if (days < 7) return `${days}d ago`
  const d = new Date(t)
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]
  const sameYear = new Date(now).getFullYear() === d.getFullYear()
  return sameYear ? `${mon} ${d.getDate()}` : `${mon} ${d.getDate()} ${d.getFullYear()}`
}

// Absolute local timestamp for the Properties sheet: "2026-07-12 16:03".
export function formatDateAbs(iso) {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// True if the entry was modified within RECENT_MS (drives the "changed" dot).
export function isRecent(iso, now = Date.now()) {
  if (!iso) return false
  const t = Date.parse(iso)
  return Number.isFinite(t) && now - t >= 0 && now - t < RECENT_MS
}

// Break a dir path into breadcrumb segments, root first. '' → [{name:'/data',
// path:''}]; 'apps/notes' → root, apps, notes. `name` is the display label,
// `path` is the FS-root-relative path to navigate to.
export function pathSegments(path) {
  const segs = [{ name: '/data', path: '' }]
  const clean = String(path || '').replace(/^\/+|\/+$/g, '')
  if (!clean) return segs
  const parts = clean.split('/')
  let acc = ''
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part
    segs.push({ name: part, path: acc })
  }
  return segs
}

// The parent dir of a dir path ('' at the root). Distinct from dirName, which
// is about a FILE's containing dir — this ascends a directory path itself.
export function parentDir(path) {
  const clean = String(path || '').replace(/\/+$/g, '')
  const i = clean.lastIndexOf('/')
  return i >= 0 ? clean.slice(0, i) : ''
}

// A new file/folder name is a single path segment — no slashes (we don't want
// the create affordance silently materializing nested dirs the owner didn't
// see) and no traversal. Reject empty/whitespace and the `.keep` marker we use
// internally to materialize folders.
export function isValidLeafName(name) {
  const n = String(name || '').trim()
  if (!n) return false
  if (n === '.keep') return false
  if (n.includes('/')) return false
  if (n === '.' || n === '..') return false
  return true
}

// `.keep` is our folder-materialization marker (the FS API has no mkdir, so a
// new folder is created by writing `<dir>/.keep`). It's an implementation
// detail, never shown in the listing.
export function isKeepMarker(name) {
  return String(name || '') === '.keep'
}

// Join a directory path (FS-root-relative, '' = root) with a leaf name.
export function joinPath(dir, leaf) {
  return dir ? `${dir}/${leaf}` : leaf
}

// After a save writes `savedText` to disk, the buffer is clean ONLY if the live
// buffer still equals what we wrote. If the user kept typing while the PUT was
// in flight (liveText !== savedText), the buffer stays dirty so those trailing
// keystrokes still require saving instead of being silently marked clean and
// lost. This is the invariant behind the writeNow save state machine.
export function bufferDirtyAfterSave(savedText, liveText) {
  return liveText !== savedText
}

// Parse a git-porcelain entry path into display parts. A wholly-untracked
// directory arrives as `subdir/` (trailing slash); strip it before splitting so
// the row renders a real name and is flagged as a folder, rather than a blank
// card that would open a directory path as if it were a file (which 404s and
// then reads as "This file no longer exists"). `path` is the slash-stripped
// path a caller opens/focuses; `base` keeps the trailing slash for display.
export function parseGitEntryPath(rawPath) {
  const raw = String(rawPath || '')
  const isDir = raw.endsWith('/')
  const path = isDir ? raw.replace(/\/+$/, '') : raw
  const idx = path.lastIndexOf('/')
  const base = (idx >= 0 ? path.slice(idx + 1) : path) + (isDir ? '/' : '')
  const dir = idx >= 0 ? path.slice(0, idx) : ''
  return { isDir, path, base, dir }
}

// ----------------------------------------------------------------------
// Client-side sorting. The server returns a directory dirs-first / name-asc;
// once every cursor page is fetched (see the App's fetchDir loop) we re-sort
// the full listing by the owner's chosen key/direction. Directories stay
// grouped ahead of files when foldersFirst is on (MiXplorer's default),
// independent of the asc/desc direction — reversing sorts WITHIN each group,
// it does not interleave folders and files.
// ----------------------------------------------------------------------
function nameCmp(a, b) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
}

function keyCmp(a, b, key) {
  if (key === SORT_SIZE) return (a.size || 0) - (b.size || 0) || nameCmp(a, b)
  if (key === SORT_MODIFIED) {
    // ISO 8601 strings sort lexicographically in chronological order.
    const am = a.modified_at || '', bm = b.modified_at || ''
    if (am < bm) return -1
    if (am > bm) return 1
    return nameCmp(a, b)
  }
  if (key === SORT_KIND) {
    const ae = extOf(a.name), be = extOf(b.name)
    if (ae < be) return -1
    if (ae > be) return 1
    return nameCmp(a, b)
  }
  return nameCmp(a, b)  // SORT_NAME
}

export function sortEntries(entries, { key = SORT_NAME, dir = 'asc', foldersFirst = true } = {}) {
  const sign = dir === 'desc' ? -1 : 1
  const rows = [...(entries || [])]
  rows.sort((a, b) => {
    if (foldersFirst) {
      const ad = a.type === 'directory' ? 0 : 1
      const bd = b.type === 'directory' ? 0 : 1
      if (ad !== bd) return ad - bd
    }
    return sign * keyCmp(a, b, key)
  })
  return rows
}

// Push a dir path to the front of the recents list, de-duped and capped. Pure
// so it unit-tests: returns a NEW array, never mutates the input.
export function pushRecent(recents, path) {
  const p = String(path == null ? '' : path)
  const next = [p, ...(recents || []).filter((x) => x !== p)]
  return next.slice(0, RECENTS_MAX)
}
