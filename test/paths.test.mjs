import test from 'node:test'
import assert from 'node:assert/strict'
import {
  baseName, dirName, extOf, joinPath, isMarkdownPath, isImagePath,
  isValidLeafName, isKeepMarker, filterVisibleEntries, fileGlyph, formatBytes,
} from '../paths.js'

test('baseName / dirName split FS-root-relative paths', () => {
  assert.equal(baseName('apps/notes/index.jsx'), 'index.jsx')
  assert.equal(baseName('README.md'), 'README.md')
  assert.equal(baseName(''), '')
  assert.equal(dirName('apps/notes/index.jsx'), 'apps/notes')
  assert.equal(dirName('README.md'), '')
  assert.equal(dirName(''), '')
})

test('extOf lowercases the extension', () => {
  assert.equal(extOf('Photo.PNG'), 'png')
  assert.equal(extOf('archive.tar.gz'), 'gz')
  assert.equal(extOf('Makefile'), '')
})

test('joinPath joins a dir with a leaf, root = empty dir', () => {
  assert.equal(joinPath('apps/notes', 'index.jsx'), 'apps/notes/index.jsx')
  assert.equal(joinPath('', 'top.md'), 'top.md')
})

test('isMarkdownPath / isImagePath classify by extension', () => {
  assert.equal(isMarkdownPath('notes/todo.md'), true)
  assert.equal(isMarkdownPath('a/b/readme.markdown'), true)
  assert.equal(isMarkdownPath('src/app.js'), false)
  assert.equal(isImagePath('icon.PNG'), true)
  assert.equal(isImagePath('diagram.svg'), true)
  assert.equal(isImagePath('data.json'), false)
})

test('isValidLeafName rejects traversal, slashes, and the .keep marker', () => {
  assert.equal(isValidLeafName('note.md'), true)
  assert.equal(isValidLeafName('  spaced.txt  '), true)
  assert.equal(isValidLeafName(''), false)
  assert.equal(isValidLeafName('   '), false)
  assert.equal(isValidLeafName('a/b'), false)
  assert.equal(isValidLeafName('.'), false)
  assert.equal(isValidLeafName('..'), false)
  assert.equal(isValidLeafName('.keep'), false)
})

test('isKeepMarker only matches the literal .keep', () => {
  assert.equal(isKeepMarker('.keep'), true)
  assert.equal(isKeepMarker('keep'), false)
  assert.equal(isKeepMarker('.keepme'), false)
})

test('hidden files stay optional while .keep always stays private', () => {
  const entries = [{ name: '.git' }, { name: '.keep' }, { name: 'index.jsx' }]
  assert.deepEqual(filterVisibleEntries(entries).map((entry) => entry.name), ['index.jsx'])
  assert.deepEqual(
    filterVisibleEntries(entries, { showHidden: true }).map((entry) => entry.name),
    ['.git', 'index.jsx'],
  )
})

test('fileGlyph maps common extensions', () => {
  assert.equal(fileGlyph('a.md'), 'M')
  assert.equal(fileGlyph('a.png'), 'i')
  assert.equal(fileGlyph('a.py'), 'py')
  assert.equal(fileGlyph('a.tsx'), 'js')
  assert.equal(fileGlyph('a.json'), '{}')
  assert.equal(fileGlyph('a.unknownext'), '·')
})

test('formatBytes is human-readable and safe on non-numbers', () => {
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(2048), '2.0 KB')
  assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MB')
  assert.equal(formatBytes(NaN), '')
  assert.equal(formatBytes(undefined), '')
})
