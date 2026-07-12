import { formatBytes } from '../paths.js'

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

  const diskPct = disk && disk.total ? Math.min(100, Math.round((disk.used / disk.total) * 100)) : null

  return (
    <footer className="ex-status">
      <span className="ex-status-census">{parts.join(' · ')}</span>
      {disk && diskPct != null && (
        <span className="ex-status-disk" title={`/data filesystem — ${formatBytes(disk.used)} used of ${formatBytes(disk.total)} (${formatBytes(disk.free)} free)`}>
          <span className="ex-disk-track" aria-hidden="true">
            <span className={`ex-disk-fill${diskPct >= 90 ? ' is-full' : ''}`} style={{ width: `${diskPct}%` }} />
          </span>
          <span className="ex-disk-label">{formatBytes(disk.used)} / {formatBytes(disk.total)}</span>
        </span>
      )}
    </footer>
  )
}
