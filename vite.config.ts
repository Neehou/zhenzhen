import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/zhenzhen/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: '臻臻 — AI私人教练',
        short_name: '臻臻',
        description: '你的AI私人健身教练',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/zhenzhen/',
        scope: '/zhenzhen/',
        icons: [
          {
            src: '/zhenzhen/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
          {
            src: '/zhenzhen/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/zhenzhen/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
