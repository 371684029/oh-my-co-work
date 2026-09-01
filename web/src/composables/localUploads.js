import { ElMessage } from 'element-plus'

/**
 * 本地文件选择 / 上传流程的单一来源。
 * Workbench（会话附件）与 FurnaceWorkspace（熔炉 inbox）共用：
 * 目标校验、上传接口、文案经 config 注入，行为保持不变。
 *
 * @param {object} config
 * @param {import('vue').Ref} config.pendingFiles 待发送附件列表（外部持有的响应式 ref）
 * @param {import('vue').Ref} config.uploading 上传中标记（外部持有的响应式 ref，供发送防重读）
 * @param {() => string} config.getTargetId 会话 id（空则视为未选择）
 * @param {(id: string, files: File[]) => Promise<{ files: Array }>} config.upload 上传接口
 * @param {string} config.noTargetAddMessage 未选择会话时 addLocalFiles 的提示
 * @param {(n: number) => string} config.successMessage 成功文案（按文件数）
 * @param {() => void} [config.onStart] addLocalFiles 开头钩子（furnace 用于清 uploadError）
 * @param {(e: Error) => string} [config.onError] 错误处理，返回要 toast 的文案
 * @param {string} [config.tooManyMessage]
 * @param {number} [config.max]
 */
export function useLocalUploads(config) {
  const {
    pendingFiles,
    uploading,
    getTargetId,
    upload,
    noTargetAddMessage,
    successMessage,
    onStart,
    onError,
    tooManyMessage = '一次最多 8 个附件',
    max = 8,
  } = config

  async function addLocalFiles(fileList) {
    onStart?.()
    if (!getTargetId()) {
      ElMessage.warning(noTargetAddMessage)
      return
    }
    const arr = [...fileList].filter(Boolean)
    if (!arr.length) return
    if (pendingFiles.value.length + arr.length > max) {
      ElMessage.warning(tooManyMessage)
      return
    }
    uploading.value = true
    try {
      const r = await upload(getTargetId(), arr)
      const files = r.files || []
      pendingFiles.value = [...pendingFiles.value, ...files]
      ElMessage.success(successMessage(files.length))
    } catch (e) {
      const msg = onError ? onError(e) : e.message
      ElMessage.error(msg)
    } finally {
      uploading.value = false
    }
  }

  function onFileInputChange(e) {
    const files = e.target?.files
    if (files?.length) addLocalFiles(files)
    if (e.target) e.target.value = ''
  }

  function removePending(i) {
    pendingFiles.value.splice(i, 1)
  }

  return { addLocalFiles, onFileInputChange, removePending }
}
