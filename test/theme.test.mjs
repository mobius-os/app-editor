import test from 'node:test'
import assert from 'node:assert/strict'
import { CSS } from '../theme.js'

test('Places, Pinned, and Recent shortcuts fill the drawer row', () => {
  const shortcutRule = CSS.match(/\.ex-shortcut\s*\{([^}]*)\}/)?.[1] || ''
  assert.match(shortcutRule, /\bwidth:\s*100%\s*;/)
})
