export const CSS = `
.fx-root, .fx-root *, .fx-root *::before, .fx-root *::after { box-sizing: border-box; }

.fx-root {
  width: 100%; height: 100%; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column;
  background: var(--bg); color: var(--text); font-family: var(--font);
  -webkit-font-smoothing: antialiased;
}

.fx-root button, .fx-root input { font: inherit; }
.fx-root button { -webkit-tap-highlight-color: transparent; }
.fx-root :where(button, input):focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.fx-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

.fx-header {
  flex: 0 0 auto; min-height: 68px; display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: max(10px, env(safe-area-inset-top)) 16px 10px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 94%, var(--bg));
}
.fx-title-group { min-width: 0; display: flex; align-items: center; gap: 11px; }
.fx-logo { width: 38px; height: 38px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; border-radius: 11px; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border)); }
.fx-title-group h1 { margin: 0; font-size: 20px; line-height: 1.1; letter-spacing: -0.025em; }
.fx-title-group p { margin: 3px 0 0; color: var(--muted); font-size: 12px; line-height: 1.2; }
.fx-icon-button, .fx-preview-back {
  width: 44px; height: 44px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; border-radius: 11px; background: transparent; color: var(--muted); cursor: pointer;
}
@media (hover:hover) {
  .fx-icon-button:hover, .fx-preview-back:hover { color: var(--text); border-color: var(--border); background: var(--surface-2, var(--surface)); }
}
.fx-icon-button:active, .fx-preview-back:active { transform: scale(.96); }

.fx-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 188px minmax(320px, 390px) minmax(0, 1fr); }

.fx-locations {
  min-width: 0; padding: 18px 10px; border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 76%, var(--bg));
}
.fx-section-label { margin: 0 10px 9px; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.fx-location {
  width: 100%; min-height: 44px; padding: 0 11px; border: 0; border-radius: 10px;
  display: flex; align-items: center; gap: 10px; background: transparent; color: var(--muted); cursor: pointer;
  text-align: left; font-size: 13.5px; font-weight: 560;
}
.fx-location svg { flex: 0 0 auto; }
.fx-location.is-active { color: var(--accent); background: color-mix(in srgb, var(--accent) 13%, transparent); font-weight: 680; }
@media (hover:hover) { .fx-location:not(.is-active):hover { color: var(--text); background: var(--surface-2, var(--surface)); } }
.fx-location-note { margin: 18px 11px 0; color: color-mix(in srgb, var(--muted) 78%, transparent); font-size: 11px; line-height: 1.45; }

.fx-browser { min-width: 0; min-height: 0; display: flex; flex-direction: column; border-right: 1px solid var(--border); background: var(--bg); }
.fx-mobile-locations { display: none; }
.fx-browser-tools { flex: 0 0 auto; padding: 12px 12px 10px; border-bottom: 1px solid var(--border); background: var(--bg); }
.fx-crumbs { min-width: 0; height: 30px; display: flex; align-items: center; overflow-x: auto; scrollbar-width: none; }
.fx-crumbs::-webkit-scrollbar { display: none; }
.fx-crumb-part { flex: 0 0 auto; display: inline-flex; align-items: center; color: var(--muted); }
.fx-crumb-part svg { opacity: .55; }
.fx-crumb-part button {
  min-height: 30px; padding: 3px 5px; border: 0; border-radius: 6px; background: transparent; color: inherit; cursor: pointer;
  font-size: 12px; white-space: nowrap;
}
.fx-crumb-part button.is-current { color: var(--text); font-weight: 680; cursor: default; }
@media (hover:hover) { .fx-crumb-part button:not(.is-current):hover { color: var(--text); background: var(--surface-2, var(--surface)); } }

.fx-search {
  height: 42px; margin-top: 8px; padding: 0 11px; display: flex; align-items: center; gap: 8px;
  border: 1px solid var(--border); border-radius: 11px; background: var(--surface-2, var(--surface)); color: var(--muted);
  transition: border-color .14s ease, box-shadow .14s ease;
}
.fx-browser-tools > .fx-search:first-child { margin-top: 0; }
.fx-search:focus-within { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent); }
.fx-search input { min-width: 0; flex: 1; height: 100%; padding: 0; border: 0; outline: 0; background: transparent; color: var(--text); font-size: 14px; }
.fx-search input::placeholder { color: color-mix(in srgb, var(--muted) 82%, transparent); }
.fx-search button { width: 32px; height: 32px; margin-right: -7px; border: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: var(--muted); cursor: pointer; }

.fx-folder-summary { margin-top: 11px; display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.fx-folder-summary strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; letter-spacing: -.01em; }
.fx-folder-summary span { flex: 0 0 auto; color: var(--muted); font-size: 11.5px; }

.fx-list-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--muted) 30%, transparent) transparent; }
.fx-list { padding: 6px; }
.fx-row {
  width: 100%; min-height: 62px; padding: 8px 10px; border: 1px solid transparent; border-radius: 11px;
  display: flex; align-items: center; gap: 11px; background: transparent; color: var(--text); cursor: pointer; text-align: left;
}
@media (hover:hover) { .fx-row:hover { background: var(--surface-2, var(--surface)); } }
.fx-row.is-selected { background: color-mix(in srgb, var(--accent) 11%, transparent); border-color: color-mix(in srgb, var(--accent) 28%, var(--border)); }
.fx-entry-icon {
  width: 38px; height: 38px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 10px; color: var(--muted); background: var(--surface-2, var(--surface));
}
.fx-entry-icon.is-folder { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.fx-row-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.fx-row-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; font-weight: 640; }
.fx-row-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 11.5px; }
.fx-chevron { flex: 0 0 auto; color: color-mix(in srgb, var(--muted) 72%, transparent); }
.fx-browser-foot { flex: 0 0 auto; min-height: 34px; padding: 8px 14px calc(8px + env(safe-area-inset-bottom)); border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; }

.fx-state { min-height: 180px; padding: 28px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; color: var(--muted); text-align: center; }
.fx-state svg { color: color-mix(in srgb, var(--muted) 70%, transparent); }
.fx-state strong { color: var(--text); font-size: 14px; }
.fx-state span { max-width: 32ch; font-size: 12px; line-height: 1.45; }
.fx-state button { min-height: 40px; margin-top: 5px; padding: 0 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); cursor: pointer; font-weight: 620; }
.fx-state.is-error svg { color: var(--danger, #c94141); }
.fx-spinner { width: 18px; height: 18px; border: 2px solid color-mix(in srgb, var(--accent) 18%, transparent); border-top-color: var(--accent); border-radius: 50%; animation: fx-spin .8s linear infinite; }
@keyframes fx-spin { to { transform: rotate(360deg); } }

.fx-preview { min-width: 0; min-height: 0; display: flex; flex-direction: column; background: color-mix(in srgb, var(--bg) 97%, var(--surface)); }
.fx-preview-empty { flex: 1; padding: 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.fx-preview-symbol { width: 72px; height: 72px; display: inline-flex; align-items: center; justify-content: center; border-radius: 22px; color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 17%, var(--border)); }
.fx-preview-empty strong { margin-top: 17px; font-size: 15px; }
.fx-preview-empty p { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
.fx-preview-head { flex: 0 0 auto; min-height: 66px; padding: 8px 12px; display: flex; align-items: center; gap: 9px; border-bottom: 1px solid var(--border); background: var(--bg); }
.fx-preview-back { display: none; }
.fx-preview-glyph { width: 36px; height: 36px; flex: 0 0 auto; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; color: var(--muted); background: var(--surface-2, var(--surface)); }
.fx-preview-title { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.fx-preview-title strong, .fx-preview-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fx-preview-title strong { font-size: 14px; }
.fx-preview-title span { color: var(--muted); font-size: 10.5px; }
.fx-download { min-height: 40px; padding: 0 12px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); cursor: pointer; font-size: 12px; font-weight: 650; }
@media (hover:hover) { .fx-download:hover { background: var(--surface-2, var(--surface)); border-color: color-mix(in srgb, var(--accent) 30%, var(--border)); } }
.fx-preview-body { flex: 1; min-height: 0; overflow: hidden; position: relative; }
.fx-text-preview { width: 100%; height: 100%; margin: 0; padding: 20px 22px 40px; overflow: auto; color: var(--text); background: transparent; font-family: var(--mono, ui-monospace, monospace); font-size: 12px; line-height: 1.65; tab-size: 2; white-space: pre; }
.fx-preview-notice { padding: 9px 14px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); color: var(--muted); font-size: 11px; }
.fx-media-preview { width: 100%; height: 100%; padding: 24px; display: flex; align-items: center; justify-content: center; overflow: auto; }
.fx-media-preview img, .fx-media-preview video { display: block; max-width: 100%; max-height: 100%; border-radius: 12px; object-fit: contain; }
.fx-media-preview audio { width: min(480px, 100%); }
.fx-pdf-preview { width: 100%; height: 100%; border: 0; background: var(--surface); }

@media (max-width: 959px) {
  .fx-body { grid-template-columns: minmax(300px, 360px) minmax(0, 1fr); }
  .fx-locations { display: none; }
  .fx-mobile-locations { flex: 0 0 auto; display: flex; gap: 6px; padding: 8px 10px; overflow-x: auto; border-bottom: 1px solid var(--border); scrollbar-width: none; }
  .fx-mobile-locations::-webkit-scrollbar { display: none; }
  .fx-mobile-locations button { min-height: 36px; padding: 0 12px; flex: 0 0 auto; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--muted); cursor: pointer; font-size: 12px; }
  .fx-mobile-locations button.is-active { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 28%, var(--border)); background: color-mix(in srgb, var(--accent) 10%, transparent); font-weight: 650; }
}

@media (max-width: 759px) {
  .fx-header { min-height: 64px; padding-left: 14px; padding-right: 10px; }
  .fx-logo { width: 36px; height: 36px; }
  .fx-title-group h1 { font-size: 19px; }
  .fx-title-group p { display: none; }
  .fx-body { display: block; position: relative; }
  .fx-browser, .fx-preview { position: absolute; inset: 0; border: 0; }
  .fx-preview { display: none; }
  .fx-root.has-selection .fx-browser { display: none; }
  .fx-root.has-selection .fx-preview { display: flex; }
  .fx-mobile-locations { padding: 8px 10px 7px; }
  .fx-browser-tools { padding: 9px 10px 9px; }
  .fx-crumbs { height: 28px; }
  .fx-search { margin-top: 6px; }
  .fx-folder-summary { margin-top: 9px; }
  .fx-list { padding: 5px 6px 14px; }
  .fx-row { min-height: 64px; padding: 8px 9px; }
  .fx-entry-icon { width: 40px; height: 40px; }
  .fx-preview-head { min-height: 64px; padding: 8px 10px; }
  .fx-preview-back { display: inline-flex; }
  .fx-preview-glyph { display: none; }
  .fx-download { width: 44px; height: 44px; min-height: 44px; padding: 0; }
  .fx-download span { display: none; }
  .fx-text-preview { padding: 16px 15px 36px; font-size: 12.5px; }
  .fx-media-preview { padding: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .fx-spinner { animation: none; }
  .fx-root * { scroll-behavior: auto !important; transition-duration: 0s !important; }
}
`
