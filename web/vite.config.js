import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@acw/shared': path.resolve(__dirname, '../shared/index.js'),
    },
  },
  server: {
    // 显式绑 IPv4，避免 Windows 上只监听 [::1] 导致 127.0.0.1 打不开
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3780', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:3780', ws: true },
    },
  },
})
