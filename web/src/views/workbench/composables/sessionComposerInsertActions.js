/** Composer @ / # picker insert (FE-01 extract from useSessionDetail). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { useComposerStore } from '../../../stores/composer.js'
import { stripTrailingHashTrigger } from './sessionComposerInput.js'
import { hashItemEmptyInsertMessage } from './sessionWorkbenchFeedbackUi.js'

export function createSessionComposerInsertActions({
  readSenderText,
  readSenderTextRaw,
  replaceSenderText,
}) {
  /** 把当前 @query 替换为 @显示名  */
  async function insertAtMember(m) {
    if (!m) return
    const name = m.display_name || m.name
    const text = readSenderText()
    const replaced = text.replace(/(^|[\s])@([^\s@]*)$/, `$1@${name} `)
    const next = replaced === text ? `${text}@${name} ` : replaced
    useComposerStore().atOpen = false
    useComposerStore().atQuery = ''
    await replaceSenderText(next)
  }

  /**
   * 选中项：去掉 # 唤起段，只插入正文（不含 #）。
   */
  async function insertHashItem(h) {
    if (!h) return
    const insert = String(h.value || '').trim()
    const raw = readSenderTextRaw()
    let stripped = stripTrailingHashTrigger(raw)
    // 面板已开但 model 尚未带上 #：仍按触发态剥离
    if (useComposerStore().hashOpen && stripped === raw.replace(/[ \t]+$/u, '')) {
      stripped = stripTrailingHashTrigger(`${stripped}#`)
    }
    useComposerStore().hashOpen = false
    useComposerStore().hashQuery = ''
    if (!insert) {
      await replaceSenderText(stripped)
      ElMessage.warning(hashItemEmptyInsertMessage(h.name || h.label))
      return
    }
    await replaceSenderText(stripped ? `${stripped} ${insert}` : insert)
  }

  return { insertAtMember, insertHashItem }
}
