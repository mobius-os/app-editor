import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')
const nameModal = readFileSync(new URL('../ui/NameModal.jsx', import.meta.url), 'utf8')

test('folder filter and create-name fields have durable accessible names', () => {
  assert.match(app, /aria-label="Filter this folder"/)
  assert.match(nameModal, /aria-label=\{isFolder \? 'Folder name' : 'File name'\}/)
})
