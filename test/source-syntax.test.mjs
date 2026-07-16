import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceKind, sourceTokens } from '../source-syntax.js'

test('sourceKind recognizes supported source extensions case-insensitively', () => {
  assert.equal(sourceKind('apps/store/index.TSX'), 'tsx')
  assert.equal(sourceKind('scripts/release.py'), 'py')
  assert.equal(sourceKind('README.md'), '')
  assert.equal(sourceKind('Makefile'), '')
})

test('sourceTokens classifies comments, strings, keywords, literals, numbers, and tags', () => {
  const source = 'const view = <Panel count={42} ready={true} title="Release" /> // note'
  const classes = sourceTokens('ui/App.jsx', source).map((token) => token.className)
  assert.ok(classes.includes('cm-syn-keyword'))
  assert.ok(classes.includes('cm-syn-tag'))
  assert.ok(classes.includes('cm-syn-number'))
  assert.ok(classes.includes('cm-syn-literal'))
  assert.ok(classes.includes('cm-syn-string'))
  assert.ok(classes.includes('cm-syn-comment'))
})

test('sourceTokens keeps multiline comments whole and ignores unsupported files', () => {
  const source = '/* first\nsecond */\nreturn null'
  const tokens = sourceTokens('logic.js', source)
  assert.deepEqual(tokens[0], {
    from: 0,
    to: '/* first\nsecond */'.length,
    className: 'cm-syn-comment',
  })
  assert.deepEqual(sourceTokens('notes.md', source), [])
})
