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
  const label = (path) => (path ? (baseName(path) || path) : 'data')
  return (
    <div className="ex-tabs ex-scroll-x" role="tablist" aria-label="Open folders">
      {tabs.map((t) => {
        const active = t.id === activeTabId
        return (
          <div key={t.id} className={`ex-tab${active ? ' is-active' : ''}`}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="ex-tab-btn"
              onClick={() => onSwitch(t.id)}
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
