import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api/schedule': {
        target: 'https://devoxxfr2026.cfp.dev',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/schedule/, '/api/public/schedules'),
      },
    },
  },
})
