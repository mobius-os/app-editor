import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ArrowLeft,
  ArrowRotateCw,
  ChevronRight,
  Download,
  File,
  FileCode,
  FileDocument,
  FileImage,
  Folder,
  Grid,
  Search,
  X,
} from '@openai/apps-sdk-ui/components/Icon'
import { LOCATIONS, START_PATH } from './constants.js'
import {
  baseName,
  entryMeta,
  fileKind,
  formatBytes,
  normalizePath,
  parentPath,
  pathSegments,
  previewKind,
  visibleEntries,
} from './domain.js'
import {
  configureFilesystemToken,
  listDirectory,
  readBlob,
  readMetadata,
  readText,
  readTextHead,
} from './storage.js'
import { CSS } from './theme.js'

const EMPTY_PREVIEW = {
  loading: false,
  meta: null,
  text: '',
  objectUrl: '',
  kind: null,
  truncated: false,
  total: null,
  error: null,
}

function LocationIcon({ name }) {
  const Icon = name === 'apps' ? Grid : name === 'code' ? FileCode : Folder
  return <Icon width={19} height={19} aria-hidden="true" />
}

function EntryIcon({ entry, size = 21 }) {
  if (entry.type === 'directory') return <Folder width={size} height={size} aria-hidden="true" />
  const kind = fileKind(entry.name, entry.mime_type || '')
  const Icon = kind === 'image' ? FileImage
    : kind === 'code' ? FileCode
      : ['text', 'pdf'].includes(kind) ? FileDocument
        : File
  return <Icon width={size} height={size} aria-hidden="true" />
}

function errorMessage(error) {
  if (!error) return ''
  if (error.status === 401) return 'Reopen Files and try again.'
  if (error.status === 403) return 'This protected item cannot be shown here.'
  if (error.status === 404) return 'This item no longer exists.'
  if (error.status === 413) return 'This file is too large to preview.'
  return error.message || 'Something went wrong while loading this item.'
}

