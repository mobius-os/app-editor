import { useEffect, useState } from 'react'
import { baseName } from '../paths.js'
import { fsReadBlob } from '../storage.js'

// ----------------------------------------------------------------------
// Image preview. /api/fs/read needs a bearer token, so we fetch the bytes as a
// blob and convert to an object URL (an <img src> can't carry an auth header).
// ----------------------------------------------------------------------
export function ImagePreview({ path, reloadKey }) {
  const [url, setUrl] = useState(null)
  const [err, setErr] = useState(null)
  // reloadKey bumps whenever an agent turn re-read the open file: an image
  // regenerated at the SAME path doesn't change `path`, so without this dep the
  // effect would never re-run and the preview would keep showing stale bytes.
  useEffect(() => {
    let live = true
    let revoke = null
    setUrl(null); setErr(null)
    fsReadBlob(path).then((blob) => {
      if (!live) return
      const u = URL.createObjectURL(blob)
      revoke = u
      setUrl(u)
    }).catch((e) => { if (live) setErr(e.message || 'Image could not be loaded.') })
    return () => { live = false; if (revoke) URL.revokeObjectURL(revoke) }
  }, [path, reloadKey])
  if (err) return <div className="ed-note">{err}</div>
  if (!url) return <div className="ed-note">Loading image…</div>
  return <img className="ed-img" src={url} alt={baseName(path)} />
}
