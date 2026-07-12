import { Icon } from './Icons.jsx'
import { CodeEditor } from './CodeEditor.jsx'
import { ImagePreview } from './ImagePreview.jsx'
import { ChatBubbleIcon } from './ChatBubbleIcon.jsx'
import {
  baseName, formatBytes, isMarkdownPath, isImagePath,
} from '../paths.js'

// ----------------------------------------------------------------------
// The file viewer / light editor — the right pane on desktop, a pushed
// full-screen surface on phone. Reader-first: a file opens as a preview
// (CodeMirror markdown live-preview / plain monospace for text, ImagePreview
// for images, an honest notice for binary / too-large / read-only). WRITABILITY
// drives editability — no mode toggle — so a writable text file is directly
// editable with Save appearing, exactly as before. Every save-safety banner
// (disk-divergence notice, save error, read-only, truncated-peek) is surfaced
// here; the App owns the state machine and passes the flags down.
// ----------------------------------------------------------------------
export function FileViewer({
  path, meta, content, onChange, fileLoading, fileError,
  dirty, saving, canSave, saveError, diskNotice,
  truncated, truncatedTotal, online, showBack, onBack, onSave, onAskAgent, fileReloadKey,
}) {
  const name = baseName(path)
  const readOnly = !canSave
  const isImage = meta && (meta.is_binary
    ? (isImagePath(path) || (meta.mime_type || '').startsWith('image/'))
    : false)

  function body() {
    if (fileLoading && !meta) {
      return <div className="ex-view-note"><span className="ex-spinner" aria-hidden="true" /> Loading {name}…</div>
    }
    if (fileError) {
      const s = fileError.status
      const msg = s === 401 ? 'Sign in as the owner to view files.'
        : s === 404 ? 'This file no longer exists — it may have been deleted.'
          : s === 413 ? 'This file is too large to preview here. Ask the agent to open or summarise it.'
            : s === 403 ? 'This file is protected and can’t be viewed here.'
              : (fileError.message || 'Could not open this file.')
      return <div className="ex-view-note is-error">{msg}</div>
    }
    if (meta && meta.is_binary) {
      if (isImage) {
        return <div className="ex-view-scroll"><ImagePreview path={path} reloadKey={fileReloadKey} /></div>
      }
      return (
        <div className="ex-view-note">
          Binary file — {formatBytes(meta.size)}{meta.mime_type ? ` · ${meta.mime_type}` : ''}.
          Open it with the agent if you need its contents.
        </div>
      )
    }
    if (!meta) return null
    return (
      <div className="ex-view-pane">
        {truncated && (
          <div className="ex-view-banner">
            Large file — showing the first 256&nbsp;KB{truncatedTotal ? ` of ${formatBytes(truncatedTotal)}` : ''} (read-only). Ask the agent to open it fully.
          </div>
        )}
        {!truncated && readOnly && (
          <div className="ex-view-banner">Platform-managed — read-only. Ask the agent if it must change.</div>
        )}
        <CodeEditor
          value={content}
          markdown={isMarkdownPath(path)}
          readOnly={readOnly}
          docKey={`${path}${truncated ? '#head' : ''}`}
          onChange={onChange}
        />
      </div>
    )
  }

  return (
    <section className="ex-view">
      <header className="ex-view-head">
        {showBack && (
          <button type="button" className="ex-icon-btn" onClick={onBack} aria-label="Back to files">
            <Icon name="arrow-left" size={20} />
          </button>
        )}
        <span className="ex-view-title" title={`/data/${path}`}>{name}</span>
        {dirty && <span className="ex-dirty-dot" title="Unsaved changes" aria-label="Unsaved changes" />}
        <div className="ex-view-actions">
          {canSave && (
            <button
              type="button"
              className={`ex-btn ex-btn-primary${dirty ? '' : ' is-quiet'}`}
              onClick={onSave}
              disabled={saving || !dirty}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          <button type="button" className="ex-icon-btn" onClick={() => onAskAgent(path)} aria-label="Ask the agent about this file" title="Ask the agent">
            <ChatBubbleIcon size={19} />
          </button>
        </div>
      </header>
      {diskNotice && <div className="ex-view-alert is-notice" role="status">{diskNotice}</div>}
      {saveError && <div className="ex-view-alert" role="status">{saveError}</div>}
      <div className="ex-view-wrap">{body()}</div>
    </section>
  )
}
