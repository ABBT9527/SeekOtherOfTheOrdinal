import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/ordinal-game/',
  server: {
    port: 5173,
    host: true
  }
})
