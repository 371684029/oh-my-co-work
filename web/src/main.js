import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { ElConfigProvider } from 'element-plus/es/components/config-provider/index.mjs'
// 按需引入 Element Plus（FE-03）：不 import 整包、不 import dist/index.css。
// 组件与样式由 unplugin ElementPlusResolver 在编译期按用到的组件注入。
// 命令式 API（ElMessage / ElMessageBox / ElLoading / ElNotification）自备样式。
import 'element-plus/es/components/config-provider/style/css'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/loading/style/css'
import 'element-plus/es/components/notification/style/css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import { getLocale } from './i18n/index.js'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import ElementPlusX from 'vue-element-plus-x'
import 'vue-element-plus-x/styles/index.css'
import App from './App.vue'
import router from './router'
import './styles.css'
import { setupBrowserLifecycle } from './lifecycle.js'

const locale = getLocale() === 'en-US' ? en : zhCn
const app = createApp({
  // ElConfigProvider 只下发 locale，不注册任何组件，因此不会把整包 JS 拖回来
  render: () => h(ElConfigProvider, { locale }, () => h(App)),
})
const pinia = createPinia()

// FE-03：仅注册实际用到的图标，避免全量 icons 进 index chunk
const usedIcons = {
  ArrowDown: ElementPlusIconsVue.ArrowDown,
  ArrowLeft: ElementPlusIconsVue.ArrowLeft,
  ArrowRight: ElementPlusIconsVue.ArrowRight,
  ArrowUp: ElementPlusIconsVue.ArrowUp,
  Bell: ElementPlusIconsVue.Bell,
  ChatDotRound: ElementPlusIconsVue.ChatDotRound,
  ChatLineRound: ElementPlusIconsVue.ChatLineRound,
  Check: ElementPlusIconsVue.Check,
  Clock: ElementPlusIconsVue.Clock,
  Close: ElementPlusIconsVue.Close,
  CopyDocument: ElementPlusIconsVue.CopyDocument,
  Delete: ElementPlusIconsVue.Delete,
  Document: ElementPlusIconsVue.Document,
  Download: ElementPlusIconsVue.Download,
  Edit: ElementPlusIconsVue.Edit,
  Expand: ElementPlusIconsVue.Expand,
  FolderOpened: ElementPlusIconsVue.FolderOpened,
  InfoFilled: ElementPlusIconsVue.InfoFilled,
  Link: ElementPlusIconsVue.Link,
  Loading: ElementPlusIconsVue.Loading,
  Lock: ElementPlusIconsVue.Lock,
  Menu: ElementPlusIconsVue.Menu,
  Minus: ElementPlusIconsVue.Minus,
  MoreFilled: ElementPlusIconsVue.MoreFilled,
  Operation: ElementPlusIconsVue.Operation,
  Plus: ElementPlusIconsVue.Plus,
  QuestionFilled: ElementPlusIconsVue.QuestionFilled,
  Refresh: ElementPlusIconsVue.Refresh,
  RefreshLeft: ElementPlusIconsVue.RefreshLeft,
  Search: ElementPlusIconsVue.Search,
  Setting: ElementPlusIconsVue.Setting,
  Star: ElementPlusIconsVue.Star,
  StarFilled: ElementPlusIconsVue.StarFilled,
  SuccessFilled: ElementPlusIconsVue.SuccessFilled,
  Switch: ElementPlusIconsVue.Switch,
  Unlock: ElementPlusIconsVue.Unlock,
  Upload: ElementPlusIconsVue.Upload,
  User: ElementPlusIconsVue.User,
  WarningFilled: ElementPlusIconsVue.WarningFilled,
}
for (const [key, component] of Object.entries(usedIcons)) {
  if (component) app.component(key, component)
}
// 基础 UI：Element Plus 组件按需注册（unplugin resolver）；locale 经 ElConfigProvider
app.use(pinia)
app.use(ElementPlusX)
app.use(router)
app.mount('#app')

setupBrowserLifecycle().catch(() => {})
