/**
 * Built-in flow templates (5.3.0 REU-03).
 */
export const BUILTIN_TEMPLATES = [
  {
    id: 'code-review',
    title: '代码评审',
    description: '拉取变更、走读、输出评审清单（示例流程）',
    steps: [
      { title: '说明评审范围', type: 'human', captureParams: true },
      { title: '执行评审', type: 'member', memberId: null, gate: true, refine: true },
      { title: '汇总', type: 'human', captureParams: false },
    ],
  },
  {
    id: 'release-check',
    title: '发版检查',
    description: '构建、测试、变更说明与发布闸门',
    steps: [
      { title: '发版参数', type: 'human', captureParams: true },
      { title: '跑检查脚本', type: 'member', memberId: null, gate: true },
      { title: '确认发布', type: 'human', gate: true },
    ],
  },
  {
    id: 'daily-digest',
    title: '日报汇总',
    description: '收集输入并生成 Markdown 日报',
    steps: [
      { title: '今日要点', type: 'human', captureParams: true },
      { title: '整理日报', type: 'member', memberId: null, gate: true, refine: true },
    ],
  },
]

export function listBuiltinTemplates() {
  return BUILTIN_TEMPLATES.map(({ id, title, description }) => ({
    id,
    title,
    description,
  }))
}
