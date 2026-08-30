import test from 'node:test'
import assert from 'node:assert/strict'
import {
  configureFilesystemToken,
  listDirectory,
  readText,
  readTextHead,
} from '../storage.js'

test('filesystem reads require the app-scoped token before making a request', async () => {
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; throw new Error('unexpected fetch') }
  configureFilesystemToken('')
  try {
    await assert.rejects(readText('shared/example.txt'), (error) => error.status === 401)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('directory reads follow bounded pagination and preserve redaction evidence', async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), authorization: init.headers.Authorization })
    const page = requests.length === 1
      ? { entries: [{ name: 'one', type: 'directory', path: './apps/one' }], redacted: ['.secret'], next_cursor: 'next' }
      : { entries: [{ name: 'two.txt', type: 'file', path: 'apps/two.txt' }], redacted: [], next_cursor: null }
    return new Response(JSON.stringify(page), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  configureFilesystemToken('scoped-token')
  try {
    const result = await listDirectory('apps')
    assert.deepEqual(result.entries.map((entry) => entry.path), ['apps/one', 'apps/two.txt'])
    assert.deepEqual(result.redacted, ['.secret'])
    assert.equal(result.truncated, false)
    assert.equal(requests.length, 2)
    assert.match(requests[1].url, /cursor=next/)
    assert.deepEqual(requests.map((request) => request.authorization), ['Bearer scoped-token', 'Bearer scoped-token'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('large-text previews expose the server truncation contract', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    assert.match(String(url), /head=1/)
    return new Response('beginning', {
      status: 200,
      headers: { 'X-Mobius-Total-Size': '9000', 'X-Mobius-Truncated': '1' },
    })
  }
  configureFilesystemToken('scoped-token')
  try {
    assert.deepEqual(await readTextHead('shared/large.txt'), {
      text: 'beginning', total: 9000, truncated: true,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
