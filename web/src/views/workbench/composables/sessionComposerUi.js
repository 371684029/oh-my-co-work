/** Composer placeholder when a gate message is pending. */

import { t } from '../../../i18n/index.js'

export function composerPlaceholderForGate(g) {
  if (!g) return t('workbench.composer.placeholderIdle')
  const mode = g.content?.mode
  if (mode === 'session_start') {
    if (g.content?.callArgs || g.content?.captureParams === false) {
      return t('workbench.composer.placeholderSessionStartOptional')
    }
    return g.content?.captureParams
      ? t('workbench.composer.placeholderSessionStartWithParams')
      : t('workbench.composer.placeholderSessionStartNote')
  }
  if (mode === 'human_input' || mode === 'need_params') {
    return g.content?.captureParams || mode === 'need_params'
      ? t('workbench.composer.placeholderHumanParams')
      : t('workbench.composer.placeholderHumanText')
  }
  if (mode === 'adapter_question') {
    return t('workbench.composer.placeholderAdapter')
  }
  if (mode === 'interrupted') {
    return t('workbench.composer.placeholderInterrupted')
  }
  const gateTitle = g.content?.text || g.content?.title
  if (gateTitle) {
    return t('workbench.composer.placeholderGateWithTitle').replace('{title}', gateTitle)
  }
  return t('workbench.composer.placeholderGateDefault')
}

export function composerToolbarHintForGate(gate) {
  if (gate) {
    const mode = gate.content?.mode
    if (mode === 'human_input' || mode === 'need_params') return t('workbench.composer.toolbarHuman')
    if (mode === 'session_start') return t('workbench.composer.toolbarSessionStart')
    if (mode === 'interrupted') return t('workbench.composer.toolbarInterrupted')
    if (mode === 'adapter_question') return t('workbench.composer.toolbarAdapter')
    return t('workbench.composer.toolbarGate')
  }
  return t('workbench.composer.toolbarIdle')
}

export function showComposerHintIForGate(gate) {
  if (!gate) return true
  const mode = gate.content?.mode
  return ['session_start', 'human_input', 'need_params', 'adapter_question', 'interrupted'].includes(
    mode,
  )
}

export function composerFooterHintForGate(gate) {
  if (gate) {
    return t('workbench.composer.footerGate')
  }
  return t('workbench.composer.footerIdle')
}
