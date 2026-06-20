import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: '/zhenzhen/',
  plugins: [
    basicSsl(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        runtimeCaching: [
          // ⚠️ 不拦截 API 调用 — 让浏览器直接处理 POST 请求
        ],
      },
      manifest: {
        name: '臻臻 — AI私人教练',
        short_name: '臻臻',
        description: '你的AI私人健身教练',
        theme_color: '#080808',
        background_color: '#080808',
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
    proxy: {
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
        configure: (proxy) => {
          proxy.on('error', (err) => console.error('[proxy] deepseek error:', err));
          proxy.on('proxyReq', (proxyReq, req) => {
            // 透传 Authorization header
            if (req.headers?.authorization) {
              proxyReq.setHeader('authorization', req.headers.authorization);
            }
          });
        },
      },
    },
  },
})
