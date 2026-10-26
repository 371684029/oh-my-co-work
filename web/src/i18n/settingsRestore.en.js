/** DSK-08: Settings → Restore center page (en-US). */
export const settingsRestoreEn = {
  title: 'Restore center',
  lead: 'One entry point for refine backups and per-step git snapshots. Step rollback happens in the workbench flow rail after expanding a node.',
  membersHeading: 'Member refine backups',
  noBackup: 'No backup',
  restoreRefine: 'Restore to pre-refine',
  membersLink: 'Member settings',
  sessionsHeading: 'Recent sessions · step changes',
  nodeLine: 'Step {step} · {title} — {n} files',
  loading: 'Loading…',
  empty: 'Nothing to restore',
  toast: {
    loadFail: 'Load failed',
    restored: 'Refine source files restored',
    restoreFail: 'Restore failed',
  },
  confirm: {
    body: 'This restores the source files changed by refine to the backup taken before saving. Continue?',
    title: 'Restore refine',
  },
}
