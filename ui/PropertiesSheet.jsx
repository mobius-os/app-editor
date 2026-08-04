import { useRef, useState } from 'react'
import { Icon } from './Icons.jsx'
import { useModalFocus } from './useModalFocus.js'
import {
  formatBytes, formatDateAbs, relativeTime, kindLabel, entryIcon,
} from '../paths.js'

// ----------------------------------------------------------------------
// The Properties sheet — the deep inspector for one file or folder, and the
// home for the single destructive action (delete). Everything the FS API knows
// about an item in one place: full path, kind + MIME, exact size (or immediate
// item count for a folder), modified time (absolute + relative), whether the
// owner can edit it or it is platform-managed, and text vs binary. A
// bottom-sheet on phone, a centered card on desktop; the iframe
// blocks native dialogs so this is an in-app modal like the others.
//
// Honest about limits: a folder shows its IMMEDIATE item count (one listing
// call), not a recursive size — the API has no bounded du, so we do not invent
// a number. When a du endpoint lands this is the one place to surface it.
// ----------------------------------------------------------------------
function Row({ label, children, mono }) {
  if (children == null || children === '') return null
  return (
    <div className="ex-prop-row">
      <div className="ex-prop-key">{label}</div>
      <div className={`ex-prop-val${mono ? ' is-mono' : ''}`}>{children}</div>
    </div>
  )
}

export function PropertiesSheet({
  entry, detail, dirCount, du, duLoading, loading, error,
  canDelete, onOpen, onDelete, onAskAgent, onClose,
}) {
  const closeRef = useRef(null)
  const { dialogRef, onKeyDown } = useModalFocus(closeRef)
  const [copied, setCopied] = useState(false)
  if (!entry) return null
  const isDir = entry.type === 'directory'
  const abs = `/data/${entry.path}`

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(abs)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch { /* clipboard blocked — the path is visible to select anyway */ }
  }

  const size = detail && typeof detail.size === 'number' ? detail.size : entry.size
  const mime = (detail && detail.mime_type) || entry.mime_type
  const modified = (detail && detail.modified_at) || entry.modified_at
  const writable = detail ? detail.writable : undefined
  const itemCount = typeof entry.child_count === 'number' ? entry.child_count
    : (typeof dirCount === 'number' ? dirCount : null)

  return (
    <div className="ex-modal-scrim" onClick={onClose}>
      <div
        className="ex-sheet"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Properties of ${entry.name}`}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ex-sheet-head">
          <span className="ex-sheet-icon" aria-hidden="true">
            <Icon name={entryIcon(entry).name} size={22} className={`ex-glyph ex-glyph--${entryIcon(entry).tone}`} />
          </span>
          <span className="ex-sheet-name" title={entry.name}>{entry.name}</span>
          <button type="button" className="ex-sheet-x" ref={closeRef} onClick={onClose} aria-label="Close properties"><Icon name="x" size={18} /></button>
        </div>

        <div className="ex-sheet-body ex-scroll">
          <Row label="Path" mono>
            <button type="button" className="ex-copy-path" onClick={copyPath} title="Copy path">
              <span className="ex-copy-path-text">{abs}</span>
              <span className="ex-copy-path-icon">{copied ? <Icon name="check" size={14} /> : <Icon name="file" size={14} />}</span>
            </button>
          </Row>
          <Row label="Kind">{isDir ? 'Folder' : kindLabel(entry.name)}</Row>
          {isDir
            ? <Row label="Contents">{itemCount != null ? `${itemCount >= 10000 ? '10000+' : itemCount} item${itemCount === 1 ? '' : 's'} (top level)` : (loading ? 'counting…' : '—')}</Row>
            : <Row label="Size">{typeof size === 'number' ? `${formatBytes(size)}  ·  ${size.toLocaleString()} bytes` : '—'}</Row>}
          {isDir && (duLoading || du) && (
            <Row label="Recursive">
              {du
                ? <span>{formatBytes(du.bytes)}{du.truncated ? '+' : ''} · {du.files.toLocaleString()} file{du.files === 1 ? '' : 's'}, {du.dirs.toLocaleString()} folder{du.dirs === 1 ? '' : 's'}{du.truncated ? <span className="ex-prop-note"> (partial — huge tree)</span> : ''}</span>
                : <span className="ex-prop-measuring"><span className="ex-spinner" aria-hidden="true" /> measuring subtree…</span>}
            </Row>
          )}
          {!isDir && <Row label="MIME" mono>{mime || 'unknown'}</Row>}
          <Row label="Modified">{modified ? `${formatDateAbs(modified)}  ·  ${relativeTime(modified)}` : '—'}</Row>
          {!isDir && detail && <Row label="Content">{detail.is_binary ? 'Binary' : 'Text'}</Row>}
          {!isDir && detail && <Row label="Access">{writable ? 'Owner-editable' : 'Read-only (platform-managed)'}</Row>}
          {error && <div className="ex-sheet-error">{error}</div>}
        </div>

        <div className="ex-sheet-actions">
          <button type="button" className="ex-btn ex-btn-primary" onClick={() => onOpen(entry)}>
            {isDir ? 'Open folder' : 'Open'}
          </button>
          <button type="button" className="ex-btn" onClick={() => onAskAgent(entry)}>Ask agent</button>
          {canDelete && (
            <button type="button" className="ex-btn ex-btn-danger" onClick={() => onDelete(entry)}>
              <Icon name="trash" size={15} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
