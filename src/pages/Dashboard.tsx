import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getTodayPlan, getStreak, DEFAULT_EXERCISES } from '../db/database';
import { generateTrainingPlan } from '../services/ai-coach';
import type { DailyPlan, WorkoutSession } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    const [s, p, sessions] = await Promise.all([
      getStreak(),
      getTodayPlan(),
      db.workoutSessions.orderBy('date').reverse().limit(1).toArray(),
    ]);
    setStreak(s);
    setPlan(p || null);
    setLastSession(sessions[0] || null);
    setLoading(false);
  }

  async function handleGeneratePlan() {
    setGenerating(true);
    try {
      const recentSessions = await db.workoutSessions
        .orderBy('date').reverse().limit(10).toArray();
      const newPlan = await generateTrainingPlan(recentSessions, undefined);
      setPlan(newPlan);
    } catch (e: any) {
      alert(e.message || '生成失败');
    }
    setGenerating(false);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 9) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    if (h < 22) return '晚上好';
    return '夜深了';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text3)' }}>
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-8 pb-24 safe-top">
      {/* 问候 */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
          {greeting()}，yooyy
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <span style={{ fontSize: '14px', color: 'var(--color-text2)' }}>
            {streak > 0
              ? `🔥 连续训练 ${streak} 天`
              : '💤 今天还没开始'}
          </span>
          {lastSession && (
            <span style={{ fontSize: '14px', color: 'var(--color-text3)' }}>
              · 上次 {lastSession.date.slice(5)}
            </span>
          )}
        </div>
      </div>

      {/* 今日计划 */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0 }}>📋 今日计划</h2>
          {!plan && (
            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: '#000',
              }}
            >
              {generating ? '生成中...' : '生成计划'}
            </button>
          )}
        </div>

        {plan ? (
          <>
            <div className="flex flex-col gap-2.5">
              {plan.exercises.map((ex, i) => {
                const exercise = DEFAULT_EXERCISES.find(e => e.id === ex.exerciseId);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 rounded-lg"
                    style={{ backgroundColor: 'var(--color-surface2)' }}
                  >
                    <div>
                      <span className="font-medium" style={{ fontSize: '15px' }}>
                        {exercise?.name || ex.exerciseId}
                      </span>
                      {ex.notes && (
                        <span className="ml-2" style={{ fontSize: '12px', color: 'var(--color-text3)' }}>
                          {ex.notes}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '14px', color: 'var(--color-text2)' }}>
                      {ex.targetSets}×{ex.targetReps}
                      {ex.targetWeight ? ` ${ex.targetWeight}kg` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => navigate('/training')}
              className="w-full mt-4 py-3 rounded-xl text-base font-semibold transition-opacity active:opacity-80"
              style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
            >
              🏋️ 开始训练
            </button>
          </>
        ) : (
          <p style={{ fontSize: '14px', color: 'var(--color-text3)', lineHeight: 1.6 }}>
            还没有今日计划。
            <br />
            点击"生成计划"，臻臻会为你想好今天该练什么。
          </p>
        )}
      </div>

      {/* 快捷入口 */}
      {!plan && (
        <button
          onClick={() => navigate('/training')}
          className="w-full py-4 rounded-2xl text-base font-semibold transition-opacity active:opacity-80"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px dashed var(--color-border)',
            color: 'var(--color-text2)',
          }}
        >
          ⚡ 不生成计划，直接开始自由训练
        </button>
      )}

      {/* 上次训练回顾 */}
      {lastSession && lastSession.aiFeedback && (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h2 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 12px' }}>💬 上次臻臻说了</h2>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text2)', whiteSpace: 'pre-wrap' }}>
            {lastSession.aiFeedback}
          </p>
        </div>
      )}

      {/* 空状态提示 */}
      {!lastSession && (
        <div className="text-center py-10" style={{ color: 'var(--color-text3)' }}>
          <p style={{ fontSize: '40px', margin: '0 0 12px' }}>🏋️</p>
          <p style={{ fontSize: '15px', lineHeight: 1.6 }}>
            还没有训练记录。
            <br />
            臻臻在等你的第一次。
          </p>
        </div>
      )}
    </div>
  );
}
