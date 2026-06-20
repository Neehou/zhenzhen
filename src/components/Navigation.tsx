import { useLocation, useNavigate } from 'react-router-dom';
import { IconDumbbell, IconJournal, IconSettings } from './Icons';

const NAV_ITEMS = [
  { path: '/',         label: '训练', Icon: IconDumbbell },
  { path: '/log',      label: '日志', Icon: IconJournal },
  { path: '/settings', label: '设置', Icon: IconSettings },
];

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="nav-bar fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center safe-bottom"
      style={{ height: '64px', paddingBottom: 'max(env(safe-area-inset-bottom), 4px)' }}
    >
      {NAV_ITEMS.map(({ path, label, Icon }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-0.5"
            style={{
              minWidth: '64px',
              height: '48px',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text3)',
              transition: 'color .2s, transform .2s',
              transform: isActive ? 'translateY(-2px)' : 'none',
            }}
          >
            <Icon size={22} color={isActive ? 'var(--color-accent)' : 'var(--color-text3)'} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: isActive ? '.3px' : '.8px',
              }}
            >
              {label}
            </span>
            {isActive && (
              <span
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: 'var(--color-accent)',
                  marginTop: '1px',
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
