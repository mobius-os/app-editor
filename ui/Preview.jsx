import { useEffect, useRef, useState } from 'react'
import { baseName, mediaKind, formatBytes } from '../paths.js'
import { fsReadBlob } from '../storage.js'

// ----------------------------------------------------------------------
// Inline preview for the "core" binary types a file manager should render:
// images, audio, video, and PDF. /api/fs/read needs a bearer token (an
// <img>/<video> src can't carry one), so we fetch the bytes as a blob — with
// the server's content-type already set — and hand a same-origin object URL to
// the right element. The read cap is 5 MB, so a bigger media file comes back as
// a 413 and we show a clear "too large to preview" notice instead of a broken
// element. `reloadKey` re-fetches after an agent turn regenerates the file.
// ----------------------------------------------------------------------

const PDF_MAX_PAGES = 25

// PDF renders through pdf.js (vendored, same-origin worker) so it works inside
// the app sandbox where the browser's native PDF plugin is blocked. Pages are
// drawn to canvases scaled to the pane width; on any failure it degrades to an
// <object> embed + open-in-new-tab link.
function PdfPreview({ blob, url, name }) {
  const hostRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const [total, setTotal] = useState(0)
  const [rendered, setRendered] = useState(0)

  useEffect(() => {
    let live = true
    const host = hostRef.current
    if (host) host.textContent = ''
    setFailed(false); setTotal(0); setRendered(0)
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        try { pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs' } catch { /* set once */ }
        const buf = await blob.arrayBuffer()
        if (!live) return
        const doc = await pdfjs.getDocument({ data: buf }).promise
        if (!live) { doc.destroy?.(); return }
        setTotal(doc.numPages)
        const pages = Math.min(doc.numPages, PDF_MAX_PAGES)
        const width = (host && host.clientWidth) || 800
        for (let i = 1; i <= pages && live; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          const page = await doc.getPage(i)
          const unit = page.getViewport({ scale: 1 })
          const scale = Math.min(2, Math.max(0.4, (width - 2) / unit.width))
          const vp = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.className = 'ex-pdf-page'
          canvas.width = Math.ceil(vp.width)
          canvas.height = Math.ceil(vp.height)
          if (host && live) host.appendChild(canvas)
          // eslint-disable-next-line no-await-in-loop
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
          if (live) setRendered(i)
        }
        if (live) doc.destroy?.()
      } catch {
        if (live) setFailed(true)
      }
    })()
    return () => { live = false }
  }, [blob])

  if (failed) {
    return (
      <object className="ex-media-pdf" data={url} type="application/pdf" aria-label={name}>
        <div className="ed-note">
          This PDF can’t be shown inline here. <a href={url} target="_blank" rel="noreferrer">Open it in a new tab</a>.
        </div>
      </object>
    )
  }
  return (
    <div className="ex-pdf">
      <div className="ex-pdf-pages" ref={hostRef} />
      {total > PDF_MAX_PAGES && rendered >= PDF_MAX_PAGES && (
        <div className="ed-note">Showing the first {PDF_MAX_PAGES} of {total} pages.</div>
      )}
    </div>
  )
}

export function Preview({ path, mime, size, reloadKey }) {
  const [state, setState] = useState({ url: null, blob: null, err: null })
  useEffect(() => {
    let live = true
    let revoke = null
    setState({ url: null, blob: null, err: null })
    fsReadBlob(path).then((blob) => {
      if (!live) return
      const url = URL.createObjectURL(blob)
      revoke = url
      setState({ url, blob, err: null })
    }).catch((e) => {
      if (!live) return
      setState({
        url: null,
        blob: null,
        err: e && e.status === 413
          ? `Too large to preview here${size ? ` (${formatBytes(size)})` : ''}. Ask the agent to open it.`
          : (e.message || 'Could not load this file.'),
      })
    })
    return () => { live = false; if (revoke) URL.revokeObjectURL(revoke) }
  }, [path, reloadKey, size])

  if (state.err) return <div className="ed-note">{state.err}</div>
  if (!state.url) return <div className="ed-note">Loading…</div>

  const kind = mediaKind(path, mime || '')
  if (kind === 'video') {
    return <video className="ex-media-video" src={state.url} controls playsInline preload="metadata" />
  }
  if (kind === 'audio') {
    return (
      <div className="ex-media-audio">
        <audio src={state.url} controls preload="metadata" />
      </div>
    )
  }
  if (kind === 'pdf') {
    return <PdfPreview blob={state.blob} url={state.url} name={baseName(path)} />
  }
  return <img className="ed-img" src={state.url} alt={baseName(path)} />
}
