import {
  EditorView, keymap, ViewPlugin, Decoration, WidgetType,
  lineNumbers, highlightActiveLine, highlightActiveLineGutter,
} from '@codemirror/view'
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, HighlightStyle, indentOnInput, syntaxTree } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import katex from 'katex'

// The pure path / name / format helpers this module used to also hold now live
// in paths.js (dependency-free so they unit-test under a bare `node --test`).
// This module keeps only the CodeMirror + markdown + KaTeX editor engine, which
// depends on the importmap-provided packages imported above.

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
export class CheckboxWidget extends WidgetType {
  constructor(checked, pos) { super(); this.checked = checked; this.pos = pos }
  eq(o) { return o.checked === this.checked && o.pos === this.pos }
  toDOM(view) {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = this.checked
    // In a read-only doc (platform-managed file) a change transaction is
    // silently filtered, so the toggle would do nothing — render it disabled
    // and non-interactive instead of looking live-but-dead.
    const ro = view.state.readOnly
    box.style.cssText = `margin:0 6px 0 0; cursor:${ro ? 'default' : 'pointer'}; vertical-align:middle; accent-color:var(--accent)`
    if (ro) {
      box.disabled = true
    } else {
      box.addEventListener('mousedown', (e) => {
        e.preventDefault()
        const insert = this.checked ? '[ ]' : '[x]'
        view.dispatch({ changes: { from: this.pos, to: this.pos + 3, insert } })
      })
    }
    return box
  }
  ignoreEvent() { return false }
}

export class MathWidget extends WidgetType {
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

export const HIDE_MARKS = new Set(['HeaderMark', 'EmphasisMark', 'StrikethroughMark', 'QuoteMark', 'ListMark', 'LinkMark', 'CodeMark', 'CodeInfo'])
export const INLINE_MATH = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g
export const BLOCK_MATH = /\$\$([^\n]+?)\$\$/g

export function scanMath(state, ranges, onActive, out) {
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

export function livePreview() {
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

export const heading = (size, weight) => ({ fontSize: size, fontWeight: weight, lineHeight: '1.3' })
export const mdHighlight = HighlightStyle.define([
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

// The platform ships the core CodeMirror runtime and Markdown parser. Source
// files still deserve useful color, so the light editor marks common tokens in
// the visible viewport without pulling a language bundle for every file type.
// The tokenizer is intentionally conservative: comments and strings win, then
// keywords, literals, numbers, and JSX-style tags. Unknown extensions stay
// readable monospace with no speculative color.
const SOURCE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'css', 'scss', 'html',
  'htm', 'py', 'sh', 'bash', 'yaml', 'yml', 'toml', 'sql',
])

const SOURCE_TOKEN_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(import|from|as|export|default|const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|new|class|extends|async|await|yield|typeof|instanceof|in|of|def|lambda|with|elif|fi|then|select|insert|update|delete|create|where|join|order|group|by)\b|\b(true|false|null|undefined|None|True|False)\b|\b(0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|(<\/?[A-Za-z][\w.-]*)/g

export function sourceKind(path) {
  const name = String(path || '').split('/').pop() || ''
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
  return SOURCE_EXTENSIONS.has(ext) ? ext : ''
}

function tokenClass(match) {
  if (match[1]) return 'cm-syn-comment'
  if (match[2]) return 'cm-syn-string'
  if (match[3]) return 'cm-syn-keyword'
  if (match[4]) return 'cm-syn-literal'
  if (match[5]) return 'cm-syn-number'
  return 'cm-syn-tag'
}

export function sourceHighlight(path) {
  const kind = sourceKind(path)
  if (!kind) return []
  return ViewPlugin.fromClass(
    class {
      constructor(view) { this.decorations = this.build(view) }
      update(update) {
        if (update.docChanged || update.viewportChanged) this.decorations = this.build(update.view)
      }
      build(view) {
        const marks = []
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.sliceDoc(from, to)
          SOURCE_TOKEN_RE.lastIndex = 0
          let match
          while ((match = SOURCE_TOKEN_RE.exec(text))) {
            const start = from + match.index
            marks.push(Decoration.mark({ class: tokenClass(match) }).range(start, start + match[0].length))
          }
        }
        return Decoration.set(marks, true)
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}

export const cmTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--text)' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font)', lineHeight: '1.65', fontSize: '15px', overscrollBehavior: 'contain' },
  '.cm-content': { padding: '14px 16px 30vh', caretColor: 'var(--accent)', maxWidth: '760px', margin: '0 auto', width: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
  '.cm-line': { padding: '0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--muted)', border: 'none' },
})

// A plain-text theme for non-markdown source — monospace, no markdown
// highlighting, no live preview. Same chrome as the markdown editor.
export const cmThemePlain = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'color-mix(in srgb, var(--bg) 88%, #000 12%)', color: 'var(--text)' },
  '.cm-scroller': {
    overflow: 'auto', fontFamily: 'var(--mono, "SFMono-Regular", "Cascadia Code", ui-monospace, monospace)',
    fontVariantLigatures: 'contextual common-ligatures', letterSpacing: '0.005em',
    lineHeight: '1.68', fontSize: '13.5px', overscrollBehavior: 'contain', scrollbarWidth: 'none',
  },
  '.cm-content': { padding: '16px 18px 35vh 8px', caretColor: 'var(--accent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
  '.cm-gutters': { backgroundColor: 'color-mix(in srgb, var(--surface) 72%, var(--bg) 28%)', color: 'color-mix(in srgb, var(--muted) 72%, transparent)', border: 'none', paddingLeft: '5px' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 6px', minWidth: '30px' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--text)' },
  '.cm-syn-comment': { color: 'var(--ed-code-comment)', fontStyle: 'italic' },
  '.cm-syn-string': { color: 'var(--ed-code-string)' },
  '.cm-syn-keyword': { color: 'var(--ed-code-keyword)', fontWeight: '650' },
  '.cm-syn-literal': { color: 'var(--ed-code-literal)' },
  '.cm-syn-number': { color: 'var(--ed-code-number)' },
  '.cm-syn-tag': { color: 'var(--ed-code-tag)' },
})

export function buildMarkdownExtensions(onDocChange) {
  return [
    history(),
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(mdHighlight),
    indentOnInput(),
    EditorView.lineWrapping,
    livePreview(),
    keymap.of([indentWithTab, ...historyKeymap, ...defaultKeymap]),
    cmTheme,
    EditorView.updateListener.of((u) => { if (u.docChanged) onDocChange(u.state.doc.toString()) }),
  ]
}

export function buildPlainExtensions(onDocChange, path) {
  return [
    history(),
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    sourceHighlight(path),
    EditorView.lineWrapping,
    keymap.of([indentWithTab, ...historyKeymap, ...defaultKeymap]),
    cmThemePlain,
    EditorView.updateListener.of((u) => { if (u.docChanged) onDocChange(u.state.doc.toString()) }),
  ]
}

export function agentSystemPrompt() {
  return [
    'You help the owner view and edit any file on their Möbius. Paths are',
    'relative to /data (for example "apps/notes/index.jsx" is',
    '/data/apps/notes/index.jsx); the injected app_context lists the available',
    'directories.',
    '',
    'When the owner asks for a change, MAKE the edit directly with Edit/Write —',
    'do not just describe it. Prefer the file the owner is most likely looking',
    'at unless they name another, then say what you changed in one short',
    'sentence.',
    '',
    'This is a silent setup brief — do NOT reply to it. Wait for the owner’s',
    'first message and act on that.',
  ].join('\n')
}
