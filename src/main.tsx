import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

// 注册 Service Worker，实现离线缓存
registerSW({
  onNeedRefresh() {
    // 新版本可用时自动更新
    window.location.reload()
  },
  onOfflineReady() {
    console.log('臻臻已可以离线使用')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
