import { fileGlyph, formatBytes, isKeepMarker } from '../paths.js'

// ----------------------------------------------------------------------
// File tree. Lazy + level-at-a-time: a directory's children are fetched on
// first expand and cached in the App's `treeCache` (keyed by dir path). The
// App owns the cache + expansion set so they survive a drawer close/reopen;
// FileNode is a pure renderer driven by props.
//
// `redacted` rows (secrets hidden by the server at a given level) are surfaced
// as a single muted "N protected" row — honest about what's hidden without
// pretending it isn't there.
// ----------------------------------------------------------------------
export function FileNode({
  entry, depth, expanded, childrenByDir, redactedByDir, loadingDirs, errorDirs,
  selectedPath, gitRepos, focusRoot, onToggleDir, onSelectFile, onFocusDir, onDeleteFile, onRetryDir,
}) {
  const isDir = entry.type === 'directory'
  const pad = { paddingLeft: `${8 + depth * 14}px` }

  // `.keep` is the internal folder-materialization marker — never a real row.
  if (isKeepMarker(entry.name)) return null

  if (!isDir) {
    const selected = entry.path === selectedPath
    // Wrap the file button + its delete affordance the way dir rows wrap the
    // focus button, so the delete control gets the same hover-reveal and the
    // row stays a single 44px touch target.
    return (
      <div className="ed-row-wrap">
        <button
          type="button"
          className={`ed-row ed-row-file${selected ? ' is-selected' : ''}`}
          style={pad}
          onClick={() => onSelectFile(entry.path)}
          aria-current={selected ? 'true' : undefined}
          title={entry.path}
        >
          <span className="ed-row-glyph" aria-hidden="true">{fileGlyph(entry.name)}</span>
          <span className="ed-row-name">{entry.name}</span>
          <span className="ed-row-size">{formatBytes(entry.size)}</span>
        </button>
        {onDeleteFile && (
          <button
            type="button"
            className="ed-row-delete"
            onClick={() => onDeleteFile(entry)}
            aria-label={`Delete ${entry.name}`}
            title={`Delete ${entry.name}`}
          >
            ✕
          </button>
        )}
      </div>
    )
  }

  const isOpen = expanded.has(entry.path)
  const kids = childrenByDir[entry.path]
  const redacted = redactedByDir[entry.path] || []
  const isGit = entry.is_git_repo || gitRepos.has(entry.path)
  const isFocused = focusRoot === entry.path
  return (
    <>
      <div className="ed-row-wrap">
        <button
          type="button"
          className="ed-row ed-row-dir"
          style={pad}
          onClick={() => onToggleDir(entry.path)}
          aria-expanded={isOpen}
          title={entry.path}
        >
          <span className="ed-row-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
          <span className="ed-row-name">{entry.name}</span>
          {isGit && <span className="ed-git-badge" title="Git repository">git</span>}
        </button>
        {onFocusDir && (
          <button
            type="button"
            className={`ed-row-focus${isFocused ? ' is-focused' : ''}`}
            onClick={() => onFocusDir(entry.path)}
            aria-pressed={isFocused}
            aria-label={`Focus on ${entry.name}`}
            title={`Show only ${entry.name}`}
          >
            ⊙
          </button>
        )}
      </div>
      {isOpen && (
        <div role="group">
          {loadingDirs.has(entry.path) && !kids && (
            <div className="ed-row-note" style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}>Loading…</div>
          )}
          {errorDirs[entry.path] && (
            <div className="ed-row-note is-error" style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}>
              {errorDirs[entry.path]}
              {onRetryDir && (
                <button type="button" className="ed-retry" onClick={() => onRetryDir(entry.path)}>Retry</button>
              )}
            </div>
          )}
          {kids && kids.map((child) => (
            <FileNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              childrenByDir={childrenByDir}
              redactedByDir={redactedByDir}
              loadingDirs={loadingDirs}
              errorDirs={errorDirs}
              selectedPath={selectedPath}
              gitRepos={gitRepos}
              focusRoot={focusRoot}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
              onFocusDir={onFocusDir}
              onDeleteFile={onDeleteFile}
              onRetryDir={onRetryDir}
            />
          ))}
          {redacted.length > 0 && (
            <div className="ed-row-note is-protected" style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}>
              {redacted.length} protected
            </div>
          )}
        </div>
      )}
    </>
  )
}
