import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PREFS, START_PATH } from '../constants.js'

test('fresh Editor launches in Apps while tabs remain session-scoped', () => {
  assert.equal(START_PATH, 'apps')
  assert.equal(Object.hasOwn(DEFAULT_PREFS, 'openTabs'), false)
  assert.equal(Object.hasOwn(DEFAULT_PREFS, 'activeTabIndex'), false)
})
