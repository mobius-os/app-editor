import { formatBytes, diskUsage } from '../paths.js'

// ----------------------------------------------------------------------
// Persistent bottom status bar — the directory census + a disk gauge. The
// census is scoped HONESTLY to the current directory's IMMEDIATE contents
// ("files here", the sum of this level's file bytes), never a fake recursive
// total, because the API gives no recursive size. The disk gauge is the /data
// filesystem's real used/total (from /api/fs/disk) — the single most-asked
// "how full is my server" signal — shown only when the endpoint is available.
// ----------------------------------------------------------------------
export function StatusBar({ census, disk, filterActive }) {
  const { folders = 0, files = 0, bytes = 0, protectedCount = 0, capped = false, matched = null } = census || {}
  const parts = []
  if (filterActive && matched != null) {
    parts.push(`${matched} match${matched === 1 ? '' : 'es'}`)
  } else {
    parts.push(`${folders} folder${folders === 1 ? '' : 's'}`)
    parts.push(`${files} file${files === 1 ? '' : 's'}`)
    if (files > 0) parts.push(`${formatBytes(bytes)} here`)
  }
  if (protectedCount > 0) parts.push(`${protectedCount} protected`)
  if (capped) parts.push('showing first 10000')

  const d = diskUsage(disk)

  return (
    <footer className="ex-status">
      <span className="ex-status-census">{parts.join(' · ')}</span>
      {d && (
        <span className="ex-status-disk" title={`/data filesystem — ${formatBytes(d.used)} used, ${formatBytes(d.free)} free of ${formatBytes(d.cap)} usable`}>
          <span className="ex-disk-track" aria-hidden="true">
            <span className={`ex-disk-fill${d.pct >= 90 ? ' is-full' : ''}`} style={{ width: `${d.pct}%` }} />
          </span>
          <span className="ex-disk-label">{formatBytes(d.used)} / {formatBytes(d.cap)}</span>
        </span>
      )}
    </footer>
  )
}