export default function App({ token }) {
  configureFilesystemToken(token)

  const [cwd, setCwd] = useState(START_PATH)
  const [entries, setEntries] = useState([])
  const [directoryState, setDirectoryState] = useState({ loading: true, error: null, redacted: [], truncated: false })
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [preview, setPreview] = useState(EMPTY_PREVIEW)
  const directoryRequest = useRef(0)
  const fileRequest = useRef(0)

  const loadFolder = useCallback(async (path, { quiet = false } = {}) => {
    const clean = normalizePath(path)
    const requestId = ++directoryRequest.current
    if (!quiet) setDirectoryState((state) => ({ ...state, loading: true, error: null }))
    try {
      const result = await listDirectory(clean)
      if (directoryRequest.current !== requestId) return
      setEntries(result.entries)
      setDirectoryState({ loading: false, error: null, redacted: result.redacted, truncated: result.truncated })
    } catch (error) {
      if (directoryRequest.current !== requestId) return
      setEntries([])
      setDirectoryState({ loading: false, error, redacted: [], truncated: false })
    }
  }, [])

  useEffect(() => {
    loadFolder(START_PATH)
  }, [loadFolder, token])

  useEffect(() => () => {
    if (preview.objectUrl) URL.revokeObjectURL(preview.objectUrl)
  }, [preview.objectUrl])

  const navigate = useCallback((path) => {
    const clean = normalizePath(path)
    setCwd(clean)
    setEntries([])
    setQuery('')
    setSelected(null)
    setPreview(EMPTY_PREVIEW)
    loadFolder(clean)
  }, [loadFolder])

  const openFile = useCallback(async (entry) => {
    const requestId = ++fileRequest.current
    setSelected(entry)
    setPreview({ ...EMPTY_PREVIEW, loading: true })
    try {
      const meta = await readMetadata(entry.path)
      if (fileRequest.current !== requestId) return
      if (meta.is_binary) {
        const kind = previewKind(entry.path, meta.mime_type || '')
        if (!kind) {
          setPreview({ ...EMPTY_PREVIEW, meta, kind: 'binary' })
          return
        }
        const blob = await readBlob(entry.path)
        if (fileRequest.current !== requestId) return
        setPreview({ ...EMPTY_PREVIEW, meta, kind, objectUrl: URL.createObjectURL(blob) })
        return
      }

      let result
      try {
        result = { text: await readText(entry.path), truncated: false, total: meta.size }
      } catch (error) {
        if (error?.status !== 413) throw error
        result = await readTextHead(entry.path)
      }
      if (fileRequest.current !== requestId) return
      setPreview({
        ...EMPTY_PREVIEW,
        meta,
        kind: 'text',
        text: result.text,
        truncated: Boolean(result.truncated),
        total: result.total,
      })
    } catch (error) {
      if (fileRequest.current !== requestId) return
      setPreview({ ...EMPTY_PREVIEW, error })
    }
  }, [])

  const openEntry = useCallback((entry) => {
    if (entry.type === 'directory') navigate(entry.path)
    else openFile(entry)
  }, [navigate, openFile])

  const closePreview = useCallback(() => {
    fileRequest.current += 1
    setSelected(null)
    setPreview(EMPTY_PREVIEW)
  }, [])

  const download = useCallback(async () => {
    if (!selected) return
    try {
      const blob = await readBlob(selected.path)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = selected.name
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setPreview((state) => ({ ...state, error }))
    }
  }, [selected])

  const entryOptions = useMemo(() => ({
    hideRuntime: cwd === 'apps',
    hideGenerated: cwd !== 'apps',
  }), [cwd])
  const filteredEntries = useMemo(() => visibleEntries(entries, query, entryOptions), [entries, query, entryOptions])
  const crumbs = useMemo(() => pathSegments(cwd), [cwd])
  const hiddenCount = entries.length - visibleEntries(entries, '', entryOptions).length
  const countLabel = `${filteredEntries.length} item${filteredEntries.length === 1 ? '' : 's'}`
  const currentLabel = crumbs.at(-1)?.label || baseName(cwd)

  return (
    <div className={`fx-root${selected ? ' has-selection' : ''}`}>
      <style>{CSS}</style>

      <header className="fx-header">
        <div className="fx-title-group">
          <span className="fx-logo" aria-hidden="true"><Folder width={22} height={22} /></span>
          <div>
            <h1>Files</h1>
            <p>Browse this Möbius</p>
          </div>
        </div>
        <button className="fx-icon-button" type="button" onClick={() => loadFolder(cwd)} aria-label="Refresh folder" title="Refresh">
          <ArrowRotateCw width={20} height={20} aria-hidden="true" />
        </button>
      </header>

      <div className="fx-body">
        <nav className="fx-locations" aria-label="Locations">
          <p className="fx-section-label">Locations</p>
          {LOCATIONS.map((location) => (
            <button
              key={location.label}
              type="button"
              className={`fx-location${cwd === location.path || (location.path && cwd.startsWith(`${location.path}/`)) ? ' is-active' : ''}`}
              onClick={() => navigate(location.path)}
            >
              <LocationIcon name={location.icon} />
              <span>{location.label}</span>
            </button>
          ))}
          <div className="fx-location-note">Hidden and protected system items stay out of the way.</div>
        </nav>

        <main className="fx-browser" aria-label="File browser">
          <div className="fx-mobile-locations" aria-label="Locations">
            {LOCATIONS.map((location) => (
              <button
                key={location.label}
                type="button"
                className={cwd === location.path || (location.path && cwd.startsWith(`${location.path}/`)) ? 'is-active' : ''}
                onClick={() => navigate(location.path)}
              >
                {location.label}
              </button>
            ))}
          </div>

          <div className="fx-browser-tools">
            {crumbs.length > 1 && (
              <nav className="fx-crumbs" aria-label="Folder location">
                {crumbs.map((crumb, index) => (
                  <span className="fx-crumb-part" key={crumb.path || 'root'}>
                    {index > 0 && <ChevronRight width={14} height={14} aria-hidden="true" />}
                    <button
                      type="button"
                      className={index === crumbs.length - 1 ? 'is-current' : ''}
                      onClick={() => index < crumbs.length - 1 && navigate(crumb.path)}
                      aria-current={index === crumbs.length - 1 ? 'page' : undefined}
                    >
                      {crumb.label}
                    </button>
                  </span>
                ))}
              </nav>
            )}
            <label className="fx-search">
              <Search width={18} height={18} aria-hidden="true" />
              <span className="fx-sr-only">Filter this folder</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this folder" />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear filter">
                  <X width={16} height={16} aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="fx-folder-summary">
              <strong>{currentLabel}</strong>
              <span>{countLabel}</span>
            </div>
          </div>

          <div className="fx-list-scroll">
            {directoryState.loading && (
              <div className="fx-state"><span className="fx-spinner" />Loading files…</div>
            )}
            {!directoryState.loading && directoryState.error && (
              <div className="fx-state is-error">
                <Folder width={30} height={30} aria-hidden="true" />
                <strong>This folder could not be opened</strong>
                <span>{errorMessage(directoryState.error)}</span>
                <button type="button" onClick={() => loadFolder(cwd)}>Try again</button>
              </div>
            )}
            {!directoryState.loading && !directoryState.error && filteredEntries.length === 0 && (
              <div className="fx-state">
                <Folder width={32} height={32} aria-hidden="true" />
                <strong>{query ? 'No matching files' : 'This folder is empty'}</strong>
                <span>{query ? 'Try a different filter.' : 'There is nothing to preview here yet.'}</span>
              </div>
            )}
            {!directoryState.loading && !directoryState.error && filteredEntries.length > 0 && (
              <div className="fx-list" role="list">
                {filteredEntries.map((entry) => {
                  const active = selected?.path === entry.path
                  return (
                    <div role="listitem" key={entry.path}>
                      <button
                        type="button"
                        className={`fx-row${active ? ' is-selected' : ''}`}
                        onClick={() => openEntry(entry)}
                        aria-current={active ? 'true' : undefined}
                      >
                        <span className={`fx-entry-icon${entry.type === 'directory' ? ' is-folder' : ''}`}><EntryIcon entry={entry} /></span>
                        <span className="fx-row-copy">
                          <strong>{entry.name}</strong>
                          <span>{entryMeta(entry) || (entry.type === 'directory' ? 'Folder' : 'File')}</span>
                        </span>
                        {entry.type === 'directory' && <ChevronRight className="fx-chevron" width={18} height={18} aria-hidden="true" />}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {(directoryState.truncated || directoryState.redacted.length > 0 || hiddenCount > 0) && (
            <div className="fx-browser-foot">
              {directoryState.truncated ? 'Showing the first 6,000 items' : `${hiddenCount + directoryState.redacted.length} hidden or protected item${hiddenCount + directoryState.redacted.length === 1 ? '' : 's'}`}
            </div>
          )}
        </main>

        <aside className="fx-preview" aria-label="File preview">
          {!selected && (
            <div className="fx-preview-empty">
              <span className="fx-preview-symbol"><FileDocument width={31} height={31} aria-hidden="true" /></span>
              <strong>Select a file to preview</strong>
              <p>Files open here without changing them.</p>
            </div>
          )}
          {selected && (
            <>
              <header className="fx-preview-head">
                <button type="button" className="fx-preview-back" onClick={closePreview} aria-label="Back to files">
                  <ArrowLeft width={20} height={20} aria-hidden="true" />
                </button>
                <span className="fx-preview-glyph"><EntryIcon entry={selected} size={20} /></span>
                <div className="fx-preview-title">
                  <strong>{selected.name}</strong>
                  <span>/data/{selected.path}</span>
                </div>
                <button type="button" className="fx-download" onClick={download} aria-label={`Download ${selected.name}`} title="Download">
                  <Download width={19} height={19} aria-hidden="true" />
                  <span>Download</span>
                </button>
              </header>

              <div className="fx-preview-body">
                {preview.loading && <div className="fx-state"><span className="fx-spinner" />Opening preview…</div>}
                {!preview.loading && preview.error && (
                  <div className="fx-state is-error">
                    <File width={30} height={30} aria-hidden="true" />
                    <strong>Preview unavailable</strong>
                    <span>{errorMessage(preview.error)}</span>
                  </div>
                )}
                {!preview.loading && !preview.error && preview.meta && (
                  <>
                    {preview.truncated && (
                      <div className="fx-preview-notice">Showing the beginning of this large file{preview.total ? ` · ${formatBytes(preview.total)} total` : ''}.</div>
                    )}
                    {preview.kind === 'text' && <pre className="fx-text-preview">{preview.text || 'This text file is empty.'}</pre>}
                    {preview.kind === 'image' && <div className="fx-media-preview"><img src={preview.objectUrl} alt={selected.name} /></div>}
                    {preview.kind === 'audio' && <div className="fx-media-preview"><audio src={preview.objectUrl} controls /></div>}
                    {preview.kind === 'video' && <div className="fx-media-preview"><video src={preview.objectUrl} controls /></div>}
                    {preview.kind === 'pdf' && <iframe className="fx-pdf-preview" src={preview.objectUrl} title={selected.name} />}
                    {preview.kind === 'binary' && (
                      <div className="fx-state">
                        <File width={34} height={34} aria-hidden="true" />
                        <strong>No inline preview</strong>
                        <span>{formatBytes(preview.meta.size)}{preview.meta.mime_type ? ` · ${preview.meta.mime_type}` : ''}</span>
                        <button type="button" onClick={download}>Download file</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
