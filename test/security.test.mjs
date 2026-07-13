import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

test('manifest explicitly grants the Editor filesystem capability', async () => {
  const manifest = JSON.parse(await readFile(new URL('mobius.json', root), 'utf8'))
  assert.equal(manifest.permissions.filesystem_access, true)
})

test('filesystem calls use the scoped app token, never the owner login token', async () => {
  const [storage, entry] = await Promise.all([
    readFile(new URL('storage.js', root), 'utf8'),
    readFile(new URL('index.jsx', root), 'utf8'),
  ])
  assert.doesNotMatch(storage, /localStorage/)
  assert.match(storage, /configureFilesystemToken/)
  assert.match(entry, /function App\(\{ appId, token \}\)/)
  assert.match(entry, /configureFilesystemToken\(token\)/)
})
