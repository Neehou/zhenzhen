import { useState, useEffect } from 'react';
import { db, DEFAULT_EXERCISES } from '../db/database';
import { IconBrain, IconDumbbell } from '../components/Icons';
import type { WorkoutSession } from '../types';

export default function Log() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { loadSessions(); }, []);

  async function loadSessions() {
    setLoading(true);
    const all = await db.workoutSessions.orderBy('date').reverse().limit(200).toArray();
    setSessions(all);
    setLoading(false);
  }

  async function deleteSession(id: string) {
    if (!window.confirm('确定删除这条训练记录？')) return;
    await db.workoutSessions.delete(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  /* ── 加载态 ── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 pb-24">
        <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 24 }} />
        <div className="skeleton" style={{ width: 140, height: 16 }} />
        <div className="skeleton" style={{ width: 100, height: 12 }} />
      </div>
    );
  }

  /* ── 空态 ── */
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 pb-24 safe-top fade-in">
        <IconDumbbell size={48} color="var(--color-text3)" />
        <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text2)', textAlign: 'center', margin: 0 }}>
          还没有训练记录
        </p>
        <p style={{ fontSize: '13px', color: 'var(--color-text3)', textAlign: 'center', marginTop: '8px', lineHeight: 1.6 }}>
          去训练页面开始你的第一次训练
          <br />
          臻臻会在终点等你 
        </p>
      </div>
    );
  }

  /* ── 按月份分组 ── */
  const grouped: Record<string, WorkoutSession[]> = {};
  for (const s of sessions) {
    const month = s.date.slice(0, 7);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(s);
  }

  const monthNames = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${y}年${parseInt(m)}月`;
  };

  return (
    <div className="flex flex-col h-full pb-24 safe-top fade-in">
      {/* ── 头部 ── */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-.3px', margin: 0 }}>训练日志</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text3)', marginTop: '2px' }}>
            共 {sessions.length} 次训练
          </p>
        </div>
        {/* 最近7天趋势的小条 */}
        <div style={{
          display: 'flex', gap: '3px', alignItems: 'flex-end',
          backgroundColor: 'var(--color-surface)', borderRadius: '10px', padding: '8px 10px',
          border: '1px solid var(--color-border)',
        }}>
          {(() => {
            const now = new Date();
            const bars: { date: string; count: number; isToday: boolean }[] = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date(now);
              d.setDate(d.getDate() - i);
              const ds = d.toISOString().slice(0, 10);
              const count = sessions.filter(s => s.date === ds).length;
              bars.push({ date: ds, count, isToday: i === 0 });
            }
            const maxH = 20;
            const maxCount = Math.max(...bars.map(b => b.count), 1);
            return bars.map((b, i) => (
              <div key={i} style={{
                width: '6px', height: `${Math.max(3, (b.count / maxCount) * maxH)}px`,
                borderRadius: '3px',
                backgroundColor: b.count > 0
                  ? (b.isToday ? 'var(--color-accent)' : 'var(--color-text2)')
                  : 'var(--color-border2)',
                transition: 'height .3s',
              }} title={`${b.date.slice(5)}: ${b.count}次`} />
            ));
          })()}
        </div>
      </div>

      {/* ── 列表 ── */}
      <div className="flex-1 overflow-y-auto px-5 py-2">
        {Object.entries(grouped).map(([month, monthSessions]) => (
          <div key={month} className="mb-6">
            <h3 style={{
              fontSize: '12px', fontWeight: 700, color: 'var(--color-text3)',
              letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 10px 4px',
            }}>
              {monthNames(month)}
            </h3>

            <div className="flex flex-col gap-2">
              {monthSessions.map((session, sessionIdx) => {
                const isExpanded = expandedId === session.id;
                const totalSets = session.sets.length;
                const exercises = [...new Set(
                  session.sets.map(s => {
                    const ex = DEFAULT_EXERCISES.find(e => e.id === s.exerciseId);
                    return ex?.name || s.exerciseId;
                  })
                )];

                // 计算训练容量
                const volume = session.sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
                const duration = session.sets.reduce((sum, s) => sum + (s.duration || 0), 0);
                const bodyParts = [...new Set(
                  session.sets.map(s => {
                    const ex = DEFAULT_EXERCISES.find(e => e.id === s.exerciseId);
                    return ex?.bodyPart || '其他';
                  })
                )];

                return (
                  <div key={session.id}
                    className="glass rounded-card2 overflow-hidden fade-up"
                    style={{
                      borderColor: isExpanded ? 'var(--color-accent)' : 'var(--color-border)',
                      animationDelay: `${sessionIdx * .03}s`,
                    }}
                  >
                    {/* 摘要行 */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : session.id)}
                      className="w-full px-4 py-3.5 text-left flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                            {session.date.slice(5)}
                          </span>
                          <span style={{
                            fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                            backgroundColor: session.type === 'planned' ? 'var(--color-green2)' : 'var(--color-orange2)',
                            color: session.type === 'planned' ? 'var(--color-green)' : 'var(--color-orange)',
                          }}>
                            {session.type === 'planned' ? '按计划' : '自由练'}
                          </span>
                          {session.aiFeedback && (
                            <IconBrain size={14} color="var(--color-accent)" />
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3" style={{ fontSize: '12px', color: 'var(--color-text3)' }}>
                          <span>{exercises.slice(0, 3).join(' · ')}{exercises.length > 3 ? '...' : ''}</span>
                          <span>·</span>
                          <span>{totalSets}组</span>
                          {volume > 0 && <><span>·</span><span>{volume}kg</span></>}
                          {duration > 0 && <><span>·</span><span>{duration}分</span></>}
                        </div>
                      </div>
                      <span style={{
                        color: 'var(--color-text3)', fontSize: '11px', marginLeft: '8px',
                        transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
                      }}>
                        ▼
                      </span>
                    </button>

                    {/* 展开详情 */}
                    {isExpanded && (
                      <div className="px-4 pb-4 slide-up" style={{ borderTop: '1px solid var(--color-border)' }}>
                        {/* 部位标签 */}
                        <div className="flex gap-1.5 mt-3 mb-3 flex-wrap">
                          {bodyParts.map(bp => (
                            <span key={bp} style={{
                              fontSize: '10px', fontWeight: 600, padding: '3px 8px',
                              borderRadius: '6px', backgroundColor: 'var(--color-surface2)',
                              color: 'var(--color-text3)',
                            }}>
                              {bp}
                            </span>
                          ))}
                        </div>

                        {/* 每组详情 */}
                        <div className="flex flex-col gap-1">
                          {session.sets.map((set, i) => {
                            const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
                            const catColor = ex?.category === 'strength' ? 'var(--color-blue)'
                              : ex?.category === 'cardio' ? 'var(--color-orange)'
                              : ex?.category === 'bodyweight' ? 'var(--color-purple)'
                              : 'var(--color-green)';
                            return (
                              <div key={set.id}
                                className="flex items-center justify-between py-2 px-3 rounded-lg"
                                style={{ backgroundColor: 'var(--color-surface2)' }}
                              >
                                <div className="flex items-center gap-3">
                                  <span style={{
                                    width: '20px', height: '20px', borderRadius: '6px',
                                    backgroundColor: catColor.replace(')', ',.2)').replace('rgb', 'rgba'),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '10px', fontWeight: 700, color: catColor,
                                  }}>
                                    {i + 1}
                                  </span>
                                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
                                    {ex?.name || set.exerciseId}
                                  </span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text2)' }}>
                                  {set.weight && <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{set.weight}<span style={{ fontSize: '10px', color: 'var(--color-text3)' }}>kg </span></span>}
                                  {set.reps && <span>{set.reps}<span style={{ fontSize: '10px', color: 'var(--color-text3)' }}>次 </span></span>}
                                  {set.distance && <span>{set.distance}<span style={{ fontSize: '10px', color: 'var(--color-text3)' }}>km </span></span>}
                                  {set.duration && <span>{set.duration}<span style={{ fontSize: '10px', color: 'var(--color-text3)' }}>分 </span></span>}
                                  {set.rpe && (
                                    <span style={{
                                      fontSize: '11px', fontWeight: 600, marginLeft: '4px',
                                      padding: '2px 6px', borderRadius: '4px',
                                      backgroundColor: set.rpe >= 8 ? 'var(--color-red2)' : set.rpe >= 6 ? 'var(--color-orange2)' : 'var(--color-green2)',
                                      color: set.rpe >= 8 ? 'var(--color-red)' : set.rpe >= 6 ? 'var(--color-orange)' : 'var(--color-green)',
                                    }}>
                                      RPE {set.rpe}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* AI 反馈 */}
                        {session.aiFeedback && (
                          <div className="mt-3 p-3 rounded-card2" style={{ backgroundColor: 'var(--color-surface2)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span style={{ fontSize: '16px' }}></span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)' }}>臻臻点评</span>
                            </div>
                            <p style={{ fontSize: '13px', lineHeight: 1.75, color: 'var(--color-text2)', whiteSpace: 'pre-wrap', margin: 0 }}>
                              {session.aiFeedback}
                            </p>
                          </div>
                        )}

                        {/* 删除 */}
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="mt-3 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
                          style={{ color: 'var(--color-text3)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text3)')}
                        >
                          删除此记录
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {/* 底部提示 */}
        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text3)', padding: '20px 0 40px' }}>
          显示最近 200 条记录
        </p>
      </div>
    </div>
  );
}
