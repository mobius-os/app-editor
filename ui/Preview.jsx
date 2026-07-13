import { useEffect, useState } from 'react'
import { baseName, mediaKind, formatBytes } from '../paths.js'
import { fsReadBlob } from '../storage.js'

// ----------------------------------------------------------------------
// Inline preview for the "core" binary types a file manager should render:
// images, audio, video, and PDF. /api/fs/read needs a bearer token (an
// <img>/<video> src can't carry one), so we fetch the bytes as a blob — with
// the server's content-type already set — and hand a same-origin object URL to
// the right element. The read cap is 5 MB, so a bigger media file comes back as
// a 413 and we show a clear "too large to preview" notice instead of a broken
// element. `reloadKey` re-fetches after an agent turn regenerates the file at
// the same path.
// ----------------------------------------------------------------------
export function Preview({ path, mime, size, reloadKey }) {
  const [url, setUrl] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    let live = true
    let revoke = null
    setUrl(null); setErr(null)
    fsReadBlob(path).then((blob) => {
      if (!live) return
      const u = URL.createObjectURL(blob)
      revoke = u
      setUrl(u)
    }).catch((e) => {
      if (!live) return
      setErr(e && e.status === 413
        ? `Too large to preview here${size ? ` (${formatBytes(size)})` : ''}. Ask the agent to open it.`
        : (e.message || 'Could not load this file.'))
    })
    return () => { live = false; if (revoke) URL.revokeObjectURL(revoke) }
  }, [path, reloadKey, size])

  if (err) return <div className="ed-note">{err}</div>
  if (!url) return <div className="ed-note">Loading…</div>

  const kind = mediaKind(path, mime || '')
  if (kind === 'video') {
    return <video className="ex-media-video" src={url} controls playsInline preload="metadata" />
  }
  if (kind === 'audio') {
    return (
      <div className="ex-media-audio">
        <audio src={url} controls preload="metadata" />
      </div>
    )
  }
  if (kind === 'pdf') {
    // A same-origin blob: URL renders in the browser's built-in PDF viewer. If a
    // sandbox blocks the embed the object's fallback link lets the owner open it.
    return (
      <object className="ex-media-pdf" data={url} type="application/pdf" aria-label={baseName(path)}>
        <div className="ed-note">
          This PDF can’t be shown inline here. <a href={url} target="_blank" rel="noreferrer">Open it in a new tab</a>.
        </div>
      </object>
    )
  }
  return <img className="ed-img" src={url} alt={baseName(path)} />
}
