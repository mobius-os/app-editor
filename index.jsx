// Editor — a MiXplorer-style file inspector + light editor for Möbius.
//
// The module tree is declared in mobius.json's source_files; the multi-file
// installer fetches each path and Rolldown bundles from this entry, resolving
// the relative imports below at compile time.
//
//   constants.js  — scalar constants (view/sort/prefs, shortcuts, caps)
//   theme.js      — the single app stylesheet (CSS)
//   domain.js     — CodeMirror + markdown-preview + KaTeX engine (no React)
//   paths.js      — pure path/name/format/sort helpers (dependency-free)
//   storage.js    — scoped FS API helpers, online signal, prefs
//   ui/*.jsx      — one React component per concern
//
// This app is the owner's window into the guarded /data tree. Its manifest
// grants the app identity filesystem_access, so /api/fs accepts the short-lived
// scoped `token` prop without exposing the owner's login token to this frame.
//
// Redesign shape (was: tree drawer + editor + resizable chat): a DRILL-IN file
// browser is the home surface — a tappable breadcrumb, a dense detail list with
// sort/filter/grid, a bookmarks drawer of server locations, a Properties sheet,
// a status-bar census + disk gauge. Editing and the agent chat DEMOTE to
// on-demand surfaces so the whole screen goes to
// browsing/inspection. The FS is huge, so a directory is fetched one level at a
// time (paginated, capped) and cached; revisits and breadcrumb jumps are instant.
import {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react'
import {
  DESKTOP_BREAKPOINT, LISTING_PAGE_CAP, LISTING_ENTRY_CAP,
  SHORTCUTS, START_PATH, DEFAULT_PREFS, VIEW_LIST, VIEW_GRID, TABS_MAX, FOCUSABLE_SELECTOR,
} from './constants.js'
import { CSS } from './theme.js'
import {
  fsDelete, fsMeta, fsReadText, fsReadHead, fsTree, fsWrite, fsDisk, fsDu,
  configureFilesystemToken, loadPrefs, savePrefs, emitSignal, useOnline,
} from './storage.js'
import {
  baseName, dirName, parentDir, extOf, bufferDirtyAfterSave,
  filterVisibleEntries, isKeepMarker, isValidLeafName, joinPath,
  sortEntries, pushRecent,
} from './paths.js'
import { Icon } from './ui/Icons.jsx'
import { TabStrip } from './ui/TabStrip.jsx'
import { Breadcrumb } from './ui/Breadcrumb.jsx'
import { EntryRow } from './ui/EntryRow.jsx'
import { GridCell } from './ui/Thumb.jsx'
import { StatusBar } from './ui/StatusBar.jsx'
import { OverflowMenu } from './ui/OverflowMenu.jsx'
import { BookmarksDrawer } from './ui/BookmarksDrawer.jsx'
import { PropertiesSheet } from './ui/PropertiesSheet.jsx'
import { FileViewer } from './ui/FileViewer.jsx'
import { ChatPanel } from './ui/ChatPanel.jsx'
import { ChatBubbleIcon } from './ui/ChatBubbleIcon.jsx'
import { NameModal } from './ui/NameModal.jsx'
import { ConfirmModal } from './ui/ConfirmModal.jsx'

export default function App({ appId, token }) {
  // Configure before hooks/effects can schedule any filesystem work. Each app
  // runs in its own frame realm, so this module-local value cannot leak to a
  // sibling app.
  configureFilesystemToken(token)
  const online = useOnline()

  // Responsive: phone (stack + drill; file/props/chat push) vs desktop
  // master-detail (wide listing beside a docked viewer; drawer pinned).
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(`(min-width:${DESKTOP_BREAKPOINT}px)`).matches
      : (typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT),
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia(`(min-width:${DESKTOP_BREAKPOINT}px)`)
    const on = (e) => setIsDesktop(e.matches)
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on)
    return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on) }
  }, [])

  // --- Prefs (view, sort, folders-first, hidden files, bookmarks, recents) ---
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const prefsLoadedRef = useRef(false)

  // --- Listing state (lazy, level-at-a-time, cached) ---
  const [childrenByDir, setChildrenByDir] = useState({})
  const [redactedByDir, setRedactedByDir] = useState({})
  const [cappedByDir, setCappedByDir] = useState({})
  const [dirLoading, setDirLoading] = useState({})   // {path: bool}
  const [dirError, setDirError] = useState({})       // {path: msg}
  const dirGenRef = useRef(new Map())
  const appReadyRef = useRef(false)

  // --- Current location (drill-in) ---
  // Folder tabs — each is an independent location; the ACTIVE tab's path is the
  // current directory (cwd). Navigation mutates the active tab; switching tabs
  // is the no-dual-pane way to compare or hop between two folders.
  const tabSeqRef = useRef(1)
  const newTabId = () => `t${tabSeqRef.current++}`
  const [tabs, setTabs] = useState(() => [{ id: 't0', path: START_PATH }])
  const [activeTabId, setActiveTabId] = useState('t0')
  const activeTabIdRef = useRef('t0')
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]
  const cwd = activeTab ? activeTab.path : ''
  const cwdRef = useRef(START_PATH)
  useEffect(() => { cwdRef.current = cwd }, [cwd])

  // --- Disk gauge (feature-detected; null when the server lacks /disk) ---
  const [disk, setDisk] = useState(null)

  // --- Filter (within the current folder) ---
  const [filter, setFilter] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  // --- Open-file / editor state ---
  const [selectedPath, setSelectedPath] = useState(null)
  const [meta, setMeta] = useState(null)
  const [content, setContent] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [diskNotice, setDiskNotice] = useState(null)
  const [fileReloadKey, setFileReloadKey] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [truncatedTotal, setTruncatedTotal] = useState(null)
  const baselineRef = useRef('')
  const contentRef = useRef('')
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const selectedRef = useRef(null)
  useEffect(() => { contentRef.current = content }, [content])
  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  useEffect(() => { savingRef.current = saving }, [saving])
  useEffect(() => { selectedRef.current = selectedPath }, [selectedPath])

  // KaTeX CSS for the markdown live-preview (self-hosted, same-origin, no CDN).
  useEffect(() => {
    if (document.querySelector('link[data-ed-katex]')) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/vendor/katex/katex.min.css'
    link.setAttribute('data-ed-katex', '1')
    document.head.appendChild(link)
  }, [])

  // --- Overlays / menus ---
  const [navOpen, setNavOpen] = useState(false)     // phone drawer (desktop = pinned rail)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [propsTarget, setPropsTarget] = useState(null)
  const [propsDetail, setPropsDetail] = useState(null)
  const [propsDirCount, setPropsDirCount] = useState(null)
  const [propsDu, setPropsDu] = useState(null)          // recursive {bytes,files,dirs,truncated}
  const [propsDuLoading, setPropsDuLoading] = useState(false)
  const [propsLoading, setPropsLoading] = useState(false)
  const [propsError, setPropsError] = useState(null)
  const propsPathRef = useRef(null)                     // guards async du against a changed target
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMounted, setChatMounted] = useState(false)
  const chatOpenRef = useRef(false)
  useEffect(() => { chatOpenRef.current = chatOpen }, [chatOpen])

  // --- Create / delete / switch / overwrite modals ---
  const [createModal, setCreateModal] = useState(null)
  const [createError, setCreateError] = useState(null)
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  useEffect(() => { creatingRef.current = creating }, [creating])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const deletingRef = useRef(false)
  useEffect(() => { deletingRef.current = deleting }, [deleting])
  const [pendingSwitch, setPendingSwitch] = useState(null)
  const [pendingClose, setPendingClose] = useState(false)
  const [pendingOverwrite, setPendingOverwrite] = useState(false)

  // --- Shell back-stack handles ---
  const navHandleRef = useRef(null)       // drawer
  const fileHandleRef = useRef(null)      // phone file overlay
  const overflowHandleRef = useRef(null)
  const propsHandleRef = useRef(null)
  const chatHandleRef = useRef(null)
  const createHandleRef = useRef(null)
  const deleteHandleRef = useRef(null)
  const switchHandleRef = useRef(null)
  const overwriteHandleRef = useRef(null)

  const closeBackHandle = useCallback((ref) => {
    try { ref.current?.close?.() } catch {}
    ref.current = null
  }, [])

  const openBackSurface = useCallback(async (label, ref, onBack) => {
    closeBackHandle(ref)
    if (window.mobius?.nav?.open) {
      const handle = window.mobius.nav.open(label, () => {
        if (ref.current === handle) ref.current = null
        onBack()
      })
      ref.current = handle
      await handle.ready?.catch(() => false)
      if (ref.current !== handle) return false
    }
    return true
  }, [closeBackHandle])

  // ----------------------------------------------------------------------
  // Directory listing — paginate through cursors so a big level lists fully,
  // capped so a pathological dir (node_modules) can't pull the whole tree.
  // Always requests ?counts=1: the server adds an immediate child_count to dir
  // entries on a new build and ignores it on an old one (feature-detected).
  // ----------------------------------------------------------------------
  const fetchDir = useCallback(async (dirPath) => {
    let cursor = null
    let all = []
    let redacted = []
    let pages = 0
    let capped = false
    do {
      // eslint-disable-next-line no-await-in-loop
      const data = await fsTree(dirPath, cursor, { counts: true })
      all = all.concat(data.entries || [])
      if (cursor === null && data.redacted) redacted = data.redacted
      cursor = data.next_cursor
      pages += 1
      if (all.length >= LISTING_ENTRY_CAP || pages >= LISTING_PAGE_CAP) {
        if (cursor) capped = true
        break
      }
    } while (cursor)
    // The FS root resolves to "." on the server, so ROOT-level entries come back
    // path-prefixed "./name" (nested levels are already clean). Strip the "./"
    // so every path we hold is clean FS-root-relative — the breadcrumb, drill-in
    // navigation, and every /api/fs call depend on that.
    const entries = all.slice(0, LISTING_ENTRY_CAP).map((e) => (
      e && typeof e.path === 'string' && e.path.startsWith('./') ? { ...e, path: e.path.slice(2) } : e
    ))
    return { entries, redacted, capped }
  }, [])

  // Fetch a directory into the cache under a generation guard so a slow fetch
  // can't overwrite a fresher one (re-navigate, or an agent-turn refresh).
  const loadDir = useCallback(async (dirPath, { showLoading = false } = {}) => {
    const gen = (dirGenRef.current.get(dirPath) || 0) + 1
    dirGenRef.current.set(dirPath, gen)
    if (showLoading) {
      setDirLoading((p) => ({ ...p, [dirPath]: true }))
      setDirError((p) => { const n = { ...p }; delete n[dirPath]; return n })
    }
    try {
      const { entries, redacted, capped } = await fetchDir(dirPath)
      if (dirGenRef.current.get(dirPath) !== gen) return
      setChildrenByDir((p) => ({ ...p, [dirPath]: entries }))
      setRedactedByDir((p) => ({ ...p, [dirPath]: redacted }))
      setCappedByDir((p) => ({ ...p, [dirPath]: capped }))
      if (dirPath === '' && !appReadyRef.current) {
        appReadyRef.current = true
        emitSignal('app_ready', { item_count: entries.length })
      }
    } catch (e) {
      if (dirGenRef.current.get(dirPath) !== gen) return
      emitSignal('fs_error', { status: (e && e.status) || 0, source: 'tree' })
      if (showLoading) setDirError((p) => ({ ...p, [dirPath]: e.message || 'Could not list this folder.' }))
    } finally {
      if (dirGenRef.current.get(dirPath) === gen) {
        setDirLoading((p) => { const n = { ...p }; delete n[dirPath]; return n })
      }
    }
  }, [fetchDir])

  // ----------------------------------------------------------------------
  // Navigation. Set the location, ensure its listing is cached (instant on a
  // re-visit), remember it in recents, and close any transient chrome. Keeping
  // navigateTo surface-agnostic lets drills, breadcrumbs, and shortcuts share
  // the same path.
  // ----------------------------------------------------------------------
  const navigateTo = useCallback((dirPath) => {
    const path = String(dirPath || '').replace(/^\/+|\/+$/g, '')
    setFilter('')
    setFilterOpen(false)
    setOverflowOpen(false)
    setTabs((prev) => prev.map((t) => (t.id === activeTabIdRef.current ? { ...t, path } : t)))
    if (!childrenByDir[path]) loadDir(path, { showLoading: true })
    if (prefsLoadedRef.current) {
      setPrefs((p) => {
        const next = { ...p, recents: pushRecent(p.recents, path) }
        savePrefs(next)
        return next
      })
    }
    emitSignal('dir_opened', { depth: path ? path.split('/').length : 0 })
  }, [childrenByDir, loadDir])

  const drillInto = useCallback((entry) => {
    navigateTo(entry.path)
  }, [navigateTo])

  // Ascend one folder level. Directory navigation is NOT wired to the shell
  // back-stack: the tappable breadcrumb and this Up button are the ascent
  // affordances (MiXplorer's model). The shell back-stack is reserved for the
  // one-at-a-time OVERLAYS (drawer, file viewer on phone, modals, chat) — a
  // persistent directory back-surface underneath those would be popped in the
  // same gesture that closes an overlay, ascending a level unexpectedly.
  const ascend = useCallback(() => {
    if (cwdRef.current) navigateTo(parentDir(cwdRef.current))
  }, [navigateTo])

  // Load a tab's directory when it becomes active (cached listings make
  // switching instant). Shared by switch/new/close.
  const activateTabAt = useCallback((path) => {
    setFilter('')
    setFilterOpen(false)
    setOverflowOpen(false)
    if (!childrenByDir[path]) loadDir(path, { showLoading: true })
  }, [childrenByDir, loadDir])

  const switchTab = useCallback((id) => {
    if (id === activeTabIdRef.current) return
    const t = tabs.find((x) => x.id === id)
    setActiveTabId(id)
    if (t) activateTabAt(t.path)
  }, [tabs, activateTabAt])

  const newTab = useCallback(() => {
    if (tabs.length >= TABS_MAX) return
    const id = newTabId()
    const path = cwdRef.current   // open the new tab at the current folder
    setTabs((prev) => [...prev, { id, path }])
    setActiveTabId(id)
    setOverflowOpen(false)
    activateTabAt(path)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length, activateTabAt])

  const closeTab = useCallback((id) => {
    if (tabs.length <= 1) return
    const idx = tabs.findIndex((t) => t.id === id)
    const next = tabs.filter((t) => t.id !== id)
    setTabs(next)
    if (id === activeTabIdRef.current) {
      const na = next[Math.min(idx, next.length - 1)]
      setActiveTabId(na.id)
      activateTabAt(na.path)
    }
  }, [tabs, activateTabAt])

  // --- Initial load + visual preference restore ---
  // Each fresh launch starts in Apps. Folder tabs are intentionally session-
  // scoped; persisting them made an old deep path override the useful start.
  useEffect(() => {
    loadDir('', { showLoading: true })
    loadDir(START_PATH, { showLoading: true })
    fsDisk().then((d) => setDisk(d)).catch(() => setDisk(null))
    loadPrefs().then((p) => {
      setPrefs(p)
      prefsLoadedRef.current = true
    }).catch(() => { prefsLoadedRef.current = true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Retry the root when connectivity returns after a failed first load.
  const wasOnlineRef = useRef(online)
  useEffect(() => {
    const was = wasOnlineRef.current
    wasOnlineRef.current = online
    if (online && !was && (dirError[cwdRef.current] || !(childrenByDir[cwdRef.current] || []).length)) {
      loadDir(cwdRef.current, { showLoading: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  // ----------------------------------------------------------------------
  // Open a file. meta first (decide binary/size/writable), then body. On a text
  // file over the server's 5MB cap we PEEK the first 256KB (head=1) read-only
  // instead of a hard "too large". An external (agent-turn) reload never
  // clobbers an unsaved buffer. This is the prior Editor's loadFile with the
  // head-peek branch added — the edit-safety semantics are unchanged.
  // ----------------------------------------------------------------------
  const loadFile = useCallback(async (path, { external = false } = {}) => {
    if (!path) return
    const preserveBuffer = external && (dirtyRef.current || savingRef.current)
    if (!external) { setFileLoading(true); setFileError(null) }
    try {
      const m = await fsMeta(path)
      if (selectedRef.current !== path) return
      setMeta(m)
      if (!external) {
        emitSignal('file_opened', { ext: extOf(baseName(path)), bytes: m.size || 0, binary: !!m.is_binary })
      }
      if (m.is_binary) {
        if (!preserveBuffer) { setContent(''); setDirty(false); baselineRef.current = ''; setTruncated(false); setTruncatedTotal(null) }
        setFileError(null)
        return
      }
      let text
      let isHead = false
      let headTotal = null
      try {
        text = await fsReadText(path)
      } catch (e) {
        // Too large for a full read — peek the head (read-only) rather than
        // failing outright. Any other error re-throws to the outer catch.
        if (e && e.status === 413) {
          const head = await fsReadHead(path)
          text = head.text
          isHead = true
          headTotal = head.total
        } else {
          throw e
        }
      }
      if (selectedRef.current !== path) return
      baselineRef.current = text
      setTruncated(isHead)
      setTruncatedTotal(headTotal)
      if (!preserveBuffer) {
        setContent(text)
        setDirty(false)
        setSaveError(null)
        setDiskNotice(null)
      } else if (text !== contentRef.current) {
        setDiskNotice('This file changed on disk (the agent edited it). Your unsaved edits are kept — save to overwrite, or reopen the file to discard them.')
      }
      setFileError(null)
    } catch (e) {
      if (selectedRef.current !== path) return
      emitSignal('fs_error', { status: (e && e.status) || 0, source: 'load' })
      if (preserveBuffer) {
        setDiskNotice('Could not re-read this file from disk; your unsaved edits are kept.')
      } else {
        setContent(''); setDirty(false); setFileError(e)
      }
    } finally {
      if (selectedRef.current === path && !external) setFileLoading(false)
    }
  }, [])

  const clearOpenFile = useCallback(() => {
    closeBackHandle(fileHandleRef)
    setSelectedPath(null)
    setMeta(null)
    setContent('')
    setFileError(null)
    setDirty(false)
    setDiskNotice(null)
    setSaveError(null)
    setTruncated(false)
    setTruncatedTotal(null)
    baselineRef.current = ''
    contentRef.current = ''
  }, [closeBackHandle])

  // Guard against discarding unsaved edits. Holds the pending destination: a
  // { path } to open a DIFFERENT file, or { path: null } to CLOSE the current
  // file (the phone Back / back-arrow path — a close still loses the buffer, so
  // it needs the same discard prompt as a switch).
  const openSwitchPrompt = useCallback(async (target) => {
    const ready = await openBackSurface('editor-discard', switchHandleRef, () => setPendingSwitch(null))
    if (!ready) return
    setPendingSwitch(target)
  }, [openBackSurface])

  // Close the open file, but prompt first if the buffer is dirty so a Back tap
  // can't silently discard edits. The old app had no user-facing close-to-list
  // path, so this guard is new — without it, drilling Back out of an edited file
  // wipes it. Used by both the back-arrow and the phone shell Back surface.
  // A plain modal (not a nav surface): the file overlay already owns a shell
  // back-surface on phone, and stacking a second one under it doesn't ack
  // cleanly. The ConfirmModal handles Escape/Cancel itself; a hardware Back just
  // re-fires this (idempotent).
  const requestCloseFile = useCallback(() => {
    if (dirtyRef.current) setPendingClose(true)
    else clearOpenFile()
  }, [clearOpenFile])

  const confirmClose = useCallback(() => { setPendingClose(false); clearOpenFile() }, [clearOpenFile])
  const cancelClose = useCallback(() => setPendingClose(false), [])

  // Open a file for real. On a phone this registers a Back surface so the file
  // is a pushed screen (Back routes through the dirty-close guard); on desktop
  // it just fills the docked detail pane.
  const selectFile = useCallback(async (path) => {
    setSelectedPath(path)
    setSaveError(null)
    setDiskNotice(null)
    setNavOpen(false)
    if (!isDesktop) {
      await openBackSurface('editor-file', fileHandleRef, () => { requestCloseFile() })
    }
  }, [isDesktop, openBackSurface, requestCloseFile])

  const attemptSelectFile = useCallback((path) => {
    if (path && path !== selectedRef.current && dirtyRef.current) {
      openSwitchPrompt({ path })
      return
    }
    selectFile(path)
  }, [selectFile, openSwitchPrompt])

  const confirmSwitch = useCallback(() => {
    const target = pendingSwitch
    closeBackHandle(switchHandleRef)
    setPendingSwitch(null)
    if (target && target.path) selectFile(target.path)
  }, [pendingSwitch, selectFile, closeBackHandle])

  const cancelSwitch = useCallback(() => {
    closeBackHandle(switchHandleRef)
    setPendingSwitch(null)
  }, [closeBackHandle])

  // Load the open file + refresh the census effect when the selection changes.
  useEffect(() => {
    if (!selectedPath) return
    loadFile(selectedPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath])

  // ----------------------------------------------------------------------
  // Snapshot file+buffer at write time via refs so the
  // cleanup matches what we wrote; re-read on-disk before overwriting so an
  // agent edit isn't silently clobbered (prompt instead).
  // ----------------------------------------------------------------------
  const onEditorChange = useCallback((text) => {
    setContent(text)
    setDirty(text !== baselineRef.current)
    if (saveError) setSaveError(null)
  }, [saveError])

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
        setDiskNotice(null)
      }
      emitSignal('file_saved', { ext: extOf(baseName(savedPath)), bytes: savedText.length })
      // The saved file's row (size/mtime) is now stale — refresh its folder.
      loadDir(dirName(savedPath) || '')
    } catch (e) {
      if (selectedRef.current === savedPath) setSaveError(e.message || 'Could not save.')
      emitSignal('fs_error', { status: (e && e.status) || 0, source: 'save' })
    } finally {
      setSaving(false)
    }
  }, [loadDir])

  const canSave = !!(meta && meta.writable && !meta.is_binary && !truncated)

  const handleSave = useCallback(async () => {
    if (!selectedPath || !canSave) return
    if (savingRef.current) return
    try {
      const diskText = await fsReadText(selectedPath)
      if (selectedRef.current !== selectedPath) return
      if (diskText !== baselineRef.current) {
        emitSignal('save_conflict', { resolution: 'prompt' })
        const ready = await openBackSurface('editor-overwrite', overwriteHandleRef, () => {
          if (savingRef.current) return
          setPendingOverwrite(false)
        })
        if (!ready) return
        setPendingOverwrite(true)
        return
      }
    } catch {
      // Couldn't re-read — proceed (best-effort divergence check).
    }
    if (selectedRef.current !== selectedPath) return
    await writeNow()
  }, [selectedPath, canSave, writeNow, openBackSurface])

  const confirmOverwrite = useCallback(() => {
    emitSignal('save_conflict', { resolution: 'overwrite' })
    closeBackHandle(overwriteHandleRef)
    setPendingOverwrite(false)
    writeNow()
  }, [writeNow, closeBackHandle])

  const cancelOverwrite = useCallback(() => {
    emitSignal('save_conflict', { resolution: 'cancel' })
    closeBackHandle(overwriteHandleRef)
    setPendingOverwrite(false)
    if (selectedRef.current) loadFile(selectedRef.current, { external: true })
  }, [loadFile, closeBackHandle])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        if (selectedRef.current && canSave) { e.preventDefault(); handleSave() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave, canSave])

  // --- Agent turn done → re-read the open file + refresh the listing ---
  const handleTurnDone = useCallback(() => {
    const path = selectedRef.current
    if (path) {
      loadFile(path, { external: true })
      setFileReloadKey((k) => k + 1)
    }
    loadDir(cwdRef.current)
  }, [loadFile, loadDir])

  // ----------------------------------------------------------------------
  // Create a file/folder in the current directory (target = cwd).
  // ----------------------------------------------------------------------
  const openCreate = useCallback(async (kind) => {
    const modal = { kind, targetDir: cwdRef.current }
    const ready = await openBackSurface('editor-create', createHandleRef, () => {
      if (creatingRef.current) return
      setCreateModal(null); setCreateError(null); setCreating(false)
    })
    if (!ready) return
    setCreateError(null)
    setCreateModal(modal)
  }, [openBackSurface])

  const closeCreate = useCallback(() => {
    closeBackHandle(createHandleRef)
    setCreateModal(null); setCreateError(null); setCreating(false)
  }, [closeBackHandle])

  const submitCreate = useCallback(async (name) => {
    if (!createModal) return
    const { kind, targetDir } = createModal
    if (!isValidLeafName(name)) {
      setCreateError('Use a single name — no slashes, and not “.keep”.')
      return
    }
    setCreating(true); setCreateError(null)
    try {
      const siblings = childrenByDir[targetDir] || (await fetchDir(targetDir)).entries
      if (siblings.some((e) => e.name === name)) {
        setCreating(false)
        setCreateError(`“${name}” already exists here.`)
        return
      }
      if (kind === 'folder') await fsWrite(joinPath(joinPath(targetDir, name), '.keep'), '')
      else await fsWrite(joinPath(targetDir, name), '')
      await loadDir(targetDir)
      emitSignal('item_created', { type: kind })
      closeCreate()
      if (kind === 'file') attemptSelectFile(joinPath(targetDir, name))
    } catch (e) {
      setCreating(false)
      emitSignal('fs_error', { status: (e && e.status) || 0, source: 'create' })
      setCreateError(e.message || 'Could not create.')
    }
  }, [createModal, childrenByDir, fetchDir, loadDir, attemptSelectFile, closeCreate])

  // ----------------------------------------------------------------------
  // Delete a file. Only files (the API refuses directories); the
  // affordance lives in the Properties sheet.
  // ----------------------------------------------------------------------
  const requestDelete = useCallback(async (entry) => {
    const ready = await openBackSurface('editor-delete', deleteHandleRef, () => {
      if (deletingRef.current) return
      setDeleteTarget(null); setDeleteError(null); setDeleting(false)
    })
    if (!ready) return
    setDeleteError(null)
    setDeleteTarget(entry)
  }, [openBackSurface])

  const closeDelete = useCallback(() => {
    closeBackHandle(deleteHandleRef)
    setDeleteTarget(null); setDeleteError(null); setDeleting(false)
  }, [closeBackHandle])

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    const path = deleteTarget.path
    setDeleting(true); setDeleteError(null)
    try {
      await fsDelete(path)
      emitSignal('item_deleted', { type: 'file' })
      await loadDir(dirName(path) || '')
      if (selectedRef.current === path) clearOpenFile()
      closeDelete()
    } catch (e) {
      setDeleting(false)
      if (e.status === 404) {
        emitSignal('item_deleted', { type: 'file' })
        loadDir(dirName(path) || '')
        if (selectedRef.current === path) clearOpenFile()
        closeDelete()
        return
      }
      emitSignal('fs_error', { status: (e && e.status) || 0, source: 'delete' })
      setDeleteError(e.message || 'Could not delete this file.')
    }
  }, [deleteTarget, loadDir, closeDelete, clearOpenFile])

  // ----------------------------------------------------------------------
  // Properties sheet. Opens instantly from the listing entry; for a file we
  // also fetch fresh meta (writable/binary/mime), for a folder its immediate
  // child count if the listing didn't already carry it.
  // ----------------------------------------------------------------------
  const openProps = useCallback(async (entry) => {
    setPropsDetail(null); setPropsDirCount(null); setPropsDu(null); setPropsError(null)
    setPropsLoading(true); setPropsDuLoading(false)
    propsPathRef.current = entry.path
    const ready = await openBackSurface('editor-props', propsHandleRef, () => setPropsTarget(null))
    if (!ready) { setPropsLoading(false); return }
    setPropsTarget(entry)
    emitSignal('properties_opened', { type: entry.type === 'directory' ? 'folder' : 'file' })
    try {
      if (entry.type === 'directory') {
        if (typeof entry.child_count !== 'number') {
          const { entries } = await fetchDir(entry.path)
          if (propsPathRef.current === entry.path) setPropsDirCount(entries.filter((e) => !isKeepMarker(e.name)).length)
        }
        // Recursive data (MiXplorer-style): a bounded du of the whole subtree,
        // in the background so the sheet opens instantly. Feature-detected —
        // absent endpoint (null) just leaves the recursive line off. Guarded by
        // propsPathRef so a slow result can't apply to a different target.
        setPropsDuLoading(true)
        fsDu(entry.path)
          .then((du) => { if (propsPathRef.current === entry.path) setPropsDu(du) })
          .catch(() => {})
          .finally(() => { if (propsPathRef.current === entry.path) setPropsDuLoading(false) })
      } else {
        const m = await fsMeta(entry.path)
        if (propsPathRef.current === entry.path) setPropsDetail(m)
      }
    } catch (e) {
      if (propsPathRef.current === entry.path) setPropsError(e.message || 'Could not read details.')
    } finally {
      if (propsPathRef.current === entry.path) setPropsLoading(false)
    }
  }, [openBackSurface, fetchDir])

  const closeProps = useCallback(() => {
    closeBackHandle(propsHandleRef)
    propsPathRef.current = null
    setPropsTarget(null); setPropsDetail(null); setPropsDirCount(null); setPropsDu(null)
    setPropsDuLoading(false); setPropsError(null)
  }, [closeBackHandle])

  // ----------------------------------------------------------------------
  // Chat (on-demand). window.mobius.chat owns the lifecycle; we keep the mount
  // + the handleTurnDone re-read/refresh loop so an agent edit still lands live
  // in the open file and the listing.
  // ----------------------------------------------------------------------
  const getContext = useCallback(() => Promise.resolve({
    openFile: selectedRef.current || null,
    dir: cwdRef.current || '/',
    dirty: dirtyRef.current || false,
  }), [])

  // A short informational line for the embedded chat's empty state — what the
  // agent can do, tuned to whether a file is currently open.
  const guidance = useMemo(() => (selectedPath
    ? 'Ask the agent about the open file — explain what it does, review and fix issues, or make a change you describe.'
    : 'Ask the agent about this project — what a folder holds, what changed recently, or a change you want made across the files.'
  ), [selectedPath])

  const openChat = useCallback(async () => {
    if (chatOpenRef.current) return
    const ready = await openBackSurface('editor-chat', chatHandleRef, () => setChatOpen(false))
    if (!ready) return
    setChatMounted(true)
    emitSignal('chat_opened', {})
    setChatOpen(true)
  }, [openBackSurface])

  const closeChat = useCallback(() => {
    closeBackHandle(chatHandleRef)
    setChatOpen(false)
  }, [closeBackHandle])

  const toggleChat = useCallback(() => { if (chatOpenRef.current) closeChat(); else openChat() }, [closeChat, openChat])
  const askAgent = useCallback(() => { openChat() }, [openChat])

  // --- Drawer open/close + swipe-to-close (phone) ---
  const closeNav = useCallback(() => {
    closeBackHandle(navHandleRef)
    setNavOpen(false)
  }, [closeBackHandle])

  const openNav = useCallback(async () => {
    const ready = await openBackSurface('editor-drawer', navHandleRef, () => setNavOpen(false))
    if (!ready) return
    setNavOpen(true)
  }, [openBackSurface])

  const toggleNav = useCallback(() => { if (navOpen) closeNav(); else openNav() }, [navOpen, closeNav, openNav])

  const drawerRef = useRef(null)
  const navToggleRef = useRef(null)
  const navWasOpenRef = useRef(false)
  useEffect(() => {
    if (isDesktop) { navWasOpenRef.current = navOpen; return undefined }
    const wasOpen = navWasOpenRef.current
    navWasOpenRef.current = navOpen
    const frame = requestAnimationFrame(() => {
      if (navOpen) drawerRef.current?.querySelector(FOCUSABLE_SELECTOR)?.focus()
      else if (wasOpen) navToggleRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [navOpen, isDesktop])
  const dragStart = useRef(null)
  function onDrawerTouchStart(e) {
    if (isDesktop) return
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
      el.classList.add('ex-drawer--dragging')
      const w = el.offsetWidth || 300
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
      el.classList.remove('ex-drawer--dragging')
      if (shouldClose) {
        el.style.transform = 'translateX(-100%)'
        const cleanup = () => { if (el) el.style.transform = ''; el.removeEventListener('transitionend', cleanup) }
        el.addEventListener('transitionend', cleanup, { once: true })
      } else {
        el.style.transform = ''
      }
    }
    dragStart.current = null
    if (shouldClose) closeNav()
  }
  function onDrawerTouchCancel() {
    const el = drawerRef.current
    if (el) { el.classList.remove('ex-drawer--dragging'); el.style.transform = '' }
    dragStart.current = null
  }

  // --- Overflow menu ---
  const openOverflow = useCallback(async () => {
    const ready = await openBackSurface('editor-overflow', overflowHandleRef, () => setOverflowOpen(false))
    if (!ready) return
    setOverflowOpen(true)
  }, [openBackSurface])
  const closeOverflow = useCallback(() => { closeBackHandle(overflowHandleRef); setOverflowOpen(false) }, [closeBackHandle])

  // --- Pref setters (persist on change) ---
  const patchPrefs = useCallback((patch) => {
    setPrefs((p) => {
      const next = typeof patch === 'function' ? patch(p) : { ...p, ...patch }
      savePrefs(next)
      return next
    })
  }, [])
  const setView = useCallback((view) => { patchPrefs({ view }); emitSignal('view_changed', { view }) }, [patchPrefs])
  const setSort = useCallback((key) => {
    patchPrefs((p) => (p.sortKey === key
      ? { ...p, sortDir: p.sortDir === 'asc' ? 'desc' : 'asc' }
      : { ...p, sortKey: key, sortDir: 'asc' }))
    emitSignal('sort_changed', { key })
  }, [patchPrefs])
  const toggleFoldersFirst = useCallback(() => patchPrefs((p) => ({ ...p, foldersFirst: !p.foldersFirst })), [patchPrefs])
  const toggleShowHidden = useCallback(() => patchPrefs((p) => ({ ...p, showHidden: !p.showHidden })), [patchPrefs])

  const pinCurrent = useCallback(() => patchPrefs((p) => (
    p.bookmarks.includes(cwdRef.current) ? p : { ...p, bookmarks: [...p.bookmarks, cwdRef.current] }
  )), [patchPrefs])
  const unpin = useCallback((path) => patchPrefs((p) => ({ ...p, bookmarks: p.bookmarks.filter((x) => x !== path) })), [patchPrefs])

  // --- Cleanup all shell handles on unmount ---
  useEffect(() => () => {
    for (const ref of [navHandleRef, fileHandleRef, overflowHandleRef, propsHandleRef, chatHandleRef, createHandleRef, deleteHandleRef, switchHandleRef, overwriteHandleRef]) {
      try { ref.current?.close?.() } catch {}
      ref.current = null
    }
  }, [])

  // ----------------------------------------------------------------------
  // Derived render data.
  // ----------------------------------------------------------------------
  const nonMarkerEntries = useMemo(
    () => filterVisibleEntries(childrenByDir[cwd], { showHidden: true }),
    [childrenByDir, cwd],
  )
  const listedEntries = useMemo(
    () => (prefs.showHidden ? nonMarkerEntries : filterVisibleEntries(nonMarkerEntries)),
    [nonMarkerEntries, prefs.showHidden],
  )
  const sorted = useMemo(
    () => sortEntries(listedEntries, { key: prefs.sortKey, dir: prefs.sortDir, foldersFirst: prefs.foldersFirst }),
    [listedEntries, prefs.sortKey, prefs.sortDir, prefs.foldersFirst],
  )
  const q = filter.trim().toLowerCase()
  const visible = q ? sorted.filter((e) => e.name.toLowerCase().includes(q)) : sorted
  const now = Date.now()

  const census = useMemo(() => {
    let folders = 0, files = 0, bytes = 0
    for (const e of listedEntries) {
      if (e.type === 'directory') folders += 1
      else { files += 1; bytes += e.size || 0 }
    }
    return {
      folders, files, bytes,
      protectedCount: (redactedByDir[cwd] || []).length,
      hiddenCount: prefs.showHidden ? 0 : nonMarkerEntries.length - listedEntries.length,
      capped: !!cappedByDir[cwd],
      matched: q ? visible.length : null,
    }
  }, [listedEntries, nonMarkerEntries.length, prefs.showHidden, redactedByDir, cappedByDir, cwd, q, visible.length])

  // Shortcuts filtered to those whose top-level segment exists on this instance
  // (platform/compiled/cron-logs are instance-specific). The root listing tells
  // us which top-level dirs are present.
  const rootTop = useMemo(() => new Set((childrenByDir[''] || []).filter((e) => e.type === 'directory').map((e) => e.name)), [childrenByDir])
  const shortcuts = useMemo(() => SHORTCUTS.filter((s) => s.path === '' || rootTop.has(s.path.split('/')[0])), [rootTop])
  const canPinCurrent = cwd !== '' && !prefs.bookmarks.includes(cwd) && !SHORTCUTS.some((s) => s.path === cwd)

  const listLoading = !!dirLoading[cwd] && !childrenByDir[cwd]
  const listError = dirError[cwd]
  const phoneFileOpen = !isDesktop && !!selectedPath
  const showTopBar = !phoneFileOpen

  function renderList() {
    if (listLoading) {
      return <div className="ex-list-note"><span className="ex-spinner" aria-hidden="true" /> Loading…</div>
    }
    if (listError) {
      return (
        <div className="ex-list-note is-error">
          {listError}
          <button type="button" className="ex-retry" onClick={() => loadDir(cwd, { showLoading: true })}>Retry</button>
        </div>
      )
    }
    if (!online && !childrenByDir[cwd]) {
      return (
        <div className="ex-empty">
          <div className="ex-empty-mark" aria-hidden="true"><Icon name="server" size={26} /></div>
          <div className="ex-empty-title">Needs a connection</div>
          <p className="ex-empty-text">The Editor reads the live filesystem, so it needs the network. Reconnect to browse.</p>
        </div>
      )
    }
    if (visible.length === 0) {
      return (
        <div className="ex-empty">
          <div className="ex-empty-mark" aria-hidden="true"><Icon name={q ? 'search' : 'folder'} size={24} /></div>
          <div className="ex-empty-title">{q ? 'No matches' : 'Empty folder'}</div>
          <p className="ex-empty-text">{q ? `Nothing here matches “${filter}”.` : `/data/${cwd || ''} has nothing to show.`}</p>
        </div>
      )
    }
    if (prefs.view === VIEW_GRID) {
      return (
        <div className="ex-grid">
          {visible.map((entry) => (
            <GridCell
              key={entry.path}
              entry={entry}
              selected={entry.path === selectedPath}
              onOpen={(e) => (e.type === 'directory' ? drillInto(e) : attemptSelectFile(e.path))}
              onProps={openProps}
              reloadKey={fileReloadKey}
            />
          ))}
        </div>
      )
    }
    return (
      <div className="ex-list" role="list">
        {visible.map((entry) => (
          <EntryRow
            key={entry.path}
            entry={entry}
            selected={entry.path === selectedPath}
            onOpen={(e) => (e.type === 'directory' ? drillInto(e) : attemptSelectFile(e.path))}
            onProps={openProps}
            now={now}
          />
        ))}
      </div>
    )
  }

  function renderBrowser() {
    return (
      <section className="ex-browser">
        <div className="ex-list-scroll ex-scroll">{renderList()}</div>
        <StatusBar census={census} disk={disk} filterActive={!!q} />
      </section>
    )
  }

  function renderDetailPlaceholder() {
    return (
      <div className="ex-empty ex-detail-empty">
        <div className="ex-empty-mark" aria-hidden="true"><Icon name="file" size={24} /></div>
        <div className="ex-empty-title">No file open</div>
        <p className="ex-empty-text">Tap a file in the list to view or edit it here.</p>
      </div>
    )
  }

  const viewer = selectedPath && (
    <FileViewer
      path={selectedPath}
      meta={meta}
      content={content}
      onChange={onEditorChange}
      fileLoading={fileLoading}
      fileError={fileError}
      dirty={dirty}
      saving={saving}
      canSave={canSave}
      saveError={saveError}
      diskNotice={diskNotice}
      truncated={truncated}
      truncatedTotal={truncatedTotal}
      showBack={!isDesktop}
      onBack={requestCloseFile}
      onSave={handleSave}
      onAskAgent={askAgent}
      fileReloadKey={fileReloadKey}
    />
  )

  return (
    <div className="ex-root">
      <style>{CSS}</style>
      <h1 className="ex-sr-only">Editor</h1>

      {showTopBar && (
        <header className="ex-appbar">
          <button
            type="button"
            ref={navToggleRef}
            className="ex-icon-btn ex-drawer-toggle"
            onClick={toggleNav}
            aria-label={navOpen ? 'Close places' : 'Open places'}
            aria-expanded={navOpen}
            aria-controls="editor-places"
            title="Toggle places"
          >
            <img
              src={`/api/apps/${appId}/icon?size=64`}
              alt=""
              width={34}
              height={34}
              className="ex-brand-icon"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const fallback = e.currentTarget.nextElementSibling
                if (fallback) fallback.style.display = 'inline-flex'
              }}
            />
            <span className="ex-brand-fallback" style={{ display: 'none' }} aria-hidden="true">
              <Icon name="code" size={19} />
            </span>
          </button>
          {cwd !== '' && (
            <button
              type="button"
              className="ex-icon-btn ex-up-btn"
              onClick={ascend}
              aria-label="Up one folder"
              title="Up one folder"
            >
              <Icon name="arrow-up" size={20} />
            </button>
          )}
          <Breadcrumb path={cwd} onNavigate={navigateTo} />
          <div className="ex-appbar-actions">
            <button
              type="button"
              className={`ex-icon-btn${filterOpen ? ' is-active' : ''}`}
              onClick={() => { if (filterOpen) setFilter(''); setFilterOpen((v) => !v) }}
              aria-label="Filter this folder"
              aria-pressed={filterOpen}
              title="Filter"
            >
              <Icon name="search" size={20} />
            </button>
            <button
              type="button"
              className="ex-icon-btn"
              onClick={openOverflow}
              aria-label="View, sort and actions"
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              title="View & sort"
            >
              <Icon name={prefs.view === VIEW_GRID ? 'grid' : 'sort'} size={20} />
            </button>
            <button
              type="button"
              className={`ex-icon-btn ex-chat-toggle${chatOpen ? ' is-active' : ''}`}
              onClick={toggleChat}
              aria-label={chatOpen ? 'Close chat' : 'Ask the agent'}
              aria-pressed={chatOpen}
              title={chatOpen ? 'Close chat' : 'Ask the agent'}
            >
              <ChatBubbleIcon size={20} />
            </button>
          </div>
        </header>
      )}

      {showTopBar && (
        <TabStrip
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitch={switchTab}
          onClose={closeTab}
          onNew={newTab}
        />
      )}

      {showTopBar && filterOpen && (
        <div className="ex-filter-row">
          <Icon name="search" size={16} className="ex-filter-icon" />
          <input
            className="ex-filter-input"
            type="text"
            aria-label="Filter this folder"
            name="folder_filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter this folder…"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          {filter && (
            <button type="button" className="ex-filter-clear" onClick={() => setFilter('')} aria-label="Clear filter"><Icon name="x" size={16} /></button>
          )}
        </div>
      )}

      <div className="ex-body">
        <button
          type="button"
          className={`ex-scrim${navOpen ? ' is-open' : ''}`}
          onClick={closeNav}
          aria-label="Close places"
          aria-hidden={!navOpen}
          tabIndex={navOpen ? 0 : -1}
        />
        <aside
          id="editor-places"
          ref={drawerRef}
          className={`ex-drawer${navOpen ? ' is-open' : ''}`}
          aria-label="Places"
          aria-hidden={!navOpen && !isDesktop}
          inert={!navOpen && !isDesktop ? true : undefined}
          onTouchStart={onDrawerTouchStart}
          onTouchMove={onDrawerTouchMove}
          onTouchEnd={onDrawerTouchEnd}
          onTouchCancel={onDrawerTouchCancel}
        >
          <BookmarksDrawer
            shortcuts={shortcuts}
            bookmarks={prefs.bookmarks}
            recents={prefs.recents.filter((p) => p !== cwd)}
            currentPath={cwd}
            onNavigate={(p) => { navigateTo(p); if (!isDesktop) closeNav() }}
            onUnpin={unpin}
            onPinCurrent={pinCurrent}
            canPinCurrent={canPinCurrent}
            disk={disk}
          />
        </aside>

        <main className="ex-main">
          {isDesktop ? (
            <>
              {renderBrowser()}
              <section className="ex-detail">{selectedPath ? viewer : renderDetailPlaceholder()}</section>
            </>
          ) : (
            phoneFileOpen ? viewer : renderBrowser()
          )}
        </main>
      </div>

      {/* Mounted once opened and only HIDDEN when closed (display:none), never
          unmounted — remounting would destroy the chat iframe and kill a
          streaming turn + the onTurnDone live-reload loop. */}
      {chatMounted && (
        <div className="ex-chat-sheet" style={chatOpen ? undefined : { display: 'none' }}>
          <div className="ex-chat-sheet-head">
            <span className="ex-chat-sheet-title">Agent</span>
            <button type="button" className="ex-icon-btn" onClick={closeChat} aria-label="Close chat"><Icon name="x" size={20} /></button>
          </div>
          <div className="ex-chat-sheet-body">
            <ChatPanel onTurnDone={handleTurnDone} guidance={guidance} getContext={getContext} />
          </div>
        </div>
      )}

      {overflowOpen && (
        <OverflowMenu
          view={prefs.view}
          sortKey={prefs.sortKey}
          sortDir={prefs.sortDir}
          foldersFirst={prefs.foldersFirst}
          showHidden={prefs.showHidden}
          online={online}
          onView={setView}
          onSort={setSort}
          onToggleFoldersFirst={toggleFoldersFirst}
          onToggleShowHidden={toggleShowHidden}
          onNewFile={() => openCreate('file')}
          onNewFolder={() => openCreate('folder')}
          onRefresh={() => loadDir(cwd, { showLoading: true })}
          onClose={closeOverflow}
        />
      )}

      {propsTarget && (
        <PropertiesSheet
          entry={propsTarget}
          detail={propsDetail}
          dirCount={propsDirCount}
          du={propsDu}
          duLoading={propsDuLoading}
          loading={propsLoading}
          error={propsError}
          canDelete={propsTarget.type !== 'directory' && propsDetail && propsDetail.writable}
          onOpen={(e) => { closeProps(); if (e.type === 'directory') drillInto(e); else attemptSelectFile(e.path) }}
          onDelete={(e) => { closeProps(); requestDelete(e) }}
          onAskAgent={() => { closeProps(); askAgent() }}
          onClose={closeProps}
        />
      )}

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
          body={<>You have unsaved edits in <code className="ed-modal-code">{baseName(selectedPath)}</code>. Opening another file will discard them.</>}
          confirmLabel="Discard & open"
          onConfirm={confirmSwitch}
          onCancel={cancelSwitch}
        />
      )}
      {pendingClose && (
        <ConfirmModal
          title="Discard unsaved changes?"
          body={<>You have unsaved edits in <code className="ed-modal-code">{baseName(selectedPath)}</code>. Closing this file will discard them.</>}
          confirmLabel="Discard & close"
          onConfirm={confirmClose}
          onCancel={cancelClose}
        />
      )}
      {pendingOverwrite && (
        <ConfirmModal
          title="File changed on disk"
          body={<><code className="ed-modal-code">{baseName(selectedPath)}</code> changed on disk since you opened it (the agent likely edited it). Saving will overwrite those changes with your version.</>}
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
