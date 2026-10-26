import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aboutT,
  aboutToast,
  aboutConfirm,
  aboutDefaultTagline,
  aboutDesktopTag,
  aboutFoundNew,
  aboutDownloadOk,
  aboutLastBackup,
  aboutBackupOptionLabel,
  aboutRestoreConfirmBody,
} from '../src/composables/settingsAboutCopy.js'

test('settingsAboutCopy returns about page copy', () => {
  assert.match(aboutT('title'), /关于与更新|About/)
  assert.match(aboutT('noUpdateUrl'), /更新地址|update URL/i)
  assert.ok(aboutDefaultTagline())
  assert.match(aboutToast('backupOk'), /备份|Backup/i)
})

test('about helpers substitute values', () => {
  assert.match(aboutDesktopTag('win32'), /win32/)
  assert.match(aboutFoundNew('1.2.3'), /1\.2\.3/)
  assert.match(aboutDownloadOk('1.2.3', 12), /12/)
  assert.match(aboutLastBackup('b.tar.gz'), /b\.tar\.gz/)
  assert.match(aboutBackupOptionLabel('b.tar.gz', true, '1 MB'), /b\.tar\.gz/)
  assert.match(aboutRestoreConfirmBody('b.tar.gz'), /b\.tar\.gz/)
  assert.match(aboutConfirm('restoreOk'), /确认|Confirm/i)
})
