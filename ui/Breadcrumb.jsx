import { useEffect, useRef } from 'react'
import { Icon } from './Icons.jsx'
import { pathSegments } from '../paths.js'

// ----------------------------------------------------------------------
// The location bar — MiXplorer's tappable breadcrumb. Each ancestor segment is
// a button that jumps straight to that level; the current (last) segment is
// bold and inert. The strip scrolls horizontally on a narrow phone and
// auto-scrolls to the end on navigation so the folder you just entered is
// always in view (the deep end, not the /data root, is what you care about).
// ----------------------------------------------------------------------
export function Breadcrumb({ path, onNavigate }) {
  const scrollRef = useRef(null)
  const segs = pathSegments(path)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [path])

  return (
    <nav className="ex-crumbs ex-scroll-x" ref={scrollRef} aria-label="Location">
      {segs.map((seg, i) => {
        const last = i === segs.length - 1
        const key = seg.path || '__root__'
        const label = i === 0 ? (
          <span className="ex-crumb-home"><Icon name="home" size={15} /><span className="ex-crumb-home-text">data</span></span>
        ) : seg.name
        if (last) {
          return (
            <span key={key} className="ex-crumb is-current" aria-current="page">{label}</span>
          )
        }
        return (
          <span key={key} className="ex-crumb-group">
            <button type="button" className="ex-crumb" onClick={() => onNavigate(seg.path)} title={`/data/${seg.path}`}>
              {label}
            </button>
            <Icon name="chevron-right" size={14} className="ex-crumb-sep" />
          </span>
        )
      })}
    </nav>
  )
}
