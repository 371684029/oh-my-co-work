import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultFurnaceSettings, getAppSettings } from '../src/appSettings.js'

test('defaultFurnaceSettings requireVerifyBeforeStamp is false', () => {
  assert.equal(defaultFurnaceSettings().requireVerifyBeforeStamp, false)
})

test('getAppSettings exposes furnace block', () => {
  const s = getAppSettings()
  assert.ok(s.furnace)
  assert.equal(s.furnace.requireVerifyBeforeStamp, false)
})
