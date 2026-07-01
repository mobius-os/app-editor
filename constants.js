// Shared scalar constants for the Editor module tree.
export const FS = '/api/fs'

export const MARKDOWN_EXTS = new Set(['md', 'markdown', 'mdown', 'mkd'])
export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const GIT_LIST_PREVIEW = 8

export const PREFS_PATH = 'ui-prefs.json'

export const CHAT_HEIGHT_VERSION = 1
// Chat-pane floor: the embedded composer input-pill band must always be fully
// visible (≈48px pill + 8px/8px foot padding). Keep in sync with the embed's
// `.chat-embed .chat__foot` padding in the shell.
export const CHAT_MIN_PX = 64
// The draggable divider's own height — kept reachable at the top extreme so the
// editor can collapse to zero without the grab handle going with it. Mirrors
// `.ed-chat-resizer` flex-basis in CSS.
export const CHAT_DIVIDER_PX = 10
export const CHAT_DEFAULT_PX = 280
export const CHAT_SPAWN_RATIO = 0.5
