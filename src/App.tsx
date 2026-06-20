import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Log from './pages/Log';
import Settings from './pages/Settings';

// SW 更新提示条 — 有新版本时在底部显示，用户手动点击更新
function UpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    // 检查 SW 是否发出了更新通知
    if ((window as any).__zhenzhenHasUpdate) {
      setHasUpdate(true);
    }
    const handler = () => setHasUpdate(true);
    window.addEventListener('zhenzhen:sw-update', handler);
    return () => window.removeEventListener('zhenzhen:sw-update', handler);
  }, []);

  if (!hasUpdate) return null;

  return (
    <div
      onClick={() => {
        const updateFn = (window as any).__zhenzhenUpdateSW;
        if (typeof updateFn === 'function') {
          updateFn();
        }
        // updateSW() 会触发页面刷新，无需额外操作
      }}
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: 'var(--color-accent, #f0a040)',
        color: '#000',
        padding: '10px 24px',
        borderRadius: '24px',
        fontSize: '14px',
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        maxWidth: 'calc(100% - 32px)',
        whiteSpace: 'nowrap',
      }}
    >
       新版本可用 · 点击更新
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="flex flex-col h-full max-w-lg mx-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/training" element={<Navigate to="/" replace />} />
            <Route path="/log" element={<Log />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
        <UpdateBanner />
        <Navigation />
      </div>
    </HashRouter>
  );
}
