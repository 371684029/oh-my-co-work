/**
 * 6.8 RFV：试跑失败 → 熔炉炼化 contextual prompt
 */
import path from 'node:path'
import { collectAdaptSourcePaths } from './adaptBackup.js'
import { buildFurnaceRefineSkillPrompt, buildRefineSkillPrompt } from './agentRefine.js'
import { enrichScriptConfig } from './runners/scriptMemberConfig.js'
import { getScriptWorkDir } from './runners/scriptWorkDir.js'
import { planRefineOnMemberSave } from './refineSource.js'

const CHECK_LABELS = {
  probe_run: '脚本探针',
  exit_code: '退出码',
  refine_stdout_heading: 'stdout 炼化标题',
  refine_echo_format: '回声炼化规格',
}

function memberLabel(member) {
  return String(member?.display_name || member?.name || member?.id || '').trim() || '成员'
}

function scriptSummary(member) {
  const paths = collectAdaptSourcePaths(member)
  const script = enrichScriptConfig(member?.config?.script || member?.config || {})
  let workDir = ''
  try {
    workDir = getScriptWorkDir(script) || ''
  } catch {
    workDir = String(script?.scriptWorkDir || script?.scriptDir || member?.work_folder || '').trim()
  }
  const cmd = String(script?.command || script?.filePath || script?.path || '').trim()
  return { paths, workDir, cmd }
}

/**
 * @param {object|null|undefined} member
 * @param {{ checks?: object[], ok?: boolean, skipped?: boolean, reason?: string, stdoutPreview?: string, stderrPreview?: string }|null} verify
 * @returns {string}
 */
export function formatVerifyFailureBrief(member, verify = null) {
  const v =
    verify && typeof verify === 'object'
      ? verify
      : member?.config?.refine?.verifyLast && typeof member.config.refine.verifyLast === 'object'
        ? member.config.refine.verifyLast
        : null
  if (!v || v.ok) return ''
  const lines = []
  if (v.skipped) {
    lines.push(`试跑已跳过：${v.reason || '未知原因'}`)
  }
  for (const c of v.checks || []) {
    if (c.ok) continue
    const label = CHECK_LABELS[c.id] || c.id || '检查项'
    let detail = String(c.detail || '').trim()
    if (c.id === 'probe_run' && detail === 'EXIT') detail = '进程非零退出（EXIT）'
    if (c.id === 'exit_code' && /非成功/.test(detail)) detail = detail.replace('（非成功）', '（进程非零退出）')
    lines.push(`${label}：${detail || '未通过'}`)
  }
  if (!lines.length) lines.push('试跑未通过')
  const out = String(v.stdoutPreview || '').trim()
  const err = String(v.stderrPreview || '').trim()
  if (out) lines.push('', 'stdout（节选）：', out.slice(0, 400))
  if (err) lines.push('', 'stderr（节选）：', err.slice(0, 200))
  return lines.join('\n').trim()
}

function normalizeTarget(raw) {
  const t = String(raw || 'grok').trim().toLowerCase()
  if (t === 'cursor') return 'cursor'
  if (t === 'external') return 'external'
  return 'grok'
}

/**
 * @param {object} member
 * @param {{ target?: string, sessionId?: string }} opts
 */
export function buildMemberRefineVerifyPrompt(member, opts = {}) {
  if (!member) throw Object.assign(new Error('成员不存在'), { code: 'NOT_FOUND' })
  const target = normalizeTarget(opts.target)
  const name = memberLabel(member)
  const refine = member?.config?.refine || {}
  const verifyLast = refine.verifyLast || null
  const failBrief = formatVerifyFailureBrief(member, verifyLast)
  const { paths, workDir, cmd } = scriptSummary(member)
  const plan = planRefineOnMemberSave(member)
  const fileLine =
    (plan.files || [])
      .slice(0, 3)
      .map((f) => f.path)
      .filter(Boolean)
      .join('；') || paths.slice(0, 3).join('；')

  const diffUrl = `/docs?pane=refine&memberId=${encodeURIComponent(member.id)}`
  const blocks = []

  blocks.push(
    `【炼化试跑失败 · ${name}】`,
    '',
    '请修复成员脚本以满足 ACW-REFINE 契约，并在设置中保存后重新「试跑验证」。',
    '',
    '## 试跑摘要',
    failBrief || '（无详细记录，请在本机执行试跑验证）',
    '',
    '## 成员',
    `- 名称：${name}`,
    `- 脚本：${cmd || '（未配置）'}`,
    `- 工作目录：${workDir || '（未配置）'}`,
    fileLine ? `- 炼化相关源文件：${fileLine}` : '',
    '',
    '## 快捷命令',
    `- node acw-ctl.mjs verify-member --member "${name}"`,
    `- 文档中心 diff：${diffUrl}`,
  )

  if (target === 'external') {
    blocks.push(
      '',
      '## 外部 Agent（写群报告）',
      buildRefineSkillPrompt({ sessionId: opts.sessionId }),
      '',
      '修完脚本后：保存成员设置 → 试跑通过 → 再用 POST /api/docs/refine 记录结论。',
    )
  } else {
    const agentLine =
      target === 'cursor'
        ? '目标：本机 **Cursor CLI 熔炉**（Skills 未镜像时请对照仓库 skills/furnace-refine-skill/SKILL.md）。'
        : '目标：本机 **Grok 熔炉**（Skill：`.grok/skills/furnace-refine-skill`）。'
    blocks.push('', '## 熔炉炼化', agentLine, '', buildFurnaceRefineSkillPrompt())
  }

  blocks.push(
    '',
    '## 收尾',
    '1. backup-source（若尚未备份）',
    '2. 改源并保存成员（触发炼化契约）',
    '3. 设置 → 试跑验证，或通过 acw-ctl verify-member',
    '4. 仍失败 → 还原中心 /「还原到炼化前」',
  )

  const prompt = blocks.filter((line) => line !== undefined).join('\n').trim()

  return {
    target,
    prompt,
    member: {
      id: member.id,
      name,
      displayName: member.display_name || member.name,
      filePath: paths[0] ? path.resolve(paths[0]) : '',
      workDir: workDir ? path.resolve(workDir) : '',
      command: cmd,
    },
    verify: verifyLast,
    verifyFailed: !!refine.verifyFailed,
    diffUrl,
    skillRefs:
      target === 'external'
        ? ['agent-refine-skill']
        : ['furnace-refine-skill', 'furnace-acw-ctl'],
  }
}