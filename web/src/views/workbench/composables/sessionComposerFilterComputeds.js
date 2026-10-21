/** Composer slash/@ picker filter lists (FE-01). */
import { computed } from 'vue'
import { useComposerStore } from '../../../stores/composer.js'

export function createSessionComposerFilterComputeds({
  slashCommands,
  members,
  getSlashQuery = () => useComposerStore().slashQuery,
  getAtQuery = () => useComposerStore().atQuery,
}) {
  const filteredSlashCmds = computed(() => {
    const q = (getSlashQuery() || '').toLowerCase()
    const list = slashCommands.value.filter((c) => c.enabled !== false)
    if (!q) return list
    return list.filter(
      (c) =>
        c.slash.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q),
    )
  })

  const filteredAtMembers = computed(() => {
    const q = (getAtQuery() || '').toLowerCase().trim()
    const list = members.value || []
    if (!q) return list
    return list.filter(
      (m) =>
        String(m.display_name || '')
          .toLowerCase()
          .includes(q) ||
        String(m.name || '')
          .toLowerCase()
          .includes(q) ||
        String(m.config?.description || '')
          .toLowerCase()
          .includes(q),
    )
  })

  return { filteredSlashCmds, filteredAtMembers }
}
