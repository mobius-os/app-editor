import test from 'node:test'
import assert from 'node:assert/strict'
import {
  entryMeta,
  normalizePath,
  pathSegments,
  visibleEntries,
} from '../domain.js'

test('normalizePath keeps every file request relative to the data root', () => {
  assert.equal(normalizePath('/apps/notes/'), 'apps/notes')
  assert.equal(normalizePath('./shared'), 'shared')
})

test('pathSegments produces navigable ancestors', () => {
  assert.deepEqual(pathSegments('apps/notes'), [
    { label: 'Apps', path: 'apps' },
    { label: 'notes', path: 'apps/notes' },
  ])
})

test('visibleEntries hides implementation details and keeps folders first', () => {
  const entries = [
    { name: 'z.txt', type: 'file' },
    { name: '.git', type: 'directory' },
    { name: 'Apps', type: 'directory' },
    { name: '.keep', type: 'file' },
    { name: 'a.txt', type: 'file' },
  ]
  assert.deepEqual(visibleEntries(entries).map((entry) => entry.name), ['Apps', 'a.txt', 'z.txt'])
  assert.deepEqual(visibleEntries(entries, 'z').map((entry) => entry.name), ['z.txt'])
})

test('the Apps location can hide numeric runtime folders', () => {
  const entries = [
    { name: '67', type: 'directory' },
    { name: '_profile-cleanup', type: 'directory' },
    { name: 'files', type: 'directory' },
  ]
  assert.deepEqual(
    visibleEntries(entries, '', { hideRuntime: true }).map((entry) => entry.name),
    ['files'],
  )
})

test('generated dependency folders stay out of source browsing', () => {
  const entries = [
    { name: 'node_modules', type: 'directory' },
    { name: 'dist', type: 'directory' },
    { name: 'src', type: 'directory' },
  ]
  assert.deepEqual(
    visibleEntries(entries, '', { hideGenerated: true }).map((entry) => entry.name),
    ['src'],
  )
})

test('entryMeta describes a folder without inventing size', () => {
  assert.equal(entryMeta({ type: 'directory', child_count: 2 }), '2 items')
})
