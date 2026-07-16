import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')
const nameModal = readFileSync(new URL('../ui/NameModal.jsx', import.meta.url), 'utf8')
const tabs = readFileSync(new URL('../ui/TabStrip.jsx', import.meta.url), 'utf8')

test('folder filter and create-name fields have durable accessible names', () => {
  assert.match(app, /aria-label="Filter this folder"/)
  assert.match(nameModal, /aria-label=\{isFolder \? 'Folder name' : 'File name'\}/)
})

test('folder toolbar owns valid button semantics and closed mobile navigation is inert', () => {
  assert.match(tabs, /role="toolbar"/)
  assert.match(tabs, /aria-pressed=\{active\}/)
  assert.doesNotMatch(tabs, /role="tab"/)
  assert.match(app, /inert=\{!navOpen && !isDesktop \? true : undefined\}/)
})
