import { useCallback, useEffect, useRef } from 'react'
import { FOCUSABLE_SELECTOR } from '../constants.js'

// ----------------------------------------------------------------------
// Shared modal-focus contract for the app's dialogs. A dialog must keep
// keyboard focus inside itself while open and hand it back to whatever the
// user was on when it closes, or focus silently lands on the inert tree
// behind the scrim. This hook owns that invariant so each modal only wires the
// returned `dialogRef`/`onKeyDown` and names its initial focus target.
//
// On open it captures the opener (document.activeElement) once and moves focus
// to `initialFocusRef` if given, else the dialog's first focusable element. On
// every keydown it traps Tab to the dialog's focusable set — recomputed
// per-keydown because labels and disabled state shift with `busy`, so a cached
// list would trap against stale nodes. On cleanup it restores the opener.
// Escape is left to each modal so destructive dialogs can guard it.
// ----------------------------------------------------------------------

export function useModalFocus(initialFocusRef) {
  const dialogRef = useRef(null)
  // A ref (not state) so the opener survives every render without being a
  // dependency that could retrigger the capture effect.
  const openerRef = useRef(null)

  useEffect(() => {
    openerRef.current = document.activeElement
    const target = initialFocusRef?.current
      || dialogRef.current?.querySelector(FOCUSABLE_SELECTOR)
    target?.focus()
    return () => {
      const opener = openerRef.current
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus()
      }
    }
  }, [])

  const onKeyDown = useCallback((e) => {
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
    if (!focusable || focusable.length === 0) {
      // Everything is disabled (mid-write) — keep focus pinned in-dialog.
      e.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  return { dialogRef, onKeyDown }
}
