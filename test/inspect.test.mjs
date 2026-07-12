import test from 'node:test'
import assert from 'node:assert/strict'
import {
  relativeTime, formatDateAbs, isRecent, pathSegments, parentDir,
  kindLabel, sortEntries, pushRecent,
} from '../paths.js'

// A fixed "now" so the relative-time cases are deterministic.
const NOW = Date.parse('2026-07-12T16:00:00Z')
const ago = (ms) => new Date(NOW - ms).toISOString()

test('relativeTime buckets recent → older, injectable now', () => {
  assert.equal(relativeTime(ago(10 * 1000), NOW), 'just now')
  assert.equal(relativeTime(ago(5 * 60 * 1000), NOW), '5m ago')
  assert.equal(relativeTime(ago(3 * 3600 * 1000), NOW), '3h ago')
  assert.equal(relativeTime(ago(2 * 86400 * 1000), NOW), '2d ago')
  // > 7 days → a month/day label
  assert.match(relativeTime(ago(40 * 86400 * 1000), NOW), /^[A-Z][a-z]{2} \d+/)
  assert.equal(relativeTime('', NOW), '')
  assert.equal(relativeTime('not-a-date', NOW), '')
  // clock skew (future mtime) never renders "in the future"
  assert.equal(relativeTime(new Date(NOW + 60000).toISOString(), NOW), 'just now')
})

test('formatDateAbs renders a zero-padded local timestamp', () => {
  assert.match(formatDateAbs('2026-07-12T16:03:00Z'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  assert.equal(formatDateAbs(''), '')
})

test('isRecent is true only within the 24h window', () => {
  assert.equal(isRecent(ago(60 * 1000), NOW), true)
  assert.equal(isRecent(ago(25 * 3600 * 1000), NOW), false)
  assert.equal(isRecent('', NOW), false)
})

test('pathSegments builds breadcrumb segments, root first', () => {
  assert.deepEqual(pathSegments(''), [{ name: '/data', path: '' }])
  assert.deepEqual(pathSegments('apps/notes'), [
    { name: '/data', path: '' },
    { name: 'apps', path: 'apps' },
    { name: 'notes', path: 'apps/notes' },
  ])
  // tolerant of stray slashes
  assert.deepEqual(pathSegments('/apps/'), [
    { name: '/data', path: '' },
    { name: 'apps', path: 'apps' },
  ])
})

test('parentDir ascends a directory path, root stays root', () => {
  assert.equal(parentDir('apps/notes'), 'apps')
  assert.equal(parentDir('apps'), '')
  assert.equal(parentDir(''), '')
})

test('kindLabel names common kinds and falls back to EXT file', () => {
  assert.equal(kindLabel('a.py'), 'Python')
  assert.equal(kindLabel('a.png'), 'PNG image')
  assert.equal(kindLabel('Makefile'), 'File')
  assert.equal(kindLabel('a.weird'), 'WEIRD file')
})

const dir = (name, extra = {}) => ({ name, path: name, type: 'directory', size: 0, ...extra })
const file = (name, size, modified_at) => ({ name, path: name, type: 'file', size, modified_at })

test('sortEntries keeps folders first (default) regardless of direction', () => {
  const entries = [file('b.txt', 10), dir('zeta'), file('a.txt', 20), dir('alpha')]
  const asc = sortEntries(entries, { key: 'name', dir: 'asc', foldersFirst: true })
  assert.deepEqual(asc.map((e) => e.name), ['alpha', 'zeta', 'a.txt', 'b.txt'])
  const desc = sortEntries(entries, { key: 'name', dir: 'desc', foldersFirst: true })
  // folders still first, but each group reversed
  assert.deepEqual(desc.map((e) => e.name), ['zeta', 'alpha', 'b.txt', 'a.txt'])
})

test('sortEntries by size and modified', () => {
  const entries = [file('small', 100, '2026-01-01T00:00:00Z'), file('big', 9000, '2026-05-01T00:00:00Z'), file('mid', 500, '2026-03-01T00:00:00Z')]
  assert.deepEqual(
    sortEntries(entries, { key: 'size', dir: 'desc', foldersFirst: true }).map((e) => e.name),
    ['big', 'mid', 'small'],
  )
  assert.deepEqual(
    sortEntries(entries, { key: 'modified', dir: 'desc', foldersFirst: true }).map((e) => e.name),
    ['big', 'mid', 'small'],
  )
})

test('sortEntries can interleave folders and files when foldersFirst is off', () => {
  const entries = [file('b', 10), dir('a'), file('c', 10)]
  assert.deepEqual(
    sortEntries(entries, { key: 'name', dir: 'asc', foldersFirst: false }).map((e) => e.name),
    ['a', 'b', 'c'],
  )
})

test('pushRecent de-dupes, most-recent-first, and caps length', () => {
  let r = []
  r = pushRecent(r, 'apps')
  r = pushRecent(r, 'shared')
  r = pushRecent(r, 'apps') // re-visit moves it to front, no dupe
  assert.deepEqual(r, ['apps', 'shared'])
  // cap at 12
  let big = []
  for (let i = 0; i < 20; i += 1) big = pushRecent(big, `d${i}`)
  assert.equal(big.length, 12)
  assert.equal(big[0], 'd19')
})
