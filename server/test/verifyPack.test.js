import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { verifyPackedZip } from '../../scripts/verify-pack.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SOURCE_SPRITESHEET = path.join(ROOT, 'web/src/assets/pets/li-muwan/spritesheet.webp')

const PLATFORM_MAGIC = {
  linux: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0]),
  win32: Buffer.from([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0]),
  darwin: Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0, 0, 0, 0]),
}

function buildFixtureZip({ dir, platformTag, nativeMagic, spritesheetBytes, includeOldAsset }) {
  const platform = platformTag.match(/^(win32|linux|darwin)-/)[1]
  const root = path.join(dir, platformTag)
  fs.mkdirSync(path.join(root, 'web/dist/assets'), { recursive: true })
  fs.mkdirSync(path.join(root, 'node_modules/node-pty/build/Release'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'BUILD_INFO.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'oh-my-co-work',
      kind: 'runtime-bundle',
      version: '3.7.0',
      major: 3,
      platform: platformTag,
      sourceCommit: 'deadbeef',
      builtAt: new Date().toISOString(),
      needsNpmInstall: false,
      requiredAssets: ['web/dist/assets/spritesheet-*.webp'],
    }),
  )
  fs.writeFileSync(
    path.join(root, 'web/dist/assets/spritesheet-test.webp'),
    spritesheetBytes,
  )
  fs.writeFileSync(
    path.join(root, 'node_modules/node-pty/build/Release/pty.node'),
    nativeMagic ?? PLATFORM_MAGIC[platform],
  )
  if (includeOldAsset) {
    fs.writeFileSync(path.join(root, 'web/dist/assets/furnace-idle-old.gif'), Buffer.from([0]))
  }
  const zipPath = path.join(dir, `${platformTag}.zip`)
  execFileSync('zip', ['-qr', zipPath, platformTag], { cwd: dir })
  return zipPath
}

function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-verify-pack-'))
  try {
    return fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('verifyPackedZip passes a well-formed win32-x64 package', () => {
  withTmpDir((dir) => {
    const spritesheetBytes = fs.existsSync(SOURCE_SPRITESHEET)
      ? fs.readFileSync(SOURCE_SPRITESHEET)
      : Buffer.from('fake-sprite')
    const zipPath = buildFixtureZip({
      dir,
      platformTag: 'win32-x64',
      spritesheetBytes,
    })
    const info = verifyPackedZip({ zipPath, platformTag: 'win32-x64', expectedVersion: '3.7.0' })
    assert.equal(info.platform, 'win32-x64')
  })
})

test('verifyPackedZip rejects a cross-packed zip whose build/Release binary is the wrong architecture', () => {
  withTmpDir((dir) => {
    const spritesheetBytes = fs.existsSync(SOURCE_SPRITESHEET)
      ? fs.readFileSync(SOURCE_SPRITESHEET)
      : Buffer.from('fake-sprite')
    // 模拟交叉打包时混入宿主平台（Linux）二进制的场景
    const zipPath = buildFixtureZip({
      dir,
      platformTag: 'win32-x64',
      nativeMagic: PLATFORM_MAGIC.linux,
      spritesheetBytes,
    })
    assert.throws(
      () => verifyPackedZip({ zipPath, platformTag: 'win32-x64', expectedVersion: '3.7.0' }),
      /架构与目标平台.*不符/,
    )
  })
})

test('verifyPackedZip rejects a package whose spritesheet bytes differ from source', () => {
  withTmpDir((dir) => {
    const zipPath = buildFixtureZip({
      dir,
      platformTag: 'linux-x64',
      spritesheetBytes: Buffer.from('not-the-real-sprite'),
    })
    if (fs.existsSync(SOURCE_SPRITESHEET)) {
      assert.throws(
        () => verifyPackedZip({ zipPath, platformTag: 'linux-x64', expectedVersion: '3.7.0' }),
        /图集字节.*不一致/,
      )
    }
  })
})

test('verifyPackedZip rejects a package that still ships the retired furnace-idle assets', () => {
  withTmpDir((dir) => {
    const spritesheetBytes = fs.existsSync(SOURCE_SPRITESHEET)
      ? fs.readFileSync(SOURCE_SPRITESHEET)
      : Buffer.from('fake-sprite')
    const zipPath = buildFixtureZip({
      dir,
      platformTag: 'darwin-arm64',
      spritesheetBytes,
      includeOldAsset: true,
    })
    assert.throws(
      () => verifyPackedZip({ zipPath, platformTag: 'darwin-arm64', expectedVersion: '3.7.0' }),
      /旧版 furnace-idle/,
    )
  })
})
