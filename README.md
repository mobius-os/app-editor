# Editor

A whole-filesystem viewer and editor for [Möbius](https://github.com/mobius-os). Browse every file under `/data`, edit text and markdown files in place (markdown gets a CodeMirror live-preview with math, task checkboxes, and heading/emphasis rendering), preview images, watch git status for what the agent changed, and ask an embedded agent to make edits — oversight and direct edit in one surface, with the agent as the primary interface.

## Features

- **FS tree** — lazy, level-at-a-time listing of the whole `/data` tree; directories expand on tap and cache their children. Folder focus (⊙) narrows the tree to one subtree so you are not scrolling a 500-entry root. Swipe-left to close the drawer on mobile.
- **CodeMirror live-preview** — markdown files render emphasis, headings, task checkboxes (`[ ]`/`[x]`), and `$…$` / `$$…$$` KaTeX math inline; moving the cursor onto a line reveals its raw source. Non-markdown files get a plain monospace editor with undo/redo and Tab indentation.
- **Image preview** — PNG, JPEG, GIF, WebP, SVG, AVIF loaded via authenticated fetch (the `/api/fs/read` endpoint requires a bearer token; `<img src>` can't carry one, so the app fetches the bytes and creates an object URL).
- **Git panel** — collapsible bar below the header showing branch, ahead/behind, and staged/modified/untracked counts. Tap a path in the list to open that file directly.
- **Embedded agent** — a full `window.mobius.chat` session mounted at the bottom of the main column. The agent knows the paths relative to `/data` and is briefed to make edits directly. Drag the divider between the editor and the chat to resize the split; the split position persists per app in `localStorage`.
- **Create and delete** — `+ File` and `+ Folder` buttons in the drawer header; a confirmation modal for deletes (the iframe sandbox excludes `allow-modals`, so `window.confirm` silently no-ops — the app renders its own modal).
- **Swipe drawer** — left-swipe closes the file tree on narrow viewports; on ≥760 px the drawer is a static column and the toggle is hidden.
- **Persistent prefs** — last opened path and expanded directory set are saved to `ui-prefs.json` via `window.mobius.storage` and restored on the next open.

## Owner-JWT trade-off

The Editor drives the owner-only `/api/fs/*` API, which the app-scoped `token` prop cannot reach (it 401s). The app reads the owner JWT from `localStorage('token')` and sends it as the bearer for every `/api/fs/*` call. This is the accepted single-owner trade-off: the gated surface is the whole filesystem regardless, so a scoped permission would be theatre. The JWT is read fresh on every call so a re-login in another tab is picked up without reloading the app.

## Install

### Via the App Store (recommended)

Open the **App Store** mini-app in Möbius, search for "Editor", tap **Install**.

### Via paste-a-URL

In the App Store, choose **Install from URL** and paste:

```
https://raw.githubusercontent.com/mobius-os/app-editor/main/mobius.json
```

## Dev / smoke compile

Run this from the repo root (no container needed) to verify the JSX compiles cleanly:

```bash
ESBUILD=/home/hmzmrzx/projects/node_modules/.bin/esbuild
$ESBUILD index.jsx \
  --bundle --format=esm --jsx=automatic --platform=browser \
  --external:react --external:react/jsx-runtime --external:react-dom \
  --external:@codemirror/state --external:@codemirror/view \
  --external:@codemirror/commands --external:@codemirror/language \
  --external:@codemirror/lang-markdown --external:@lezer/highlight \
  --external:katex \
  --outfile=/tmp/editor-smoke.js
```

Expected: ~84.5 KB output, exit 0.

## License

MIT — see [LICENSE](LICENSE).
