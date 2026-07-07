// Editor — thin app shell. The module tree is declared in mobius.json's
// source_files; the multi-file installer fetches each path and esbuild bundles
// from this entry, resolving the relative imports below at compile time.
//
//   constants.js  — shared scalar constants for filesystem, markdown, git, modal, and chat sizing
//   theme.js      — the single app stylesheet (CSS)
//   domain.js     — pure + DOM-level path, CodeMirror, markdown-preview, and prompt logic; no React/network
//   storage.js    — owner filesystem API helpers, online signal, UI prefs, and chat-height storage
//   ui/*.jsx      — one React component per file
//
// Only App lives here: it owns top-level filesystem/editor/git/chat state,
// persistence wiring, drawer navigation, and mounts the UI components.
import {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react'
import {
  CHAT_DEFAULT_PX,
  CHAT_DIVIDER_PX,
  CHAT_MIN_PX,
  CHAT_SPAWN_RATIO,
} from './constants.js'
import { CSS } from './theme.js'
import {
  fsDelete,
  fsGit,
  fsMeta,
  fsReadText,
  fsTree,
  fsWrite,
  loadPrefs,
  readChatHeight,
  savePrefs,
  chatHeightKey,
  useOnline,
} from './storage.js'
import {
  baseName,
  bufferDirtyAfterSave,
  dirName,
  extOf,
  formatBytes,
  isImagePath,
  isKeepMarker,
  isMarkdownPath,
  isValidLeafName,
  joinPath,
} from './paths.js'
import { CodeEditor } from './ui/CodeEditor.jsx'
import { ImagePreview } from './ui/ImagePreview.jsx'
import { NameModal } from './ui/NameModal.jsx'
import { ConfirmModal } from './ui/ConfirmModal.jsx'
import { FileNode } from './ui/FileNode.jsx'
import { GitPanel } from './ui/GitPanel.jsx'
import { ChatPanel } from './ui/ChatPanel.jsx'
import { ChatBubbleIcon } from './ui/ChatBubbleIcon.jsx'

// ----------------------------------------------------------------------
// Editor — a whole-filesystem viewer + editor for Möbius.
//
// The owner sees the entire /data tree, edits text/markdown files in place
// (markdown gets the Notes live-preview), watches git status to see what the
// agent changed, and asks an embedded agent to make edits — oversight plus
// direct edit, with the agent as the primary interface.
//
// This app drives the OWNER-ONLY /api/fs/* API (routes/fs.py), which the
// app-scoped `token` prop cannot reach (it 401s). Same-origin owner tool: we
// read the owner JWT from localStorage('token') and send it as the bearer for
// every /api/fs/* call. This is the accepted single-owner trade-off documented
// in mobius/CLAUDE.md — the gated surface is the whole filesystem regardless,
// so a scoped permission would be theatre.
//
// The FS is huge, so the tree is NEVER walked whole: each directory's children
// are fetched lazily when the user expands it, and cached. Paths are relative
// to the FS root (/data).
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// Top-level app.
// ----------------------------------------------------------------------
export default function App({ appId }) {
  const online = useOnline()

  // --- File tree state (lazy, level-at-a-time) ---
  const [rootError, setRootError] = useState(null)
  const [rootLoading, setRootLoading] = useState(true)
  // childrenByDir[dirPath] = entries[] (cached after first expand; '' = root).
  const [childrenByDir, setChildrenByDir] = useState({})
  const [redactedByDir, setRedactedByDir] = useState({})
  const [expanded, setExpanded] = useState(() => new Set())
  const [loadingDirs, setLoadingDirs] = useState(() => new Set())
  const [errorDirs, setErrorDirs] = useState({})
  // Directories we've learned are git repos (from their parent's listing) so a
  // freshly-fetched node can badge without re-probing.
  const gitRepos = useMemo(() => {
    const s = new Set()
    for (const entries of Object.values(childrenByDir)) {
      for (const e of entries || []) {
        if (e.type === 'directory' && e.is_git_repo) s.add(e.path)
      }
    }
    return s
  }, [childrenByDir])

  // --- Editor / open-file state ---
  const [selectedPath, setSelectedPath] = useState(null)
  const [meta, setMeta] = useState(null)        // {name,size,mime_type,is_binary,writable,modified_at}
  const [content, setContent] = useState('')    // editor buffer (text files)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  // A "the file changed under your unsaved edit" / "couldn't re-read it" notice.
  // Kept SEPARATE from saveError because it must survive keystrokes (saveError
  // auto-clears on edit) — it stays until the user saves or reopens the file.
  const [diskNotice, setDiskNotice] = useState(null)
  // Bumped every time an agent turn re-reads the open file. The image preview
  // keys its blob fetch on this so a regenerated image at the SAME path (path
  // unchanged) reloads its fresh bytes instead of showing the stale render.
  const [fileReloadKey, setFileReloadKey] = useState(0)
  // The content as last loaded/saved from the server — what we re-read against
  // to decide whether an external (agent) edit changed the file under us.
  const baselineRef = useRef('')
  // Live mirror of the editor buffer so the external-edit divergence check
  // compares against what the user CURRENTLY has, not a value captured in a
  // stale loadFile closure (which would fire a false "changed on disk" warning
  // for characters the user already typed).
  const contentRef = useRef('')
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const selectedRef = useRef(null)
  // app_ready fires once per mount (the first successful root load), so a retry
  // or reconnect-triggered reload doesn't inflate Reflection's open count.
  const appReadyRef = useRef(false)
  useEffect(() => { contentRef.current = content }, [content])
  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  useEffect(() => { savingRef.current = saving }, [saving])
  useEffect(() => { selectedRef.current = selectedPath }, [selectedPath])

  // KaTeX's renderToString output (used by the markdown live-preview for
  // $...$ math) needs katex.min.css for its fraction/sizing/positioning rules;
  // without it every formula renders as overlapping fallback glyphs. The
  // platform self-hosts the stylesheet + its woff2 fonts under the same-origin
  // /vendor/katex/ path (a stable, unversioned symlink to the pinned version —
  // the same version-proofing as the bare `katex` importmap specifier the
  // runtime import uses), so a plain <link> loads under the prod CSP
  // (style-src/font-src 'self') with no external CDN, no /api/proxy round-trip,
  // and no version skew against the runtime import. The @font-face `./fonts/*`
  // URLs inside the sheet resolve to /vendor/katex/fonts/*, so glyphs are fully
  // styled rather than falling back to the system math font.
  useEffect(() => {
    if (document.querySelector('link[data-ed-katex]')) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/vendor/katex/katex.min.css'
    link.setAttribute('data-ed-katex', '1')
    document.head.appendChild(link)
  }, [])

  // --- Git state for the open file's directory ---
  const [git, setGit] = useState(null)
  const [gitError, setGitError] = useState(null)
  const [gitLoading, setGitLoading] = useState(false)
  const [gitOpen, setGitOpen] = useState(false)

  // --- Layout ---
  // On mobile (narrow) the drawer overlays the editor — start closed so the
  // user lands on the editor immediately. On desktop (≥760px) the drawer is
  // a static column (no overlay), so we start it open there. Best-effort: if
  // typeof window is undefined (SSR), default open.
  const [navOpen, setNavOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 760,
  )
  const navHandleRef = useRef(null)
  const prefsLoadedRef = useRef(false)
  const restorePathRef = useRef(null)
  // Live mirror of the expanded set so an agent-turn refresh can re-list every
  // open directory (the agent can create/delete files anywhere, not just in
  // the open file's folder) without the handler closing over a stale set.
  const expandedRef = useRef(expanded)
  useEffect(() => { expandedRef.current = expanded }, [expanded])
  // Per-directory load generation. Every (re)load of a directory bumps its
  // counter and only applies its result if it is still the newest issued for
  // that path — so a slow/in-flight fetch can't overwrite a fresher one
  // (collapse-then-reexpand, or an agent-turn refresh that supersedes a
  // first-expand still in flight).
  const dirGenRef = useRef(new Map())
  // Resizable chat/editor split. chatHeight is the chat panel's px height; the
  // editor pane takes the rest. mainRef measures the available column so a drag
  // can clamp against the real container height. Until the user has chosen a
  // height (drag/keyboard, or a restored value from a previous session) the
  // height is "untouched": the first open replaces it with the 50/50 spawn and
  // nothing is persisted, so the spawn ratio keeps applying on fresh devices.
  const storedChatHeight = readChatHeight(appId)
  const [chatHeight, setChatHeight] = useState(() => storedChatHeight ?? CHAT_DEFAULT_PX)
  const chatHeightTouched = useRef(storedChatHeight != null)
  // Chat starts collapsed — the editor is the primary surface; the user opens
  // the agent when they need it, not the other way around.
  const [chatOpen, setChatOpen] = useState(false)
  const mainRef = useRef(null)

  const quickActions = useMemo(() => [
    { label: 'Explain this file', prompt: 'Explain what this file does.' },
    { label: 'Fix issues in this file', prompt: 'Review and fix issues in the currently open file.' },
    { label: 'What changed recently?', prompt: 'Summarize what changed recently in this project.' },
  ], [])

  const getContext = useCallback(() => {
    return Promise.resolve({
      openFile: selectedPath || null,
      dirty: dirty || false,
      gitSummary: null,
    })
  }, [selectedPath, dirty])

  // --- Folder focus: when set, the tree renders only this dir's subtree. ---
  const [focusRoot, setFocusRoot] = useState('')

  // --- Create file/folder: the open name-entry modal, if any. ---
  // { kind: 'file'|'folder', targetDir } while open; null when closed.
  const [createModal, setCreateModal] = useState(null)
  const [createError, setCreateError] = useState(null)
  const [creating, setCreating] = useState(false)

  // --- Delete file: the file entry pending a confirm, if any. ---
  // Holds the FileNode `entry` while the confirm dialog is open; null when closed.
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // --- Switch-away guard: a file path the user tapped while the current buffer
  // has unsaved edits, held until they confirm discarding. null = no pending
  // switch. The iframe blocks window.confirm, so this drives an in-app modal. ---
  const [pendingSwitch, setPendingSwitch] = useState(null)

  // --- Overwrite guard: set when a save found the file changed on disk since
  // we loaded it (an agent edited it), so we ask before clobbering rather than
  // silently overwriting. null = no pending overwrite. ---
  const [pendingOverwrite, setPendingOverwrite] = useState(false)

  // Fetch one directory level (uncached). Returns the entries or throws.
  const fetchDir = useCallback(async (dirPath) => {
    // Paginate through cursors so a >200-entry directory lists fully.
    let cursor = null
    let all = []
    let redacted = []
    let guard = 0
    do {
      // eslint-disable-next-line no-await-in-loop
      const data = await fsTree(dirPath, cursor)
      all = all.concat(data.entries || [])
      // The server returns the directory's FULL redacted list on every page
      // (it re-scans the whole dir each request), so take it only from the
      // first page — concatenating across pages would multiply the count.
      if (cursor === null && data.redacted) redacted = data.redacted
      cursor = data.next_cursor
      guard += 1
    } while (cursor && guard < 50)
    return { entries: all, redacted }
  }, [])

  // Fetch a directory and apply it to the tree, but only if this load is still
  // the newest issued for that path (generation guard). showLoading drives the
  // per-row spinner + error for an interactive expand; an agent-turn refresh
  // passes it false so it silently supersedes whatever was in flight.
  const loadDirInto = useCallback(async (dirPath, { showLoading = false } = {}) => {
    const gen = (dirGenRef.current.get(dirPath) || 0) + 1
    dirGenRef.current.set(dirPath, gen)
    if (showLoading) {
      setLoadingDirs((prev) => { const n = new Set(prev); n.add(dirPath); return n })
      setErrorDirs((prev) => { const n = { ...prev }; delete n[dirPath]; return n })
    }
    try {
      const { entries, redacted } = await fetchDir(dirPath)
      if (dirGenRef.current.get(dirPath) !== gen) return  // superseded
      setChildrenByDir((prev) => ({ ...prev, [dirPath]: entries }))
      setRedactedByDir((prev) => ({ ...prev, [dirPath]: redacted }))
    } catch (e) {
      if (dirGenRef.current.get(dirPath) !== gen) return
      if (showLoading) {
        setErrorDirs((prev) => ({ ...prev, [dirPath]: e.message || 'Could not list this folder.' }))
      }
      // A silent refresh leaves the cached listing alone on a transient failure.
    } finally {
      if (dirGenRef.current.get(dirPath) === gen) {
        setLoadingDirs((prev) => { const n = new Set(prev); n.delete(dirPath); return n })
      }
    }
  }, [fetchDir])

  // Load the root listing on mount + whenever connectivity returns while the
  // root failed to load.
  const loadRoot = useCallback(async () => {
    setRootLoading(true)
    setRootError(null)
    const gen = (dirGenRef.current.get('') || 0) + 1
    dirGenRef.current.set('', gen)
    try {
      const { entries, redacted } = await fetchDir('')
      if (dirGenRef.current.get('') !== gen) return  // an agent-turn refresh won
      setChildrenByDir((prev) => ({ ...prev, '': entries }))
      setRedactedByDir((prev) => ({ ...prev, '': redacted }))
      if (!appReadyRef.current) {
        appReadyRef.current = true
      }
    } catch (e) {
      if (dirGenRef.current.get('') !== gen) return
      setRootError(e.message || 'Could not load the file tree.')
    } finally {
      if (dirGenRef.current.get('') === gen) setRootLoading(false)
    }
  }, [fetchDir])

  useEffect(() => { loadRoot() }, [loadRoot])

  // Retry the root when connectivity returns. The FS API is live-only, so a
  // first load that failed offline (or never landed) would otherwise sit on a
  // dead error until the owner reopens the app. Fire only on an offline→online
  // transition (a ref guards against re-firing the initial mount load) and only
  // when the root actually needs it (errored, or still empty).
  const wasOnlineRef = useRef(online)
  useEffect(() => {
    const wasOnline = wasOnlineRef.current
    wasOnlineRef.current = online
    if (online && !wasOnline && (rootError || (childrenByDir[''] || []).length === 0)) {
      loadRoot()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  // Expand/collapse a directory; fetch its children on first expand.
  const toggleDir = useCallback(async (dirPath) => {
    const isOpen = expanded.has(dirPath)
    if (isOpen) {
      setExpanded((prev) => { const n = new Set(prev); n.delete(dirPath); return n })
      // Also drop any in-flight loading marker — if a fetch from this expand
      // is still running (or hung), collapsing then re-expanding must not
      // leave a spinner stuck on a row whose children never arrived.
      setLoadingDirs((prev) => { const n = new Set(prev); n.delete(dirPath); return n })
      return
    }
    setExpanded((prev) => { const n = new Set(prev); n.add(dirPath); return n })
    if (childrenByDir[dirPath]) return  // cached — nothing to fetch
    await loadDirInto(dirPath, { showLoading: true })
  }, [expanded, childrenByDir, loadDirInto])

  // Re-list a directory after an agent edit. The generation guard makes this
  // supersede any in-flight first-expand of the same dir (whose result would
  // otherwise be the stale pre-edit listing). Silent — no spinner, and the
  // cached listing is kept on a transient failure.
  const refreshDir = useCallback((dirPath) => loadDirInto(dirPath), [loadDirInto])

  // --- Load git for the open file's directory ---
  const loadGit = useCallback(async (forPath) => {
    if (!forPath) { setGit(null); setGitError(null); return }
    setGitLoading(true)
    try {
      const g = await fsGit(dirName(forPath) || forPath)
      if (selectedRef.current !== forPath) return  // selection moved on
      setGit(g); setGitError(null)
    } catch (e) {
      if (selectedRef.current !== forPath) return
      setGit(null); setGitError(e)
    } finally {
      if (selectedRef.current === forPath) setGitLoading(false)
    }
  }, [])

  // --- Load a selected file: meta first, then body (or blob preview) ---
  const loadFile = useCallback(async (path, { external = false } = {}) => {
    if (!path) return
    // When the agent (external) re-triggers a load while the user is mid-edit,
    // do NOT clobber their unsaved buffer. We still refresh git/meta.
    const preserveBuffer = external && (dirtyRef.current || savingRef.current)
    if (!external) { setFileLoading(true); setFileError(null) }
    try {
      const m = await fsMeta(path)
      if (selectedRef.current !== path) return
      setMeta(m)
      // A real user open (not an agent-turn re-read) — record which file types
      // the owner actually inspects, no path/name PII.
      if (!external) {
      }
      if (m.is_binary) {
        // Binary: image preview component or a "binary file" notice render from
        // meta; no text buffer to load.
        if (!preserveBuffer) { setContent(''); setDirty(false); baselineRef.current = '' }
        setFileError(null)
        return
      }
      const text = await fsReadText(path)
      if (selectedRef.current !== path) return
      baselineRef.current = text
      if (!preserveBuffer) {
        setContent(text)
        setDirty(false)
        setSaveError(null)
        setDiskNotice(null)
      } else if (text !== contentRef.current) {
        // The file changed on disk under an unsaved edit. Keep the user's
        // buffer but surface the divergence (sticky — survives keystrokes).
        setDiskNotice('This file changed on disk (the agent edited it). Your unsaved edits are kept — save to overwrite, or reopen the file to discard them.')
      }
      setFileError(null)
    } catch (e) {
      if (selectedRef.current !== path) return
      if (preserveBuffer) {
        // The user still has a valid buffer open — don't replace it with an
        // error pane (that would visually destroy their unsaved work). Surface
        // the re-read failure non-destructively and keep them editing.
        setDiskNotice('Could not re-read this file from disk; your unsaved edits are kept.')
      } else {
        setContent('')
        setDirty(false)
        setFileError(e)
      }
    } finally {
      if (selectedRef.current === path && !external) setFileLoading(false)
    }
  }, [])

  // Reset the editor back to the empty "no file open" state, clearing EVERY
  // open-file field in one place. Centralized so the delete-success, delete-404,
  // and selection-cleared paths all clear the same set — the delete-404 path
  // used to clear fewer fields (leaving a stale dirty dot / baseline), and
  // clearing the selection used to leave a save-error or disk-notice banner
  // hanging above "No file open".
  const clearOpenFile = useCallback(() => {
    setSelectedPath(null)
    setMeta(null)
    setContent('')
    setGit(null)
    setGitError(null)
    setFileError(null)
    setDirty(false)
    setDiskNotice(null)
    setSaveError(null)
    baselineRef.current = ''
    contentRef.current = ''
  }, [])

  // Select a file (from the tree or a git-panel tap).
  const selectFile = useCallback((path) => {
    setSelectedPath(path)
    setSaveError(null)
    setDiskNotice(null)
    setGitOpen(false)
    restorePathRef.current = path
    savePrefs({ lastPath: path, expanded: Array.from(expanded) })
  }, [expanded])

  // --- Drawer open/close with shell-mediated back support ---
  const closeNav = useCallback(() => {
    try { navHandleRef.current?.close?.() } catch {}
    navHandleRef.current = null
    setNavOpen(false)
  }, [])

  const openNav = useCallback(async () => {
    if (window.mobius?.nav?.open) {
      const handle = window.mobius.nav.open('editor-drawer', () => {
        navHandleRef.current = null
        setNavOpen(false)
      })
      navHandleRef.current = handle
      await handle.ready?.catch(() => false)
      if (navHandleRef.current !== handle) return
    }
    setNavOpen(true)
  }, [])

  const toggleNav = useCallback(() => { if (navOpen) closeNav(); else openNav() }, [navOpen, closeNav, openNav])

  // Guard against silently discarding unsaved edits when the user opens a
  // DIFFERENT file. If the current buffer is dirty, hold the target (plus the
  // nav-close the tap wanted) and show a confirm modal (the iframe blocks
  // window.confirm); otherwise switch straight away. Re-selecting the same file
  // is a no-op switch, so it never prompts. We defer the nav-close to the
  // confirm so a cancel leaves the user where they were browsing.
  const attemptSelectFile = useCallback((path, { closeNavAfter = false } = {}) => {
    if (path && path !== selectedRef.current && dirtyRef.current) {
      setPendingSwitch({ path, closeNavAfter })
      return
    }
    selectFile(path)
    if (closeNavAfter) closeNav()
  }, [selectFile, closeNav])

  const confirmSwitch = useCallback(() => {
    const target = pendingSwitch
    setPendingSwitch(null)
    if (target && target.path) {
      selectFile(target.path)
      if (target.closeNavAfter) closeNav()
    }
  }, [pendingSwitch, selectFile, closeNav])

  const cancelSwitch = useCallback(() => setPendingSwitch(null), [])

  // On desktop (≥760px) the drawer is already pinned-open by state initialization.
  // On mobile it starts closed — nothing to register on mount.
  // The cleanup effect below still tears down any live shell nav handle on unmount.

  // Swipe-left-to-close, ported from the Möbius shell Drawer. touchstart
  // captures the origin (only while open + single touch); touchmove drags the
  // panel 1:1 with the finger when the gesture is dominantly horizontal-left;
  // touchend either closes (≥70px past origin AND horizontal-dominant) or snaps
  // back. The CSS transition is disabled mid-drag via `ed-drawer--dragging` so
  // the panel tracks the finger, then the normal transform-transition animates
  // the snap/close once the class is removed.
  const drawerRef = useRef(null)
  const dragStart = useRef(null) // { x, y } or null

  function onDrawerTouchStart(e) {
    // At >=760px the drawer is a static column (no overlay/scrim, toggle hidden),
    // so a swipe-to-close is meaningless and would briefly slide the static
    // column before self-healing. Only the narrow overlay layout is swipeable.
    if (typeof window !== 'undefined' && window.innerWidth >= 760) return
    if (!navOpen || e.touches.length !== 1) return
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onDrawerTouchMove(e) {
    if (!dragStart.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - dragStart.current.x
    const dy = e.touches[0].clientY - dragStart.current.y
    if (dx < 0 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      const el = drawerRef.current
      if (!el) return
      el.classList.add('ed-drawer--dragging')
      // Cap the drag at the drawer's own rendered width (80%/max-320) so the
      // panel never slides past fully-closed, matching the shell's -width cap.
      const w = el.offsetWidth || 320
      el.style.transform = `translateX(${Math.max(dx, -w)}px)`
    }
  }
  function onDrawerTouchEnd(e) {
    if (!dragStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - dragStart.current.x
    const dy = t.clientY - dragStart.current.y
    const shouldClose = dx < -70 && Math.abs(dx) > Math.abs(dy) * 1.35
    const el = drawerRef.current
    if (el) {
      el.classList.remove('ed-drawer--dragging')
      if (shouldClose) {
        // Animate from the finger position to closed, then clear the inline
        // transform after the transition so the next open doesn't start from
        // an inline translateX(-100%) that would fight the .is-open class.
        el.style.transform = 'translateX(-100%)'
        const cleanup = () => {
          if (el) el.style.transform = ''
          el.removeEventListener('transitionend', cleanup)
        }
        el.addEventListener('transitionend', cleanup, { once: true })
      } else {
        // Snap back: clearing the inline transform lets the .is-open class's
        // translateX(0) take over with the transition running from here.
        el.style.transform = ''
      }
    }
    dragStart.current = null
    if (shouldClose) closeNav()
  }
  // touchcancel positions are unreliable across browsers, so treat cancel as
  // "snap back, don't close" — never evaluate the close threshold on a cancel.
  function onDrawerTouchCancel() {
    const el = drawerRef.current
    if (el) {
      el.classList.remove('ed-drawer--dragging')
      el.style.transform = ''
    }
    dragStart.current = null
  }

  // Fetch + cache one directory level unconditionally (refreshDir no-ops for
  // dirs we never expanded; focus + create both need a dir's children fetched
  // on demand). Returns the entries so a caller can act on the result.
  const loadDir = useCallback(async (dirPath) => {
    setLoadingDirs((prev) => { const n = new Set(prev); n.add(dirPath); return n })
    setErrorDirs((prev) => { const n = { ...prev }; delete n[dirPath]; return n })
    try {
      const { entries, redacted } = await fetchDir(dirPath)
      setChildrenByDir((prev) => ({ ...prev, [dirPath]: entries }))
      setRedactedByDir((prev) => ({ ...prev, [dirPath]: redacted }))
      return entries
    } catch (e) {
      setErrorDirs((prev) => ({ ...prev, [dirPath]: e.message || 'Could not list this folder.' }))
      return null
    } finally {
      setLoadingDirs((prev) => { const n = new Set(prev); n.delete(dirPath); return n })
    }
  }, [fetchDir])

  // --- Folder focus ---
  // "Focus" narrows the tree to one folder's subtree; clearing restores the
  // full tree. Toggling focus on the already-focused dir unfocuses it. We make
  // sure the focused dir's children are fetched (it may never have been
  // expanded) so the narrowed tree isn't blank.
  // Focus stays in the drawer (the owner is narrowing what they browse), so we
  // do NOT close the nav here — closing would hide the tree they just focused.
  const focusDir = useCallback((dirPath) => {
    setFocusRoot((cur) => {
      const next = cur === dirPath ? '' : dirPath
      if (next && !childrenByDir[next]) loadDir(next)
      return next
    })
  }, [childrenByDir, loadDir])

  const clearFocus = useCallback(() => setFocusRoot(''), [])

  // Open a directory row tapped in the git panel. A wholly-untracked folder
  // arrives from git as a directory path — opening it as a FILE 404s and reads
  // as "This file no longer exists", so instead focus the tree on that subtree.
  // On a narrow viewport the drawer is closed, so reveal it to show the result;
  // on desktop the drawer is a static column already in view.
  const openDirFromGit = useCallback((dirPath) => {
    focusDir(dirPath)
    if (typeof window !== 'undefined' && window.innerWidth < 760) openNav()
  }, [focusDir, openNav])

  // --- Create a file or folder ---
  // The create target is the focused folder if any, else the directory of the
  // selected file, else the root. A new file is an empty write; a new folder is
  // a `.keep` marker write (the FS API auto-creates parent dirs, so a single
  // write materializes the path). After a successful write we re-fetch the
  // target dir so the new entry appears, and select a new file so the owner
  // lands in it ready to type.
  const createTargetDir = useCallback(() => {
    if (focusRoot) return focusRoot
    if (selectedPath) return dirName(selectedPath)
    return ''
  }, [focusRoot, selectedPath])

  const openCreate = useCallback((kind) => {
    setCreateError(null)
    setCreateModal({ kind, targetDir: createTargetDir() })
  }, [createTargetDir])

  const closeCreate = useCallback(() => {
    setCreateModal(null)
    setCreateError(null)
    setCreating(false)
  }, [])

  const submitCreate = useCallback(async (name) => {
    if (!createModal) return
    const { kind, targetDir } = createModal
    if (!isValidLeafName(name)) {
      setCreateError('Use a single name — no slashes, and not “.keep”.')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      // Guard against clobbering an existing entry at the target (the FS write
      // would otherwise silently overwrite a file's contents with empty). The
      // collision check needs the target dir's REAL listing: if we only trust a
      // cached `childrenByDir[targetDir]`, an un-expanded target has no cache
      // and the guard never fires. Fetch the listing first (loadDir caches it),
      // and only proceed if the fetch succeeded — refusing to create blind
      // beats overwriting an unseen file.
      let siblings = childrenByDir[targetDir]
      if (!Array.isArray(siblings)) {
        siblings = await loadDir(targetDir)
        if (siblings === null) {
          setCreating(false)
          setCreateError('Could not check this folder’s contents — try again.')
          return
        }
      }
      if (siblings.some((e) => e.name === name)) {
        setCreating(false)
        setCreateError(`“${name}” already exists here.`)
        return
      }
      if (kind === 'folder') {
        await fsWrite(joinPath(joinPath(targetDir, name), '.keep'), '')
      } else {
        await fsWrite(joinPath(targetDir, name), '')
      }
      // Make sure the target dir is expanded + re-fetched so the new row shows.
      if (targetDir) setExpanded((prev) => { const n = new Set(prev); n.add(targetDir); return n })
      await loadDir(targetDir)
      closeCreate()
      // Open the new file THROUGH the dirty-switch guard — a direct selectFile
      // here would silently discard an unsaved buffer without the discard modal.
      // The created row is already re-listed above, so it stays visible even if
      // the switch is deferred behind (or cancelled at) the discard prompt.
      if (kind === 'file') attemptSelectFile(joinPath(targetDir, name), { closeNavAfter: false })
    } catch (e) {
      setCreating(false)
      setCreateError(e.message || 'Could not create.')
    }
  }, [createModal, childrenByDir, loadDir, attemptSelectFile, closeCreate])

  // --- Delete a file ---
  // The tree's per-row ✕ opens a confirm dialog (the iframe blocks
  // window.confirm). On confirm we DELETE via the FS API, then refresh the
  // file's directory so the row disappears, and clear the open buffer if the
  // deleted file was the one being viewed.
  const requestDelete = useCallback((entry) => {
    setDeleteError(null)
    setDeleteTarget(entry)
  }, [])

  const closeDelete = useCallback(() => {
    setDeleteTarget(null)
    setDeleteError(null)
    setDeleting(false)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    const path = deleteTarget.path
    setDeleting(true)
    setDeleteError(null)
    try {
      await fsDelete(path)
      // Refresh the parent dir so the deleted row disappears. After a delete,
      // re-list even a directory we haven't expanded as cached so the change is
      // reflected wherever the row lived (root '' included).
      await loadDir(dirName(path))
      // If the deleted file was open, clear the editor back to the empty state.
      if (selectedRef.current === path) clearOpenFile()
      closeDelete()
    } catch (e) {
      setDeleting(false)
      // 404 = already gone: treat as success (refresh + close) rather than an
      // error — same full cleanup as the normal path so no stale dirty/baseline
      // or banner survives.
      if (e.status === 404) {
        loadDir(dirName(path))
        if (selectedRef.current === path) clearOpenFile()
        closeDelete()
        return
      }
      setDeleteError(e.message || 'Could not delete this file.')
    }
  }, [deleteTarget, loadDir, closeDelete, clearOpenFile])

  // When the selection changes, load the file + its git status.
  useEffect(() => {
    if (!selectedPath) { clearOpenFile(); return }
    loadFile(selectedPath)
    loadGit(selectedPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath])

  // Persist expansion set to prefs (debounced via the toggle handler is
  // overkill; a plain effect is fine — writes are best-effort + coalesced by
  // the storage layer).
  useEffect(() => {
    if (!prefsLoadedRef.current) return
    savePrefs({ lastPath: selectedRef.current, expanded: Array.from(expanded) })
  }, [expanded])

  // Restore prefs once on mount (after the root is available so expansions can
  // be honored). We expand saved dirs (fetching their children) and reopen the
  // last file. Best-effort: a saved dir that no longer exists just no-ops.
  useEffect(() => {
    if (prefsLoadedRef.current) return
    if (rootLoading) return
    prefsLoadedRef.current = true
    loadPrefs().then((prefs) => {
      if (!prefs || typeof prefs !== 'object') return
      const dirs = Array.isArray(prefs.expanded) ? prefs.expanded : []
      // Expand shallow-to-deep so each fetch's parent listing exists first.
      const ordered = [...dirs].sort((a, b) => a.split('/').length - b.split('/').length)
      ordered.reduce((p, d) => p.then(() => toggleDir(d)), Promise.resolve()).catch(() => {})
      if (typeof prefs.lastPath === 'string' && prefs.lastPath) {
        setSelectedPath(prefs.lastPath)
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootLoading])

  // --- Save the open file (explicit) ---
  const onEditorChange = useCallback((text) => {
    setContent(text)
    setDirty(text !== baselineRef.current)
    if (saveError) setSaveError(null)
  }, [saveError])

  // The actual write — shared by the normal save and the confirmed-overwrite
  // path. No divergence check here; the caller decides whether to gate.
  //
  // Snapshot the file + buffer AT WRITE TIME (via refs, not render-captured
  // closure vars) so the state we clean afterwards matches what we actually
  // wrote. After the PUT returns we only mark the buffer clean if we're still on
  // the same file AND the live buffer still equals what we wrote — otherwise we
  // set the baseline to the saved text and recompute `dirty` from the LIVE
  // buffer, so keystrokes typed during the in-flight write stay dirty instead of
  // being silently marked saved and then lost on the next file switch.
  const writeNow = useCallback(async () => {
    const savedPath = selectedRef.current
    if (!savedPath) return
    const savedText = contentRef.current
    setSaving(true)
    setSaveError(null)
    try {
      await fsWrite(savedPath, savedText)
      if (selectedRef.current === savedPath) {
        baselineRef.current = savedText
        setDirty(bufferDirtyAfterSave(savedText, contentRef.current))
        setDiskNotice(null)  // the user resolved the divergence by saving
        // The save may have changed git status (new modified/untracked) — refresh.
        loadGit(savedPath)
      }
    } catch (e) {
      if (selectedRef.current === savedPath) setSaveError(e.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }, [loadGit])

  const handleSave = useCallback(async () => {
    if (!selectedPath || !meta || !meta.writable) return
    if (savingRef.current) return
    // Detect a divergence AT SAVE TIME: re-read the on-disk text and compare to
    // the baseline we loaded. Previously save was an unconditional overwrite, so
    // an agent edit that landed without an onTurnDone re-read (or that the user
    // dismissed) would be silently clobbered. If the disk diverged, ask before
    // overwriting. A re-read failure is non-fatal — fall through to a plain save
    // rather than blocking the user from saving at all.
    try {
      const diskText = await fsReadText(selectedPath)
      if (selectedRef.current !== selectedPath) return  // selection moved on
      if (diskText !== baselineRef.current) {
        setPendingOverwrite(true)
        return
      }
    } catch {
      // Couldn't re-read — proceed with the save (best-effort divergence check).
    }
    if (selectedRef.current !== selectedPath) return
    await writeNow()
  }, [selectedPath, meta, writeNow])

  const confirmOverwrite = useCallback(() => {
    setPendingOverwrite(false)
    writeNow()
  }, [writeNow])

  const cancelOverwrite = useCallback(() => {
    setPendingOverwrite(false)
    // Re-read the file so the user can see what's on disk now and reconcile;
    // their unsaved buffer is preserved by the dirty-guard in loadFile.
    if (selectedRef.current) loadFile(selectedRef.current, { external: true })
  }, [loadFile])

  // Cmd/Ctrl-S saves (when writable). A keyboard convenience; the Save button
  // is the primary affordance.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        if (selectedRef.current && meta && meta.writable) {
          e.preventDefault()
          handleSave()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave, meta])

  // --- Agent turn done → re-read the open file + refresh its dir + git ---
  const handleTurnDone = useCallback(() => {
    const path = selectedRef.current
    if (path) {
      loadFile(path, { external: true })
      loadGit(path)
      // Force the image preview (if the open file is an image) to re-fetch its
      // bytes — the agent may have regenerated it at the same path.
      setFileReloadKey((k) => k + 1)
    }
    // The agent can touch files anywhere — refresh the root plus every
    // currently-expanded directory so new/removed files appear wherever they
    // landed, not just under the open file. refreshDir no-ops for dirs we
    // never loaded, so this stays bounded to what's actually on screen.
    refreshDir('')
    expandedRef.current.forEach((d) => refreshDir(d))
  }, [loadFile, loadGit, refreshDir])

  // --- Chat/editor split resize ---
  // Persist the panel height (best-effort, per app) — but only once the user
  // has actually chosen one; persisting the untouched default would defeat the
  // 50/50 spawn forever after the first visit. The drag itself is a
  // pointer-capture loop on the divider: pointerdown records the start, each
  // pointermove sets chatHeight clamped between CHAT_MIN_PX and
  // (containerHeight - CHAT_MIN_PX) so neither pane can vanish, pointerup ends.
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    if (!chatHeightTouched.current) return
    try { localStorage.setItem(chatHeightKey(appId), String(Math.round(chatHeight))) } catch {}
  }, [appId, chatHeight])

  // The chat-pane MAX for a given column height: fill everything except the
  // divider, so the editor above can collapse to zero while the divider (and
  // therefore the pill below it) stay on screen. Floors at CHAT_MIN_PX so a
  // tiny column can't invert the clamp.
  const maxChatPx = useCallback((total) => Math.max(CHAT_MIN_PX, total - CHAT_DIVIDER_PX), [])

  // Re-clamp the chat height whenever the main column changes size. Without
  // this, a tall chat pane keeps its fixed px height after a rotation or when
  // the on-screen keyboard shrinks the viewport, pushing the embedded composer
  // and the resize divider off-screen with no way to drag them back. We only
  // ever shrink toward the new max (growing the column leaves the user's chosen
  // height alone) and never mark the height "touched" — an automatic correction
  // must not defeat the fresh-device 50/50 spawn.
  useEffect(() => {
    const el = mainRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => {
      const total = el.getBoundingClientRect().height
      if (!total) return
      const maxPx = maxChatPx(total)
      setChatHeight((v) => Math.min(maxPx, Math.max(CHAT_MIN_PX, v)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxChatPx])

  // Opening the chat for the first time (no height chosen yet) spawns it at
  // half the main column — the house 50/50 split. After that the user's own
  // height (dragged or restored) wins.
  const toggleChat = useCallback(() => {
    const opening = !chatOpen
    if (opening && !chatHeightTouched.current) {
      const total = mainRef.current ? mainRef.current.getBoundingClientRect().height : 0
      if (total) {
        const maxPx = maxChatPx(total)
        setChatHeight(Math.min(maxPx, Math.max(CHAT_MIN_PX, Math.round(total * CHAT_SPAWN_RATIO))))
      }
    }
    setChatOpen(!chatOpen)
  }, [chatOpen, maxChatPx])

  const beginChatResize = useCallback((event) => {
    event.preventDefault()
    chatHeightTouched.current = true
    const container = mainRef.current
    if (!container) return
    const total = container.getBoundingClientRect().height
    if (!total) return
    const startY = event.clientY
    const startHeight = chatHeight
    // MIN = the composer pill band (transcript collapses to zero, pill stays);
    // MAX = column minus the divider (editor collapses to zero, divider stays).
    const maxPx = maxChatPx(total)
    const onMove = (moveEvent) => {
      const next = startHeight + (startY - moveEvent.clientY)
      setChatHeight(Math.min(maxPx, Math.max(CHAT_MIN_PX, next)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }, [chatHeight, maxChatPx])

  // Keyboard resize for the divider (it's a focusable separator): arrows nudge,
  // Home/End jump to the extremes the drag can reach.
  const nudgeChat = useCallback((deltaPx) => {
    chatHeightTouched.current = true
    const container = mainRef.current
    const total = container ? container.getBoundingClientRect().height : 0
    const maxPx = total ? maxChatPx(total) : Infinity
    setChatHeight((v) => Math.min(maxPx, Math.max(CHAT_MIN_PX, v + deltaPx)))
  }, [maxChatPx])

  const onResizerKey = useCallback((event) => {
    if (event.key === 'ArrowUp') { event.preventDefault(); nudgeChat(24) }
    else if (event.key === 'ArrowDown') { event.preventDefault(); nudgeChat(-24) }
    else if (event.key === 'Home') {
      event.preventDefault()
      chatHeightTouched.current = true
      const container = mainRef.current
      const total = container ? container.getBoundingClientRect().height : 0
      setChatHeight(total ? maxChatPx(total) : chatHeight)
    } else if (event.key === 'End') {
      event.preventDefault()
      chatHeightTouched.current = true
      setChatHeight(CHAT_MIN_PX)
    }
  }, [nudgeChat, chatHeight, maxChatPx])

  useEffect(() => () => { try { navHandleRef.current?.close?.() } catch {} navHandleRef.current = null }, [])

  const rootEntries = childrenByDir[''] || []
  const rootRedacted = redactedByDir[''] || []
  const openName = selectedPath ? baseName(selectedPath) : null
  const repoRoot = git ? git.repo_root : null

  // When a folder is focused, the tree renders that dir's children (fetched on
  // focus) at depth 0 instead of the root. The focused dir's own children may
  // still be loading the first time.
  const focused = focusRoot !== ''
  const treeEntries = focused ? (childrenByDir[focusRoot] || []) : rootEntries
  const treeRedacted = focused ? (redactedByDir[focusRoot] || []) : rootRedacted
  const focusLoading = focused && !childrenByDir[focusRoot] && loadingDirs.has(focusRoot)

  // What to render in the editor pane.
  function renderEditor() {
    if (!online && !meta) {
      return (
        <div className="ed-empty">
          <div className="ed-empty-mark" aria-hidden="true">⚡</div>
          <div className="ed-empty-title">Needs a connection</div>
          <p className="ed-empty-text">The Editor reads the live filesystem, so it needs the network. Reconnect to browse and edit.</p>
        </div>
      )
    }
    if (!selectedPath) {
      return (
        <div className="ed-empty">
          <div className="ed-empty-mark" aria-hidden="true">⌘</div>
          <div className="ed-empty-title">No file open</div>
          <p className="ed-empty-text">Open the tree and tap a file to view or edit it.</p>
        </div>
      )
    }
    if (fileLoading && !meta) {
      return <div className="ed-pane-note"><span className="ed-spinner" aria-hidden="true" /> Loading {openName}…</div>
    }
    if (fileError) {
      const s = fileError.status
      const msg = s === 401 ? 'Sign in as the owner to view files.'
        : s === 404 ? 'This file no longer exists — it may have been deleted.'
          : s === 413 ? 'This file is too large to preview here. Ask the agent to open or summarise it.'
            : s === 403 ? 'This file is protected and can’t be viewed here.'
              : (fileError.message || 'Could not open this file.')
      return <div className="ed-pane-note is-error">{msg}</div>
    }
    if (meta && meta.is_binary) {
      if (isImagePath(selectedPath) || (meta.mime_type || '').startsWith('image/')) {
        return <div className="ed-pane ed-pane-scroll"><ImagePreview path={selectedPath} reloadKey={fileReloadKey} /></div>
      }
      return (
        <div className="ed-pane-note">
          Binary file — {formatBytes(meta.size)}{meta.mime_type ? ` · ${meta.mime_type}` : ''}.
          Open it with the agent if you need its contents.
        </div>
      )
    }
    // Text file. Read-only if the server says so (root-owned / platform file).
    const readOnly = !meta || !meta.writable
    return (
      <div className="ed-pane">
        {readOnly && (
          <div className="ed-readonly-note">
            Platform-managed — read-only. Ask the agent if it must change.
          </div>
        )}
        <CodeEditor
          value={content}
          markdown={isMarkdownPath(selectedPath)}
          readOnly={readOnly}
          docKey={`${selectedPath}`}
          onChange={onEditorChange}
        />
      </div>
    )
  }

  const canSave = meta && meta.writable && !meta.is_binary

  return (
    <div className="ed-root">
      <style>{CSS}</style>

      <header className="ed-header">
        {/* The app's own glossy icon is the drawer toggle, mirroring the Möbius
            shell header where the logo (not a hamburger) opens the drawer. The
            real icon image — the backend serves a downscaled copy at
            ?size=128 (cached 1h), so it paints crisp at the larger 44px size
            without the old full-res PNG cost; the accent-dot fallback shows
            when an install has no custom
            icon (the route 404s). */}
        <button
          className="ed-icon-btn"
          onClick={toggleNav}
          aria-label={navOpen ? 'Close file tree' : 'Open file tree'}
          aria-expanded={navOpen}
        >
          <img
            src={`/api/apps/${appId}/icon?size=128`}
            alt=""
            width={36}
            height={36}
            className="ed-brand-icon"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const f = e.currentTarget.nextElementSibling
              if (f) f.style.display = 'flex'
            }}
          />
          <span className="ed-brand-fallback" style={{ display: 'none' }} aria-hidden="true" />
        </button>
        <div className="ed-header-title">
          {openName
            ? <span className="ed-open-path" title={selectedPath}>{openName}</span>
            : <span className="ed-open-path is-muted">Editor</span>}
          {dirty && <span className="ed-dirty-dot" title="Unsaved changes" aria-label="Unsaved changes" />}
        </div>
        <div className="ed-header-right">
          {!online && <span className="ed-offline-pill" title="The Editor needs a connection">Offline</span>}
          {selectedPath && canSave && (
            // Persistent: mounted for any writable text file so the header
            // layout doesn't jump when an edit makes it active. It goes visually
            // quiet + disabled when there's nothing to save (the .is-quiet CSS),
            // and becomes the primary accent button once the buffer is dirty.
            <button
              className={`ed-btn ed-btn-primary${dirty ? '' : ' is-quiet'}`}
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          <button
            type="button"
            className={`ed-icon-btn ed-chat-toggle${chatOpen ? ' is-active' : ''}`}
            onClick={toggleChat}
            aria-label={chatOpen ? 'Close chat' : 'Open chat'}
            aria-pressed={chatOpen}
            title={chatOpen ? 'Close chat' : 'Open chat'}
          >
            <ChatBubbleIcon size={20} />
          </button>
        </div>
      </header>

      <div className="ed-body">
        {/* Backdrop — taps close the drawer (mobile) */}
        <div className={`ed-scrim${navOpen ? ' is-open' : ''}`} onClick={closeNav} aria-hidden="true" />

        <aside
          ref={drawerRef}
          className={`ed-drawer${navOpen ? ' is-open' : ''}`}
          aria-label="File tree"
          aria-hidden={!navOpen}
          onTouchStart={onDrawerTouchStart}
          onTouchMove={onDrawerTouchMove}
          onTouchEnd={onDrawerTouchEnd}
          onTouchCancel={onDrawerTouchCancel}
        >
          <div className="ed-drawer-head">
            <span className="ed-drawer-sub">/data</span>
            <div className="ed-drawer-actions">
              <button
                type="button"
                className="ed-new-btn"
                onClick={() => openCreate('file')}
                disabled={!online}
                title="New file"
              >
                + File
              </button>
              <button
                type="button"
                className="ed-new-btn"
                onClick={() => openCreate('folder')}
                disabled={!online}
                title="New folder"
              >
                + Folder
              </button>
            </div>
          </div>
          {focused && (
            <div className="ed-focus-bar">
              <button type="button" className="ed-focus-clear" onClick={clearFocus} title="Show the full tree">
                ← All files
              </button>
              <span className="ed-focus-path" title={`/data/${focusRoot}`}>{focusRoot}</span>
            </div>
          )}
          <div className="ed-tree ed-scroll" role="tree" aria-label="Filesystem">
            {!focused && rootLoading && rootEntries.length === 0 && (
              <div className="ed-row-note"><span className="ed-spinner" aria-hidden="true" /> Loading…</div>
            )}
            {!focused && rootError && (
              <div className="ed-row-note is-error">
                {rootError}
                <button type="button" className="ed-retry" onClick={loadRoot}>Retry</button>
              </div>
            )}
            {focusLoading && (
              <div className="ed-row-note"><span className="ed-spinner" aria-hidden="true" /> Loading…</div>
            )}
            {focused && errorDirs[focusRoot] && (
              <div className="ed-row-note is-error">{errorDirs[focusRoot]}</div>
            )}
            {!focusLoading && !(!focused && (rootLoading || rootError)) && !(focused && errorDirs[focusRoot]) && treeEntries.filter((e) => !isKeepMarker(e.name)).length === 0 && (
              <div className="ed-empty ed-empty-tree">
                <div className="ed-empty-mark" aria-hidden="true">∅</div>
                <div className="ed-empty-title">Nothing here</div>
                <p className="ed-empty-text">{focused ? `/data/${focusRoot} is empty.` : '/data looks empty.'}</p>
              </div>
            )}
            {treeEntries.map((entry) => (
              <FileNode
                key={entry.path}
                entry={entry}
                depth={0}
                expanded={expanded}
                childrenByDir={childrenByDir}
                redactedByDir={redactedByDir}
                loadingDirs={loadingDirs}
                errorDirs={errorDirs}
                selectedPath={selectedPath}
                gitRepos={gitRepos}
                focusRoot={focusRoot}
                onToggleDir={toggleDir}
                onSelectFile={(p) => attemptSelectFile(p, { closeNavAfter: true })}
                onFocusDir={focusDir}
                onDeleteFile={requestDelete}
                onRetryDir={(p) => loadDirInto(p, { showLoading: true })}
              />
            ))}
            {treeRedacted.length > 0 && (
              <div className="ed-row-note is-protected">{treeRedacted.length} protected</div>
            )}
          </div>
        </aside>

        <main className="ed-main" ref={mainRef}>
          {selectedPath && (
            <GitPanel
              git={git}
              gitError={gitError}
              gitLoading={gitLoading}
              repoRoot={repoRoot}
              open={gitOpen}
              onToggle={() => setGitOpen((v) => !v)}
              onOpenFile={(p) => attemptSelectFile(p)}
              onOpenDir={openDirFromGit}
            />
          )}
          {diskNotice && <div className="ed-save-error is-notice" role="status">{diskNotice}</div>}
          {saveError && <div className="ed-save-error" role="status">{saveError}</div>}
          <div className="ed-editor-wrap">{renderEditor()}</div>
          <>
            {chatOpen && (
              <div
                className="ed-chat-resizer"
                role="separator"
                aria-label="Resize chat and editor areas"
                aria-orientation="horizontal"
                tabIndex={0}
                onPointerDown={beginChatResize}
                onKeyDown={onResizerKey}
              >
                <span className="ed-chat-resizer-bar" aria-hidden="true" />
              </div>
            )}
            <div className="ed-chat-slot" style={chatOpen ? undefined : { display: 'none' }}>
              <ChatPanel chatHeight={chatHeight} onTurnDone={handleTurnDone} quickActions={quickActions} getContext={getContext} />
            </div>
          </>
        </main>
      </div>
      {createModal && (
        <NameModal
          kind={createModal.kind}
          targetDir={createModal.targetDir}
          error={createError}
          busy={creating}
          onSubmit={submitCreate}
          onCancel={closeCreate}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete file"
          body={<>Delete <code className="ed-modal-code">/data/{deleteTarget.path}</code>? This can’t be undone here.</>}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          error={deleteError}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={closeDelete}
        />
      )}
      {pendingSwitch && (
        <ConfirmModal
          title="Discard unsaved changes?"
          body={<>You have unsaved edits in <code className="ed-modal-code">{openName}</code>. Opening another file will discard them.</>}
          confirmLabel="Discard & open"
          onConfirm={confirmSwitch}
          onCancel={cancelSwitch}
        />
      )}
      {pendingOverwrite && (
        <ConfirmModal
          title="File changed on disk"
          body={<><code className="ed-modal-code">{openName}</code> changed on disk since you opened it (the agent likely edited it). Saving will overwrite those changes with your version.</>}
          confirmLabel="Overwrite"
          busyLabel="Saving…"
          busy={saving}
          onConfirm={confirmOverwrite}
          onCancel={cancelOverwrite}
        />
      )}
    </div>
  )
}
