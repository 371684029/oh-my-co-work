/** 5.9.0 RAR-08：成员步适配回落时轻提示（流程轨另有摘要）。 */
import { watch } from 'vue'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { t } from '../../../i18n/index.js'

export function registerAdaptFallbackToastWatcher({ stopWatchers, detail, activeId }) {
  const seen = new Set()
  stopWatchers.push(
    watch(
      () =>
        detail.value?.nodes?.map((n) => {
          const inp = n?.input && typeof n.input === 'object' ? n.input : {}
          return `${n.id}:${inp.adaptFallback}:${inp.adaptReason || ''}`
        }) || [],
      () => {
        const sid = activeId.value
        if (!sid || !detail.value?.nodes) return
        for (const n of detail.value.nodes) {
          const inp = n?.input && typeof n.input === 'object' ? n.input : {}
          if (!inp.adapt || !inp.adaptFallback) continue
          const key = `${sid}:${n.id}`
          if (seen.has(key)) continue
          seen.add(key)
          const reason = inp.adaptReason ? String(inp.adaptReason).trim() : ''
          const msg = reason
            ? t('workbench.adaptFallbackToast', { reason })
            : t('workbench.flowRail.adaptFallback')
          ElMessage.warning({ message: msg, duration: 5000 })
        }
      },
    ),
  )
}
