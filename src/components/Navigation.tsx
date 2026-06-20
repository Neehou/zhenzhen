import { useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: '训练' },
  { path: '/log', label: '日志' },
  { path: '/settings', label: '设置' },
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
        height: '56px',
      }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex items-center justify-center w-16 h-full transition-colors"
            style={{
              color: isActive ? 'var(--color-accent)' : 'var(--color-text3)',
              fontSize: '16px',
              fontWeight: isActive ? 700 : 500,
              letterSpacing: '2px',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
