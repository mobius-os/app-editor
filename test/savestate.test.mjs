import test from 'node:test'
import assert from 'node:assert/strict'
import { bufferDirtyAfterSave } from '../paths.js'

// Regression for the data-loss bug: keystrokes typed during an in-flight save
// were marked clean and then lost on the next file switch. writeNow (index.jsx)
// captures the buffer at write START, writes THAT, and recomputes `dirty` from
// the LIVE buffer after the PUT resolves via bufferDirtyAfterSave. This test
// models that state machine end to end with a deferred mock write.

test('bufferDirtyAfterSave: clean only when the live buffer equals what was written', () => {
  assert.equal(bufferDirtyAfterSave('A', 'A'), false)
  assert.equal(bufferDirtyAfterSave('A', 'AB'), true)
  assert.equal(bufferDirtyAfterSave('', ''), false)
})

test('keystrokes typed during save keep the buffer dirty and are not written', async () => {
  const state = { baseline: 'A', live: 'A', dirty: false, written: null }
  let resolveWrite
  const fsWrite = (text) => new Promise((res) => { state.written = text; resolveWrite = res })

  async function writeNow() {
    const savedText = state.live         // snapshot at write START
    const put = fsWrite(savedText)
    state.live = 'AB'                     // user keeps typing during the PUT
    await put
    state.baseline = savedText
    state.dirty = bufferDirtyAfterSave(savedText, state.live)
  }

  const done = writeNow()
  resolveWrite()
  await done

  assert.equal(state.written, 'A', 'disk write is the buffer captured at save start')
  assert.equal(state.live, 'AB', 'the visible buffer keeps the trailing keystrokes')
  assert.equal(state.dirty, true, 'buffer stays dirty so the trailing edits still need saving')
  assert.equal(state.baseline, 'A', 'baseline advances to what was actually written')
})

test('a save with no trailing edits ends clean', async () => {
  const state = { live: 'hello', dirty: true, written: null }
  let resolveWrite
  const fsWrite = (text) => new Promise((res) => { state.written = text; resolveWrite = res })

  async function writeNow() {
    const savedText = state.live
    const put = fsWrite(savedText)
    await put
    state.dirty = bufferDirtyAfterSave(savedText, state.live)
  }

  const done = writeNow()
  resolveWrite()
  await done

  assert.equal(state.written, 'hello')
  assert.equal(state.dirty, false, 'no trailing edits → buffer is clean after save')
})
