import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGitEntryPath } from '../paths.js'

// Regression for the git-panel bug where an untracked DIRECTORY row (`subdir/`)
// was opened as a file, 404ing into a "This file no longer exists" pane.

test('a plain file is not a directory and keeps its path', () => {
  assert.deepEqual(parseGitEntryPath('src/app.js'), {
    isDir: false, path: 'src/app.js', base: 'app.js', dir: 'src',
  })
})

test('a top-level file has no dir', () => {
  assert.deepEqual(parseGitEntryPath('README.md'), {
    isDir: false, path: 'README.md', base: 'README.md', dir: '',
  })
})

test('an untracked directory (trailing slash) is flagged and stripped for opening', () => {
  const r = parseGitEntryPath('subdir/')
  assert.equal(r.isDir, true)
  assert.equal(r.path, 'subdir')        // slash-stripped: safe to open/focus
  assert.equal(r.base, 'subdir/')       // display keeps the slash
  assert.equal(r.dir, '')
})

test('a nested untracked directory splits base and dir correctly', () => {
  const r = parseGitEntryPath('a/b/c/')
  assert.equal(r.isDir, true)
  assert.equal(r.path, 'a/b/c')
  assert.equal(r.base, 'c/')
  assert.equal(r.dir, 'a/b')
})

test('empty/undefined input does not throw', () => {
  assert.deepEqual(parseGitEntryPath(''), { isDir: false, path: '', base: '', dir: '' })
  assert.deepEqual(parseGitEntryPath(undefined), { isDir: false, path: '', base: '', dir: '' })
})
