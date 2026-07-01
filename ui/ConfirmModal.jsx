import { useEffect, useRef } from 'react'
import { useModalFocus } from './useModalFocus.js'

// ----------------------------------------------------------------------
// Confirm modal for destructive actions (deleting a file). Same overlay/scrim
// shapes as NameModal — the iframe lacks the `allow-modals` sandbox token, so
// window.confirm silently no-ops and returns false. The parent runs the delete
// and can report an `error` back for inline display without tearing the modal
// down (so a failed delete keeps the dialog open with the reason).
// ----------------------------------------------------------------------
export function ConfirmModal({ title, body, confirmLabel, busyLabel, error, busy, onConfirm, onCancel }) {
  const cancelRef = useRef(null)
  // Land focus on Cancel — the safe default for a destructive confirm, so a
  // keyboard/AT user starts on "back out", not "delete". The hook captures and
  // restores the opener and traps Tab within the dialog.
  const { dialogRef, onKeyDown } = useModalFocus(cancelRef)
  useEffect(() => {
    // Escape closes only while idle; once a delete is in flight, Escape must
    // not race the request out from under it.
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, busy])
  return (
    <div className="ed-modal-scrim" onClick={busy ? null : onCancel}>
      <div className="ed-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()}>
        <div className="ed-modal-title">{title}</div>
        {body && <div className="ed-modal-body">{body}</div>}
        {error && <div className="ed-modal-error">{error}</div>}
        <div className="ed-modal-actions">
          <button type="button" className="ed-btn" ref={cancelRef} onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="ed-btn ed-btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? (busyLabel || 'Working…') : (confirmLabel || 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
