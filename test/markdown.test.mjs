import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CSS } from '../theme.js'

const domain = readFileSync(new URL('../domain.js', import.meta.url), 'utf8')

test('markdown markers only reveal after the editor receives focus', () => {
  assert.match(domain, /u\.focusChanged/)
  assert.match(domain, /view\.hasFocus\s*&&/)
})

test('markdown preview gives structural elements visible rendered shapes', () => {
  for (const className of [
    '.ed-md-rule',
    '.ed-md-code-line',
    '.ed-md-inline-code',
    '.ed-md-list-mark',
    '.ed-md-quote-line',
  ]) {
    assert.match(domain, new RegExp(className.replaceAll('.', '\\.')))
  }
})

test('folder tabs keep balanced breathing room around their label', () => {
  const tabRule = CSS.match(/\.ex-tab-btn\s*\{([^}]*)\}/)?.[1] || ''
  assert.match(tabRule, /padding:\s*4px\s+12px/)
  assert.match(tabRule, /min-height:\s*44px/)
})
