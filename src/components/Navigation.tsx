import { useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: '训练', icon: '🏋️' },
  { path: '/log', label: '日志', icon: '📊' },
  { path: '/settings', label: '设置', icon: '⚙️' },
];

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center safe-bottom"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        height: '64px',
      }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors"
            style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text3)' }}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
