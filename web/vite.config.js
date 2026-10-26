import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// 按需引入 Element Plus：JS 与 CSS 都只进用到的组件。
// 注意不要用 manualChunks 把 element-plus 归并成一个大包——那样会把
// resolver 注入的「按需 CSS」重新拼回整包（vite 会把散落 CSS 收进同名 css 文件）。
// 取而代之：把 element-plus 放进异步 chunk，首屏不加载。
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({ resolvers: [ElementPlusResolver({ importStyle: 'css' })] }),
    Components({ resolvers: [ElementPlusResolver({ importStyle: 'css' })] }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@xterm')) return 'xterm'
          if (id.includes('node_modules/highlight.js')) return 'highlight'
          if (id.includes('node_modules/markdown-it')) return 'markdown-it'
          if (id.includes('node_modules/@vueuse')) return 'vueuse'
          if (id.includes('node_modules/pinyin-pro')) return 'fuzzy'
          if (id.includes('node_modules/pinia') || id.includes('node_modules/vue-router')) {
            return 'vue-vendor'
          }
          // 不要把整个 element-plus 归并成单个 chunk：
          // message/message-box 等按需入口会被拖进首屏。只合并 locale 等零散子路径。
          if (id.includes('node_modules/element-plus/es/locale')) return 'element-plus-locale'
          if (id.includes('node_modules/element-plus/es/hooks')) return 'element-plus-hooks'
          if (id.includes('node_modules/element-plus/es/utils')) return 'element-plus-utils'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@acw/shared': path.resolve(__dirname, '../shared/index.js'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3780', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:3780', ws: true },
    },
  },
})
