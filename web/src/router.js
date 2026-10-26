/**
 * FE-03：设置/文档等非首屏路由懒加载，首屏只拉 Workbench（默认落地页，同步引入防白屏）。
 */
import { createRouter, createWebHistory } from 'vue-router'
import Workbench from './views/Workbench.vue'

const routes = [
  { path: '/', redirect: '/workbench' },
  { path: '/workbench', component: Workbench },
  { path: '/workbench/:sessionId', component: Workbench, props: true },
  {
    path: '/docs',
    component: () => import('./views/docs/DocsHub.vue'),
  },
  {
    path: '/settings',
    component: () => import('./views/settings/SettingsLayout.vue'),
    redirect: '/settings/members',
    children: [
      { path: 'members', component: () => import('./views/settings/Members.vue') },
      { path: 'groups', component: () => import('./views/settings/Groups.vue') },
      { path: 'shortcuts', component: () => import('./views/settings/Shortcuts.vue') },
      { path: 'snippets', component: () => import('./views/settings/PromptSnippets.vue') },
      { path: 'wizard', component: () => import('./views/settings/SetupWizard.vue') },
      { path: 'prefs', component: () => import('./views/settings/Prefs.vue') },
      { path: 'restore', component: () => import('./views/settings/RestoreCenter.vue') },
      { path: 'grok', component: () => import('./views/settings/GrokSetup.vue') },
      { path: 'support', component: () => import('./views/settings/Support.vue') },
      { path: 'about', component: () => import('./views/settings/About.vue') },
    ],
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
