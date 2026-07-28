import { useEffect, useMemo, useRef, useState } from 'react'
import { agentSystemPrompt } from '../domain.js'
import { emitSignal } from '../storage.js'

// ----------------------------------------------------------------------
// Embedded agent chat. The runtime mounts the real ChatView into an iframe, so
// this app does not duplicate SSE handling, composer state, provider controls,
// or persistence. window.mobius.chat owns the whole lifecycle (create-once via
// persist, re-apply the system prompt on resume). onTurnDone fires after each
// agent turn → the App re-reads the open file + refreshes the tree node + git.
// ----------------------------------------------------------------------

export function ChatPanel({ chatHeight, onTurnDone, guidance, getContext }) {
  const mountRef = useRef(null)
  const [error, setError] = useState(null)
  // Keep the latest onTurnDone in a ref so the mount effect does not depend on
  // it — that callback closes over the selected path and changes identity on
  // every file selection; as a mount-effect dep it would tear down and remount
  // the chat iframe (killing a streaming turn) every time the user opens a file.
  const onTurnDoneRef = useRef(onTurnDone)
  useEffect(() => { onTurnDoneRef.current = onTurnDone }, [onTurnDone])
  const guidanceRef = useRef(guidance)
  const chatHandleRef = useRef(null)
  useEffect(() => {
    guidanceRef.current = guidance
    chatHandleRef.current?.setGuidance?.(guidance)
  }, [guidance])
  const getContextRef = useRef(getContext)
  useEffect(() => { getContextRef.current = getContext }, [getContext])
  const systemPrompt = useMemo(() => agentSystemPrompt(), [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !window.mobius || typeof window.mobius.chat !== 'function') {
      setError('Embedded chat is not available in this shell.')
      return undefined
    }
    let disposed = false
    let handle = null
    setError(null)
    window.mobius.chat({
      mount,
      persist: 'chat_id.json',
      title: 'Editor',
      systemPrompt,
      picker: true,
      guidance: guidanceRef.current,
      getContext: () => {
        const fn = getContextRef.current
        return fn ? fn() : null
      },
      onTurnDone: () => {
        // A turn completed — clear any stale error banner from a prior failure
        // (it previously only cleared on mount, so it survived a full recovery).
        setError(null)
        if (onTurnDoneRef.current) onTurnDoneRef.current()
      },
      onError: ({ error: e }) => {
        const msg = typeof e === 'string' ? e : 'Embedded chat reported an error.'
        setError(msg)
        emitSignal('error', { message: msg, source: 'chat' })
      },
    }).then((h) => {
      if (disposed) { h.destroy(); return }
      handle = h
      chatHandleRef.current = h
      h.setGuidance?.(guidanceRef.current)
    }).catch((e) => {
      if (disposed) return
      const msg = e.message || 'Could not mount embedded chat.'
      setError(msg)
      emitSignal('error', { message: msg, source: 'chat' })
    })
    return () => {
      disposed = true
      if (chatHandleRef.current === handle) chatHandleRef.current = null
      if (handle) handle.destroy()
    }
  }, [systemPrompt])

  // The whole height goes to the embed — the chat's own composer is pinned at
  // the bottom of the iframe and is self-evident, so the app adds no title or
  // hint band of its own ("full vibe writing").
  return (
    <section
      className="ed-chat"
      style={Number.isFinite(chatHeight) ? { height: `${chatHeight}px` } : undefined}
    >
      {error && <div className="ed-chat-error">{error}</div>}
      <div className="ed-chat-embed" ref={mountRef} />
    </section>
  )
}
