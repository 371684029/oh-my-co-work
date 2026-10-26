/** Ctrl/Cmd+1/2 agent-switch hotkeys for the furnace workspace (FE-01 extract from FurnaceWorkspace.vue). */
import {
  furnaceAgentFromHotkey,
  isEventWithinFurnaceRoot,
  shouldIgnoreFurnaceHotkeyTarget,
} from '../furnaceWorkspaceUi.js'

export function createFurnaceAgentHotkeys({ workspaceRoot, setActiveAgent }) {
  function onKeyDown(e) {
    if (!isEventWithinFurnaceRoot(workspaceRoot.value, e)) return
    if (shouldIgnoreFurnaceHotkeyTarget(e.target)) return
    if (!(e.metaKey || e.ctrlKey)) return
    const agent = furnaceAgentFromHotkey(e.key)
    if (!agent) return
    e.preventDefault()
    setActiveAgent(agent)
  }

  return { onKeyDown }
}
