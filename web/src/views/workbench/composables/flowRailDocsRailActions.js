/** Docs rail list / read / export actions for FlowRail (FE-01 extract from FlowRail.vue). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import {
  flowRailDocsExportFailedMessage,
  flowRailDocsExportSuccessMessage,
  flowRailDocsListFailedMessage,
  flowRailDocsNoGroupMessage,
  flowRailDocsReadFailedMessage,
} from './flowRailFeedbackUi.js'

export function createFlowRailDocsRailActions({
  activeId,
  detail,
  api,
  getDocsList,
  recordDocsOpen,
  railDocFiles,
  railDocsLoading,
  selectedDocName,
  selectedDocContent,
  selectedDocLoading,
  exportingRailDocs,
  notify = ElMessage,
}) {
  let currentFileReqId = 0
  let currentListReqId = 0

  async function loadRailDocs() {
    const reqSessionId = activeId.value
    const reqId = ++currentListReqId
    if (!reqSessionId) {
      railDocFiles.value = []
      selectedDocName.value = ''
      selectedDocContent.value = ''
      return
    }
    railDocsLoading.value = true
    try {
      const res = await getDocsList('group')
      if (reqId !== currentListReqId || reqSessionId !== activeId.value) return
      let found = null
      for (const g of res?.groups || []) {
        const s = (g.sessions || []).find((s) => s.sessionId === reqSessionId)
        if (s) {
          found = s
          break
        }
      }
      railDocFiles.value = found?.files || []
      if (railDocFiles.value.length && (!selectedDocName.value || !railDocFiles.value.some((f) => f.name === selectedDocName.value))) {
        await onSelectRailDoc(railDocFiles.value[0].name)
      } else if (!railDocFiles.value.length) {
        selectedDocName.value = ''
        selectedDocContent.value = ''
      }
    } catch (e) {
      if (reqId === currentListReqId && reqSessionId === activeId.value) {
        notify.warning(flowRailDocsListFailedMessage(e))
      }
    } finally {
      if (reqId === currentListReqId) {
        railDocsLoading.value = false
      }
    }
  }

  async function onSelectRailDoc(name) {
    const reqSessionId = activeId.value
    const reqId = ++currentFileReqId
    if (!reqSessionId || !name) return
    selectedDocName.value = name
    selectedDocLoading.value = true
    try {
      const res = await api.docs.file(reqSessionId, name)
      if (reqId !== currentFileReqId || reqSessionId !== activeId.value) return
      selectedDocContent.value = res?.content || ''
      recordDocsOpen({
        sessionId: reqSessionId,
        name,
        label: railDocFiles.value.find((f) => f.name === name)?.title || name,
        sessionTitle: detail.value?.session?.title || '',
      })
    } catch (e) {
      if (reqId === currentFileReqId && reqSessionId === activeId.value) {
        notify.error(flowRailDocsReadFailedMessage(e))
      }
    } finally {
      if (reqId === currentFileReqId) {
        selectedDocLoading.value = false
      }
    }
  }

  async function onExportRailGroupDocs() {
    if (!detail.value?.session?.group_id) {
      notify.warning(flowRailDocsNoGroupMessage())
      return
    }
    exportingRailDocs.value = true
    try {
      await api.docs.downloadDocsExport(detail.value.session.group_id)
      notify.success(flowRailDocsExportSuccessMessage())
    } catch (e) {
      notify.error(flowRailDocsExportFailedMessage(e))
    } finally {
      exportingRailDocs.value = false
    }
  }

  return { loadRailDocs, onSelectRailDoc, onExportRailGroupDocs }
}
