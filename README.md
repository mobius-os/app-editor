# Editor

A file explorer, inspector, and light editor for [Möbius](https://github.com/mobius-os) — a MiXplorer-style window into everything under `/data`. Browse the server by drilling into folders, sort and filter to see what's there and what just changed, inspect any file or folder's full metadata, preview images, edit text and markdown in place, watch git status for what the agent changed, and summon an embedded agent to make edits for you.

The redesign (v0.5) reorients the app around **observability** — a large, dense browsing surface with the metadata forward — instead of the old cramped tree + editor + always-on chat split. Browsing is the home surface; editing and the agent are on-demand.

## Features

- **Drill-in navigation** — tap a folder to go into it; a tappable breadcrumb (`/data › apps › notes`) jumps to any ancestor, and hardware/gesture Back ascends one level. Listings are lazy (one directory level at a time, paginated, cached) so Back and breadcrumb jumps are instant.
- **Detail list** — dense rows with the file-kind glyph, name, and a metadata line (size · relative-modified, or item-count for folders). Repo folders are badged `git`; files the agent touched carry a git change chip inline. The timestamp carries recency directly rather than duplicating it with an ambiguous status dot.
- **Sort, filter, view** — sort by name / size / modified / kind (asc↔desc, folders-first), filter the current folder by name, and switch between a dense **list** and an image-friendly **grid** (viewport-gated, byte-capped, concurrency-limited lazy thumbnails). Preferences persist via `window.mobius.storage`.
- **Properties inspector** — the deep view for any file or folder: full path (copyable), kind + MIME, exact size (or immediate item count for a folder), modified time (absolute + relative), owner-editable vs platform-managed, text vs binary, and git repo status. Delete lives here (files only).
- **Status bar** — an honest census of the current directory (`N folders · M files · Σ file bytes here · K protected`) plus a **disk gauge** of the `/data` filesystem (used / total), so you can see how full the server is at a glance.
- **Source Control** — on entering a repo, a panel names the branch and shows staged changes, working-tree changes, and untracked files in plain language. A newly observed dirty state opens once so the changed paths are visible; clean repos stay compact and non-repo folders show no Git noise. Opening a row inspects the current file contents.
- **Bookmarks drawer** — curated jump points to the places worth inspecting (`apps`, `shared`, `shared/memory`, `shared/skills`, `logs`, `cron-logs`, `compiled`, `platform` — only those present on this instance), plus your own pinned folders and a recents list.
- **Code editor:** writable text files open ready to edit. Markdown includes a live preview with emphasis, headings, task checkboxes, and KaTeX math. Source files have line numbers, syntax color, and a quiet background with no visible scrollbar. Read-only platform files show a badge, while files over 5 MB open as a read-only preview of the first 256 KB.
- **Image preview** — PNG, JPEG, GIF, WebP, SVG, AVIF, loaded via authenticated fetch.
- **Embedded agent** — an on-demand `window.mobius.chat` sheet (bottom sheet on phone, docked panel on desktop), pre-seeded with the current path/file/git context. After each agent turn the open file, listing, and git status refresh live.
- **Responsive** — one component set: phone stacks and drills (file / Properties / chat push full-screen or as sheets); desktop (≥760 px) becomes a **master-detail** split — a wide listing beside a docked viewer — with the drawer pinned as a rail.
- **In-app modals** — create (`+ File` / `+ Folder`), delete confirm, discard-unsaved-changes, and overwrite-conflict dialogs are rendered in-app (the iframe sandbox blocks `window.confirm` / `window.prompt`).

## Observability backend (optional, feature-detected)

Three small additive `/api/fs` fields make the observability richer; the app detects them and degrades gracefully on an older platform:

- **`GET /api/fs/disk`** — statvfs of the `/data` filesystem, powers the disk gauge.
- **`GET /api/fs/tree?counts=1`** — an immediate `child_count` per directory entry, powers the "N items" folder metadata.
- **`GET /api/fs/read?head=1`** — first 256 KB of an over-cap text file, powers the large-file peek.

Without them: no disk gauge, no folder item counts, and a >5 MB file shows the "too large — ask the agent" notice instead of a peek. Everything else works unchanged.

## Owner-JWT trade-off

The Editor declares `permissions.filesystem_access: true`. The shell passes its short-lived app-scoped token into the frame, and the backend checks the Editor's live permission row on every `/api/fs/*` request. Removing the grant takes effect immediately; the owner's login token is never exposed to the app.

## Install

### Via the App Store (recommended)

Open the **App Store** mini-app in Möbius, search for "Editor", tap **Install** (or **Update** if you already have it).

### Via paste-a-URL

In the App Store, choose **Install from URL** and paste:

```
https://raw.githubusercontent.com/mobius-os/app-editor/main/mobius.json
```

## Project layout

The app is a multi-file module tree (declared in `mobius.json`'s `source_files`;
the installer fetches each path and Rolldown bundles from `index.jsx`):

| File | Role |
|------|------|
| `index.jsx` | App orchestrator: navigation, listing/sort/filter/view state, the open-file + save state machine (reused verbatim), overlays, and composition. |
| `constants.js` | Scalar constants (FS root, extension sets, view/sort keys, prefs defaults, shortcuts, listing caps). |
| `paths.js` | Pure, dependency-free path / name / format / sort helpers (relative time, breadcrumb segments, `sortEntries`, recents, the save-state + git-entry parsers). Unit-tested. |
| `domain.js` | The CodeMirror + markdown live-preview + KaTeX editor engine, and the embedded-agent system prompt. |
| `storage.js` | `/api/fs/*` helpers (incl. `fsDisk` / `fsReadHead` / `counts`), the online signal, prefs persistence, and the analytics `emitSignal`. |
| `theme.js` | The single scoped stylesheet (`export const CSS`). |
| `ui/Icons.jsx` | One consolidated stroke-icon set (`<Icon name=…/>`). |
| `ui/Breadcrumb.jsx` `ui/EntryRow.jsx` `ui/Thumb.jsx` `ui/StatusBar.jsx` `ui/OverflowMenu.jsx` `ui/BookmarksDrawer.jsx` `ui/PropertiesSheet.jsx` `ui/FileViewer.jsx` | The redesigned surfaces. |
| `ui/CodeEditor.jsx` `ui/ImagePreview.jsx` `ui/GitPanel.jsx` `ui/ChatPanel.jsx` `ui/NameModal.jsx` `ui/ConfirmModal.jsx` `ui/useModalFocus.js` `ui/ChatBubbleIcon.jsx` | Carried over verbatim (editor, previews, git, chat embed, modals). |

## Data

- **`ui-prefs.json`** (via `window.mobius.storage`) — view mode, sort key + direction, folders-first, pinned bookmarks, recents, and the last directory browsed; restored on reopen.
- **`chat_id.json`** (via `window.mobius.chat`'s `persist`) — the embedded agent chat id, so the transcript is the same one every visit.
- **`signals.jsonl`** (via `window.mobius.signal`) — fire-and-forget analytics for Reflection (`app_ready`, `file_opened`, `file_saved`, `save_conflict`, `fs_error`, `item_created`, `item_deleted`, `dir_opened`, `view_changed`, `sort_changed`, `properties_opened`, `chat_opened`, `error`). Flat primitives only; no paths or file names.

## Development

Unit tests (pure helpers + the save-state, git-entry-path, and sort/format regressions) run on a fresh clone with zero install — Node's built-in test runner:

```bash
npm test
```

Compile smoke (verify the JSX bundles cleanly; needs `rolldown` on your `PATH`):

```bash
rolldown index.jsx \
  --format esm --platform browser \
  --external react,react/jsx-runtime,react-dom \
  --external @codemirror/state,@codemirror/view \
  --external @codemirror/commands,@codemirror/language \
  --external @codemirror/lang-markdown,@lezer/highlight \
  --external katex \
  --file /tmp/editor-smoke.js
```

Expected: a clean bundle (~145 KB), exit 0.

## License

MIT — see [LICENSE](LICENSE).
