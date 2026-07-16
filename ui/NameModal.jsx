import { useEffect, useRef, useState } from 'react'
import { isValidLeafName } from '../paths.js'
import { useModalFocus } from './useModalFocus.js'

// ----------------------------------------------------------------------
// Name-entry modal for "+ File" / "+ Folder". Möbius mini-apps run in an
// iframe WITHOUT the `allow-modals` sandbox token, so window.prompt silently
// no-ops; we render our own absolutely-positioned overlay. It's a focused
// single-field form (not a generic prompt surface) — name in, Create/Cancel
// out — reusing the app's existing button + scrim shapes. `onSubmit(name)`
// receives the trimmed leaf; the parent validates + writes and can report an
// `error` back for inline display without tearing the modal down.
// ----------------------------------------------------------------------
export function NameModal({ kind, targetDir, error, busy, onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const inputRef = useRef(null)
  const isFolder = kind === 'folder'
  // Focus the name field on open; capture/restore the opener and trap Tab
  // within the dialog. Escape closes (a name-entry modal is non-destructive).
  const { dialogRef, onKeyDown } = useModalFocus(inputRef)
  useEffect(() => {
    // Escape closes only while idle. Once a create is in flight (busy), Escape —
    // like the scrim and Cancel below — must not race the async fsWrite +
    // selection out from under it, matching ConfirmModal: the write is not
    // fenced, so a "cancel" mid-flight would still create + select the file.
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, busy])

  const trimmed = name.trim()
  const valid = isValidLeafName(trimmed)
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!valid || busy) return
    onSubmit(trimmed)
  }
  const where = targetDir ? `/data/${targetDir}` : '/data'
  return (
    <div className="ed-modal-scrim" onClick={busy ? null : onCancel}>
      <div className="ed-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-label={isFolder ? 'New folder' : 'New file'} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="ed-modal-title">{isFolder ? 'New folder' : 'New file'}</div>
          <div className="ed-modal-where" title={where}>in {where}</div>
          <input
            ref={inputRef}
            className="ed-modal-input"
            type="text"
            aria-label={isFolder ? 'Folder name' : 'File name'}
            name={isFolder ? 'folder_name' : 'file_name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isFolder ? 'folder-name' : 'file-name.md'}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-invalid={name && !valid ? 'true' : undefined}
          />
          {error && <div className="ed-modal-error">{error}</div>}
          <div className="ed-modal-actions">
            <button type="button" className="ed-btn" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="submit" className="ed-btn ed-btn-primary" disabled={!valid || busy}>
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
