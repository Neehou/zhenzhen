/* ══════════════ 臻臻 SVG 图标库 — 统一风格，无 emoji ══════════════ */

type IconProps = { size?: number; color?: string; className?: string; style?: React.CSSProperties };

function Icon({ size = 24, color = 'currentColor', children, className, style }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
    >
      {children}
    </svg>
  );
}

/* ── 导航 ── */
export function IconDumbbell(p: IconProps) { return <Icon {...p}><path d="M6.5 6.5h2v11h-2zM15.5 6.5h2v11h-2z"/><path d="M8.5 6.5V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M8.5 17.5V19a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-1.5"/><line x1="6.5" y1="9" x2="6.5" y2="15"/><line x1="17.5" y1="9" x2="17.5" y2="15"/></Icon>; }
export function IconJournal(p: IconProps) { return <Icon {...p}><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="14" y2="14"/></Icon>; }
export function IconSettings(p: IconProps) { return <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>; }

/* ── 动作类别 ── */
export function IconStrength(p: IconProps) { return <Icon {...p}><path d="M12 2v6M12 16v4M8 8l-3 4h5l3-4H8zM16 8l3 4h-5l-3-4h5z"/><rect x="9" y="8" width="6" height="8" rx="1"/></Icon>; }
export function IconCardio(p: IconProps) { return <Icon {...p}><circle cx="18" cy="6" r="2"/><path d="M21 14c0 5-9 7-9 7s-9-2-9-7c0-4 4-11 9-11s9 7 9 11z"/></Icon>; }
export function IconBodyweight(p: IconProps) { return <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></Icon>; }
export function IconStretch(p: IconProps) { return <Icon {...p}><path d="M8 2v6l-4 4v8M16 2v6l4 4v8"/><line x1="8" y1="8" x2="16" y2="8"/></Icon>; }

/* ── 状态 ── */
export function IconCheck(p: IconProps) { return <Icon {...p}><polyline points="5 13 10 18 19 6"/></Icon>; }
export function IconSparkle(p: IconProps) { return <Icon {...p}><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/></Icon>; }
export function IconBrain(p: IconProps) { return <Icon {...p}><path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v15a2.5 2.5 0 0 0 5 0v-15A2.5 2.5 0 0 0 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 1 17 4.5v15a2.5 2.5 0 0 1-5 0v-15A2.5 2.5 0 0 1 14.5 2z"/><line x1="12" y1="7" x2="12" y2="11"/></Icon>; }
export function IconZap(p: IconProps) { return <Icon {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Icon>; }

/* ── 操作 ── */
export function IconSend(p: IconProps) { return <Icon {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Icon>; }
export function IconPlus(p: IconProps) { return <Icon {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Icon>; }
export function IconSkip(p: IconProps) { return <Icon {...p}><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></Icon>; }
export function IconRefresh(p: IconProps) { return <Icon {...p}><polyline points="1 4 1 10 7 10"/><path d="M4 13a9 9 0 1 0 3-8.7"/></Icon>; }
export function IconTrash(p: IconProps) { return <Icon {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></Icon>; }
export function IconFlag(p: IconProps) { return <Icon {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></Icon>; }
export function IconHome(p: IconProps) { return <Icon {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Icon>; }

/* ── 小点/指示器 ── */
export function Dot({ color = 'var(--color-green)', glow = false, size = 10 }: { color?: string; glow?: boolean; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: color, display: 'inline-block', flexShrink: 0,
      boxShadow: glow ? `0 0 ${size}px ${color}` : undefined,
    }} />
  );
}

/* ── 类别颜色映射 ── */
export const CAT_COLORS: Record<string, string> = {
  strength:   'var(--color-blue)',
  cardio:     'var(--color-orange)',
  bodyweight: 'var(--color-purple)',
  stretch:    'var(--color-green)',
};

export function categoryIcon(cat: string, size?: number) {
  const c = CAT_COLORS[cat] || 'var(--color-text3)';
  switch (cat) {
    case 'strength':   return <IconStrength size={size} color={c} />;
    case 'cardio':     return <IconCardio size={size} color={c} />;
    case 'bodyweight': return <IconBodyweight size={size} color={c} />;
    case 'stretch':    return <IconStretch size={size} color={c} />;
    default:           return <IconDumbbell size={size} color={c} />;
  }
}
