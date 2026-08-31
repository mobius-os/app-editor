import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(resolve(ROOT, 'mobius.json'), 'utf8'))
const pkg = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'))

test('Files ships one read-only product contract', async () => {
  assert.equal(manifest.name, 'Files')
  assert.equal(manifest.version, pkg.version)
  assert.equal(manifest.permissions.filesystem_access, true)
  assert.equal(manifest.offline.writes, 'none')
  assert.equal(manifest.embeds_agent, undefined)
  for (const path of [manifest.entry, ...manifest.source_files]) {
    assert.ok((await readFile(resolve(ROOT, path))).length > 0, `${path} should ship`)
  }
})

test('the filesystem client has no write request path', async () => {
  const source = await readFile(resolve(ROOT, 'storage.js'), 'utf8')
  assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/)
})
