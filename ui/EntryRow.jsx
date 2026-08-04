import { Icon } from './Icons.jsx'
import {
  entryIcon, formatBytes, relativeTime,
} from '../paths.js'

// ----------------------------------------------------------------------
// One row in the detail LIST view — the inspector's primary surface. A row is
// a single tap target (drill into a dir / open a file) with a trailing info
// button that opens the Properties sheet (destructive delete lives there, not
// on the row, so a dense list stays calm).
//
// Observability lives in the row: relative modified time, exact size, and an
// immediate item-count for folders (when the server sent child_count).
// ----------------------------------------------------------------------
export function EntryRow({ entry, selected, onOpen, onProps, now }) {
  const isDir = entry.type === 'directory'
  const ic = entryIcon(entry)
  const rel = relativeTime(entry.modified_at, now)

  // Folder secondary line: "N items · 3d ago" (item count only when the server
  // supplied child_count via ?counts=1). File secondary: "1.2 KB · 3d ago".
  const meta = []
  if (isDir) {
    if (typeof entry.child_count === 'number') {
      meta.push(entry.child_count >= 10000 ? '10000+ items' : `${entry.child_count} item${entry.child_count === 1 ? '' : 's'}`)
    }
  } else {
    meta.push(formatBytes(entry.size))
  }
  if (rel) meta.push(rel)

  return (
    <div className={`ex-row-wrap${selected ? ' is-selected' : ''}`} role="listitem">
      <button
        type="button"
        className={`ex-row ex-row-${isDir ? 'dir' : 'file'}`}
        onClick={() => onOpen(entry)}
        aria-current={selected ? 'true' : undefined}
        title={`/data/${entry.path}`}
      >
        <span className="ex-row-icon" aria-hidden="true">
          <Icon name={ic.name} size={20} className={`ex-glyph ex-glyph--${ic.tone}`} />
        </span>
        <span className="ex-row-body">
          <span className="ex-row-name-line">
            <span className="ex-row-name">{entry.name}</span>
          </span>
          <span className="ex-row-meta">{meta.join(' · ')}</span>
        </span>
        {isDir && <Icon name="chevron-right" size={17} className="ex-row-chevron" />}
      </button>
      <button
        type="button"
        className="ex-row-info"
        onClick={() => onProps(entry)}
        aria-label={`Properties of ${entry.name}`}
        title="Properties"
      >
        <Icon name="info" size={18} />
      </button>
    </div>
  )
}
