import {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView, keymap, ViewPlugin, Decoration, WidgetType,
} from '@codemirror/view'
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, HighlightStyle, indentOnInput, syntaxTree } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import katex from 'katex'

// ----------------------------------------------------------------------
// Editor — a whole-filesystem viewer + editor for Möbius.
//
// The owner sees the entire /data tree, edits text/markdown files in place
// (markdown gets the Notes live-preview), watches git status to see what the
// agent changed, and asks an embedded agent to make edits — oversight plus
// direct edit, with the agent as the primary interface.
//
// This app drives the OWNER-ONLY /api/fs/* API (routes/fs.py), which the
// app-scoped `token` prop cannot reach (it 401s). Same-origin owner tool: we
// read the owner JWT from localStorage('token') and send it as the bearer for
// every /api/fs/* call. This is the accepted single-owner trade-off documented
// in mobius/CLAUDE.md — the gated surface is the whole filesystem regardless,
// so a scoped permission would be theatre.
//
// The FS is huge, so the tree is NEVER walked whole: each directory's children
// are fetched lazily when the user expands it, and cached. Paths are relative
// to the FS root (/data).
// ----------------------------------------------------------------------

const FS = '/api/fs'

// The owner JWT — written by the shell at login. /api/fs/* is owner-only and
// the app `token` prop is app-scoped (would 401), so we read the owner token
// here. Read fresh on every call: a 30-day token can be rotated mid-session by
// a re-login in another tab, and caching a stale copy would 401 silently.
function ownerToken() {
  try {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
  } catch {
    return ''
  }
}

