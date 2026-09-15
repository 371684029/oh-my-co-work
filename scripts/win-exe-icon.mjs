/**
 * 给 Windows PE（Electron 改名后的 oh-my-co-work.exe）写入应用 ICO。
 * 交叉打包在 Linux 上也能跑（resedit）。
 */
import fs from 'node:fs'
import * as ResEdit from 'resedit'

export function stampWinExeIcon(exePath, icoPath) {
  if (!fs.existsSync(exePath)) throw new Error(`缺少 exe: ${exePath}`)
  if (!fs.existsSync(icoPath)) throw new Error(`缺少 ico: ${icoPath}`)
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true })
  const res = ResEdit.NtExecutableResource.from(exe)
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath))
  const lang = 1033
  const icons = iconFile.icons.map((item) => item.data)
  let groupId = 1
  for (const entry of res.entries) {
    if (entry.type === 14) {
      groupId = entry.id
      break
    }
  }
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, icons)
  res.outputResource(exe, true)
  fs.writeFileSync(exePath, Buffer.from(exe.generate()))
}
