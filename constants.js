// Shared scalar constants for the Editor module tree.
export const FS = '/api/fs'

export const MARKDOWN_EXTS = new Set(['md', 'markdown', 'mdown', 'mkd'])
export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const GIT_LIST_PREVIEW = 8

export const PREFS_PATH = 'ui-prefs.json'

// The width at which the app flips from phone (stack + drill; the drawer
// overlays; file/properties/chat push full-screen) to desktop MASTER-DETAIL
// (a wide listing column beside a docked viewer/properties pane; the drawer
// pins as a rail). One source of truth so the JS layout choices and the CSS
// media query never disagree.
export const DESKTOP_BREAKPOINT = 760

// A file whose mtime is within this window gets a subtle "changed" dot so the
// owner can spot at a glance what the agent (or they) just touched.
export const RECENT_MS = 24 * 60 * 60 * 1000

// Directory-listing safety. The FS is huge, so a directory is fetched one level
// at a time; a single level can still be thousands of entries (node_modules),
// so we page through cursors but cap the total so a pathological dir can't pull
// the whole thing into memory. Beyond the cap the status bar says "showing
// first N" so a partial client-side sort is never presented as complete.
export const LISTING_PAGE_CAP = 50      // max cursor pages fetched per dir
export const LISTING_ENTRY_CAP = 10000  // ~ LISTING_PAGE_CAP * server page size

// Grid thumbnails pull FULL image bytes (there is no thumbnail endpoint), so we
// only auto-fetch a thumb for an image under this size; bigger images render
// the file-kind glyph until opened. Keeps an image-heavy folder from pulling
// tens of MB just to draw a grid.
export const THUMB_MAX_BYTES = 2 * 1024 * 1024

// View modes (persisted globally). List is the inspector default; Grid is for
// image-heavy folders (lazy, viewport-gated thumbnails).
export const VIEW_LIST = 'list'
export const VIEW_GRID = 'grid'

// Sort keys + directions (persisted globally). Default mirrors the server's
// own ordering (directories first, then case-insensitive name) so the first
// paint matches the listing order with no client reshuffle.
export const SORT_NAME = 'name'
export const SORT_SIZE = 'size'
export const SORT_MODIFIED = 'modified'
export const SORT_KIND = 'kind'
export const SORT_KEYS = [SORT_NAME, SORT_SIZE, SORT_MODIFIED, SORT_KIND]
export const SORT_LABELS = {
  [SORT_NAME]: 'Name',
  [SORT_SIZE]: 'Size',
  [SORT_MODIFIED]: 'Modified',
  [SORT_KIND]: 'Kind',
}

// The default prefs, applied when nothing is stored yet or a field is missing.
// One object so a stored prefs blob only has to override the keys it knows.
export const DEFAULT_PREFS = {
  view: VIEW_LIST,
  sortKey: SORT_NAME,
  sortDir: 'asc',       // 'asc' | 'desc'
  foldersFirst: true,
  bookmarks: [],        // owner-pinned extra dir paths (FS-root-relative strings)
  recents: [],          // recently-visited dirs, most-recent first (capped)
  lastPath: '',         // last directory the owner browsed (a dir, not a file)
}

export const RECENTS_MAX = 12

// Curated jump points — the Möbius-meaningful replacement for MiXplorer's
// internal/SD/USB storage list. Only those whose top-level segment actually
// exists on this instance are shown (some, like platform/compiled/cron-logs,
// are instance-specific). `path` is FS-root-relative; '' is /data itself.
export const SHORTCUTS = [
  { label: 'Home', path: '', hint: '/data', icon: 'home' },
  { label: 'Apps', path: 'apps', hint: 'installed mini-apps', icon: 'apps' },
  { label: 'Shared', path: 'shared', hint: 'cross-app files', icon: 'folder' },
  { label: 'Memory', path: 'shared/memory', hint: 'agent knowledge graph', icon: 'brain' },
  { label: 'Skills', path: 'shared/skills', hint: 'agent skills', icon: 'book' },
  { label: 'Logs', path: 'logs', hint: 'chat + app logs', icon: 'logs' },
  { label: 'Cron logs', path: 'cron-logs', hint: 'scheduled task output', icon: 'clock' },
  { label: 'Compiled', path: 'compiled', hint: 'built app bundles', icon: 'code' },
  { label: 'Platform', path: 'platform', hint: 'served platform clone', icon: 'server' },
]