// A thrown FsError carries the HTTP status so callers can branch (403 → "ask
// the agent", 404 → "deleted", 413 → "too big") instead of string-matching.
class FsError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function fsJSON(pathQuery) {
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
function fsTree(path, cursor) {
  const q = new URLSearchParams({ path: path || '' })
  if (cursor) q.set('cursor', cursor)
  return fsJSON(`/tree?${q.toString()}`)
}

// Metadata for a file (size, mime, is_binary, writable) without the body, so
// the UI decides how to render before pulling a big log or a binary.
function fsMeta(path) {
  return fsJSON(`/read?path=${encodeURIComponent(path)}&meta=1`)
}

// Read a file's text. Returns the plaintext string; throws FsError on
// 403/404/413/etc. (the caller has already checked meta for binary/size).
async function fsReadText(path) {
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
async function fsReadBlob(path) {
  const tok = ownerToken()
  if (!tok) throw new FsError('Not signed in as the owner.', 401)
  const r = await fetch(`${FS}/read?path=${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  if (!r.ok) throw new FsError(`Could not load the file (${r.status}).`, r.status)
  return r.blob()
}

// Write text to a path under /data. 403 = denied/root-owned/protected;
// 413 = too big. Body is raw text/plain (the route reads it as a string body).
async function fsWrite(path, content) {
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

// Git status for the repo containing `path`. Throws FsError(404) when there's
// no repo between `path` and the root — the caller treats that as "no repo".
function fsGit(path) {
  return fsJSON(`/git?path=${encodeURIComponent(path || '')}`)
}

// ----------------------------------------------------------------------
// Path helpers. Paths are FS-root-relative, '/'-joined, no leading slash.
// ----------------------------------------------------------------------
function baseName(path) {
  const p = String(path || '')
  const i = p.lastIndexOf('/')
  return i >= 0 ? p.slice(i + 1) : p
}

function dirName(path) {
  const p = String(path || '')
  const i = p.lastIndexOf('/')
  return i > 0 ? p.slice(0, i) : ''
}

function extOf(name) {
  const dot = String(name || '').lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

const MARKDOWN_EXTS = new Set(['md', 'markdown', 'mdown', 'mkd'])
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

function isMarkdownPath(path) {
  return MARKDOWN_EXTS.has(extOf(baseName(path)))
}

function isImagePath(path) {
  return IMAGE_EXTS.has(extOf(baseName(path)))
}

// A short glyph per file kind for the tree row. Single chars keep the rows
// dense on mobile.
function fileGlyph(name) {
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

function formatBytes(n) {
  if (!Number.isFinite(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// ----------------------------------------------------------------------
// CodeMirror markdown live-preview engine (adapted inline from the Notes app's
// src/editor/{extensions,livePreview,widgets}.js). Markdown edits and preview
// happen at once: emphasis/heading/strikethrough markers hide on inactive
// lines (text just looks bold/big), task `[ ]` become checkboxes, `$…$`/`$$…$$`
// render KaTeX. Moving the cursor onto a line reveals its raw source to edit.
//
// The whole decoration build is wrapped in try/catch → Decoration.none, so a
// decoration bug degrades to a plain (still excellent) markdown editor rather
// than crashing the view. Only the importmap-provided CodeMirror packages are
// used — no marked/DOMPurify, so the preview never interprets stored bytes as
// raw HTML (the live-preview renders from the syntax tree, not innerHTML).
// ----------------------------------------------------------------------
class CheckboxWidget extends WidgetType {
  constructor(checked, pos) { super(); this.checked = checked; this.pos = pos }
  eq(o) { return o.checked === this.checked && o.pos === this.pos }
  toDOM(view) {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = this.checked
    box.style.cssText = 'margin:0 6px 0 0; cursor:pointer; vertical-align:middle; accent-color:var(--accent)'
    box.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const insert = this.checked ? '[ ]' : '[x]'
      view.dispatch({ changes: { from: this.pos, to: this.pos + 3, insert } })
    })
    return box
  }
  ignoreEvent() { return false }
}

class MathWidget extends WidgetType {
  constructor(src, block) { super(); this.src = src; this.block = !!block }
  eq(o) { return o.src === this.src && o.block === this.block }
  toDOM() {
    const el = document.createElement(this.block ? 'div' : 'span')
    try {
      // KaTeX renders trusted HTML from math source (it does not pass user HTML
      // through), so its output is safe to inject directly.
      el.innerHTML = katex.renderToString(this.src, { throwOnError: false, displayMode: this.block })
    } catch {
      el.textContent = this.block ? `$$${this.src}$$` : `$${this.src}$`
    }
    if (this.block) el.style.cssText = 'text-align:center; margin:8px 0; overflow-x:auto;'
    return el
  }
  ignoreEvent() { return true }
}

const HIDE_MARKS = new Set(['HeaderMark', 'EmphasisMark', 'StrikethroughMark'])
const INLINE_MATH = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g
const BLOCK_MATH = /\$\$([^\n]+?)\$\$/g

function scanMath(state, ranges, onActive, out) {
  for (const { from, to } of ranges) {
    const startLine = state.doc.lineAt(from).number
    const endLine = state.doc.lineAt(to).number
    for (let n = startLine; n <= endLine; n++) {
      const line = state.doc.line(n)
      const text = line.text
      let m
      BLOCK_MATH.lastIndex = 0
      const blocked = []
      while ((m = BLOCK_MATH.exec(text))) {
        const f = line.from + m.index
        const t = f + m[0].length
        blocked.push([m.index, m.index + m[0].length])
        if (!onActive(f, t)) out.push({ from: f, to: t, deco: Decoration.replace({ widget: new MathWidget(m[1].trim(), true) }) })
      }
      INLINE_MATH.lastIndex = 0
      while ((m = INLINE_MATH.exec(text))) {
        const insideBlock = blocked.some(([a, b]) => m.index >= a && m.index < b)
        if (insideBlock) continue
        const f = line.from + m.index
        const t = f + m[0].length
        if (!onActive(f, t)) out.push({ from: f, to: t, deco: Decoration.replace({ widget: new MathWidget(m[1].trim(), false) }) })
      }
    }
  }
}

function livePreview() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) { this.decorations = this.build(view) }
      update(u) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) this.decorations = this.build(u.view)
      }
      build(view) {
        try {
          const { state } = view
          const sel = state.selection.main
          const aFrom = state.doc.lineAt(sel.from).from
          const aTo = state.doc.lineAt(sel.to).to
          const onActive = (from, to) => to >= aFrom && from <= aTo
          const out = []
          const tree = syntaxTree(state)
          for (const { from, to } of view.visibleRanges) {
            tree.iterate({
              from,
              to,
              enter: (node) => {
                const name = node.name
                if (name === 'TaskMarker') {
                  if (!onActive(node.from, node.to)) {
                    const text = state.sliceDoc(node.from, node.to)
                    out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new CheckboxWidget(/x/i.test(text), node.from) }) })
                  }
                } else if (HIDE_MARKS.has(name)) {
                  if (!onActive(node.from, node.to)) out.push({ from: node.from, to: node.to, deco: Decoration.replace({}) })
                }
              },
            })
          }
          scanMath(state, view.visibleRanges, onActive, out)
          out.sort((a, b) => a.from - b.from || a.to - b.to)
          // Drop overlaps — CM requires non-overlapping replace decorations.
          const ranges = []
          let lastTo = -1
          for (const w of out) {
            if (w.from < lastTo) continue
            ranges.push(w.deco.range(w.from, w.to))
            lastTo = w.to
          }
          return Decoration.set(ranges, true)
        } catch {
          return Decoration.none
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

const heading = (size, weight) => ({ fontSize: size, fontWeight: weight, lineHeight: '1.3' })
const mdHighlight = HighlightStyle.define([
  { tag: tags.heading1, ...heading('1.55em', '700') },
  { tag: tags.heading2, ...heading('1.34em', '700') },
  { tag: tags.heading3, ...heading('1.17em', '650') },
  { tag: [tags.heading4, tags.heading5, tags.heading6], ...heading('1.05em', '650') },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--muted)' },
  { tag: [tags.monospace], fontFamily: 'var(--mono)', fontSize: '0.92em', background: 'var(--surface2)', borderRadius: '4px', padding: '0 3px' },
  { tag: tags.quote, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--text)' },
  { tag: tags.processingInstruction, color: 'var(--muted)', opacity: 0.6 },
  { tag: tags.contentSeparator, color: 'var(--border)' },
])

const cmTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--text)' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font)', lineHeight: '1.6', fontSize: '15px' },
  '.cm-content': { padding: '14px 16px 30vh', caretColor: 'var(--accent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
  '.cm-line': { padding: '0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--muted)', border: 'none' },
})

// A plain-text theme for non-markdown source — monospace, no markdown
// highlighting, no live preview. Same chrome as the markdown editor.
const cmThemePlain = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--text)' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--mono)', lineHeight: '1.6', fontSize: '13.5px' },
  '.cm-content': { padding: '14px 16px 30vh', caretColor: 'var(--accent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
})

function buildMarkdownExtensions(onDocChange) {
  return [
    history(),
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(mdHighlight),
    indentOnInput(),
    EditorView.lineWrapping,
    livePreview(),
    keymap.of([indentWithTab, ...historyKeymap, ...defaultKeymap]),
    cmTheme,
    EditorView.editable.of(true),
    EditorView.updateListener.of((u) => { if (u.docChanged) onDocChange(u.state.doc.toString()) }),
  ]
}

function buildPlainExtensions(onDocChange) {
  return [
    history(),
    EditorView.lineWrapping,
    keymap.of([indentWithTab, ...historyKeymap, ...defaultKeymap]),
    cmThemePlain,
    EditorView.editable.of(true),
    EditorView.updateListener.of((u) => { if (u.docChanged) onDocChange(u.state.doc.toString()) }),
  ]
}

// ----------------------------------------------------------------------
// CodeMirror React wrapper. Mounts an EditorView whose extension stack is
// chosen by `markdown` (live-preview vs plain monospace). `value` seeds the
// doc; an EXTERNAL change (open a different file, or the agent edited the file
// and onTurnDone re-read it) replaces the whole doc — but only when the user
// isn't the one who just typed it. We track the last value emitted by local
// typing in `lastEmitted` so a parent re-render that echoes our own onChange
// back as `value` does NOT reset the cursor. `readOnly` swaps in a read-only
// configuration. The whole view is rebuilt when `markdown`/`readOnly`/`docKey`
// change (different file or mode), because the extension stack differs.
// ----------------------------------------------------------------------
function CodeEditor({ value, markdown: isMd, readOnly, docKey, onChange }) {
  const host = useRef(null)
  const view = useRef(null)
  const onChangeRef = useRef(onChange)
  const lastEmitted = useRef(value)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Rebuild the view when the file (docKey) or the mode (markdown/readOnly)
  // changes. Editing the same file just dispatches doc changes (effect below).
  useEffect(() => {
    const emit = (text) => {
      lastEmitted.current = text
      if (onChangeRef.current) onChangeRef.current(text)
    }
    const base = isMd ? buildMarkdownExtensions(emit) : buildPlainExtensions(emit)
    const extensions = readOnly
      ? [...base, EditorState.readOnly.of(true), EditorView.editable.of(false)]
      : base
    const state = EditorState.create({ doc: value || '', extensions })
    const v = new EditorView({ state, parent: host.current })
    view.current = v
    lastEmitted.current = value || ''
    return () => { v.destroy(); view.current = null }
    // value is intentionally omitted: a docKey change carries the new file's
    // value; reacting to value here would rebuild the view on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, isMd, readOnly])

  // External value change for the SAME file (agent edit re-read, or a
  // revalidation) — replace the doc, but skip our own echo so typing isn't
  // interrupted and the cursor doesn't jump.
  useEffect(() => {
    const v = view.current
    if (!v) return
    if (value == null) return
    if (value === lastEmitted.current) return
    const cur = v.state.doc.toString()
    if (value === cur) return
    v.dispatch({ changes: { from: 0, to: cur.length, insert: value } })
    lastEmitted.current = value
  }, [value])

  return <div ref={host} className="ed-cm-host" />
}

// ----------------------------------------------------------------------
// Image preview. /api/fs/read needs a bearer token, so we fetch the bytes as a
// blob and convert to an object URL (an <img src> can't carry an auth header).
// ----------------------------------------------------------------------
function ImagePreview({ path }) {
  const [url, setUrl] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    let live = true
    let revoke = null
    setUrl(null); setErr(null)
    fsReadBlob(path).then((blob) => {
      if (!live) return
      const u = URL.createObjectURL(blob)
      revoke = u
      setUrl(u)
    }).catch((e) => { if (live) setErr(e.message || 'Image could not be loaded.') })
    return () => { live = false; if (revoke) URL.revokeObjectURL(revoke) }
  }, [path])
  if (err) return <div className="ed-note">{err}</div>
  if (!url) return <div className="ed-note">Loading image…</div>
  return <img className="ed-img" src={url} alt={baseName(path)} />
}

// ----------------------------------------------------------------------
// File tree. Lazy + level-at-a-time: a directory's children are fetched on
// first expand and cached in the App's `treeCache` (keyed by dir path). The
// App owns the cache + expansion set so they survive a drawer close/reopen;
// FileNode is a pure renderer driven by props.
//
// `redacted` rows (secrets hidden by the server at a given level) are surfaced
// as a single muted "N protected" row — honest about what's hidden without
// pretending it isn't there.
// ----------------------------------------------------------------------
function FileNode({
  entry, depth, expanded, childrenByDir, redactedByDir, loadingDirs, errorDirs,
  selectedPath, gitRepos, onToggleDir, onSelectFile,
}) {
  const isDir = entry.type === 'directory'
  const pad = { paddingLeft: `${8 + depth * 14}px` }

  if (!isDir) {
    const selected = entry.path === selectedPath
    return (
      <button
        type="button"
        className={`ed-row ed-row-file${selected ? ' is-selected' : ''}`}
        style={pad}
        onClick={() => onSelectFile(entry.path)}
        aria-current={selected ? 'true' : undefined}
        title={entry.path}
      >
        <span className="ed-row-glyph" aria-hidden="true">{fileGlyph(entry.name)}</span>
        <span className="ed-row-name">{entry.name}</span>
        <span className="ed-row-size">{formatBytes(entry.size)}</span>
      </button>
    )
  }

  const isOpen = expanded.has(entry.path)
  const kids = childrenByDir[entry.path]
  const redacted = redactedByDir[entry.path] || []
  const isGit = entry.is_git_repo || gitRepos.has(entry.path)
  return (
    <>
      <button
        type="button"
        className="ed-row ed-row-dir"
        style={pad}
        onClick={() => onToggleDir(entry.path)}
        aria-expanded={isOpen}
        title={entry.path}
      >
        <span className="ed-row-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
        <span className="ed-row-name">{entry.name}</span>
        {isGit && <span className="ed-git-badge" title="Git repository">git</span>}
      </button>
      {isOpen && (
        <div role="group">
          {loadingDirs.has(entry.path) && !kids && (
            <div className="ed-row-note" style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}>Loading…</div>
          )}
          {errorDirs[entry.path] && (
            <div className="ed-row-note is-error" style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}>
              {errorDirs[entry.path]}
            </div>
          )}
          {kids && kids.map((child) => (
            <FileNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              childrenByDir={childrenByDir}
              redactedByDir={redactedByDir}
              loadingDirs={loadingDirs}
              errorDirs={errorDirs}
              selectedPath={selectedPath}
              gitRepos={gitRepos}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
            />
          ))}
          {redacted.length > 0 && (
            <div className="ed-row-note is-protected" style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}>
              {redacted.length} protected
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ----------------------------------------------------------------------
// Git panel — a compact, collapsible summary for the open file's repo. Shows
// branch + ahead/behind + staged/modified/untracked counts, and a short list
// (tap a path to open that file). Mobile real estate is tight, so it starts
// collapsed and the lists are capped (the server already caps at 200; we show
// the first handful).
// ----------------------------------------------------------------------
const GIT_LIST_PREVIEW = 8

function GitPanel({ git, gitError, gitLoading, repoRoot, open, onToggle, onOpenFile }) {
  if (gitLoading && !git) {
    return <div className="ed-git-bar is-quiet">Checking git…</div>
  }
  if (gitError || !git) {
    // 404 = no repo here; anything else is a real error. Either way, keep it
    // to one muted line rather than a dead panel.
    return <div className="ed-git-bar is-quiet">{gitError && gitError.status !== 404 ? 'Git status unavailable' : 'Not a git repo'}</div>
  }
  const c = git.counts || { staged: 0, modified: 0, untracked: 0 }
  const dirty = c.staged + c.modified + c.untracked
  const aheadBehind = []
  if (git.ahead) aheadBehind.push(`↑${git.ahead}`)
  if (git.behind) aheadBehind.push(`↓${git.behind}`)

  const resolve = (p) => (repoRoot ? (repoRoot ? `${repoRoot}/${p}` : p) : p)
  const list = (items, status) => items.slice(0, GIT_LIST_PREVIEW).map((it) => (
    <button
      key={`${status}-${it.path}`}
      type="button"
      className="ed-git-file"
      onClick={() => onOpenFile(resolve(it.path))}
      title={it.path}
    >
      <span className={`ed-git-dot is-${status}`} aria-hidden="true" />
      <span className="ed-git-file-path">{it.path}</span>
      {it.status && <span className="ed-git-file-status">{it.status}</span>}
    </button>
  ))

  return (
    <div className="ed-git">
      <button type="button" className="ed-git-bar" onClick={onToggle} aria-expanded={open}>
        <span className="ed-git-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="ed-git-branch">{git.detached ? `detached @ ${git.head_sha}` : git.branch}</span>
        {aheadBehind.length > 0 && <span className="ed-git-track">{aheadBehind.join(' ')}</span>}
        <span className="ed-git-counts">
          {c.staged > 0 && <span className="ed-git-count is-staged" title="staged">+{c.staged}</span>}
          {c.modified > 0 && <span className="ed-git-count is-modified" title="modified">~{c.modified}</span>}
          {c.untracked > 0 && <span className="ed-git-count is-untracked" title="untracked">?{c.untracked}</span>}
          {dirty === 0 && <span className="ed-git-count is-clean">clean</span>}
        </span>
      </button>
      {open && dirty > 0 && (
        <div className="ed-git-body">
          {c.staged > 0 && <div className="ed-git-group"><div className="ed-git-group-label">Staged</div>{list(git.staged, 'staged')}</div>}
          {c.modified > 0 && <div className="ed-git-group"><div className="ed-git-group-label">Modified</div>{list(git.modified, 'modified')}</div>}
          {c.untracked > 0 && <div className="ed-git-group"><div className="ed-git-group-label">Untracked</div>{list(git.untracked, 'untracked')}</div>}
          {git.truncated && <div className="ed-git-more">…and more (status truncated)</div>}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------
// Embedded agent chat. The runtime mounts the real ChatView into an iframe, so
// this app does not duplicate SSE handling, composer state, provider controls,
// or persistence. window.mobius.chat owns the whole lifecycle (create-once via
// persist, re-apply the system prompt on resume). onTurnDone fires after each
// agent turn → the App re-reads the open file + refreshes the tree node + git.
// ----------------------------------------------------------------------
function agentSystemPrompt(appId) {
  return [
    `You are the Editor app's agent for Möbius app id ${appId}.`,
    '',
    'You have full access to the container filesystem with your normal tools',
    '(Read, Edit, Write, Bash, Grep, Glob). Your working directory is /data.',
    'The owner is viewing files in this Editor app — a whole-filesystem viewer',
    'and editor — and uses you to make changes they would rather not type by',
    'hand. The owner can see the file tree, the open file, and git status, so',
    'they are watching what you do.',
    '',
    'When the owner asks for a change to a file, MAKE the edit directly with',
    'your tools — do not just describe it in chat. Prefer editing the file the',
    'owner is most likely looking at unless they name another. Paths the owner',
    'sees are relative to /data (for example "apps/notes/index.jsx" is',
    '/data/apps/notes/index.jsx). Platform code outside /data is root-owned and',
    'read-only; if a change needs a root-owned file, say so rather than failing',
    'silently.',
    '',
    'After making an edit, summarise what you changed in ONE short sentence —',
    'the embedded chat panel shows only your last message, and the owner will',
    'see the file and git status update in the app.',
    '',
    'This is a silent setup brief — do NOT reply to it. Wait for the owner’s',
    'first message and act on that.',
  ].join('\n')
}

function ChatPanel({ appId, onTurnDone }) {
  const mountRef = useRef(null)
  const [error, setError] = useState(null)
  // Keep the latest onTurnDone in a ref so the mount effect does not depend on
  // it — that callback closes over the selected path and changes identity on
  // every file selection; as a mount-effect dep it would tear down and remount
  // the chat iframe (killing a streaming turn) every time the user opens a file.
  const onTurnDoneRef = useRef(onTurnDone)
  useEffect(() => { onTurnDoneRef.current = onTurnDone }, [onTurnDone])
  const systemPrompt = useMemo(() => agentSystemPrompt(appId), [appId])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !window.mobius || typeof window.mobius.chat !== 'function') {
      setError('Embedded chat is not available in this shell.')
      return undefined
    }
    let disposed = false
    let handle = null
    setError(null)
    window.mobius.chat({
      mount,
      persist: 'chat_id.json',
      title: 'Editor agent',
      systemPrompt,
      picker: false,
      onTurnDone: () => { if (onTurnDoneRef.current) onTurnDoneRef.current() },
      onError: ({ error: e }) => { setError(typeof e === 'string' ? e : 'Embedded chat reported an error.') },
    }).then((h) => {
      if (disposed) { h.destroy(); return }
      handle = h
    }).catch((e) => { if (!disposed) setError(e.message || 'Could not mount embedded chat.') })
    return () => { disposed = true; if (handle) handle.destroy() }
  }, [systemPrompt])

  return (
    <section className="ed-chat">
      <div className="ed-chat-head">
        <span className="ed-chat-title">Agent</span>
        <span className="ed-chat-hint">Ask it to edit any file — you’ll see it change</span>
      </div>
      {error && <div className="ed-chat-error">{error}</div>}
      <div className="ed-chat-embed" ref={mountRef} />
    </section>
  )
}

