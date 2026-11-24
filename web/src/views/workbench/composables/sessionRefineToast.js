/** NTF-R：终端等长任务节点炼化完成后轻量 toast */
import { watch } from 'vue'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { t } from '../../../i18n/index.js'

function memberUsesTerminal(member) {
  const cfg = member?.config && typeof member.config === 'object' ? member.config : {}
  const script = cfg.script && typeof cfg.script === 'object' ? cfg.script : {}
  return !!script.terminal || String(member?.kind || '').toLowerCase() === 'agent'
}

export function registerRefineCompleteToastWatcher({ stopWatchers, detail, activeId, members }) {
  const seen = new Set()
  stopWatchers.push(
    watch(
      () =>
        detail.value?.nodes?.map((n) => {
          const r = n?.input?.refine
          return `${n.id}:${n.status}:${n.finished_at}:${r?.enabled}:${r?.refined}`
        }) || [],
      () => {
        const sid = activeId.value
        if (!sid || !detail.value?.nodes) return
        for (const n of detail.value.nodes) {
          if (n.status !== 'succeeded' || !n.finished_at) continue
          const refine = n?.input?.refine
          if (!refine?.enabled) continue
          const key = `${sid}:${n.id}:${n.finished_at}`
          if (seen.has(key)) continue
          const mem = (members.value || []).find((m) => m.id === n.member_id)
          if (!memberUsesTerminal(mem)) continue
          seen.add(key)
          ElMessage.success({
            message: t('workbench.refineCompleteToast'),
            duration: 5000,
          })
        }
      },
    ),
  )
}