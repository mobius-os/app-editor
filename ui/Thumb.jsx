import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons.jsx'
import { entryIcon, formatBytes } from '../paths.js'
import { fsReadBlob } from '../storage.js'
import { THUMB_MAX_BYTES } from '../constants.js'
import { isThumbable } from './EntryRow.jsx'

// ----------------------------------------------------------------------
// Grid view. There is no thumbnail endpoint — /api/fs/read streams the FULL
// image — so a naive grid of an image-heavy folder would pull tens of MB at
// once. Three guards keep it cheap: (1) VIEWPORT-GATED — an IntersectionObserver
// only fetches a tile's bytes once it scrolls into view; (2) BYTE-GATED — a
// thumb auto-loads only for images under THUMB_MAX_BYTES, bigger ones show the
// kind glyph until opened; (3) CONCURRENCY-CAPPED — at most a few blob fetches
// run at once via a tiny module-level semaphore, the rest queue.
// ----------------------------------------------------------------------

const MAX_CONCURRENT = 4
let active = 0
const waiters = []

function acquire() {
  if (active < MAX_CONCURRENT) { active += 1; return Promise.resolve() }
  return new Promise((resolve) => waiters.push(resolve))
}
function release() {
  active -= 1
  const next = waiters.shift()
  if (next) { active += 1; next() }
}

function Thumb({ path, reloadKey }) {
  const hostRef = useRef(null)
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(false)

  // Reveal on first intersection, then stop observing (once fetched it stays).
  useEffect(() => {
    const el = hostRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    let live = true
    let objectUrl = null
    let acquired = false
    setUrl(null); setFailed(false)
    acquire().then(() => {
      acquired = true
      if (!live) return null
      return fsReadBlob(path)
    }).then((blob) => {
      if (!live || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => { if (live) setFailed(true) })
      .finally(() => { if (acquired) release() })
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path, visible, reloadKey])

  return (
    <span ref={hostRef} className="ex-thumb">
      {url && !failed
        ? <img src={url} alt="" className="ex-thumb-img" />
        : <span className="ex-thumb-fallback" aria-hidden="true">{failed ? '?' : ''}</span>}
    </span>
  )
}

export function GridCell({ entry, selected, onOpen, onProps, now, reloadKey }) {
  const isDir = entry.type === 'directory'
  const ic = entryIcon(entry)
  const showThumb = isThumbable(entry) && (entry.size || 0) <= THUMB_MAX_BYTES
  return (
    <div className={`ex-cell-wrap${selected ? ' is-selected' : ''}`}>
      <button
        type="button"
        className={`ex-cell ex-cell-${isDir ? 'dir' : 'file'}`}
        onClick={() => onOpen(entry)}
        aria-current={selected ? 'true' : undefined}
        title={`/data/${entry.path}`}
      >
        <span className="ex-cell-art" aria-hidden="true">
          {showThumb
            ? <Thumb path={entry.path} reloadKey={reloadKey} />
            : <Icon name={ic.name} size={30} className={`ex-glyph ex-glyph--${ic.tone}`} />}
        </span>
        <span className="ex-cell-name">{entry.name}</span>
        <span className="ex-cell-meta">
          {isDir
            ? (typeof entry.child_count === 'number' ? `${entry.child_count >= 10000 ? '10000+' : entry.child_count} items` : '')
            : formatBytes(entry.size)}
        </span>
        {entry.is_git_repo && <span className="ex-badge-git ex-badge-git--cell">git</span>}
      </button>
      <button
        type="button"
        className="ex-cell-info"
        onClick={() => onProps(entry)}
        aria-label={`Properties of ${entry.name}`}
        title="Properties"
      >
        <Icon name="info" size={16} />
      </button>
    </div>
  )
}
