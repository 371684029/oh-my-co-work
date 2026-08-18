import { createRouter, createWebHistory } from 'vue-router'
import Workbench from './views/Workbench.vue'
import SettingsLayout from './views/settings/SettingsLayout.vue'
import Members from './views/settings/Members.vue'
import Groups from './views/settings/Groups.vue'
import Support from './views/settings/Support.vue'
import About from './views/settings/About.vue'
import Shortcuts from './views/settings/Shortcuts.vue'
import Prefs from './views/settings/Prefs.vue'
import GrokSetup from './views/settings/GrokSetup.vue'

const routes = [
  { path: '/', redirect: '/workbench' },
  { path: '/workbench', component: Workbench },
  { path: '/workbench/:sessionId', component: Workbench, props: true },
  {
    path: '/settings',
    component: SettingsLayout,
    redirect: '/settings/members',
    children: [
      { path: 'members', component: Members },
      { path: 'groups', component: Groups },
      { path: 'shortcuts', component: Shortcuts },
      { path: 'prefs', component: Prefs },
      { path: 'grok', component: GrokSetup },
      { path: 'support', component: Support },
      { path: 'about', component: About },
    ],
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
