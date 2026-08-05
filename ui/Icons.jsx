import {
  Archive,
  ArrowLeft,
  ArrowRotateCw,
  ArrowUp,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUpDown,
  Clock,
  Code,
  Desktop,
  Document,
  DotsVerticalMoreMenu,
  File,
  FileCode,
  FileDocument,
  FileImage,
  Filter,
  Folder,
  Grid,
  Home,
  InfoCircle,
  Lock,
  Menu,
  Music,
  Number,
  Plus,
  Search,
  Star,
  StarFilled,
  TableFilled,
  Trash,
  Video,
  X,
} from '@openai/apps-sdk-ui/components/Icon'

// ----------------------------------------------------------------------
// One consolidated icon seam for the Editor. Generic controls use the OpenAI
// Apps SDK icon family; the small fallback registry below is reserved for the
// few app-specific concepts that do not have a direct SDK equivalent.
//
// The three legacy icon components (NewFileIcon, NewFolderIcon, ChatBubbleIcon)
// stay in their own files — they are still imported by name elsewhere and the
// installer already declares them.
// ----------------------------------------------------------------------

const SDK_ICONS = {
  menu: Menu,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'arrow-up': ArrowUp,
  'arrow-left': ArrowLeft,
  home: Home,
  apps: Grid,
  folder: Folder,
  file: File,
  image: FileImage,
  brain: Brain,
  book: BookOpen,
  logs: FileDocument,
  clock: Clock,
  code: Code,
  server: Desktop,
  info: InfoCircle,
  search: Search,
  x: X,
  star: Star,
  'star-filled': StarFilled,
  refresh: ArrowRotateCw,
  sort: ChevronUpDown,
  grid: Grid,
  list: Menu,
  kebab: DotsVerticalMoreMenu,
  check: Check,
  plus: Plus,
  filter: Filter,
  trash: Trash,
  lock: Lock,
  fileText: FileDocument,
  document: Document,
  braces: FileCode,
  hash: Number,
  music: Music,
  film: Video,
  archive: Archive,
  table: TableFilled,
}

const PATHS = {
  disk: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v9h10V4" /><path d="M13 7.5h1.5" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
}

export function Icon({ name, size = 20, className, strokeWidth = 1.8, ...rest }) {
  const SdkIcon = SDK_ICONS[name]
  if (SdkIcon) {
    return (
      <SdkIcon
        width={size}
        height={size}
        className={className}
        aria-hidden="true"
        {...rest}
      />
    )
  }
  const children = PATHS[name]
  if (!children) return null
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" {...rest}
    >
      {children}
    </svg>
  )
}
