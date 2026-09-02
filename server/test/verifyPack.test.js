import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { verifyPackedZip, resolveLoadedNativeEntries } from '../../scripts/verify-pack.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SOURCE_SPRITESHEET = path.join(ROOT, 'web/src/assets/pets/li-muwan/spritesheet.webp')

const PLATFORM_MAGIC = {
  linux: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0]),
  win32: Buffer.from([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0]),
  darwin: Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0, 0, 0, 0]),
}

/**
 * @param {object} opts
 * @param {Array<{relPath: string, magic?: Buffer}>} [opts.nativeFiles] 默认放一份
 *   build/Release/pty.node（正常原生打包）；显式传空数组可模拟交叉打包剪掉
 *   build/Release 后只剩 prebuilds/<平台> 的场景。
 */
function buildFixtureZip({
  dir,
  platformTag,
  spritesheetBytes,
  includeOldAsset,
  nativeFiles,
}) {
  const platform = platformTag.match(/^(win32|linux|darwin)-/)[1]
  const root = path.join(dir, platformTag)
  fs.mkdirSync(path.join(root, 'web/dist/assets'), { recursive: true })
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
  const files =
    nativeFiles ??
    [{ relPath: 'node_modules/node-pty/build/Release/pty.node', magic: PLATFORM_MAGIC[platform] }]
  for (const f of files) {
    const full = path.join(root, f.relPath)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, f.magic ?? PLATFORM_MAGIC[platform])
  }
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

test('verifyPackedZip rejects a package that leaks the runtime data directory (4.2.0)', () => {
  withTmpDir((dir) => {
    const spritesheetBytes = fs.existsSync(SOURCE_SPRITESHEET)
      ? fs.readFileSync(SOURCE_SPRITESHEET)
      : Buffer.from('fake-sprite')
    const zipPath = buildFixtureZip({ dir, platformTag: 'win32-x64', spritesheetBytes })
    const leaked = path.join(dir, 'win32-x64', 'data', 'oh-my-co-work.sqlite')
    fs.mkdirSync(path.dirname(leaked), { recursive: true })
    fs.writeFileSync(leaked, 'SQLite format 3 placeholder')
    execFileSync('zip', [zipPath, 'win32-x64/data/oh-my-co-work.sqlite'], { cwd: dir })
    assert.throws(
      () => verifyPackedZip({ zipPath, platformTag: 'win32-x64', expectedVersion: '3.7.0' }),
      /data\/\*\*/,
    )
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
      spritesheetBytes,
      nativeFiles: [
        { relPath: 'node_modules/node-pty/build/Release/pty.node', magic: PLATFORM_MAGIC.linux },
      ],
    })
    assert.throws(
      () => verifyPackedZip({ zipPath, platformTag: 'win32-x64', expectedVersion: '3.7.0' }),
      /架构与目标平台.*不符/,
    )
  })
})

test('resolveLoadedNativeEntries picks build/Release over prebuilds when both exist', () => {
  const entries = [
    'pkg/node_modules/node-pty/build/Release/pty.node',
    'pkg/node_modules/node-pty/prebuilds/win32-x64/pty.node',
  ]
  assert.deepEqual(resolveLoadedNativeEntries(entries, 'win32-x64'), [
    'pkg/node_modules/node-pty/build/Release/pty.node',
  ])
})

test('resolveLoadedNativeEntries falls back to prebuilds/<target> once build/Release is pruned', () => {
  const entries = [
    'pkg/node_modules/node-pty/prebuilds/win32-arm64/pty.node',
    'pkg/node_modules/node-pty/prebuilds/win32-x64/pty.node',
    'pkg/node_modules/node-pty/prebuilds/darwin-arm64/pty.node',
  ]
  assert.deepEqual(resolveLoadedNativeEntries(entries, 'win32-x64'), [
    'pkg/node_modules/node-pty/prebuilds/win32-x64/pty.node',
  ])
})

test('verifyPackedZip catches a cross-packed zip whose prebuilds/<target> binary is the wrong architecture (previously unchecked)', () => {
  withTmpDir((dir) => {
    const spritesheetBytes = fs.existsSync(SOURCE_SPRITESHEET)
      ? fs.readFileSync(SOURCE_SPRITESHEET)
      : Buffer.from('fake-sprite')
    // 交叉打包已经把 build/Release 里宿主平台的二进制清掉（pruneMismatchedNativeBuilds
    // 的效果），只剩 prebuilds/<目标平台>——如果这份也是错的架构，必须被抓出来。
    const zipPath = buildFixtureZip({
      dir,
      platformTag: 'win32-x64',
      spritesheetBytes,
      nativeFiles: [
        { relPath: 'node_modules/node-pty/prebuilds/win32-x64/pty.node', magic: PLATFORM_MAGIC.linux },
        { relPath: 'node_modules/node-pty/prebuilds/darwin-arm64/pty.node', magic: PLATFORM_MAGIC.darwin },
      ],
    })
    assert.throws(
      () => verifyPackedZip({ zipPath, platformTag: 'win32-x64', expectedVersion: '3.7.0' }),
      /架构与目标平台.*不符/,
    )
  })
})

test('verifyPackedZip passes a cross-packed zip whose only candidate is a correct prebuilds/<target> binary', () => {
  withTmpDir((dir) => {
    const spritesheetBytes = fs.existsSync(SOURCE_SPRITESHEET)
      ? fs.readFileSync(SOURCE_SPRITESHEET)
      : Buffer.from('fake-sprite')
    const zipPath = buildFixtureZip({
      dir,
      platformTag: 'win32-x64',
      spritesheetBytes,
      nativeFiles: [
        // 其它平台的预编译副本混在包里是正常现象（node-pty 自带），不该导致误报
        { relPath: 'node_modules/node-pty/prebuilds/darwin-arm64/pty.node', magic: PLATFORM_MAGIC.darwin },
        { relPath: 'node_modules/node-pty/prebuilds/win32-x64/pty.node', magic: PLATFORM_MAGIC.win32 },
        { relPath: 'node_modules/better-sqlite3/build/Release/better_sqlite3.node', magic: PLATFORM_MAGIC.win32 },
      ],
    })
    const info = verifyPackedZip({ zipPath, platformTag: 'win32-x64', expectedVersion: '3.7.0' })
    assert.equal(info.platform, 'win32-x64')
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
