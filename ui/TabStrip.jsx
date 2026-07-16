import { useRef } from 'react'
import { Icon } from './Icons.jsx'
import { baseName } from '../paths.js'

// ----------------------------------------------------------------------
// MiXplorer-style folder tabs. Each tab is an independent location (its own
// current directory); switching tabs is the no-dual-pane way to compare or
// jump between two folders. The strip scrolls horizontally; "+" opens a new
// tab at the current folder; the ✕ closes a tab (hidden when only one is open,
// so the last tab can't be closed). One tab always stays active.
// ----------------------------------------------------------------------
export function TabStrip({ tabs, activeTabId, onSwitch, onClose, onNew }) {
  const tabRefs = useRef([])
  const label = (path) => (path ? (baseName(path) || path) : 'data')

  const moveTabFocus = (event, index) => {
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return

    event.preventDefault()
    const next = tabs[nextIndex]
    if (!next) return
    onSwitch(next.id)
    window.requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus())
  }

  return (
    <div className="ex-tabs ex-scroll-x" role="toolbar" aria-label="Open folders">
      {tabs.map((t, index) => {
        const active = t.id === activeTabId
        return (
          <div key={t.id} className={`ex-tab${active ? ' is-active' : ''}`}>
            <button
              type="button"
              aria-pressed={active}
              tabIndex={active ? 0 : -1}
              ref={(node) => { tabRefs.current[index] = node }}
              className="ex-tab-btn"
              onClick={() => onSwitch(t.id)}
              onKeyDown={(event) => moveTabFocus(event, index)}
              title={`/data/${t.path}`}
            >
              <Icon name={t.path ? 'folder' : 'home'} size={14} className="ex-tab-icon" />
              <span className="ex-tab-label">{label(t.path)}</span>
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                className="ex-tab-close"
                onClick={() => onClose(t.id)}
                aria-label={`Close tab ${label(t.path)}`}
                title="Close tab"
              >
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
        )
      })}
      <button type="button" className="ex-tab-new" onClick={onNew} aria-label="New tab" title="New tab (this folder)">
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}
