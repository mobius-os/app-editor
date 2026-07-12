import { useEffect, useRef } from 'react'
import { Icon } from './Icons.jsx'
import {
  VIEW_LIST, VIEW_GRID, SORT_KEYS, SORT_LABELS,
} from '../constants.js'

// ----------------------------------------------------------------------
// The toolbar overflow menu — view mode, sort, folders-first, and the create /
// refresh actions, in one popover. Kept as a plain absolutely-positioned panel
// over a transparent full-screen scrim (the iframe blocks native menus, and a
// scrim is the app-wide pattern for "tap outside to close"). Escape closes;
// focus lands on the panel so keyboard users can tab through it.
// ----------------------------------------------------------------------
export function OverflowMenu({
  view, sortKey, sortDir, foldersFirst, online,
  onView, onSort, onToggleFoldersFirst, onNewFile, onNewFolder, onRefresh, onClose,
}) {
  const panelRef = useRef(null)
  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ex-menu-scrim" onClick={onClose}>
      <div
        className="ex-menu"
        ref={panelRef}
        role="menu"
        tabIndex={-1}
        aria-label="View and sort options"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ex-menu-label">View</div>
        <div className="ex-seg">
          <button type="button" className={`ex-seg-btn${view === VIEW_LIST ? ' is-on' : ''}`} onClick={() => onView(VIEW_LIST)} aria-pressed={view === VIEW_LIST}>
            <Icon name="list" size={16} /> List
          </button>
          <button type="button" className={`ex-seg-btn${view === VIEW_GRID ? ' is-on' : ''}`} onClick={() => onView(VIEW_GRID)} aria-pressed={view === VIEW_GRID}>
            <Icon name="grid" size={16} /> Grid
          </button>
        </div>

        <div className="ex-menu-label">Sort by</div>
        {SORT_KEYS.map((k) => {
          const active = sortKey === k
          return (
            <button
              key={k}
              type="button"
              className={`ex-menu-item${active ? ' is-active' : ''}`}
              role="menuitemradio"
              aria-checked={active}
              onClick={() => onSort(k)}
              title={active ? 'Tap to reverse direction' : `Sort by ${SORT_LABELS[k]}`}
            >
              <span className="ex-menu-check">{active && <Icon name="check" size={15} />}</span>
              <span className="ex-menu-item-text">{SORT_LABELS[k]}</span>
              {active && <span className="ex-menu-dir" aria-hidden="true">{sortDir === 'desc' ? '↓' : '↑'}</span>}
            </button>
          )
        })}

        <button type="button" className="ex-menu-item" role="menuitemcheckbox" aria-checked={foldersFirst} onClick={onToggleFoldersFirst}>
          <span className="ex-menu-check">{foldersFirst && <Icon name="check" size={15} />}</span>
          <span className="ex-menu-item-text">Folders first</span>
        </button>

        <div className="ex-menu-divider" />

        <button type="button" className="ex-menu-item" onClick={() => { onNewFile(); onClose() }} disabled={!online}>
          <span className="ex-menu-check"><Icon name="file" size={15} /></span>
          <span className="ex-menu-item-text">New file</span>
        </button>
        <button type="button" className="ex-menu-item" onClick={() => { onNewFolder(); onClose() }} disabled={!online}>
          <span className="ex-menu-check"><Icon name="folder" size={15} /></span>
          <span className="ex-menu-item-text">New folder</span>
        </button>
        <button type="button" className="ex-menu-item" onClick={() => { onRefresh(); onClose() }} disabled={!online}>
          <span className="ex-menu-check"><Icon name="refresh" size={15} /></span>
          <span className="ex-menu-item-text">Refresh</span>
        </button>
      </div>
    </div>
  )
}
