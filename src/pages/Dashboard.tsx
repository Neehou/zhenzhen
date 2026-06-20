import { useState, useEffect, useRef } from 'react';
import { db, getTodayPlan, getStreak, DEFAULT_EXERCISES, saveDailyPlan } from '../db/database';
import { generateTrainingPlan, parseUserInput, hasApiKey } from '../services/ai-coach';
import { useTraining } from '../hooks/useTraining';
import type { DailyPlan, WorkoutSession, TrainingSet } from '../types';

// ─── 弹出面板组件 ───
function RecordPanel({
  exerciseName,
  category,
  onRecord,
  onClose,
  existingSets,
  onRemoveSet,
  onUpdateRPE,
}: {
  exerciseId: string;
  exerciseName: string;
  category: string;
  onRecord: (data: { weight?: number; reps?: number; duration?: number; distance?: number; rpe?: number }) => void;
  onClose: () => void;
  existingSets: TrainingSet[];
  onRemoveSet: (id: string) => void;
  onUpdateRPE: (id: string, rpe: number) => void;
}) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const isCardio = category === 'cardio';
  const isStretch = category === 'stretch';

  function handleRecord() {
    onRecord({
      weight: weight ? parseFloat(weight) : undefined,
      reps: reps ? parseInt(reps) : undefined,
      duration: duration ? parseInt(duration) : undefined,
      distance: distance ? parseFloat(distance) : undefined,
      rpe: rpe || undefined,
    });
    setWeight(''); setReps(''); setDuration(''); setDistance(''); setRpe(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl px-5 pt-5 pb-8 slide-up"
        style={{ backgroundColor: 'var(--color-surface)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{exerciseName}</h3>
          <button onClick={onClose} style={{ fontSize: '20px', color: 'var(--color-text3)' }}>✕</button>
        </div>

        {/* 已记录组 */}
        {existingSets.length > 0 && (
          <div className="flex flex-col gap-1 mb-4">
            {existingSets.map((set, i) => (
              <div
                key={set.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--color-surface2)' }}
              >
                <span style={{ color: 'var(--color-text2)' }}>
                  第{i + 1}组：
                  {set.weight && ` ${set.weight}kg`}
                  {set.reps && ` ${set.reps}次`}
                  {set.distance && ` ${set.distance}km`}
                  {set.duration && ` ${set.duration}分钟`}
                </span>
                <div className="flex items-center gap-1">
                  {[5, 6, 7, 8].map(r => (
                    <button
                      key={r}
                      onClick={() => onUpdateRPE(set.id, r)}
                      className="w-6 h-6 rounded-full text-xs font-medium"
                      title={['','','','','','轻松','刚好','有点累','很累'][r]}
                      style={{
                        backgroundColor: set.rpe === r ? 'var(--color-accent)' : 'var(--color-surface)',
                        color: set.rpe === r ? '#000' : 'var(--color-text3)',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                  <button
                    onClick={() => onRemoveSet(set.id)}
                    className="ml-1 w-5 h-5 rounded-full text-xs flex items-center justify-center"
                    style={{ color: 'var(--color-red)' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 输入区 */}
        {isCardio || isStretch ? (
          <div className="flex gap-3 mb-4">
            {!isStretch && (
              <div className="flex-1">
                <label style={{ fontSize: '12px', color: 'var(--color-text3)', marginBottom: '4px', display: 'block' }}>
                  距离 (km)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={distance}
                  onChange={e => setDistance(e.target.value)}
                  placeholder="3"
                  className="w-full px-4 py-3 rounded-xl text-lg outline-none"
                  style={{ backgroundColor: 'var(--color-surface2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
            )}
            <div className="flex-1">
              <label style={{ fontSize: '12px', color: 'var(--color-text3)', marginBottom: '4px', display: 'block' }}>
                时长 (分钟)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder={isStretch ? '5' : '20'}
                className="w-full px-4 py-3 rounded-xl text-lg outline-none"
                style={{ backgroundColor: 'var(--color-surface2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
          </div>
        ) : (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label style={{ fontSize: '12px', color: 'var(--color-text3)', marginBottom: '4px', display: 'block' }}>
                重量 (kg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="25"
                className="w-full px-4 py-3 rounded-xl text-lg outline-none"
                style={{ backgroundColor: 'var(--color-surface2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
            <div className="flex-1">
              <label style={{ fontSize: '12px', color: 'var(--color-text3)', marginBottom: '4px', display: 'block' }}>
                次数
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={reps}
                onChange={e => setReps(e.target.value)}
                placeholder="12"
                className="w-full px-4 py-3 rounded-xl text-lg outline-none"
                style={{ backgroundColor: 'var(--color-surface2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
          </div>
        )}

        {/* 感觉 */}
        <div className="mb-4">
          <label style={{ fontSize: '12px', color: 'var(--color-text3)', marginBottom: '6px', display: 'block' }}>
            感觉
          </label>
          <div className="flex gap-2">
            {[
              { v: 5, l: '轻松' },
              { v: 6, l: '刚好' },
              { v: 7, l: '有点累' },
              { v: 8, l: '很累' },
            ].map(({ v, l }) => (
              <button
                key={v}
                onClick={() => setRpe(rpe === v ? null : v)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: rpe === v ? 'var(--color-accent)' : 'var(--color-surface2)',
                  color: rpe === v ? '#000' : 'var(--color-text2)',
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* 记录按钮 */}
        <button
          onClick={handleRecord}
          className="w-full py-3.5 rounded-xl text-base font-semibold"
          style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
        >
          记录这组
        </button>
      </div>
    </div>
  );
}

// ─── 主页面 ───
export default function Dashboard() {
  const [streak, setStreak] = useState(0);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);

  const {
    currentSession, sets, isResting, restSeconds, feedback, isAnalyzing,
    startWorkout, addSet, removeSet, updateRPE, skipRest, finishWorkout, cancelWorkout,
  } = useTraining();

  const [textInput, setTextInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [panelExercise, setPanelExercise] = useState<{ id: string; name: string; category: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setAiAvailable(hasApiKey());
      const [s, p, sessions] = await Promise.all([
        getStreak(), getTodayPlan(),
        db.workoutSessions.orderBy('date').reverse().limit(1).toArray(),
      ]);
      setStreak(s); setPlan(p || null); setLastSession(sessions[0] || null);
      setLoading(false);
    })();
  }, []);

  async function handleGeneratePlan() {
    setGenerating(true);
    try {
      const recentSessions = await db.workoutSessions.orderBy('date').reverse().limit(10).toArray();
      const newPlan = await generateTrainingPlan(recentSessions, undefined);
      setPlan(newPlan);
      await saveDailyPlan(newPlan);
    } catch (e: any) { alert(e.message || '生成失败'); }
    setGenerating(false);
  }

  // ─── 弹窗记录 ───
  function openPanel(exerciseId: string) {
    const ex = DEFAULT_EXERCISES.find(e => e.id === exerciseId);
    if (!ex) return;
    if (!currentSession) startWorkout('planned');
    setPanelExercise({ id: exerciseId, name: ex.name, category: ex.category });
  }

  function handlePanelRecord(data: { weight?: number; reps?: number; duration?: number; distance?: number; rpe?: number }) {
    if (!panelExercise) return;
    addSet({ exerciseId: panelExercise.id, ...data });
    setPanelExercise(null);
  }

  // ─── AI 文字输入 ───
  async function handleTextSubmit(raw: string) {
    if (!raw.trim()) return;
    if (!currentSession) startWorkout('freestyle');

    setParsing(true);
    setParseError('');
    try {
      const parsed = await parseUserInput(raw);
      if (parsed) {
        addSet({
          exerciseId: parsed.exerciseId,
          weight: parsed.weight,
          reps: parsed.reps,
          duration: parsed.duration,
          distance: parsed.distance,
          rpe: parsed.rpe,
        });
        setTextInput('');
      } else {
        setParseError('没识别到动作。试试"高位下拉25公斤8次刚好"');
      }
    } catch (e: any) {
      setParseError(e.message || '解析失败');
    }
    setParsing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleTextSubmit(textInput);
  }

  function getSetsForExercise(exerciseId: string) {
    return sets.filter(s => s.exerciseId === exerciseId);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了'; if (h < 9) return '早上好';
    if (h < 12) return '上午好'; if (h < 14) return '中午好';
    if (h < 18) return '下午好'; if (h < 22) return '晚上好';
    return '夜深了';
  };

  // ─── 加载中 ───
  if (loading) {
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text3)' }}>加载中...</div>;
  }

  // ─── 分析中 ───
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full pb-24 safe-top">
        <p style={{ fontSize: '48px' }}>🧠</p>
        <p style={{ fontSize: '16px', color: 'var(--color-text2)', marginTop: '12px' }}>臻臻在分析你的训练...</p>
      </div>
    );
  }

  // ─── 完成 ───
  if (feedback) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 pb-24 safe-top">
        <div className="text-center mb-8">
          <p style={{ fontSize: '48px', margin: 0 }}>✅</p>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '12px 0 4px' }}>训练完成</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text3)' }}>{sets.length} 组已完成</p>
        </div>
        <div className="w-full rounded-2xl p-5 mb-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="font-semibold mb-2" style={{ fontSize: '15px' }}>💬 臻臻点评</h3>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text2)', whiteSpace: 'pre-wrap' }}>{feedback}</p>
        </div>
        <button onClick={() => window.location.reload()} className="w-full py-3.5 rounded-xl text-base font-semibold" style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}>
          返回首页
        </button>
      </div>
    );
  }

  // ─── 主界面 ───
  return (
    <div className="flex flex-col h-full pb-24 safe-top">
      {/* 问候 */}
      <div className="px-5 pt-6 pb-3">
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
          {greeting()}，yooyy
        </h1>
        <div className="flex items-center gap-2 mt-1.5">
          <span style={{ fontSize: '14px', color: 'var(--color-text2)' }}>
            {streak > 0 ? `🔥 连续训练 ${streak} 天` : '💤 今天还没开始'}
          </span>
          {lastSession && (
            <span style={{ fontSize: '14px', color: 'var(--color-text3)' }}>
              · 上次 {lastSession.date.slice(5)}
            </span>
          )}
          {!aiAvailable && (
            <span style={{ fontSize: '12px', color: 'var(--color-text3)', marginLeft: 'auto' }}>
              💡 设置里填Key解锁AI
            </span>
          )}
        </div>
      </div>

      {/* 今日计划 */}
      <div className="mx-5 rounded-2xl p-4 mb-3" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>📋 今日计划</h2>
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
          >
            {generating ? '生成中...' : plan ? '重新生成' : '生成计划'}
          </button>
        </div>

        {plan ? (
          <div className="flex flex-col gap-1.5">
            {plan.exercises.map((ex, i) => {
              const exercise = DEFAULT_EXERCISES.find(e => e.id === ex.exerciseId);
              const exerciseSets = getSetsForExercise(ex.exerciseId);
              const hasSets = exerciseSets.length > 0;

              return (
                <button
                  key={i}
                  onClick={() => openPanel(ex.exerciseId)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                  style={{
                    backgroundColor: hasSets ? 'rgba(92,184,120,0.1)' : 'var(--color-surface2)',
                    border: `1.5px solid ${hasSets ? 'var(--color-green)' : 'transparent'}`,
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{hasSets ? '✅' : '⬜'}</span>
                      <span className="font-medium" style={{ fontSize: '15px' }}>
                        {exercise?.name || ex.exerciseId}
                      </span>
                    </div>
                    {hasSets && (
                      <div className="mt-1 ml-6" style={{ fontSize: '12px', color: 'var(--color-text3)' }}>
                        {exerciseSets.map(s =>
                          [s.weight && `${s.weight}kg`, s.reps && `${s.reps}次`, s.duration && `${s.duration}分钟`].filter(Boolean).join(' ')
                        ).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '13px', color: 'var(--color-text3)' }}>
                      {ex.targetSets}×{ex.targetReps}
                    </span>
                    <span style={{ fontSize: '14px', color: 'var(--color-accent)' }}>+</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: '14px', color: 'var(--color-text3)', lineHeight: 1.6 }}>
            还没有今日计划。点击"生成计划"让臻臻帮你安排。
          </p>
        )}
      </div>

      {/* 组间休息 */}
      {isResting && (
        <div className="mx-5 mb-3 p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--color-surface2)' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text2)' }}>⏱️ 组间休息 </span>
          <span style={{ fontSize: '28px', fontWeight: 700 }}>{restSeconds}s</span>
          <button onClick={skipRest} className="ml-3 px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text2)' }}>跳过</button>
        </div>
      )}

      {/* 错误提示 */}
      {parseError && (
        <div className="mx-5 mb-3 p-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(224,85,85,0.1)', color: 'var(--color-red)' }}>
          {parseError}
          <button onClick={() => setParseError('')} className="ml-3 underline">知道了</button>
        </div>
      )}

      <div className="flex-1" />

      {/* 底部输入区 */}
      <div className="px-5 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={parsing ? 'AI 解析中...' : '说说你练了什么...'}
            disabled={parsing}
            className="flex-1 px-4 py-3 rounded-xl text-base outline-none"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
          <button
            onClick={() => handleTextSubmit(textInput)}
            disabled={parsing || !textInput.trim()}
            className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: '#000',
              opacity: textInput.trim() ? 1 : 0.3,
            }}
          >
            →
          </button>
        </div>

        {currentSession && sets.length > 0 && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={cancelWorkout}
              className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-text2)' }}
            >
              放弃
            </button>
            <button
              onClick={finishWorkout}
              className="flex-[2] py-3 rounded-xl text-base font-semibold"
              style={{ backgroundColor: 'var(--color-green)', color: '#000' }}
            >
              完成训练 · 查看臻臻点评
            </button>
          </div>
        )}
      </div>

      {/* 弹出面板 */}
      {panelExercise && (
        <RecordPanel
          exerciseId={panelExercise.id}
          exerciseName={panelExercise.name}
          category={panelExercise.category}
          onRecord={handlePanelRecord}
          onClose={() => setPanelExercise(null)}
          existingSets={getSetsForExercise(panelExercise.id)}
          onRemoveSet={removeSet}
          onUpdateRPE={updateRPE}
        />
      )}
    </div>
  );
}
