import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { manifest } from './pwa.config.ts'
import { theme } from './src/theme.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // The look of the components follows the Figma design (src/theme.ts)
    ui({ ui: theme }),
    VitePWA({
      registerType: 'autoUpdate', // a new version replaces the old one by itself
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest,
      workbox: {
        // The app shell works offline; every route is the same page (the router decides)
        navigateFallback: '/index.html',
        // The API (another origin) is never cached: companies and robots must be live
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/__tests__/**/*.spec.ts'],
  },
})
