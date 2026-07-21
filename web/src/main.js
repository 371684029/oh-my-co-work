import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import ElementPlusX from 'vue-element-plus-x'
import 'vue-element-plus-x/styles/index.css'
import App from './App.vue'
import router from './router'
import './styles.css'

const app = createApp(App)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
// 基础 UI：Element Plus；AI 对话等：优先 Element-Plus-X
app.use(ElementPlus, { locale: zhCn })
app.use(ElementPlusX)
app.use(router)
app.mount('#app')
