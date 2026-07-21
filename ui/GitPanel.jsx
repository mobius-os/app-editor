import { GIT_LIST_PREVIEW } from '../constants.js'
import { parseGitEntryPath } from '../paths.js'
import { Icon } from './Icons.jsx'

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
  if (k.includes('M')) return group === 'staged'
    ? { tone: 'staged', label: 'Staged' }
    : { tone: 'modified', label: 'Modified' }
  return { tone: group, label: group.charAt(0).toUpperCase() + group.slice(1) }
}

export function GitPanel({ git, gitError, gitLoading, repoRoot, open, onToggle, onOpenFile, onOpenDir }) {
  if (gitLoading && !git) {
    return <div className="ed-git-bar is-quiet" role="status" aria-live="polite">Checking source control…</div>
  }
  if (gitError || !git) {
    // Most folders are not repositories. Absence is not a useful status row;
    // reserve the panel for actionable source-control information.
    if (!gitError || gitError.status === 404) return null
    return <div className="ed-git-bar is-quiet" role="status" aria-live="polite">Source control unavailable</div>
  }
  const c = git.counts || { staged: 0, modified: 0, untracked: 0 }
  const changedPaths = new Set([
    ...(git.staged || []).map((item) => item.path),
    ...(git.modified || []).map((item) => item.path),
    ...(git.untracked || []).map((item) => item.path),
  ])
  // One file may have both staged and unstaged edits. The section counts keep
  // those states distinct, while the headline reports unique changed paths.
  const dirty = changedPaths.size
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
          // parseGitEntryPath strips the trailing slash so it renders a real
          // name (flagged as a folder), and gives us `path` (slash-stripped, for
          // opening/focusing) separate from `base` (kept with the slash, for
          // display). A directory row focuses the tree instead of trying to
          // OPEN a directory as a file — the latter 404s and reads as
          // "This file no longer exists".
          const { isDir, path, base, dir } = parseGitEntryPath(it.path)
          const chip = chipFor(status, it.status)
          const deleted = chip.tone === 'deleted'
          return (
            <button
              key={`${status}-${it.path}`}
              type="button"
              className="ed-git-file"
              onClick={() => (isDir ? onOpenDir && onOpenDir(resolve(path)) : onOpenFile(resolve(it.path)))}
              aria-label={deleted ? `${base} was deleted` : (isDir ? `Focus folder ${base}` : `Open ${base}`)}
              title={deleted ? `${it.path} was deleted` : it.path}
              disabled={deleted}
            >
              <span className="ed-git-file-icon" aria-hidden="true"><Icon name={isDir ? 'folder' : 'file'} size={17} /></span>
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
      <button
        type="button"
        className="ed-git-bar"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${open ? 'Hide' : 'Show'} source control${dirty ? `, ${dirty} change${dirty === 1 ? '' : 's'}` : ', no changes'}`}
      >
        <span className="ed-git-mark" aria-hidden="true"><Icon name="git" size={18} /></span>
        <span className="ed-git-heading">
          <span className="ed-git-title">Source Control</span>
          <span className="ed-git-branch">
            {git.detached ? `Detached at ${git.head_sha}` : git.branch}
            {aheadBehind.length > 0 && <span className="ed-git-track"> · {aheadBehind.join(' ')}</span>}
          </span>
        </span>
        <span className={`ed-git-total${dirty === 0 ? ' is-clean' : ''}`} aria-live="polite">{dirty === 0 ? 'No changes' : `${dirty} change${dirty === 1 ? '' : 's'}`}</span>
        <Icon name="chevron-down" size={16} className={`ed-git-chevron${open ? ' is-open' : ''}`} />
      </button>
      {open && dirty > 0 && (
        <div className="ed-git-body">
          {c.staged > 0 && <section className="ed-git-group" aria-label={`Staged Changes, ${c.staged}`}><div className="ed-git-group-label"><span>Staged Changes</span><span>{c.staged}</span></div>{list(git.staged, 'staged', c.staged)}</section>}
          {c.modified > 0 && <section className="ed-git-group" aria-label={`Changes, ${c.modified}`}><div className="ed-git-group-label"><span>Changes</span><span>{c.modified}</span></div>{list(git.modified, 'modified', c.modified)}</section>}
          {c.untracked > 0 && <section className="ed-git-group" aria-label={`Untracked Files, ${c.untracked}`}><div className="ed-git-group-label"><span>Untracked Files</span><span>{c.untracked}</span></div>{list(git.untracked, 'untracked', c.untracked)}</section>}
          <div className="ed-git-help">Open a file to inspect its current contents.</div>
        </div>
      )}
    </div>
  )
}
