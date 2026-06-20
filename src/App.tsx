import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Log from './pages/Log';
import Settings from './pages/Settings';

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
          </Routes>
        </main>
        <Navigation />
      </div>
    </HashRouter>
  );
}
