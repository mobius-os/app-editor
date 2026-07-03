import { GIT_LIST_PREVIEW } from '../constants.js'

// ----------------------------------------------------------------------
// Git panel — a compact, collapsible summary for the open file's repo. Shows
// branch + ahead/behind + staged/modified/untracked counts, and a short list
// (tap a path to open that file). Mobile real estate is tight, so it starts
// collapsed and the lists are capped (the server already caps at 200; we show
// the first handful).
// ----------------------------------------------------------------------

// Map a group + raw git status code to a semantic chip (tone drives the color,
// Hermex's fixed kind->color map: added/staged=green, modified=amber,
// untracked=blue, deleted=red, renamed=blue). Tone falls back to the group.
function chipFor(group, code) {
  const k = String(code || '').toUpperCase()
  if (group === 'untracked') return { tone: 'untracked', label: 'New' }
  if (k.includes('D')) return { tone: 'deleted', label: 'Deleted' }
  if (k.includes('R')) return { tone: 'renamed', label: 'Renamed' }
  if (k.includes('A')) return { tone: 'staged', label: 'Added' }
  if (k.includes('M')) return { tone: group === 'staged' ? 'staged' : 'modified', label: 'Modified' }
  return { tone: group, label: group.charAt(0).toUpperCase() + group.slice(1) }
}

export function GitPanel({ git, gitError, gitLoading, repoRoot, open, onToggle, onOpenFile }) {
  if (gitLoading && !git) {
    return <div className="ed-git-bar is-quiet">Checking git…</div>
  }
  if (gitError || !git) {
    // 404 = no repo here; anything else is a real error. Either way, keep it
    // to one muted line rather than a dead panel.
    return <div className="ed-git-bar is-quiet">{gitError && gitError.status !== 404 ? 'Git status unavailable' : 'Not a git repo'}</div>
  }
  const c = git.counts || { staged: 0, modified: 0, untracked: 0 }
  const dirty = c.staged + c.modified + c.untracked
  const aheadBehind = []
  if (git.ahead) aheadBehind.push(`↑${git.ahead}`)
  if (git.behind) aheadBehind.push(`↓${git.behind}`)

  const resolve = (p) => (repoRoot ? `${repoRoot}/${p}` : p)
  // Show the first GIT_LIST_PREVIEW files, then a per-group "+N more" keyed to
  // the EXACT count (not the server's 200-cap flag) so files 9..N are never
  // silently dropped from the open list.
  const list = (items, status, total) => {
    const shown = (items || []).slice(0, GIT_LIST_PREVIEW)
    const extra = total - shown.length
    return (
      <>
        {shown.map((it) => {
          // A wholly-untracked directory arrives from porcelain as `subdir/`.
          // Strip the trailing slash before splitting so it renders a real name
          // (and is flagged as a folder), not a blank card that opens a dir path.
          const rawPath = it.path || ''
          const isDir = rawPath.endsWith('/')
          const path = isDir ? rawPath.replace(/\/+$/, '') : rawPath
          const idx = path.lastIndexOf('/')
          const base = (idx >= 0 ? path.slice(idx + 1) : path) + (isDir ? '/' : '')
          const dir = idx >= 0 ? path.slice(0, idx) : ''
          const chip = chipFor(status, it.status)
          return (
            <button
              key={`${status}-${it.path}`}
              type="button"
              className="ed-git-file"
              onClick={() => onOpenFile(resolve(it.path))}
              title={it.path}
            >
              <span className="ed-git-file-id">
                <span className="ed-git-file-name">{base}</span>
                {dir && <span className="ed-git-file-dir">{dir}</span>}
              </span>
              <span className={`ed-chip tone-${chip.tone}`}>{chip.label}</span>
            </button>
          )
        })}
        {extra > 0 && <div className="ed-git-more">+{extra} more</div>}
      </>
    )
  }

  return (
    <div className="ed-git">
      <button type="button" className="ed-git-bar" onClick={onToggle} aria-expanded={open}>
        <span className="ed-git-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="ed-git-branch">{git.detached ? `detached @ ${git.head_sha}` : git.branch}</span>
        {aheadBehind.length > 0 && <span className="ed-git-track">{aheadBehind.join(' ')}</span>}
        <span className="ed-git-counts">
          {c.staged > 0 && <span className="ed-git-count is-staged" title="staged">+{c.staged}</span>}
          {c.modified > 0 && <span className="ed-git-count is-modified" title="modified">~{c.modified}</span>}
          {c.untracked > 0 && <span className="ed-git-count is-untracked" title="untracked">?{c.untracked}</span>}
          {dirty === 0 && <span className="ed-git-count is-clean">clean</span>}
        </span>
      </button>
      {open && dirty > 0 && (
        <div className="ed-git-body">
          {c.staged > 0 && <div className="ed-git-group"><div className="ed-git-group-label">Staged</div>{list(git.staged, 'staged', c.staged)}</div>}
          {c.modified > 0 && <div className="ed-git-group"><div className="ed-git-group-label">Modified</div>{list(git.modified, 'modified', c.modified)}</div>}
          {c.untracked > 0 && <div className="ed-git-group"><div className="ed-git-group-label">Untracked</div>{list(git.untracked, 'untracked', c.untracked)}</div>}
        </div>
      )}
    </div>
  )
}
