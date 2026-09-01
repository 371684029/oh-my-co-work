// ESLint flat config (3.8.2) — 从宽起步：正确性规则 0 error，风格类不进 lint。
// - server/ / shared/ / scripts/ / 根配置：Node 全局
// - web/src/：浏览器全局；.vue 用 eslint-plugin-vue 的 essential 集
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'packages/**',
      'data/**',
      'coverage/**',
      'server/test/fixtures/**',
      '*.min.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'shared/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.js', '*.mjs', 'start.mjs', '**/vite.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['web/src/**/*.js', 'web/test/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  ...pluginVue.configs['flat/essential'].map((config) => ({
    ...config,
    files: ['web/src/**/*.vue'],
  })),
  {
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      // 测试文件里的断言参数与占位形参从宽
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // 视图组件名沿用现状（Workbench / About / Groups…），改名会牵动路由与导入
    files: ['web/src/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // 终端/ANSI 处理是本仓库的业务域：控制字符正则属正常用法
    files: ['shared/**/*.js', 'server/src/terminal/**/*.js', 'server/src/consoleEncoding.js'],
    rules: {
      'no-control-regex': 'off',
    },
  },
  {
    // 遗留 HTA 控制窗模板里的 \" 转义按原样保留（模板字面量中实际渲染为 "，历史上即如此）
    files: ['server/src/processRegistry.js'],
    rules: {
      'no-useless-escape': 'off',
    },
  },
  {
    files: ['server/test/**/*.js', 'web/test/**/*.mjs', 'scripts/selftest-*.mjs'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
]
