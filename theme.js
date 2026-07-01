// ----------------------------------------------------------------------
// Styles. One scoped stylesheet rendered once at the root, per the mini-app
// styling standard (app-component-shapes.md): semantic classNames with an
// `ed-` prefix, theme tokens only (no hard-coded brand colors), 44px touch
// targets, fenced mobius-ui blocks kept in sync with sibling apps.
// ----------------------------------------------------------------------
export const CSS = `
/* mobius-ui:Focus v1 -- shared keyboard focus ring (WCAG 2.4.7); never bare outline:none */
:where(button,a,input,textarea,select,summary,[role="button"],[tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* /mobius-ui:Focus */

/* mobius-ui:Root v1 — keep in sync; library candidate. Diverge below the marker only. */
.ed-root {
  position: relative;
  display: flex; flex-direction: column;
  height: 100%; width: 100%; max-width: 100%;
  overflow: hidden;
  background: var(--bg); color: var(--text); font-family: var(--font);
  -webkit-font-smoothing: antialiased;
}
/* /mobius-ui:Root */

/* mobius-ui:Header v1 — keep in sync; library candidate. Diverge below the marker only. */
.ed-header {
  flex: 0 0 auto;
  display: flex; align-items: center; gap: 10px;
  min-height: 48px;
  /* Top-pinned bar: pad against the notch on an installed PWA (iOS safe area). */
  padding: max(8px, env(safe-area-inset-top)) 12px 8px;
  background: var(--surface); border-bottom: 1px solid var(--border);
}
/* /mobius-ui:Header */
.ed-header-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.ed-open-path {
  min-width: 0; font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ed-open-path.is-muted { color: var(--muted); font-weight: 650; }
.ed-dirty-dot {
  flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}
.ed-header-right { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.ed-offline-pill {
  display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  font-size: 11px; font-weight: 700;
}

/* mobius-ui:Button v1 — keep in sync; library candidate. Diverge below the marker only. */
.ed-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 10px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  font-family: var(--font); font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: background 0.14s ease, border-color 0.14s ease, transform 0.1s ease;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.ed-btn:active { transform: scale(0.97); }
.ed-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ed-btn:disabled { opacity: 0.5; cursor: default; transform: none; }
.ed-btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
@media (hover: hover) { .ed-btn-primary:hover { filter: brightness(1.06); } }
.ed-btn-icon { width: 44px; padding: 0; border-radius: 8px; font-size: 18px; }
/* /mobius-ui:Button */
/* The Save button when there's nothing to save: present but visually quiet,
   so the toolbar layout doesn't jump when an edit makes it active. */
.ed-btn-primary.is-quiet { background: var(--surface2, var(--surface)); border-color: var(--border); color: var(--muted); }
/* Destructive confirm action (delete file). App-specific, so it lives below the
   shared Button fence. */
.ed-btn-danger {
  background: var(--danger); border-color: var(--danger); color: var(--accent-fg);
}
@media (hover: hover) { .ed-btn-danger:hover { filter: brightness(1.06); } }
/* The logo-toggle is BARE like the shell's .shell__brand: no border, no
   background, no focus ring on a non-keyboard (mouse/programmatic) focus. A
   bounding box lingering after the drawer closes reads as a stuck-highlight
   bug, so the resting :focus leaves nothing behind. Keyboard focus still gets
   the shared :focus-visible ring (WCAG 2.4.7) — only the non-keyboard case is
   suppressed. tap-highlight and text-selection stay suppressed. */
.ed-icon-btn {
  flex: 0 0 auto; width: 44px; height: 44px; padding: 0; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--text);
  font-size: 18px; cursor: pointer;
  transition: color 0.12s, background 0.12s, transform 0.08s;
  -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none; user-select: none;
}
.ed-icon-btn:focus:not(:focus-visible) { outline: none; }
/* Brand drawer-toggle feedback — match the shell drawer toggle's polish.
   Scoped to :not(.ed-chat-toggle) so the chat toggle keeps its own accent
   hover/is-active treatment below. Hover is a neutral grey wash; the press
   scales for an instant touch acknowledgement (tap-highlight is suppressed);
   focus-visible gets the shell's accent ring. */
@media (hover: hover) {
  .ed-icon-btn:not(.ed-chat-toggle):hover { color: var(--text); background: var(--surface); }
}
.ed-icon-btn:not(.ed-chat-toggle):active { color: var(--text); background: var(--surface); transform: scale(0.92); }
.ed-icon-btn:not(.ed-chat-toggle):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* Open state — the brand button is the drawer toggle, which exposes its open
   state via aria-expanded (NOT data-state), so the accent must key off
   [aria-expanded="true"] to fire at all. While the file tree is open the
   button stays accent-tinted with a soft accent wash, matching the shell
   drawer toggle. Because background is in the transition above, the wash
   fades in lockstep with the color on open/close (no snap). */
.ed-icon-btn:not(.ed-chat-toggle)[aria-expanded="true"] {
  color: var(--accent);
  background: var(--accent-dim, color-mix(in srgb, var(--accent) 12%, transparent));
}
/* The real app icon as the brand mark inside the drawer toggle. */
.ed-brand-icon {
  width: 34px; height: 34px; border-radius: 8px; object-fit: cover;
  flex-shrink: 0; display: block;
}
/* Accent-dot fallback shown when the install has no custom icon (route 404s). */
.ed-brand-fallback {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--accent, var(--text));
  align-items: center; justify-content: center; flex-shrink: 0;
}

/* Body: drawer + main, side by side on wide, drawer overlays on narrow. */
.ed-body { flex: 1; min-height: 0; position: relative; display: flex; }

/* mobius-ui:Sheet v1 — keep in sync; library candidate. Diverge below the marker only. */
/* The drawer scrim reuses the sheet-scrim shape (absolute, inside the app). */
.ed-scrim {
  position: absolute; inset: 0; z-index: 30;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
}
.ed-scrim.is-open { opacity: 1; pointer-events: auto; }
/* /mobius-ui:Sheet */

.ed-drawer {
  position: absolute; top: 0; left: 0; bottom: 0; z-index: 31;
  width: 80%; max-width: 320px;
  display: flex; flex-direction: column;
  background: var(--surface); border-right: 1px solid var(--border);
  transform: translateX(-102%); transition: transform 0.22s ease;
}
.ed-drawer.is-open { transform: translateX(0); }
/* During a swipe-to-close drag, disable the transform-transition so the panel
   tracks the finger 1:1; removing the class lets the transition animate the
   snap-back or close. */
.ed-drawer--dragging { transition: none; }
.ed-drawer-head {
  flex: 0 0 auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 12px 14px; border-bottom: 1px solid var(--border);
  -webkit-user-select: none; user-select: none;
}
.ed-drawer-sub { font-size: 12px; color: var(--muted); font-family: var(--mono); }
.ed-drawer-actions { margin-left: auto; display: flex; gap: 6px; align-self: center; }
.ed-new-btn {
  display: inline-flex; align-items: center; min-height: 30px; padding: 4px 10px;
  border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface2, var(--surface)); color: var(--text);
  font-family: var(--font); font-size: 12px; font-weight: 650; cursor: pointer; white-space: nowrap;
  transition: background 0.14s ease, border-color 0.14s ease;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
@media (hover: hover) { .ed-new-btn:hover { background: color-mix(in srgb, var(--accent) 12%, var(--surface)); border-color: var(--accent); } }
.ed-new-btn:active { background: color-mix(in srgb, var(--accent) 18%, var(--surface)); border-color: var(--accent); }
.ed-new-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ed-new-btn:disabled { opacity: 0.5; cursor: default; }

/* Focus breadcrumb — shows the focused folder + a way back to the full tree. */
.ed-focus-bar {
  flex: 0 0 auto; display: flex; align-items: center; gap: 8px;
  padding: 7px 12px; border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
  -webkit-user-select: none; user-select: none;
}
.ed-focus-clear {
  flex: 0 0 auto; display: inline-flex; align-items: center; min-height: 30px;
  padding: 4px 10px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface); color: var(--accent);
  font-family: var(--font); font-size: 12px; font-weight: 650; cursor: pointer; white-space: nowrap;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
@media (hover: hover) { .ed-focus-clear:hover { background: color-mix(in srgb, var(--accent) 12%, var(--surface)); } }
.ed-focus-clear:active { background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
.ed-focus-clear:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ed-focus-path {
  min-width: 0; font-family: var(--mono); font-size: 12px; color: var(--muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* mobius-ui:Scrollskin v1 — keep in sync; library candidate. Add the ed-scroll class to a scroller. */
.ed-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.ed-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
.ed-scroll::-webkit-scrollbar-thumb:hover { background: var(--muted); background-clip: padding-box; }
.ed-scroll::-webkit-scrollbar-track { background: transparent; }
/* /mobius-ui:Scrollskin */

/* Side gutter (8px) so the rows float as rounded pills inset from the
   panel edge — mirrors the shell drawer body's horizontal padding. The
   rows themselves carry the border-radius; this gutter is what lets the
   rounded corners read against the panel rather than bleeding to the edge. */
.ed-tree { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 6px 8px 24px; overscroll-behavior: contain; }

/* Directory rows pair the expand button with a focus button. The focus button
   keeps a faint resting opacity on pointer devices (discoverable, not hover-only)
   and brightens to full on row hover / focus-within; on touch (no hover) it sits
   at full opacity. */
.ed-row-wrap { display: flex; align-items: stretch; }
.ed-row-wrap .ed-row { flex: 1; min-width: 0; }
.ed-row-focus {
  flex: 0 0 auto; width: 40px; min-height: 44px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 0; border-radius: 8px; color: var(--muted);
  font-size: 15px; line-height: 1; cursor: pointer;
  opacity: 0.35; transition: opacity 0.12s ease, color 0.12s ease, background 0.12s ease;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.ed-row-wrap:hover .ed-row-focus,
.ed-row-wrap:focus-within .ed-row-focus,
.ed-row-focus:focus-visible,
.ed-row-focus.is-focused { opacity: 1; }
@media (hover: hover) { .ed-row-focus:hover { color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); } }
.ed-row-focus:active { color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
.ed-row-focus:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ed-row-focus.is-focused { color: var(--accent); }
@media (hover: none) { .ed-row-focus { opacity: 0.55; } }

/* Per-file delete affordance — always faintly visible (not hover-only) so the
   control is discoverable on desktop too; it brightens on row hover/focus. On
   touch (no hover) it sits at full opacity. Tinted danger so it reads as
   destructive. Mirrors the webstudio kebab visibility pattern. */
.ed-row-delete {
  flex: 0 0 auto; width: 40px; min-height: 44px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 0; border-radius: 8px; color: var(--muted);
  font-size: 13px; line-height: 1; cursor: pointer;
  /* Resting opacity 0.6 keeps the muted glyph readable (>=3:1 against --surface)
     while still reading as secondary to the row text; full on hover/focus-within. */
  opacity: 0.6; transition: opacity 0.12s ease, color 0.12s ease, background 0.12s ease;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.ed-row-wrap:hover .ed-row-delete,
.ed-row-wrap:focus-within .ed-row-delete,
.ed-row-delete:focus-visible { opacity: 1; }
@media (hover: hover) { .ed-row-delete:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); } }
.ed-row-delete:active { color: var(--danger); background: color-mix(in srgb, var(--danger) 18%, transparent); }
.ed-row-delete:focus-visible { outline: 2px solid var(--danger); outline-offset: -2px; }
@media (hover: none) { .ed-row-delete { opacity: 1; } }

.ed-row {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px;
  padding: 6px 12px; text-align: left;
  background: transparent; border: 0; border-radius: 10px; color: var(--text);
  font-family: var(--font); font-size: 14px; cursor: pointer;
  transition: color 0.12s ease, background 0.12s ease;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
/* Neutral hover — matches the shell drawer's --surface row hover rather
   than an accent tint, so hovering a file reads as "focusable row", not
   "almost selected". The accent is reserved for the selected/active state. */
@media (hover: hover) { .ed-row:hover { background: var(--surface); } }
.ed-row:active { color: var(--accent); background: var(--accent-dim, color-mix(in srgb, var(--accent) 12%, transparent)); }
.ed-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
/* Selected file — rounded accent-dim fill + accent text, the same
   treatment the shell drawer gives its active row (no square full-bleed). */
.ed-row-file.is-selected { color: var(--accent); background: var(--accent-dim, color-mix(in srgb, var(--accent) 12%, transparent)); }
.ed-row-file.is-selected .ed-row-name { font-weight: 650; color: var(--accent); }
.ed-row-caret { flex: 0 0 auto; width: 20px; font-size: 17px; line-height: 1; color: var(--text); text-align: center; }
/* File-type glyph — a bare mono token, no box. The shell's icons are bare
   lucide SVGs with no bounding box; matching that, the glyph keeps its accent
   color and mono shape but drops the badge-weight (700) that made short tokens
   like {} / <> / py read as a filled chip. Normal weight reads as a plain
   glyph beside the filename. */
.ed-row-glyph {
  flex: 0 0 auto; width: 18px; text-align: center; font-size: 11px; font-weight: 400;
  color: var(--accent); font-family: var(--mono);
  background: none; border: 0; padding: 0; border-radius: 0;
}
.ed-row-dir .ed-row-name { font-weight: 650; }
.ed-row-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ed-row-size { flex: 0 0 auto; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.ed-git-badge {
  flex: 0 0 auto; padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 700;
  letter-spacing: 0.02em; text-transform: uppercase;
  background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent);
}
.ed-row-note {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; font-size: 12.5px; color: var(--muted);
}
.ed-row-note.is-error { color: var(--danger); flex-wrap: wrap; }
.ed-row-note.is-protected { font-style: italic; opacity: 0.75; }
.ed-retry {
  margin-left: 6px; padding: 4px 10px; border-radius: 8px; min-height: 44px;
  border: 1px solid var(--border); background: var(--surface2, var(--surface)); color: var(--text);
  font-size: 12px; font-weight: 600; cursor: pointer;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}

/* Main column: git bar + editor + chat, stacked. */
.ed-main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--bg); }

/* Git panel — compact, collapsible. */
.ed-git { flex: 0 0 auto; border-bottom: 1px solid var(--border); background: var(--surface); }
.ed-git-bar {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px;
  padding: 8px 12px; text-align: left;
  background: transparent; border: 0; color: var(--text); cursor: pointer;
  font-family: var(--font); font-size: 12.5px;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.ed-git-bar.is-quiet { color: var(--muted); cursor: default; min-height: 34px; font-size: 12px; }
.ed-git-caret { flex: 0 0 auto; width: 16px; font-size: 14px; line-height: 1; color: var(--muted); }
.ed-git-branch { font-weight: 700; font-family: var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.ed-git-track { flex: 0 0 auto; color: var(--muted); font-variant-numeric: tabular-nums; }
.ed-git-counts { margin-left: auto; display: flex; align-items: center; gap: 6px; flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.ed-git-count { font-weight: 700; font-size: 11.5px; }
.ed-git-count.is-staged { color: var(--green); }
.ed-git-count.is-modified { color: var(--accent); }
.ed-git-count.is-untracked { color: var(--muted); }
.ed-git-count.is-clean { color: var(--muted); font-weight: 600; }
.ed-git-body { padding: 4px 12px 12px; max-height: 34vh; overflow-y: auto; overscroll-behavior: contain; }
.ed-git-group { margin-top: 8px; }
.ed-git-group-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 4px; }
.ed-git-file {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px;
  padding: 5px 6px; text-align: left; border-radius: 8px;
  background: transparent; border: 0; color: var(--text); cursor: pointer;
  font-family: var(--mono); font-size: 12px;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
@media (hover: hover) { .ed-git-file:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); } }
.ed-git-file:active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.ed-git-dot { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; }
.ed-git-dot.is-staged { background: var(--green); }
.ed-git-dot.is-modified { background: var(--accent); }
.ed-git-dot.is-untracked { background: var(--muted); }
.ed-git-file-path { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ed-git-file-status { flex: 0 0 auto; color: var(--muted); }
.ed-git-more { margin-top: 6px; font-size: 11px; color: var(--muted); font-style: italic; }

.ed-save-error {
  flex: 0 0 auto; margin: 8px 10px 0; padding: 8px 12px; border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  color: var(--text); font-size: 12.5px; line-height: 1.45;
}

/* Editor pane — flex region above the chat. */
.ed-editor-wrap { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.ed-pane { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.ed-pane-scroll { overflow: auto; padding: 14px 16px; overscroll-behavior: contain; }
.ed-cm-host { flex: 1; min-height: 0; overflow: hidden; }
/* On a touch device the editor content jumps to >=16px so focusing a non-markdown
   file (the common .py/.json/.jsx case) doesn't trigger iOS Safari zoom-on-focus.
   The cmTheme/cmThemePlain JS themes keep their tighter desktop sizes; this only
   raises the floor where a fingertip-driven focus would otherwise zoom the page. */
@media (pointer: coarse) {
  .ed-cm-host .cm-content { font-size: 16px; }
}
.ed-readonly-note {
  flex: 0 0 auto; padding: 7px 14px; font-size: 12px; color: var(--muted);
  background: var(--surface2, var(--surface)); border-bottom: 1px solid var(--border);
}
.ed-pane-note {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 16px; color: var(--muted); font-size: 14px; line-height: 1.5;
}
.ed-pane-note.is-error { color: var(--danger); }
.ed-note { padding: 16px; color: var(--muted); font-size: 13px; }
.ed-img { max-width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--border); display: block; }

/* mobius-ui:Empty v1 — keep in sync; library candidate. Diverge below the marker only. */
.ed-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;
  max-width: 440px; margin: auto; padding: 40px 24px; color: var(--muted);
}
.ed-empty-mark {
  width: 60px; height: 60px; margin-bottom: 8px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center; font-size: 26px; line-height: 1;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
}
.ed-empty-title { font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
.ed-empty-text { margin: 0; font-size: 13.5px; line-height: 1.55; }
/* /mobius-ui:Empty */
.ed-empty-tree { padding: 28px 20px; }

/* mobius-ui:ChatEmbed v1 — keep in sync; library candidate. Diverge below the marker only. */
/* Height is driven inline from the resizable split (chatHeight px); the 64px
   floor matches CHAT_MIN_PX (the embed's composer pill band) so dragging the
   divider down collapses the chat transcript to just its pinned composer band
   ("full vibe writing") while the pill stays fully visible. */
.ed-chat {
  flex: 0 0 auto;
  display: flex; flex-direction: column;
  height: 280px; min-height: 64px;
  border-top: 1px solid var(--border); background: var(--surface);
}
.ed-chat-embed {
  flex: 1 1 auto; min-height: 0;
  overflow: hidden; background: var(--bg);
}
.ed-chat-embed iframe { display: block; width: 100%; height: 100%; border: 0; }
/* /mobius-ui:ChatEmbed */
/* The slot exists only so the chat iframe stays mounted while hidden (a
   remount kills a streaming turn). flex: 0 0 auto pins it to the pane's own
   height so editor-side overflow can never squash the chat (and its
   bottom-pinned composer) out of view. */
.ed-chat-slot { flex: 0 0 auto; display: flex; flex-direction: column; }
.ed-chat-error {
  flex: 0 0 auto; margin: 8px 12px; padding: 8px 12px; border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  color: var(--text); font-size: 12.5px;
}

/* The draggable divider between the editor pane and the chat panel: a SLIM
   10px visual bar (the house style — same recipe as latex/webstudio); the
   ::before overlay extends the pointer hit area to ~26px without adding
   visual weight. z-index keeps the overlay above the adjacent panes so the
   extra hit area actually receives the pointer. touch-action: none so a
   touch-drag resizes instead of scrolling the page. */
.ed-chat-resizer {
  flex: 0 0 10px;
  height: 10px;
  box-sizing: border-box;
  position: relative;
  z-index: 5;
  display: flex; align-items: center; justify-content: center;
  cursor: ns-resize; touch-action: none; user-select: none;
  background: var(--surface);
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
}
.ed-chat-resizer::before {
  content: '';
  position: absolute;
  left: 0; right: 0;
  top: -8px; bottom: -8px;
}
.ed-chat-resizer:hover,
.ed-chat-resizer:focus-visible {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}
/* Keyboard focus keeps the shared :focus-visible ring (separator is arrow-key
   resizable); only the non-keyboard focus is suppressed. */
.ed-chat-resizer:focus-visible { outline-offset: -2px; }
.ed-chat-resizer:focus:not(:focus-visible) { outline: none; }
.ed-chat-resizer-bar {
  width: 44px; height: 4px; border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 65%, transparent);
  pointer-events: none;
}

/* mobius-ui:Spinner v1 — keep in sync; library candidate. */
@keyframes ed-spin { to { transform: rotate(360deg); } }
.ed-spinner {
  display: inline-block; flex: 0 0 auto;
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--accent) 18%, transparent); border-top-color: var(--accent);
  animation: ed-spin 0.8s linear infinite;
}
@media (prefers-reduced-motion: reduce) { .ed-spinner { animation: none; } }
/* /mobius-ui:Spinner */

/* Name-entry modal for + File / + Folder. Absolutely positioned over the whole
   app (the iframe blocks window.prompt). Reuses the .ed-btn shapes for actions. */
.ed-modal-scrim {
  position: absolute; inset: 0; z-index: 60;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(0, 0, 0, 0.5);
}
.ed-modal {
  width: 100%; max-width: 360px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 18px 18px 16px; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
}
.ed-modal-title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.ed-modal-where {
  margin-top: 3px; font-family: var(--mono); font-size: 11.5px; color: var(--muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ed-modal-body { margin-top: 10px; font-size: 13px; line-height: 1.5; color: var(--text); }
.ed-modal-code {
  font-family: var(--mono); font-size: 12px; color: var(--accent);
  word-break: break-all;
}
.ed-modal-input {
  width: 100%; margin-top: 12px; min-height: 44px; padding: 10px 12px;
  border-radius: 10px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text);
  /* 16px stops iOS Safari zoom-on-focus — don't go lower on a focusable field. */
  font-family: var(--mono); font-size: 16px;
}
.ed-modal-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.ed-modal-input[aria-invalid="true"] { border-color: var(--danger); }
.ed-modal-error {
  margin-top: 10px; padding: 7px 10px; border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  color: var(--text); font-size: 12px; line-height: 1.4;
}
.ed-modal-actions { margin-top: 14px; display: flex; justify-content: flex-end; gap: 8px; }

/* Chat toggle — keep visible on desktop too (it's in the header, always needed). */
.ed-chat-toggle { flex: 0 0 auto; }
.ed-chat-toggle.is-active { color: var(--accent); }
@media (hover: hover) { .ed-chat-toggle:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); } }

/* On a wide viewport the drawer is a static column, not an overlay. */
@media (min-width: 760px) {
  .ed-scrim { display: none; }
  .ed-drawer {
    position: relative; transform: none; flex: 0 0 280px; max-width: 280px;
  }
  /* Hide drawer hamburger on desktop — drawer is always visible as a column.
     But keep the chat toggle visible on all screen sizes. */
  .ed-icon-btn:not(.ed-chat-toggle) { display: none; }
}

/* mobius-ui:ReducedMotion v1 -- honor the OS reduce-motion setting */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
/* /mobius-ui:ReducedMotion */
`
