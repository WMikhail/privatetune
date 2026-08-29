import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/privatetune/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-maskable.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PrivateTune — приватный тюнер для гитары и баса',
        short_name: 'PrivateTune',
        description: 'Приватный офлайн-тюнер для гитары и баса',
        theme_color: '#090b0d',
        background_color: '#090b0d',
        display: 'standalone',
        orientation: 'any',
        lang: 'ru',
        start_url: '/privatetune/',
        scope: '/privatetune/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//]
      },
      devOptions: { enabled: false }
    })
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  build: { target: 'es2022' }
})
