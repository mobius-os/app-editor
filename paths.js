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
import { MARKDOWN_EXTS, IMAGE_EXTS } from './constants.js'

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

// A short glyph per file kind for the tree row. Single chars keep the rows
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
  if (e === 'sh') return '$'
  return '·'
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
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
// detail, never shown in the tree.
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
