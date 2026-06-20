import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

// 注册 Service Worker，实现离线缓存
// 新版本不会自动刷新 — 改为提示用户手动确认
const updateSW = registerSW({
  onNeedRefresh() {
    // 存储更新函数，让 UpdateBanner 组件触发
    (window as any).__zhenzhenUpdateSW = updateSW;
    (window as any).__zhenzhenHasUpdate = true;
    // 触发自定义事件通知 React 组件
    window.dispatchEvent(new CustomEvent('zhenzhen:sw-update'));
  },
  onOfflineReady() {
    console.log('臻臻已可以离线使用');
  },
  onRegisterError(e) {
    console.error('SW 注册失败:', e);
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