// ----------------------------------------------------------------------
// Online/offline. /api/fs/* needs the network — there is no offline mirror —
// so we track navigator.onLine to show a clean "needs a connection" state
// rather than letting calls fail into a dead UI.
// ----------------------------------------------------------------------
function useOnline() {
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
const PREFS_PATH = 'ui-prefs.json'

function loadPrefs() {
  const ms = (typeof window !== 'undefined' && window.mobius && window.mobius.storage) || null
  if (!ms || typeof ms.get !== 'function') return Promise.resolve(null)
  return ms.get(PREFS_PATH).catch(() => null)
}

function savePrefs(prefs) {
  const ms = (typeof window !== 'undefined' && window.mobius && window.mobius.storage) || null
  if (!ms || typeof ms.set !== 'function') return
  ms.set(PREFS_PATH, prefs).catch(() => {})
}

// ----------------------------------------------------------------------
// Top-level app.
// ----------------------------------------------------------------------
export default function App({ appId }) {
  const online = useOnline()

  // --- File tree state (lazy, level-at-a-time) ---
  const [rootError, setRootError] = useState(null)
  const [rootLoading, setRootLoading] = useState(true)
  // childrenByDir[dirPath] = entries[] (cached after first expand; '' = root).
  const [childrenByDir, setChildrenByDir] = useState({})
  const [redactedByDir, setRedactedByDir] = useState({})
  const [expanded, setExpanded] = useState(() => new Set())
  const [loadingDirs, setLoadingDirs] = useState(() => new Set())
  const [errorDirs, setErrorDirs] = useState({})
  // Directories we've learned are git repos (from their parent's listing) so a
  // freshly-fetched node can badge without re-probing.
  const gitRepos = useMemo(() => {
    const s = new Set()
    for (const entries of Object.values(childrenByDir)) {
      for (const e of entries || []) {
        if (e.type === 'directory' && e.is_git_repo) s.add(e.path)
      }
    }
    return s
  }, [childrenByDir])

  // --- Editor / open-file state ---
  const [selectedPath, setSelectedPath] = useState(null)
  const [meta, setMeta] = useState(null)        // {name,size,mime_type,is_binary,writable,modified_at}
  const [content, setContent] = useState('')    // editor buffer (text files)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  // The content as last loaded/saved from the server — what we re-read against
  // to decide whether an external (agent) edit changed the file under us.
  const baselineRef = useRef('')
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const selectedRef = useRef(null)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  useEffect(() => { savingRef.current = saving }, [saving])
  useEffect(() => { selectedRef.current = selectedPath }, [selectedPath])

  // --- Git state for the open file's directory ---
  const [git, setGit] = useState(null)
  const [gitError, setGitError] = useState(null)
  const [gitLoading, setGitLoading] = useState(false)
  const [gitOpen, setGitOpen] = useState(false)

  // --- Layout ---
  const [navOpen, setNavOpen] = useState(true)
  const navHandleRef = useRef(null)
  const prefsLoadedRef = useRef(false)
  const restorePathRef = useRef(null)

  // Fetch one directory level (uncached). Returns the entries or throws.
  const fetchDir = useCallback(async (dirPath) => {
    // Paginate through cursors so a >200-entry directory lists fully.
    let cursor = null
    let all = []
    let redacted = []
    let guard = 0
    do {
      // eslint-disable-next-line no-await-in-loop
      const data = await fsTree(dirPath, cursor)
      all = all.concat(data.entries || [])
      if (data.redacted && data.redacted.length) redacted = redacted.concat(data.redacted)
      cursor = data.next_cursor
      guard += 1
    } while (cursor && guard < 50)
    return { entries: all, redacted }
  }, [])

  // Load the root listing on mount + whenever connectivity returns while the
  // root failed to load.
  const loadRoot = useCallback(async () => {
    setRootLoading(true)
    setRootError(null)
    try {
      const { entries, redacted } = await fetchDir('')
      setChildrenByDir((prev) => ({ ...prev, '': entries }))
      setRedactedByDir((prev) => ({ ...prev, '': redacted }))
    } catch (e) {
      setRootError(e.message || 'Could not load the file tree.')
    } finally {
      setRootLoading(false)
    }
  }, [fetchDir])

  useEffect(() => { loadRoot() }, [loadRoot])

  // Expand/collapse a directory; fetch its children on first expand.
  const toggleDir = useCallback(async (dirPath) => {
    const isOpen = expanded.has(dirPath)
    if (isOpen) {
      setExpanded((prev) => { const n = new Set(prev); n.delete(dirPath); return n })
      return
    }
    setExpanded((prev) => { const n = new Set(prev); n.add(dirPath); return n })
    if (childrenByDir[dirPath]) return  // cached — nothing to fetch
    setLoadingDirs((prev) => { const n = new Set(prev); n.add(dirPath); return n })
    setErrorDirs((prev) => { const n = { ...prev }; delete n[dirPath]; return n })
    try {
      const { entries, redacted } = await fetchDir(dirPath)
      setChildrenByDir((prev) => ({ ...prev, [dirPath]: entries }))
      setRedactedByDir((prev) => ({ ...prev, [dirPath]: redacted }))
    } catch (e) {
      setErrorDirs((prev) => ({ ...prev, [dirPath]: e.message || 'Could not list this folder.' }))
    } finally {
      setLoadingDirs((prev) => { const n = new Set(prev); n.delete(dirPath); return n })
    }
  }, [expanded, childrenByDir, fetchDir])

  // Re-fetch a directory we've already cached (after an agent edit may have
  // added/removed files in it). No-op for dirs we never expanded.
  const refreshDir = useCallback(async (dirPath) => {
    if (!(dirPath in childrenByDir)) return
    try {
      const { entries, redacted } = await fetchDir(dirPath)
      setChildrenByDir((prev) => ({ ...prev, [dirPath]: entries }))
      setRedactedByDir((prev) => ({ ...prev, [dirPath]: redacted }))
    } catch {
      // Leave the cached listing alone on a transient failure.
    }
  }, [childrenByDir, fetchDir])

  // --- Load git for the open file's directory ---
  const loadGit = useCallback(async (forPath) => {
    if (!forPath) { setGit(null); setGitError(null); return }
    setGitLoading(true)
    try {
      const g = await fsGit(dirName(forPath) || forPath)
      if (selectedRef.current !== forPath) return  // selection moved on
      setGit(g); setGitError(null)
    } catch (e) {
      if (selectedRef.current !== forPath) return
      setGit(null); setGitError(e)
    } finally {
      if (selectedRef.current === forPath) setGitLoading(false)
    }
  }, [])

  // --- Load a selected file: meta first, then body (or blob preview) ---
  const loadFile = useCallback(async (path, { external = false } = {}) => {
    if (!path) return
    // When the agent (external) re-triggers a load while the user is mid-edit,
    // do NOT clobber their unsaved buffer. We still refresh git/meta.
    const preserveBuffer = external && (dirtyRef.current || savingRef.current)
    if (!external) { setFileLoading(true); setFileError(null) }
    try {
      const m = await fsMeta(path)
      if (selectedRef.current !== path) return
      setMeta(m)
      if (m.is_binary) {
        // Binary: image preview component or a "binary file" notice render from
        // meta; no text buffer to load.
        if (!preserveBuffer) { setContent(''); setDirty(false); baselineRef.current = '' }
        setFileError(null)
        return
      }
      const text = await fsReadText(path)
      if (selectedRef.current !== path) return
      baselineRef.current = text
      if (!preserveBuffer) {
        setContent(text)
        setDirty(false)
        setSaveError(null)
      } else if (text !== content) {
        // The file changed on disk under an unsaved edit. Keep the user's
        // buffer but surface the divergence so they can decide.
        setSaveError('This file changed on disk (the agent edited it). Your unsaved edits are kept — save to overwrite, or reopen the file to discard them.')
      }
      setFileError(null)
    } catch (e) {
      if (selectedRef.current !== path) return
      if (!preserveBuffer) {
        setContent('')
        setDirty(false)
      }
      setFileError(e)
    } finally {
      if (selectedRef.current === path && !external) setFileLoading(false)
    }
  }, [content])

  // Select a file (from the tree or a git-panel tap).
  const selectFile = useCallback((path) => {
    setSelectedPath(path)
    setSaveError(null)
    setSavedAt(null)
    setGitOpen(false)
    restorePathRef.current = path
    savePrefs({ lastPath: path, expanded: Array.from(expanded) })
  }, [expanded])

  // When the selection changes, load the file + its git status.
  useEffect(() => {
    if (!selectedPath) { setMeta(null); setContent(''); setGit(null); return }
    loadFile(selectedPath)
    loadGit(selectedPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath])

  // Persist expansion set to prefs (debounced via the toggle handler is
  // overkill; a plain effect is fine — writes are best-effort + coalesced by
  // the storage layer).
  useEffect(() => {
    if (!prefsLoadedRef.current) return
    savePrefs({ lastPath: selectedRef.current, expanded: Array.from(expanded) })
  }, [expanded])

  // Restore prefs once on mount (after the root is available so expansions can
  // be honored). We expand saved dirs (fetching their children) and reopen the
  // last file. Best-effort: a saved dir that no longer exists just no-ops.
  useEffect(() => {
    if (prefsLoadedRef.current) return
    if (rootLoading) return
    prefsLoadedRef.current = true
    loadPrefs().then((prefs) => {
      if (!prefs || typeof prefs !== 'object') return
      const dirs = Array.isArray(prefs.expanded) ? prefs.expanded : []
      // Expand shallow-to-deep so each fetch's parent listing exists first.
      const ordered = [...dirs].sort((a, b) => a.split('/').length - b.split('/').length)
      ordered.reduce((p, d) => p.then(() => toggleDir(d)), Promise.resolve()).catch(() => {})
      if (typeof prefs.lastPath === 'string' && prefs.lastPath) {
        setSelectedPath(prefs.lastPath)
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootLoading])

  // --- Save the open file (explicit) ---
  const onEditorChange = useCallback((text) => {
    setContent(text)
    setDirty(text !== baselineRef.current)
    if (saveError) setSaveError(null)
  }, [saveError])

  const handleSave = useCallback(async () => {
    if (!selectedPath || !meta || !meta.writable) return
    if (savingRef.current) return
    setSaving(true)
    setSaveError(null)
    try {
      await fsWrite(selectedPath, content)
      baselineRef.current = content
      setDirty(false)
      setSavedAt(Date.now())
      // The save may have changed git status (new modified/untracked) — refresh.
      loadGit(selectedPath)
    } catch (e) {
      setSaveError(e.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }, [selectedPath, meta, content, loadGit])

  // Cmd/Ctrl-S saves (when writable). A keyboard convenience; the Save button
  // is the primary affordance.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        if (selectedRef.current && meta && meta.writable) {
          e.preventDefault()
          handleSave()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave, meta])

  // --- Agent turn done → re-read the open file + refresh its dir + git ---
  const handleTurnDone = useCallback(() => {
    const path = selectedRef.current
    if (path) {
      loadFile(path, { external: true })
      loadGit(path)
      refreshDir(dirName(path))
    } else {
      // No file open — at least refresh the root so new top-level files show.
      refreshDir('')
    }
  }, [loadFile, loadGit, refreshDir])

  // --- Drawer open/close with shell-mediated back support ---
  const closeNav = useCallback(() => {
    try { navHandleRef.current?.close?.() } catch {}
    navHandleRef.current = null
    setNavOpen(false)
  }, [])

  const openNav = useCallback(async () => {
    if (window.mobius?.nav?.open) {
      const handle = window.mobius.nav.open('editor-drawer', () => {
        navHandleRef.current = null
        setNavOpen(false)
      })
      navHandleRef.current = handle
      await handle.ready?.catch(() => false)
      if (navHandleRef.current !== handle) return
    }
    setNavOpen(true)
  }, [])

  const toggleNav = useCallback(() => { if (navOpen) closeNav(); else openNav() }, [navOpen, closeNav, openNav])

  useEffect(() => () => { try { navHandleRef.current?.close?.() } catch {} navHandleRef.current = null }, [])

  const rootEntries = childrenByDir[''] || []
  const rootRedacted = redactedByDir[''] || []
  const openName = selectedPath ? baseName(selectedPath) : null
  const repoRoot = git ? git.repo_root : null

  // What to render in the editor pane.
  function renderEditor() {
    if (!online && !meta) {
      return (
        <div className="ed-empty">
          <div className="ed-empty-mark" aria-hidden="true">⚡</div>
          <div className="ed-empty-title">Needs a connection</div>
          <p className="ed-empty-text">The Editor reads the live filesystem, so it needs the network. Reconnect to browse and edit.</p>
        </div>
      )
    }
    if (!selectedPath) {
      return (
        <div className="ed-empty">
          <div className="ed-empty-mark" aria-hidden="true">⌘</div>
          <div className="ed-empty-title">No file open</div>
          <p className="ed-empty-text">Open the tree and tap a file to view or edit it — or ask the agent below to make a change.</p>
        </div>
      )
    }
    if (fileLoading && !meta) {
      return <div className="ed-pane-note"><span className="ed-spinner" aria-hidden="true" /> Loading {openName}…</div>
    }
    if (fileError) {
      const s = fileError.status
      const msg = s === 404 ? 'This file no longer exists — it may have been deleted.'
        : s === 413 ? 'This file is too large to preview here. Ask the agent to open or summarise it.'
          : s === 403 ? 'This file is protected and can’t be viewed here.'
            : (fileError.message || 'Could not open this file.')
      return <div className="ed-pane-note is-error">{msg}</div>
    }
    if (meta && meta.is_binary) {
      if (isImagePath(selectedPath) || (meta.mime_type || '').startsWith('image/')) {
        return <div className="ed-pane ed-pane-scroll"><ImagePreview path={selectedPath} /></div>
      }
      return (
        <div className="ed-pane-note">
          Binary file — {formatBytes(meta.size)}{meta.mime_type ? ` · ${meta.mime_type}` : ''}.
          Open it with the agent if you need its contents.
        </div>
      )
    }
    // Text file. Read-only if the server says so (root-owned / platform file).
    const readOnly = !meta || !meta.writable
    return (
      <div className="ed-pane">
        {readOnly && (
          <div className="ed-readonly-note">
            Platform-managed — read-only. Ask the agent if it must change.
          </div>
        )}
        <CodeEditor
          value={content}
          markdown={isMarkdownPath(selectedPath)}
          readOnly={readOnly}
          docKey={`${selectedPath}|${readOnly ? 'ro' : 'rw'}`}
          onChange={onEditorChange}
        />
      </div>
    )
  }

  const canSave = meta && meta.writable && !meta.is_binary
  const saveLabel = saving ? 'Saving…' : dirty ? 'Save' : (savedAt ? 'Saved' : 'Save')

  return (
    <div className="ed-root">
      <style>{CSS}</style>

      <header className="ed-header">
        <button
          className="ed-icon-btn"
          onClick={toggleNav}
          aria-label={navOpen ? 'Close file tree' : 'Open file tree'}
          aria-expanded={navOpen}
        >
          ☰
        </button>
        <div className="ed-header-title">
          {openName
            ? <span className="ed-open-path" title={selectedPath}>{openName}</span>
            : <span className="ed-open-path is-muted">Editor</span>}
          {dirty && <span className="ed-dirty-dot" title="Unsaved changes" aria-label="Unsaved changes" />}
        </div>
        <div className="ed-header-right">
          {!online && <span className="ed-offline-pill" title="The Editor needs a connection">Offline</span>}
          {selectedPath && canSave && (
            <button
              className={`ed-btn ed-btn-primary${dirty ? '' : ' is-quiet'}`}
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              {saveLabel}
            </button>
          )}
        </div>
      </header>

      <div className="ed-body">
        {/* Backdrop — taps close the drawer (mobile) */}
        <div className={`ed-scrim${navOpen ? ' is-open' : ''}`} onClick={closeNav} aria-hidden="true" />

        <aside className={`ed-drawer${navOpen ? ' is-open' : ''}`} aria-label="File tree" aria-hidden={!navOpen}>
          <div className="ed-drawer-head">
            <span className="ed-drawer-title">Files</span>
            <span className="ed-drawer-sub">/data</span>
          </div>
          <div className="ed-tree ed-scroll" role="tree" aria-label="Filesystem">
            {rootLoading && rootEntries.length === 0 && (
              <div className="ed-row-note"><span className="ed-spinner" aria-hidden="true" /> Loading…</div>
            )}
            {rootError && (
              <div className="ed-row-note is-error">
                {rootError}
                <button type="button" className="ed-retry" onClick={loadRoot}>Retry</button>
              </div>
            )}
            {!rootLoading && !rootError && rootEntries.length === 0 && (
              <div className="ed-empty ed-empty-tree">
                <div className="ed-empty-mark" aria-hidden="true">∅</div>
                <div className="ed-empty-title">Nothing here</div>
                <p className="ed-empty-text">/data looks empty.</p>
              </div>
            )}
            {rootEntries.map((entry) => (
              <FileNode
                key={entry.path}
                entry={entry}
                depth={0}
                expanded={expanded}
                childrenByDir={childrenByDir}
                redactedByDir={redactedByDir}
                loadingDirs={loadingDirs}
                errorDirs={errorDirs}
                selectedPath={selectedPath}
                gitRepos={gitRepos}
                onToggleDir={toggleDir}
                onSelectFile={(p) => { selectFile(p); closeNav() }}
              />
            ))}
            {rootRedacted.length > 0 && (
              <div className="ed-row-note is-protected">{rootRedacted.length} protected</div>
            )}
          </div>
        </aside>

        <main className="ed-main">
          {selectedPath && (
            <GitPanel
              git={git}
              gitError={gitError}
              gitLoading={gitLoading}
              repoRoot={repoRoot}
              open={gitOpen}
              onToggle={() => setGitOpen((v) => !v)}
              onOpenFile={(p) => selectFile(p)}
            />
          )}
          {saveError && <div className="ed-save-error" role="status">{saveError}</div>}
          <div className="ed-editor-wrap">{renderEditor()}</div>
          <ChatPanel appId={appId} onTurnDone={handleTurnDone} />
        </main>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// Styles. One scoped stylesheet rendered once at the root, per the mini-app
// styling standard (app-component-shapes.md): semantic classNames with an
// `ed-` prefix, theme tokens only (no hard-coded brand colors), 44px touch
// targets, fenced mobius-ui blocks kept in sync with sibling apps.
// ----------------------------------------------------------------------
const CSS = `
/* mobius-ui:Root v1 — keep in sync; library candidate. Diverge below the marker only. */
.ed-root {
  position: relative;
  display: flex; flex-direction: column;
  height: 100%; width: 100%; max-width: 100%;
  overflow: hidden;
  background: var(--bg); color: var(--text); font-family: var(--font);
  -webkit-font-smoothing: antialiased;
}
/* /mobius-ui:Root */

/* mobius-ui:Header v1 — keep in sync; library candidate. Diverge below the marker only. */
.ed-header {
  flex: 0 0 auto;
  display: flex; align-items: center; gap: 10px;
  min-height: 48px; padding: 8px 12px;
  background: var(--surface); border-bottom: 1px solid var(--border);
}
/* /mobius-ui:Header */
.ed-header-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.ed-open-path {
  min-width: 0; font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ed-open-path.is-muted { color: var(--muted); font-weight: 650; }
.ed-dirty-dot {
  flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}
.ed-header-right { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.ed-offline-pill {
  display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  font-size: 11px; font-weight: 700;
}

/* mobius-ui:Button v1 — keep in sync; library candidate. Diverge below the marker only. */
.ed-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 10px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  font-family: var(--font); font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: background 0.14s ease, border-color 0.14s ease, transform 0.1s ease;
}
.ed-btn:active { transform: scale(0.97); }
.ed-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ed-btn:disabled { opacity: 0.5; cursor: default; transform: none; }
.ed-btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.ed-btn-primary:hover { filter: brightness(1.06); }
.ed-btn-icon { width: 44px; padding: 0; border-radius: 8px; font-size: 18px; }
/* /mobius-ui:Button */
/* The Save button when there's nothing to save: present but visually quiet,
   so the toolbar layout doesn't jump when an edit makes it active. */
.ed-btn-primary.is-quiet { background: var(--surface2, var(--surface)); border-color: var(--border); color: var(--muted); }
.ed-icon-btn {
  flex: 0 0 auto; width: 44px; height: 44px; padding: 0; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; background: transparent; color: var(--text);
  font-size: 18px; cursor: pointer; transition: background 0.14s ease;
}
.ed-icon-btn:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.ed-icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Body: drawer + main, side by side on wide, drawer overlays on narrow. */
.ed-body { flex: 1; min-height: 0; position: relative; display: flex; }

/* mobius-ui:Sheet v1 — keep in sync; library candidate. Diverge below the marker only. */
/* The drawer scrim reuses the sheet-scrim shape (absolute, inside the app). */
.ed-scrim {
  position: absolute; inset: 0; z-index: 30;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
}
.ed-scrim.is-open { opacity: 1; pointer-events: auto; }
/* /mobius-ui:Sheet */

.ed-drawer {
  position: absolute; top: 0; left: 0; bottom: 0; z-index: 31;
  width: 80%; max-width: 320px;
  display: flex; flex-direction: column;
  background: var(--surface); border-right: 1px solid var(--border);
  transform: translateX(-102%); transition: transform 0.22s ease;
}
.ed-drawer.is-open { transform: translateX(0); }
.ed-drawer-head {
  flex: 0 0 auto; display: flex; align-items: baseline; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--border);
}
.ed-drawer-title { font-size: 14.5px; font-weight: 700; letter-spacing: -0.01em; }
.ed-drawer-sub { font-size: 12px; color: var(--muted); font-family: var(--mono); }

/* mobius-ui:Scrollskin v1 — keep in sync; library candidate. Add the ed-scroll class to a scroller. */
.ed-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.ed-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
.ed-scroll::-webkit-scrollbar-thumb:hover { background: var(--muted); background-clip: padding-box; }
.ed-scroll::-webkit-scrollbar-track { background: transparent; }
/* /mobius-ui:Scrollskin */

.ed-tree { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 6px 0 24px; }

.ed-row {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 38px;
  padding: 6px 12px 6px 0; text-align: left;
  background: transparent; border: 0; color: var(--text);
  font-family: var(--font); font-size: 14px; cursor: pointer;
  transition: background 0.12s ease;
}
.ed-row:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.ed-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ed-row-file.is-selected { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.ed-row-file.is-selected .ed-row-name { font-weight: 650; color: var(--text); }
.ed-row-caret { flex: 0 0 auto; width: 14px; font-size: 11px; color: var(--muted); text-align: center; }
.ed-row-glyph {
  flex: 0 0 auto; width: 18px; text-align: center; font-size: 11px; font-weight: 700;
  color: var(--accent); font-family: var(--mono);
}
.ed-row-dir .ed-row-name { font-weight: 650; }
.ed-row-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ed-row-size { flex: 0 0 auto; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.ed-git-badge {
  flex: 0 0 auto; padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 700;
  letter-spacing: 0.02em; text-transform: uppercase;
  background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent);
}
.ed-row-note {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; font-size: 12.5px; color: var(--muted);
}
.ed-row-note.is-error { color: var(--danger); flex-wrap: wrap; }
.ed-row-note.is-protected { font-style: italic; opacity: 0.75; }
.ed-retry {
  margin-left: 6px; padding: 4px 10px; border-radius: 8px; min-height: 32px;
  border: 1px solid var(--border); background: var(--surface2, var(--surface)); color: var(--text);
  font-size: 12px; font-weight: 600; cursor: pointer;
}

/* Main column: git bar + editor + chat, stacked. */
.ed-main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--bg); }

/* Git panel — compact, collapsible. */
.ed-git { flex: 0 0 auto; border-bottom: 1px solid var(--border); background: var(--surface); }
.ed-git-bar {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px;
  padding: 8px 12px; text-align: left;
  background: transparent; border: 0; color: var(--text); cursor: pointer;
  font-family: var(--font); font-size: 12.5px;
}
.ed-git-bar.is-quiet { color: var(--muted); cursor: default; min-height: 34px; font-size: 12px; }
.ed-git-caret { flex: 0 0 auto; width: 12px; font-size: 10px; color: var(--muted); }
.ed-git-branch { font-weight: 700; font-family: var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.ed-git-track { flex: 0 0 auto; color: var(--muted); font-variant-numeric: tabular-nums; }
.ed-git-counts { margin-left: auto; display: flex; align-items: center; gap: 6px; flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.ed-git-count { font-weight: 700; font-size: 11.5px; }
.ed-git-count.is-staged { color: var(--green, #4ade80); }
.ed-git-count.is-modified { color: var(--accent); }
.ed-git-count.is-untracked { color: var(--muted); }
.ed-git-count.is-clean { color: var(--muted); font-weight: 600; }
.ed-git-body { padding: 4px 12px 12px; max-height: 34vh; overflow-y: auto; }
.ed-git-group { margin-top: 8px; }
.ed-git-group-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 4px; }
.ed-git-file {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 34px;
  padding: 5px 6px; text-align: left; border-radius: 8px;
  background: transparent; border: 0; color: var(--text); cursor: pointer;
  font-family: var(--mono); font-size: 12px;
}
.ed-git-file:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.ed-git-dot { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; }
.ed-git-dot.is-staged { background: var(--green, #4ade80); }
.ed-git-dot.is-modified { background: var(--accent); }
.ed-git-dot.is-untracked { background: var(--muted); }
.ed-git-file-path { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ed-git-file-status { flex: 0 0 auto; color: var(--muted); }
.ed-git-more { margin-top: 6px; font-size: 11px; color: var(--muted); font-style: italic; }

.ed-save-error {
  flex: 0 0 auto; margin: 8px 10px 0; padding: 8px 12px; border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  color: var(--text); font-size: 12.5px; line-height: 1.45;
}

/* Editor pane — flex region above the chat. */
.ed-editor-wrap { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.ed-pane { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.ed-pane-scroll { overflow: auto; padding: 14px 16px; }
.ed-cm-host { flex: 1; min-height: 0; overflow: hidden; }
.ed-readonly-note {
  flex: 0 0 auto; padding: 7px 14px; font-size: 12px; color: var(--muted);
  background: var(--surface2, var(--surface)); border-bottom: 1px solid var(--border);
}
.ed-pane-note {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 16px; color: var(--muted); font-size: 14px; line-height: 1.5;
}
.ed-pane-note.is-error { color: var(--danger); }
.ed-note { padding: 16px; color: var(--muted); font-size: 13px; }
.ed-img { max-width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--border); display: block; }

/* mobius-ui:Empty v1 — keep in sync; library candidate. Diverge below the marker only. */
.ed-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;
  max-width: 440px; margin: auto; padding: 40px 24px; color: var(--muted);
}
.ed-empty-mark {
  width: 60px; height: 60px; margin-bottom: 8px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center; font-size: 26px; line-height: 1;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
}
.ed-empty-title { font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
.ed-empty-text { margin: 0; font-size: 13.5px; line-height: 1.55; }
/* /mobius-ui:Empty */
.ed-empty-tree { padding: 28px 20px; }

/* mobius-ui:ChatEmbed v1 — keep in sync; library candidate. Diverge below the marker only. */
.ed-chat {
  flex: 0 0 auto;
  display: flex; flex-direction: column;
  height: 42%; min-height: 200px;
  border-top: 1px solid var(--border); background: var(--surface);
}
.ed-chat-embed {
  flex: 1 1 auto; min-height: 0;
  overflow: hidden; background: var(--bg);
}
.ed-chat-embed iframe { display: block; width: 100%; height: 100%; border: 0; }
/* /mobius-ui:ChatEmbed */
.ed-chat-head {
  flex: 0 0 auto; display: flex; align-items: baseline; gap: 10px;
  padding: 8px 14px; border-bottom: 1px solid var(--border);
}
.ed-chat-title { font-size: 13px; font-weight: 700; letter-spacing: -0.01em; }
.ed-chat-hint { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ed-chat-error {
  flex: 0 0 auto; margin: 8px 12px; padding: 8px 12px; border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  color: var(--text); font-size: 12.5px;
}

/* mobius-ui:Spinner v1 — keep in sync; library candidate. */
@keyframes ed-spin { to { transform: rotate(360deg); } }
.ed-spinner {
  display: inline-block; flex: 0 0 auto;
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--accent) 18%, transparent); border-top-color: var(--accent);
  animation: ed-spin 0.8s linear infinite;
}
@media (prefers-reduced-motion: reduce) { .ed-spinner { animation: none; } }
/* /mobius-ui:Spinner */

/* On a wide viewport the drawer is a static column, not an overlay. */
@media (min-width: 760px) {
  .ed-scrim { display: none; }
  .ed-drawer {
    position: relative; transform: none; flex: 0 0 280px; max-width: 280px;
  }
  .ed-icon-btn { display: none; }
}
`
