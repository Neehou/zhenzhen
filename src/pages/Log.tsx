import { useState, useEffect } from 'react';
import { db, DEFAULT_EXERCISES } from '../db/database';
import type { WorkoutSession } from '../types';

export default function Log() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    const all = await db.workoutSessions
      .orderBy('date')
      .reverse()
      .toArray();
    setSessions(all);
    setLoading(false);
  }

  async function deleteSession(id: string) {
    if (!window.confirm('确定删除这条训练记录？')) return;
    await db.workoutSessions.delete(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text3)' }}>
        加载中...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 pb-24 safe-top">
        <p style={{ fontSize: '48px', margin: '0 0 12px' }}>📭</p>
        <p style={{ fontSize: '16px', color: 'var(--color-text2)', textAlign: 'center', lineHeight: 1.6 }}>
          还没有训练记录。
          <br />
          去"训练"页面开始你的第一次吧。
        </p>
      </div>
    );
  }

  // 按月份分组
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
    <div className="flex flex-col h-full pb-24 safe-top">
      {/* 顶部 */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <span style={{ fontSize: '17px', fontWeight: 600 }}>📊 训练日志</span>
        <span style={{ fontSize: '13px', color: 'var(--color-text3)' }}>
          共 {sessions.length} 次
        </span>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {Object.entries(grouped).map(([month, monthSessions]) => (
          <div key={month} className="mb-5">
            <h3
              className="mb-2 font-medium"
              style={{ fontSize: '13px', color: 'var(--color-text3)' }}
            >
              {monthNames(month)}
            </h3>

            <div className="flex flex-col gap-2">
              {monthSessions.map(session => {
                const isExpanded = expandedId === session.id;
                const totalSets = session.sets.length;
                const exercises = [...new Set(
                  session.sets.map(s => {
                    const ex = DEFAULT_EXERCISES.find(e => e.id === s.exerciseId);
                    return ex?.name || s.exerciseId;
                  })
                )];

                return (
                  <div
                    key={session.id}
                    className="rounded-xl overflow-hidden transition-all"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: `1px solid ${isExpanded ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    }}
                  >
                    {/* 摘要行 */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : session.id)}
                      className="w-full px-4 py-3.5 text-left flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ fontSize: '15px' }}>
                            {session.date.slice(5)}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: session.type === 'planned' ? 'rgba(92,184,120,0.15)' : 'rgba(240,176,66,0.15)',
                            color: session.type === 'planned' ? 'var(--color-green)' : 'var(--color-accent)',
                          }}>
                            {session.type === 'planned' ? '按计划' : '自由练'}
                          </span>
                        </div>
                        <div className="mt-1" style={{ fontSize: '13px', color: 'var(--color-text3)' }}>
                          {exercises.join(' · ')} · {totalSets}组
                        </div>
                      </div>
                      <span style={{ color: 'var(--color-text3)', fontSize: '12px' }}>
                        {isExpanded ? '收起 ▲' : '展开 ▼'}
                      </span>
                    </button>

                    {/* 展开详情 */}
                    {isExpanded && (
                      <div
                        className="px-4 pb-4 slide-up"
                        style={{ borderTop: '1px solid var(--color-border)' }}
                      >
                        {/* 每组详情 */}
                        <div className="mt-3 flex flex-col gap-1.5">
                          {session.sets.map((set, i) => {
                            const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
                            return (
                              <div
                                key={set.id}
                                className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                                style={{ backgroundColor: 'var(--color-surface2)' }}
                              >
                                <div className="flex items-center gap-2">
                                  <span style={{ fontSize: '12px', color: 'var(--color-text3)' }}>
                                    #{i + 1}
                                  </span>
                                  <span style={{ fontSize: '14px' }}>
                                    {ex?.name || set.exerciseId}
                                  </span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text2)' }}>
                                  {set.weight && `${set.weight}kg `}
                                  {set.reps && `${set.reps}次 `}
                                  {set.distance && `${set.distance}km `}
                                  {set.duration && `${set.duration}分钟 `}
                                  {set.rpe && `RPE${set.rpe}`}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* AI 反馈 */}
                        {session.aiFeedback && (
                          <div
                            className="mt-3 p-3 rounded-lg"
                            style={{ backgroundColor: 'var(--color-surface2)' }}
                          >
                            <p style={{ fontSize: '12px', color: 'var(--color-text3)', marginBottom: '4px' }}>
                              💬 臻臻点评
                            </p>
                            <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--color-text2)', whiteSpace: 'pre-wrap' }}>
                              {session.aiFeedback}
                            </p>
                          </div>
                        )}

                        {/* 删除 */}
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="mt-3 text-xs underline"
                          style={{ color: 'var(--color-text3)' }}
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
      </div>
    </div>
  );
}
