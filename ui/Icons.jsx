// ----------------------------------------------------------------------
// One consolidated icon set for the redesigned Editor. Lucide-style stroke
// glyphs (24×24 viewBox, currentColor, 2px round strokes) so they inherit the
// owner's theme --text/--accent/--muted and stay crisp at any size. A single
// <Icon name=… size=…/> keeps the many small icons in one declared source file
// (one mobius.json source_files entry) instead of a file per glyph.
//
// The three legacy icon components (NewFileIcon, NewFolderIcon, ChatBubbleIcon)
// stay in their own files — they are still imported by name elsewhere and the
// installer already declares them.
// ----------------------------------------------------------------------

// The path/child content for each icon name. Kept as a function so it's only a
// map from name → JSX children; the wrapper below supplies the <svg> chrome.
const PATHS = {
  menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'arrow-up': <><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>,
  'arrow-left': <><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>,
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  apps: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.6.8l.9 1.2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m21 16-5-5L5 21" /></>,
  brain: <><circle cx="7" cy="7" r="2" /><circle cx="17" cy="9" r="2" /><circle cx="10" cy="16" r="2" /><path d="M8.7 8.2 15.4 8.6M8.7 14.4 15.6 10.4M9.5 8.9l0.2 5.1" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></>,
  logs: <><path d="M5 4h14v16H5Z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  code: <><path d="m9 8-4 4 4 4" /><path d="m15 8 4 4-4 4" /></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5h.01" /></>,
  disk: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v9h10V4" /><path d="M13 7.5h1.5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.3" /><path d="M21 4v5h-5" /></>,
  sort: <><path d="M8 4v16" /><path d="m4 8 4-4 4 4" /><path d="M16 20V4" /><path d="m20 16-4 4-4-4" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
  kebab: <><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  filter: <path d="M3 5h18l-7 8v5l-4 2v-7Z" />,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  git: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="9" r="2.5" /><path d="M6 8.5v7M8.4 7.4l7.4 1.2M18 11.4c0 3-3 3.6-6 3.6" /></>,
  // File-type glyphs (see paths.js KIND_ICON).
  fileText: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /><path d="M9 13h6M9 17h4" /></>,
  document: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /><path d="M9 15h6" /></>,
  braces: <><path d="M8 4a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2" /><path d="M16 4a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2" /></>,
  hash: <><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16M15 4v16" /></>,
}

// A filled star for a pinned bookmark (currentColor fill) — distinct from the
// hollow outline used for the "pin this" affordance.
const FILLED = new Set(['star-filled'])

export function Icon({ name, size = 20, className, strokeWidth = 2, ...rest }) {
  const key = name === 'star-filled' ? 'star' : name
  const children = PATHS[key]
  if (!children) return null
  const filled = FILLED.has(name)
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" {...rest}
    >
      {children}
    </svg>
  )
}
