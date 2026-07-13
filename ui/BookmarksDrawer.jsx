import { Icon } from './Icons.jsx'
import { formatBytes, baseName, diskUsage } from '../paths.js'

// ----------------------------------------------------------------------
// The drawer CONTENT — the Möbius-meaningful replacement for MiXplorer's
// internal/SD/USB storage list: a curated set of jump points to the places on
// the server worth inspecting (apps, shared, memory, skills, logs…), the
// owner's own pinned folders, and a recents list. The <aside> shell, scrim, and
// swipe-to-close live in the App (reused from the shell drawer); this renders
// what goes inside. A disk gauge at the top answers "how full is my server" the
// moment the drawer opens.
// ----------------------------------------------------------------------
export function BookmarksDrawer({
  shortcuts, bookmarks, recents, currentPath,
  onNavigate, onUnpin, onPinCurrent, canPinCurrent, disk,
}) {
  const d = diskUsage(disk)

  return (
    <div className="ex-drawer-content ex-scroll">
      <div className="ex-drawer-head">
        <span className="ex-drawer-title">Möbius</span>
        <span className="ex-drawer-sub">/data</span>
      </div>

      {d && (
        <div className="ex-drawer-disk" title="The host filesystem backing /data (not a Möbius quota)">
          <div className="ex-drawer-disk-top">
            <Icon name="disk" size={15} />
            <span>{formatBytes(d.used)} used</span>
            <span className="ex-drawer-disk-free">{formatBytes(d.free)} free</span>
          </div>
          <span className="ex-disk-track" aria-hidden="true">
            <span className={`ex-disk-fill${d.pct >= 90 ? ' is-full' : ''}`} style={{ width: `${d.pct}%` }} />
          </span>
        </div>
      )}

      <div className="ex-drawer-section-label">Places</div>
      {shortcuts.map((s) => {
        const active = (s.path || '') === (currentPath || '')
        return (
          <button
            key={s.path || '__home__'}
            type="button"
            className={`ex-shortcut${active ? ' is-active' : ''}`}
            onClick={() => onNavigate(s.path)}
            aria-current={active ? 'true' : undefined}
          >
            <span className="ex-shortcut-icon"><Icon name={s.icon || 'folder'} size={18} /></span>
            <span className="ex-shortcut-body">
              <span className="ex-shortcut-label">{s.label}</span>
              <span className="ex-shortcut-hint">{s.hint}</span>
            </span>
          </button>
        )
      })}

      {bookmarks.length > 0 && (
        <>
          <div className="ex-drawer-section-label">Pinned</div>
          {bookmarks.map((p) => {
            const active = p === (currentPath || '')
            return (
              <div key={p} className={`ex-shortcut-wrap${active ? ' is-active' : ''}`}>
                <button type="button" className="ex-shortcut" onClick={() => onNavigate(p)} aria-current={active ? 'true' : undefined}>
                  <span className="ex-shortcut-icon"><Icon name="star-filled" size={16} /></span>
                  <span className="ex-shortcut-body">
                    <span className="ex-shortcut-label">{baseName(p) || p}</span>
                    <span className="ex-shortcut-hint">{p}</span>
                  </span>
                </button>
                <button type="button" className="ex-shortcut-unpin" onClick={() => onUnpin(p)} aria-label={`Unpin ${p}`} title="Unpin">
                  <Icon name="x" size={15} />
                </button>
              </div>
            )
          })}
        </>
      )}

      {recents.length > 0 && (
        <>
          <div className="ex-drawer-section-label">Recent</div>
          {recents.map((p) => (
            <button key={p || '__r_home__'} type="button" className="ex-shortcut ex-shortcut--recent" onClick={() => onNavigate(p)}>
              <span className="ex-shortcut-icon"><Icon name="clock" size={16} /></span>
              <span className="ex-shortcut-body">
                <span className="ex-shortcut-label">{p ? (baseName(p) || p) : '/data'}</span>
                {p && <span className="ex-shortcut-hint">{p}</span>}
              </span>
            </button>
          ))}
        </>
      )}

      <div className="ex-drawer-foot">
        <button
          type="button"
          className="ex-pin-current"
          onClick={onPinCurrent}
          disabled={!canPinCurrent}
          title={canPinCurrent ? 'Pin this folder to the drawer' : 'This folder is already pinned (or is a Place)'}
        >
          <Icon name="star" size={15} /> Pin current folder
        </button>
      </div>
    </div>
  )
}
