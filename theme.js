// ----------------------------------------------------------------------
// Styles. One scoped stylesheet rendered once at the root, per the mini-app
// styling standard: semantic classNames, theme tokens only (no hard-coded brand
// colors), 44px touch targets, honor reduced-motion + prefers-color-scheme +
// safe-area insets.
//
// Naming: NEW structural UI uses the `ex-` prefix (explorer). The components
// carried over verbatim — NameModal / ConfirmModal (ed-modal/ed-btn), CodeEditor
// (ed-cm-host), ImagePreview (ed-img/ed-note), GitPanel (ed-git/ed-chip),
// ChatPanel (ed-chat) — keep their `ed-` classes untouched, so shared primitives
// are grouped selectors (`.ed-btn, .ex-btn { … }`) rather than duplicated.
// ----------------------------------------------------------------------
export const CSS = `
/* mobius-ui:Focus v1 -- shared keyboard focus ring (WCAG 2.4.7) */
:where(button,a,input,textarea,select,summary,[role="button"],[tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* /mobius-ui:Focus */

.ex-root {
  position: relative;
  display: flex; flex-direction: column;
  height: 100%; width: 100%; max-width: 100%;
  overflow: hidden;
  background: var(--bg); color: var(--text); font-family: var(--font);
  -webkit-font-smoothing: antialiased;
  /* Git-signal colors: structure stays monochrome/accent; hue is reserved for
     git meaning only. --green/--danger come from the theme; amber/blue are
     git-specific and the theme can't express them. */
  --ed-amber: #d99a2b;
  --ed-blue: #4a90d9;
  --ed-code-comment: #7f8c98;
  --ed-code-string: #9dd6a5;
  --ed-code-keyword: #c4a7ff;
  --ed-code-literal: #7dcfff;
  --ed-code-number: #f0b77d;
  --ed-code-tag: #ff9fa8;
}
@media (prefers-color-scheme: light) {
  .ex-root {
    --ed-amber: #8a5a08; --ed-blue: #245ba0;
    --ed-code-comment: #64727d; --ed-code-string: #27733a;
    --ed-code-keyword: #6941b8; --ed-code-literal: #116a91;
    --ed-code-number: #9a4e12; --ed-code-tag: #a52c3f;
  }
}

/* mobius-ui:Scrollskin v2 — hidden scrollbar, content stays scrollable. */
.ex-scroll, .ex-scroll-x, .ex-git-body, .ed-git-body, .ex-view-scroll {
  scrollbar-width: none; -ms-overflow-style: none;
}
.ex-scroll::-webkit-scrollbar, .ex-scroll-x::-webkit-scrollbar,
.ed-git-body::-webkit-scrollbar, .ex-view-scroll::-webkit-scrollbar,
.ed-cm-host .cm-scroller::-webkit-scrollbar {
  display: none; width: 0; height: 0;
}
/* /mobius-ui:Scrollskin */

/* mobius-ui:Button v1 — shared by the reused modals (ed-) and new UI (ex-). */
.ed-btn, .ex-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 10px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  font-family: var(--font); font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: background 0.14s ease, border-color 0.14s ease, transform 0.1s ease;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.ed-btn:active, .ex-btn:active { transform: scale(0.97); }
.ed-btn:disabled, .ex-btn:disabled { opacity: 0.5; cursor: default; transform: none; }
.ed-btn-primary, .ex-btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
@media (hover: hover) { .ed-btn-primary:hover, .ex-btn-primary:hover { filter: brightness(1.06); } }
.ex-btn-primary.is-quiet { background: var(--surface2, var(--surface)); border-color: var(--border); color: var(--muted); }
.ed-btn-danger, .ex-btn-danger { background: var(--danger); border-color: var(--danger); color: var(--accent-fg); }
@media (hover: hover) { .ed-btn-danger:hover, .ex-btn-danger:hover { filter: brightness(1.06); } }
/* /mobius-ui:Button */

/* mobius-ui:Spinner v1 */
@keyframes ex-spin { to { transform: rotate(360deg); } }
.ex-spinner {
  display: inline-block; flex: 0 0 auto; width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--accent) 18%, transparent); border-top-color: var(--accent);
  animation: ex-spin 0.8s linear infinite;
}
@media (prefers-reduced-motion: reduce) { .ex-spinner { animation: none; } }
/* /mobius-ui:Spinner */

.ex-icon-btn {
  flex: 0 0 auto; width: 44px; height: 44px; padding: 0; border-radius: 9px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--text); cursor: pointer;
  transition: color 0.12s, background 0.12s, transform 0.08s;
  -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none;
}
@media (hover: hover) { .ex-icon-btn:hover { background: var(--surface); } }
.ex-icon-btn:active { background: var(--surface); transform: scale(0.92); }
.ex-icon-btn:focus:not(:focus-visible) { outline: none; }
.ex-icon-btn.is-active { color: var(--accent); background: var(--accent-dim, color-mix(in srgb, var(--accent) 12%, transparent)); }
.ex-chat-toggle.is-active { color: var(--accent); }
.ex-dirty-dot {
  flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}

/* ---- App bar (drawer toggle · breadcrumb · filter · view · chat) ---- */
.ex-appbar {
  flex: 0 0 auto; display: flex; align-items: center; gap: 6px;
  min-height: 52px;
  padding: max(8px, env(safe-area-inset-top), var(--mobius-safe-top, 0px)) 8px 8px;
  background: var(--surface); border-bottom: 1px solid var(--border);
}
.ex-appbar-actions { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; }

/* ---- Breadcrumb / location bar ---- */
.ex-crumbs {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px;
  overflow-x: auto; white-space: nowrap; padding: 2px 2px;
  -webkit-overflow-scrolling: touch;
}
.ex-crumb-group { display: inline-flex; align-items: center; flex: 0 0 auto; }
.ex-crumb {
  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 3px;
  min-height: 44px; padding: 6px 8px; border-radius: 8px; border: 0; background: transparent;
  color: var(--muted); font-family: var(--font); font-size: 14px; font-weight: 600;
  cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent;
  transition: background 0.12s, color 0.12s;
}
@media (hover: hover) { .ex-crumb:hover { background: var(--surface2, var(--bg)); color: var(--text); } }
.ex-crumb.is-current { color: var(--text); font-weight: 750; cursor: default; padding-left: 6px; }
.ex-crumb-home { display: inline-flex; align-items: center; gap: 4px; }
.ex-crumb-home-text { font-size: 13px; }
.ex-crumb-sep { flex: 0 0 auto; color: color-mix(in srgb, var(--muted) 60%, transparent); }

/* ---- Folder tabs ---- */
.ex-tabs {
  flex: 0 0 auto; display: flex; align-items: stretch; gap: 4px;
  padding: 5px 8px; background: var(--surface); border-bottom: 1px solid var(--border);
  overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch;
}
.ex-tab {
  flex: 0 0 auto; display: inline-flex; align-items: stretch; border-radius: 9px;
  border: 1px solid var(--border); background: var(--surface2, var(--bg)); overflow: hidden;
  max-width: 190px;
}
.ex-tab.is-active { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); background: var(--accent-dim, color-mix(in srgb, var(--accent) 12%, transparent)); }
.ex-tab-btn {
  flex: 1; min-width: 0; display: inline-flex; align-items: center; gap: 6px;
  min-height: 44px; padding: 4px 4px 4px 10px; border: 0; background: transparent;
  color: var(--muted); font-family: var(--font); font-size: 13px; font-weight: 600;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.ex-tab.is-active .ex-tab-btn { color: var(--accent); }
.ex-tab-icon { flex: 0 0 auto; opacity: 0.9; }
.ex-tab-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-tab-close {
  flex: 0 0 auto; width: 44px; display: inline-flex; align-items: center; justify-content: center;
  border: 0; background: transparent; color: var(--muted); cursor: pointer; opacity: 0.7;
}
@media (hover: hover) { .ex-tab-close:hover { opacity: 1; color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); } }
.ex-tab-new {
  flex: 0 0 auto; width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px dashed var(--border); border-radius: 9px; background: transparent; color: var(--muted); cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
@media (hover: hover) { .ex-tab-new:hover { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); } }
.ex-tab-new:active { transform: scale(0.94); }

/* ---- Filter row ---- */
.ex-filter-row {
  flex: 0 0 auto; display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: var(--surface2, var(--surface)); border-bottom: 1px solid var(--border);
}
.ex-filter-icon { color: var(--muted); flex: 0 0 auto; }
.ex-filter-input {
  flex: 1; min-width: 0; min-height: 32px; border: 0; background: transparent;
  color: var(--text); font-family: var(--font); font-size: 16px; outline: none;
}
.ex-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.ex-filter-clear {
  flex: 0 0 auto; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer;
}
@media (hover: hover) { .ex-filter-clear:hover { background: var(--surface); color: var(--text); } }

/* ---- Body: drawer + main ---- */
.ex-body { flex: 1; min-height: 0; position: relative; display: flex; }
.ex-scrim {
  position: absolute; inset: 0; z-index: 30; background: rgba(0,0,0,0.5);
  opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
}
.ex-scrim.is-open { opacity: 1; pointer-events: auto; }
.ex-drawer {
  position: absolute; top: 0; left: 0; bottom: 0; z-index: 31;
  width: 82%; max-width: 300px; display: flex; flex-direction: column;
  background: var(--surface); border-right: 1px solid var(--border);
  transform: translateX(-102%); transition: transform 0.22s ease;
}
.ex-drawer.is-open { transform: translateX(0); }
.ex-drawer--dragging { transition: none; }

.ex-main { flex: 1; min-width: 0; min-height: 0; display: flex; background: var(--bg); }
.ex-browser { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.ex-detail { flex: 1; min-width: 0; min-height: 0; display: none; }
.ex-list-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }

/* A tap anywhere on an interactive row selects/opens the WHOLE row — suppress
   text selection so a tap on the label can't be swallowed by a selection drag
   (the whole row, icon + name + metadata, is one target, not just the text). */
.ex-row, .ex-shortcut, .ex-cell, .ex-tab-btn, .ex-crumb, .ex-menu-item, .ex-shortcut-label, .ex-shortcut-hint, .ex-row-name, .ex-row-meta {
  -webkit-user-select: none; user-select: none;
}

/* ---- Detail list rows ---- */
.ex-list { padding: 4px 6px max(20px, env(safe-area-inset-bottom), var(--mobius-safe-bottom, 0px)); }
.ex-row-wrap { display: flex; align-items: stretch; border-radius: 10px; }
.ex-row-wrap.is-selected { background: var(--accent-dim, color-mix(in srgb, var(--accent) 12%, transparent)); }
.ex-row {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px;
  min-height: 52px; padding: 7px 8px; text-align: left;
  background: transparent; border: 0; border-radius: 10px; color: var(--text);
  font-family: var(--font); cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background 0.12s ease;
}
@media (hover: hover) { .ex-row:hover { background: var(--surface); } }
.ex-row:active { background: var(--accent-dim, color-mix(in srgb, var(--accent) 12%, transparent)); }
.ex-row-wrap.is-selected .ex-row-name { color: var(--accent); font-weight: 700; }
.ex-row-icon { flex: 0 0 auto; width: 26px; display: flex; align-items: center; justify-content: center; }
/* File/folder type icons. Shape carries the type; a restrained tone carries
   the category ("hue for meaning"): folders + code in accent, media in blue,
   pdf/archive in amber, everything else calm muted. */
.ex-glyph { flex: 0 0 auto; }
.ex-glyph--accent { color: var(--accent); }
.ex-glyph--blue { color: var(--ed-blue); }
.ex-glyph--amber { color: var(--ed-amber); }
.ex-glyph--muted { color: var(--muted); }
.ex-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ex-row-name-line { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ex-row-name { min-width: 0; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ex-row-dir .ex-row-name { font-weight: 650; }
.ex-recent-dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; background: var(--ed-blue); }
.ex-row-meta { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ex-row-chevron { flex: 0 0 auto; color: color-mix(in srgb, var(--muted) 70%, transparent); }
.ex-badge-git {
  flex: 0 0 auto; padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 700;
  background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent);
}
.ex-badge-git--cell { position: absolute; top: 6px; left: 6px; }
.ex-row-info {
  flex: 0 0 auto; width: 40px; min-height: 44px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 0; border-radius: 8px; color: var(--muted);
  cursor: pointer; opacity: 0.55; transition: opacity 0.12s, color 0.12s, background 0.12s;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.ex-row-wrap:hover .ex-row-info, .ex-row-wrap:focus-within .ex-row-info, .ex-row-info:focus-visible { opacity: 1; }
@media (hover: hover) { .ex-row-info:hover { color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); } }
@media (hover: none) { .ex-row-info { opacity: 0.8; } }

/* change chip — shared tones with GitPanel's ed-chip */
.ed-chip, .ex-chip {
  flex: 0 0 auto; padding: 2px 8px; border-radius: 999px;
  font-size: 10.5px; font-weight: 700; white-space: nowrap;
  background: color-mix(in srgb, var(--chip) 16%, transparent); color: var(--chip);
}
.ed-chip.tone-staged, .ex-chip.tone-staged { --chip: var(--green); }
.ed-chip.tone-modified, .ex-chip.tone-modified { --chip: var(--ed-amber); }
.ed-chip.tone-untracked, .ex-chip.tone-untracked { --chip: var(--ed-blue); }
.ed-chip.tone-deleted, .ex-chip.tone-deleted { --chip: var(--danger); }
.ed-chip.tone-renamed, .ex-chip.tone-renamed { --chip: var(--ed-blue); }

/* ---- Grid view ---- */
.ex-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px;
  padding: 10px 10px max(20px, env(safe-area-inset-bottom), var(--mobius-safe-bottom, 0px));
}
.ex-cell-wrap { position: relative; border-radius: 12px; }
.ex-cell {
  width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 6px 10px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); color: var(--text); cursor: pointer; text-align: center;
  -webkit-tap-highlight-color: transparent; transition: border-color 0.12s, background 0.12s;
}
@media (hover: hover) { .ex-cell:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); } }
.ex-cell-wrap.is-selected .ex-cell { border-color: var(--accent); background: var(--accent-dim, color-mix(in srgb, var(--accent) 10%, transparent)); }
.ex-cell-art { width: 100%; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: var(--bg); overflow: hidden; }
.ex-cell-name { width: 100%; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ex-cell-meta { font-size: 10.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.ex-thumb { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.ex-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ex-thumb-fallback { color: var(--muted); font-family: var(--mono); }
.ex-cell-info {
  position: absolute; top: 4px; right: 4px; width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 8px; background: color-mix(in srgb, var(--bg) 70%, transparent); color: var(--muted);
  cursor: pointer; opacity: 0.7;
}
@media (hover: hover) { .ex-cell-info:hover { opacity: 1; color: var(--accent); } }

/* ---- Status bar ---- */
.ex-status {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  min-height: 32px; padding: 6px 14px max(6px, env(safe-area-inset-bottom), var(--mobius-safe-bottom, 0px));
  border-top: 1px solid var(--border); background: var(--surface);
  font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums;
}
.ex-status-census { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-status-disk { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.ex-disk-track { display: inline-block; width: 72px; height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--muted) 25%, transparent); overflow: hidden; }
.ex-disk-fill { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.ex-disk-fill.is-full { background: var(--danger); }
.ex-disk-label { white-space: nowrap; }

/* ---- Drawer content ---- */
.ex-drawer-content { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 6px 8px max(20px, env(safe-area-inset-bottom), var(--mobius-safe-bottom, 0px)); }
.ex-drawer-head { padding: 10px 8px 6px; display: flex; align-items: baseline; gap: 8px; }
.ex-drawer-title { font-size: 15px; font-weight: 750; }
.ex-drawer-sub { font-size: 11px; color: var(--muted); font-family: var(--mono); }
.ex-drawer-disk { margin: 4px 6px 8px; padding: 10px; border-radius: 10px; background: var(--surface2, var(--bg)); border: 1px solid var(--border); }
.ex-drawer-disk-top { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text); margin-bottom: 7px; }
.ex-drawer-disk-top svg { color: var(--muted); }
.ex-drawer-disk-free { margin-left: auto; color: var(--muted); }
.ex-drawer-disk .ex-disk-track { width: 100%; height: 7px; }
.ex-drawer-section-label { padding: 10px 8px 4px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.ex-shortcut-wrap { display: flex; align-items: stretch; border-radius: 10px; }
.ex-shortcut {
  flex: 1; width: 100%; min-width: 0; display: flex; align-items: center; gap: 11px;
  min-height: 46px; padding: 7px 10px; text-align: left;
  background: transparent; border: 0; border-radius: 10px; color: var(--text);
  cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.12s;
}
@media (hover: hover) { .ex-shortcut:hover { background: var(--surface2, var(--bg)); } }
.ex-shortcut:active { background: var(--accent-dim, color-mix(in srgb, var(--accent) 12%, transparent)); }
.ex-shortcut.is-active, .ex-shortcut-wrap.is-active { background: var(--accent-dim, color-mix(in srgb, var(--accent) 12%, transparent)); }
.ex-shortcut.is-active .ex-shortcut-label { color: var(--accent); }
.ex-shortcut-icon { flex: 0 0 auto; width: 24px; display: flex; align-items: center; justify-content: center; color: var(--muted); }
.ex-shortcut.is-active .ex-shortcut-icon { color: var(--accent); }
.ex-shortcut-body { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ex-shortcut-label { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ex-shortcut-hint { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ex-shortcut--recent .ex-shortcut-icon { opacity: 0.8; }
.ex-shortcut-unpin { flex: 0 0 auto; width: 40px; display: flex; align-items: center; justify-content: center; background: transparent; border: 0; border-radius: 8px; color: var(--muted); cursor: pointer; opacity: 0.6; }
@media (hover: hover) { .ex-shortcut-unpin:hover { opacity: 1; color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); } }
.ex-drawer-foot { padding: 12px 6px 6px; }
.ex-pin-current { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; border-radius: 10px; border: 1px dashed var(--border); background: transparent; color: var(--muted); font-family: var(--font); font-size: 13px; font-weight: 600; cursor: pointer; }
@media (hover: hover) { .ex-pin-current:not(:disabled):hover { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); } }
.ex-pin-current:disabled { opacity: 0.4; cursor: default; }

/* ---- Overflow menu ---- */
.ex-menu-scrim { position: absolute; inset: 0; z-index: 60; display: flex; justify-content: flex-end; align-items: flex-start; padding: max(56px, calc(env(safe-area-inset-top) + 48px)) 8px 8px; }
.ex-menu {
  width: 240px; max-width: calc(100vw - 16px); max-height: 78vh; overflow-y: auto;
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.32); padding: 8px; outline: none;
}
.ex-menu-label { padding: 8px 8px 4px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.ex-seg { display: flex; gap: 6px; padding: 2px 4px 6px; }
.ex-seg-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; border-radius: 9px; border: 1px solid var(--border); background: transparent; color: var(--muted); font-family: var(--font); font-size: 13px; font-weight: 600; cursor: pointer; }
.ex-seg-btn.is-on { background: var(--accent-dim, color-mix(in srgb, var(--accent) 14%, transparent)); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); color: var(--accent); }
.ex-menu-item {
  width: 100%; display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 6px 8px;
  background: transparent; border: 0; border-radius: 9px; color: var(--text); font-family: var(--font);
  font-size: 14px; text-align: left; cursor: pointer;
}
@media (hover: hover) { .ex-menu-item:hover { background: var(--surface2, var(--bg)); } }
.ex-menu-item:disabled { opacity: 0.45; cursor: default; }
.ex-menu-item.is-active { color: var(--accent); }
.ex-menu-check { flex: 0 0 auto; width: 18px; display: inline-flex; align-items: center; justify-content: center; color: var(--accent); }
.ex-menu-item-text { flex: 1; }
.ex-menu-dir { flex: 0 0 auto; color: var(--muted); font-weight: 700; }
.ex-menu-divider { height: 1px; margin: 6px 4px; background: var(--border); }

/* ---- Properties sheet + modal scrim ---- */
.ed-modal-scrim, .ex-modal-scrim {
  position: absolute; inset: 0; z-index: 60; display: flex;
  padding: max(20px, env(safe-area-inset-top), var(--mobius-safe-top, 0px)) 16px max(16px, env(safe-area-inset-bottom), var(--mobius-safe-bottom, 0px));
  background: rgba(0,0,0,0.5);
}
.ed-modal-scrim { align-items: center; justify-content: center; }
.ex-modal-scrim { align-items: flex-end; justify-content: center; }
@media (min-width: 760px) { .ex-modal-scrim { align-items: center; } }
.ex-sheet {
  width: 100%; max-width: 460px; max-height: 90%; display: flex; flex-direction: column;
  background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.34); overflow: hidden;
}
.ex-sheet-head { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; padding: 14px 12px 12px 16px; border-bottom: 1px solid var(--border); }
.ex-sheet-icon { flex: 0 0 auto; display: flex; align-items: center; }
.ex-sheet-name { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ex-sheet-x { flex: 0 0 auto; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer; }
@media (hover: hover) { .ex-sheet-x:hover { background: var(--surface2, var(--bg)); color: var(--text); } }
.ex-sheet-body { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 16px 14px; }
.ex-prop-row { display: flex; gap: 12px; padding: 9px 0; border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent); }
.ex-prop-row:last-child { border-bottom: 0; }
.ex-prop-key { flex: 0 0 84px; font-size: 12px; color: var(--muted); font-weight: 600; padding-top: 1px; }
.ex-prop-val { flex: 1; min-width: 0; font-size: 13px; color: var(--text); word-break: break-word; }
.ex-prop-val.is-mono { font-family: var(--mono); font-size: 12px; }
.ex-prop-note { color: var(--muted); font-size: 11px; }
.ex-prop-measuring { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); }
.ex-copy-path { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; background: transparent; border: 0; padding: 0; color: var(--accent); font-family: var(--mono); font-size: 12px; cursor: pointer; text-align: left; }
.ex-copy-path-text { min-width: 0; overflow-wrap: anywhere; }
.ex-copy-path-icon { flex: 0 0 auto; color: var(--muted); }
.ex-sheet-error { margin-top: 10px; padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--danger) 12%, transparent); border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border)); color: var(--text); font-size: 12px; }
.ex-sheet-actions { flex: 0 0 auto; display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border); flex-wrap: wrap; }
.ex-sheet-actions .ex-btn { flex: 1; min-width: 96px; }

/* ---- File viewer / editor ---- */
.ex-view { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--bg); }
.ex-view-head {
  flex: 0 0 auto; display: flex; align-items: center; gap: 8px; min-height: 48px;
  padding: max(8px, env(safe-area-inset-top), var(--mobius-safe-top, 0px)) 10px 8px;
  background: var(--surface); border-bottom: 1px solid var(--border);
}
.ex-view-title { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ex-view-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.ex-view-alert { flex: 0 0 auto; margin: 8px 10px 0; padding: 8px 12px; border-radius: 10px; background: color-mix(in srgb, var(--danger) 12%, transparent); border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border)); color: var(--text); font-size: 12.5px; line-height: 1.4; }
.ex-view-alert.is-notice { background: color-mix(in srgb, var(--ed-amber) 14%, transparent); border-color: color-mix(in srgb, var(--ed-amber) 40%, var(--border)); }
.ex-view-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.ex-view-pane { flex: 1; min-height: 0; display: flex; flex-direction: column; background: color-mix(in srgb, var(--bg) 88%, #000 12%); }
.ex-view-banner { flex: 0 0 auto; padding: 7px 14px; font-size: 12px; color: var(--muted); background: var(--surface2, var(--surface)); border-bottom: 1px solid var(--border); }
.ex-view-scroll { flex: 1; overflow: auto; padding: 14px 16px; overscroll-behavior: contain; }
.ex-view-note { display: flex; align-items: center; gap: 10px; padding: 20px 16px; color: var(--muted); font-size: 14px; line-height: 1.5; }
.ex-view-note.is-error { color: var(--danger); }
.ex-detail-empty { color: var(--muted); }

/* ---- Empty states ---- */
.ex-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; max-width: 420px; margin: auto; padding: 40px 24px; color: var(--muted); }
.ex-empty-mark { width: 58px; height: 58px; margin-bottom: 6px; border-radius: 18px; display: flex; align-items: center; justify-content: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border)); }
.ex-empty-title { font-size: 16px; font-weight: 700; color: var(--text); }
.ex-empty-text { margin: 0; font-size: 13.5px; line-height: 1.55; }
.ex-list-note { display: flex; align-items: center; gap: 8px; padding: 16px; color: var(--muted); font-size: 13px; flex-wrap: wrap; }
.ex-list-note.is-error { color: var(--danger); }
.ex-retry { margin-left: 6px; padding: 6px 12px; min-height: 40px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2, var(--surface)); color: var(--text); font-size: 12px; font-weight: 600; cursor: pointer; }

/* ---- Chat sheet ---- */
.ex-chat-sheet {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 55;
  height: min(72%, 560px); display: flex; flex-direction: column;
  background: var(--surface); border-top: 1px solid var(--border);
  border-top-left-radius: 16px; border-top-right-radius: 16px;
  box-shadow: 0 -8px 24px rgba(0,0,0,0.28);
  padding-bottom: max(0px, env(safe-area-inset-bottom), var(--mobius-safe-bottom, 0px));
}
.ex-chat-sheet-head { flex: 0 0 auto; display: flex; align-items: center; padding: 8px 8px 8px 16px; border-bottom: 1px solid var(--border); }
.ex-chat-sheet-title { flex: 1; font-size: 14px; font-weight: 700; }
.ex-chat-sheet-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
/* On desktop the chat docks as a right-hand panel instead of a bottom sheet. */
@media (min-width: 760px) {
  .ex-chat-sheet { left: auto; top: 0; bottom: 0; width: min(420px, 42%); height: auto; border-top: 0; border-left: 1px solid var(--border); border-radius: 0; box-shadow: -8px 0 24px rgba(0,0,0,0.22); }
}

/* Reused ChatPanel — fill the sheet body (the resizable split was removed). */
.ed-chat { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; background: var(--surface); }
.ed-chat-embed { flex: 1 1 auto; min-height: 0; overflow: hidden; background: var(--bg); }
.ed-chat-embed iframe { display: block; width: 100%; height: 100%; border: 0; }
.ed-chat-error { flex: 0 0 auto; margin: 8px 12px; padding: 8px 12px; border-radius: 10px; background: color-mix(in srgb, var(--danger) 12%, transparent); border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border)); color: var(--text); font-size: 12.5px; }

/* ---- Reused: CodeEditor host + ImagePreview ---- */
.ed-cm-host { flex: 1; min-height: 0; overflow: hidden; }
@media (pointer: coarse) { .ed-cm-host .cm-content { font-size: 16px; } }
.ed-img { max-width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--border); display: block; margin: 0 auto; }
/* Inline media previews (image/audio/video/pdf). */
.ex-preview { min-height: 0; }
.ex-media-video { max-width: 100%; max-height: 100%; width: 100%; border-radius: 10px; background: #000; display: block; }
.ex-media-audio { width: 100%; display: flex; align-items: center; justify-content: center; padding: 24px 8px; }
.ex-media-audio audio { width: 100%; max-width: 520px; }
/* PDF via pdf.js — pages stacked as canvases, centered, scrolling in the pane. */
.ex-pdf { width: 100%; }
.ex-pdf-pages { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.ex-pdf-page { max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 1px 6px rgba(0,0,0,0.35); background: #fff; }
/* Fallback embed if pdf.js can't render (e.g. sandbox blocks it). */
.ex-media-pdf { width: 100%; min-height: 70vh; border: 0; background: var(--surface2, var(--bg)); }
.ed-note { padding: 16px; color: var(--muted); font-size: 13px; }

/* ---- Reused: GitPanel (git banner) ---- */
.ed-git { flex: 0 0 auto; border-bottom: 1px solid var(--border); background: var(--surface); }
.ed-git-bar { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 42px; padding: 8px 14px; text-align: left; background: transparent; border: 0; color: var(--text); cursor: pointer; font-family: var(--font); font-size: 12.5px; -webkit-tap-highlight-color: transparent; }
.ed-git-bar.is-quiet { color: var(--muted); cursor: default; min-height: 32px; font-size: 12px; }
.ed-git-caret { flex: 0 0 auto; width: 16px; font-size: 14px; line-height: 1; color: var(--muted); }
.ed-git-branch { font-weight: 700; font-family: var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.ed-git-track { flex: 0 0 auto; color: var(--muted); font-variant-numeric: tabular-nums; }
.ed-git-counts { margin-left: auto; display: flex; align-items: center; gap: 6px; flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.ed-git-count { font-weight: 700; font-size: 11.5px; }
.ed-git-count.is-staged { color: var(--green); }
.ed-git-count.is-modified { color: var(--ed-amber); }
.ed-git-count.is-untracked { color: var(--ed-blue); }
.ed-git-count.is-clean { color: var(--muted); font-weight: 600; }
.ed-git-body { padding: 4px 14px 12px; max-height: 34vh; overflow-y: auto; overscroll-behavior: contain; }
.ed-git-group { margin-top: 8px; }
.ed-git-group-label { font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 4px; }
.ed-git-file { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; margin-bottom: 6px; padding: 8px 10px; text-align: left; border-radius: 10px; background: var(--surface2, var(--surface)); border: 1px solid var(--border); color: var(--text); cursor: pointer; font-family: var(--font); transition: border-color 0.12s ease, background 0.12s ease; }
@media (hover: hover) { .ed-git-file:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); } }
.ed-git-file-id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ed-git-file-name { font-size: 12.5px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ed-git-file-dir { font-family: var(--mono); font-size: 10.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ed-git-more { margin: 2px 0 4px; font-size: 11px; color: var(--muted); font-style: italic; }

/* ---- Reused: modals (NameModal / ConfirmModal) ---- */
.ed-modal { width: 100%; max-width: 360px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px 18px 16px; box-shadow: 0 4px 8px rgba(0,0,0,0.32); margin: auto; }
.ed-modal-title { font-size: 15px; font-weight: 700; }
.ed-modal-where { margin-top: 3px; font-family: var(--mono); font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ed-modal-body { margin-top: 10px; font-size: 13px; line-height: 1.5; color: var(--text); }
.ed-modal-code { font-family: var(--mono); font-size: 12px; color: var(--accent); word-break: break-all; }
.ed-modal-input { width: 100%; margin-top: 12px; min-height: 44px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-family: var(--mono); font-size: 16px; }
.ed-modal-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.ed-modal-input[aria-invalid="true"] { border-color: var(--danger); }
.ed-modal-error { margin-top: 10px; padding: 7px 10px; border-radius: 8px; background: color-mix(in srgb, var(--danger) 12%, transparent); border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border)); color: var(--text); font-size: 12px; line-height: 1.4; }
.ed-modal-actions { margin-top: 14px; display: flex; justify-content: flex-end; gap: 8px; }

/* ---- Desktop master-detail (≥760px) ---- */
@media (min-width: 760px) {
  .ex-scrim { display: none; }
  .ex-drawer { position: relative; transform: none; flex: 0 0 250px; max-width: 250px; z-index: 1; }
  .ex-drawer-toggle { display: none; }
  .ex-browser { flex: 0 0 clamp(320px, 42%, 480px); border-right: 1px solid var(--border); }
  .ex-detail { display: flex; }
}

/* mobius-ui:ReducedMotion v1 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
/* /mobius-ui:ReducedMotion */
`
