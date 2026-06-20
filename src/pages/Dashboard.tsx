import { useState, useEffect, useRef } from 'react';
import { db, getTodayPlan, getWeeklyStats, DEFAULT_EXERCISES, saveDailyPlan, getOrCreateProfile } from '../db/database';
import { generateTrainingPlan, parseUserInput, hasApiKey, onboardingMessage, parseOnboardingAnswer, skipComment, setFeedback, getAIStatus, processOfflineQueue, getOfflineQueue } from '../services/ai-coach';
import { useTraining } from '../hooks/useTraining';
import type { DailyPlan, WorkoutSession } from '../types';

// ═══════════════════════ 全屏休息 ═══════════════════════
function RestOverlay({ seconds, nextExercise, comment, onSkip }: { seconds: number; nextExercise: string; comment: string; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8" style={{ backgroundColor: '#0a0a0a' }}>
      <p style={{ fontSize: '64px', margin: 0 }}>⏱️</p>
      <p style={{ fontSize: '72px', fontWeight: 800, margin: '12px 0', fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px' }}>{seconds}s</p>
      {nextExercise && <p style={{ fontSize: '16px', color: 'var(--color-text2)', margin: '0 0 8px' }}>下一组：{nextExercise}</p>}
      {comment && <p style={{ fontSize: '15px', color: 'var(--color-accent)', margin: '0 0 24px', textAlign: 'center', lineHeight: 1.6 }}>{comment}</p>}
      <button onClick={onSkip} className="px-8 py-3 rounded-xl text-lg font-medium" style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-text2)' }}>跳过休息</button>
    </div>
  );
}

// ═══════════════════════ 统计小格 ═══════════════════════
function StatBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface2)' }}>
      <p style={{ fontSize: '11px', color: 'var(--color-text3)', margin: '0 0 2px' }}>{label}</p>
      <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-accent)' }}>{value}</span>
      <span style={{ fontSize: '13px', color: 'var(--color-text3)', marginLeft: '4px' }}>{unit}</span>
    </div>
  );
}

// ═══════════════════════ 主页面 ═══════════════════════
export default function Dashboard() {
  const [weekly, setWeekly] = useState({ trainedDays: 0, goalDays: 3 });
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
  const { currentSession, sets, isResting, restSeconds, feedback, isAnalyzing,
    startWorkout, addSet, skipRest, finishWorkout, cancelWorkout } = useTraining();
  const [textInput, setTextInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [skipMsg, setSkipMsg] = useState('');
  const [showRest, setShowRest] = useState(false);
  const [setComment, setSetComment] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── 行内输入状态 ───
  const [inlineWeight, setInlineWeight] = useState<Record<string, string>>({});
  const [inlineReps, setInlineReps] = useState<Record<string, string>>({});
  const [inlineDuration, setInlineDuration] = useState<Record<string, string>>({});

  // ─── 引导 ───
  const [onboardStep, setOnboardStep] = useState<'checking' | 'chatting' | 'done'>('checking');
  const [onboardMsg, setOnboardMsg] = useState('');
  const [onboardInput, setOnboardInput] = useState('');
  const [onboardWaiting, setOnboardWaiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [w, p, sessions, profile] = await Promise.all([
          getWeeklyStats(), getTodayPlan(),
          db.workoutSessions.orderBy('date').reverse().limit(1).toArray(),
          getOrCreateProfile(),
        ]);
        if (cancelled) return;
        setWeekly(w); setPlan(p || null); setLastSession(sessions[0] || null);
        if (!profile.onboarded && hasApiKey()) {
          setOnboardStep('chatting');
          try { const msg = await onboardingMessage(); if (!cancelled) setOnboardMsg(msg); }
          catch { setOnboardStep('done'); }
        } else { setOnboardStep('done'); }
      } catch (e) { console.error('初始化失败', e); setOnboardStep('done'); }
      if (!cancelled) setLoading(false);

      // 处理离线队列
      if (hasApiKey()) {
        const queue = getOfflineQueue();
        if (queue.length > 0) {
          const count = await processOfflineQueue();
          if (count > 0) console.log(`离线队列处理完成: ${count}条`);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── 引导对话 ───
  async function handleOnboardSend() {
    if (!onboardInput.trim() || onboardWaiting) return;
    setOnboardWaiting(true);
    const raw = onboardInput.trim(); setOnboardInput('');
    const profile = await getOrCreateProfile();
    const result = await parseOnboardingAnswer(raw);
    if (result) {
      if (result.field === 'weeklyDays') { profile.weeklyDays = parseInt(result.value) || 3; await db.userProfile.put(profile); setWeekly(prev => ({ ...prev, goalDays: profile.weeklyDays || 3 })); }
      else if (result.field === 'equipment') { profile.equipment = result.value; await db.userProfile.put(profile); }
      else if (result.field === 'goal') { profile.goal = result.value; await db.userProfile.put(profile); }
      const msg = await onboardingMessage(); setOnboardMsg(msg);
      if (profile.onboarded) setOnboardStep('done');
    } else { setOnboardMsg('没太理解，再说一次？'); }
    setOnboardWaiting(false);
  }

  // ─── 生成计划 ───
  async function handleGeneratePlan() {
    setGenerating(true);
    try {
      const recent = await db.workoutSessions.orderBy('date').reverse().limit(10).toArray();
      const newPlan = await generateTrainingPlan(recent, undefined);
      setPlan(newPlan); await saveDailyPlan(newPlan); setCurrentExIndex(0);
    } catch (e: any) { alert(e.message || '生成失败'); }
    setGenerating(false);
  }

  // ─── 行内记录（极速版） ───
  async function quickRecord(exerciseId: string, _category: string) {
    if (!currentSession) startWorkout('planned');
    const exKey = exerciseId;
    const w = inlineWeight[exKey] ? parseFloat(inlineWeight[exKey]) : undefined;
    const r = inlineReps[exKey] ? parseInt(inlineReps[exKey]) : undefined;
    const d = inlineDuration[exKey] ? parseInt(inlineDuration[exKey]) : undefined;
    if (!w && !r && !d) return;
    addSet({ exerciseId, weight: w, reps: r, duration: d });
    setInlineWeight(prev => ({ ...prev, [exKey]: '' }));
    setInlineReps(prev => ({ ...prev, [exKey]: '' }));
    setInlineDuration(prev => ({ ...prev, [exKey]: '' }));
    setShowRest(true);
    const ex = DEFAULT_EXERCISES.find(e => e.id === exerciseId);
    if (hasApiKey()) {
      try { const c = await setFeedback(ex?.name || '', w, r, d); setSetComment(c); }
      catch { setSetComment(''); }
    } else { setSetComment(''); }
  }

  // ─── 跳过动作 ───
  async function handleSkipExercise() {
    if (!plan) return;
    const ex = plan.exercises[currentExIndex];
    if (!ex) return;
    const e = DEFAULT_EXERCISES.find(x => x.id === ex.exerciseId);
    const msg = await skipComment(e?.name || ex.exerciseId, e?.category || 'strength');
    setSkipMsg(msg); setTimeout(() => setSkipMsg(''), 3000);
    setCurrentExIndex(prev => Math.min(prev + 1, (plan?.exercises.length || 1) - 1));
  }

  // ─── 底部文字输入（AI解析） ───
  async function handleTextSubmit(raw: string) {
    if (!raw.trim()) return;
    if (!currentSession) startWorkout('freestyle');
    setParsing(true); setParseError('');
    try {
      const parsed = await parseUserInput(raw);
      if (parsed) {
        addSet({ exerciseId: parsed.exerciseId, weight: parsed.weight, reps: parsed.reps, duration: parsed.duration, rpe: parsed.rpe });
        setTextInput(''); setShowRest(true);
        if (hasApiKey()) {
          try { const c = await setFeedback(parsed.exerciseName, parsed.weight, parsed.reps, parsed.duration, parsed.rpe); setSetComment(c); }
          catch { setSetComment(''); }
        }
      } else { setParseError('没识别到动作。试试"高位下拉25公斤8次刚好"'); }
    } catch (e: any) { setParseError(e.message || '解析失败'); }
    setParsing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter') handleTextSubmit(textInput); }
  function getSetsForExercise(exId: string) { return sets.filter(s => s.exerciseId === exId); }

  const currentPlanEx = plan?.exercises[currentExIndex];
  const currentExercise = currentPlanEx ? DEFAULT_EXERCISES.find(e => e.id === currentPlanEx.exerciseId) : null;
  const isLastExercise = currentExIndex >= (plan?.exercises.length || 1) - 1;

  // ─── 今日状态 ───
  const today = new Date().toISOString().slice(0, 10);
  const todayTrained = sets.length > 0 || lastSession?.date === today;
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const restDayMsg = isWeekend ? '周末放松，走走也好 🚶' : '今日休息，肌肉在生长 💪';

  const greeting = () => { const h = new Date().getHours(); if (h < 6) return '夜深了'; if (h < 9) return '早上好'; if (h < 12) return '上午好'; if (h < 14) return '中午好'; if (h < 18) return '下午好'; return '晚上好'; };

  // ═════════════════ 渲染 ═════════════════

  if (loading) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text3)' }}>加载中...</div>;
  if (showRest && isResting) return <RestOverlay seconds={restSeconds} nextExercise={currentExercise?.name || ''} comment={setComment} onSkip={() => { skipRest(); setShowRest(false); setSetComment(''); }} />;
  if (isAnalyzing) return <div className="flex flex-col items-center justify-center h-full pb-24 safe-top"><p style={{ fontSize: '48px' }}>🧠</p><p style={{ fontSize: '16px', color: 'var(--color-text2)', marginTop: '12px' }}>臻臻在分析你的训练...</p></div>;

  // ─── 训练完成 ───
  if (feedback) {
    const strSets = sets.filter(s => { const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId); return e?.category === 'strength' || e?.category === 'bodyweight'; });
    const totalVolume = strSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
    const totalDuration = sets.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalDistance = sets.reduce((sum, s) => sum + (s.distance || 0), 0);
    const workoutDuration = currentSession?.endTime && currentSession?.startTime ? Math.round((currentSession.endTime - currentSession.startTime) / 60000) : null;
    const exercisesDone = [...new Set(sets.map(s => { const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId); return e?.name || s.exerciseId; }))];
    return (
      <div className="flex flex-col h-full overflow-y-auto px-5 pb-24 safe-top">
        <div className="text-center pt-6 pb-4"><p style={{ fontSize: '48px', margin: 0 }}>🏁</p><h2 style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0 0', letterSpacing: '-0.5px' }}>训练完成</h2></div>
        <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px', color: 'var(--color-text2)' }}>📊 今日数据</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="总组数" value={`${sets.length}`} unit="组" />
            <StatBox label="力量组" value={`${strSets.length}`} unit="组" />
            {totalVolume > 0 && <StatBox label="总容量" value={`${totalVolume.toLocaleString()}`} unit="kg" />}
            {totalDuration > 0 && <StatBox label="有氧时长" value={`${totalDuration}`} unit="分钟" />}
            {totalDistance > 0 && <StatBox label="有氧距离" value={`${totalDistance}`} unit="km" />}
            {workoutDuration && <StatBox label="训练用时" value={`${workoutDuration}`} unit="分钟" />}
          </div>
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}><span style={{ fontSize: '13px', color: 'var(--color-text3)' }}>完成了：{exercisesDone.join(' · ')}</span></div>
        </div>
        <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text2)' }}>💬 臻臻总评</h3>
          <p style={{ fontSize: '14px', lineHeight: 1.8, color: 'var(--color-text2)', whiteSpace: 'pre-wrap', margin: 0 }}>{feedback}</p>
        </div>
        <button onClick={() => window.location.reload()} className="w-full py-3.5 rounded-xl text-base font-semibold" style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}>返回首页</button>
      </div>
    );
  }

  // ─── 引导 ───
  if (onboardStep === 'chatting') {
    return (
      <div className="flex flex-col h-full pb-24 safe-top">
        <div className="px-5 pt-6 pb-3"><h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>臻臻</h1><p style={{ fontSize: '14px', color: 'var(--color-text3)', marginTop: '4px' }}>你的AI私人教练</p></div>
        <div className="flex-1 overflow-y-auto px-5"><div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><p style={{ fontSize: '15px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{onboardMsg}</p></div></div>
        <div className="px-5 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex gap-2">
            <input type="text" value={onboardInput} onChange={e => setOnboardInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleOnboardSend()} placeholder={onboardWaiting ? '臻臻在思考...' : '输入你的回答...'} disabled={onboardWaiting} className="flex-1 px-4 py-3 rounded-xl text-base outline-none" style={{ backgroundColor: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }} />
            <button onClick={handleOnboardSend} disabled={onboardWaiting || !onboardInput.trim()} className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold" style={{ backgroundColor: 'var(--color-accent)', color: '#000', opacity: onboardInput.trim() ? 1 : 0.3 }}>→</button>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════ 主界面 ═════════════════
  return (
    <div className="flex flex-col h-full pb-24 safe-top">
      {/* 问候 + 周状态 */}
      <div className="px-5 pt-6 pb-3">
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>{greeting()}，yooyy</h1>
        <div className="flex items-center gap-2 mt-1.5">
          {todayTrained ? (
            <span style={{ fontSize: '14px', color: 'var(--color-green)' }}>✅ 今天已练</span>
          ) : weekly.trainedDays > 0 ? (
            <span style={{ fontSize: '14px', color: 'var(--color-accent)' }}>本周 {weekly.trainedDays}/{weekly.goalDays} 天</span>
          ) : (
            <span style={{ fontSize: '14px', color: 'var(--color-text2)' }}>💤 本周还没开始</span>
          )}
          {!todayTrained && weekly.trainedDays === 0 && new Date().getDay() !== 1 && (
            <span style={{ fontSize: '13px', color: 'var(--color-text3)' }}>{restDayMsg}</span>
          )}
          {getAIStatus() === 'no-key' && <span style={{ fontSize: '12px', color: 'var(--color-text3)', marginLeft: 'auto' }}>⚠️ 未配置AI</span>}
          {getAIStatus() === 'error' && <span style={{ fontSize: '12px', color: 'var(--color-red)', marginLeft: 'auto' }}>🔴 AI连接失败</span>}
          {getAIStatus() === 'connected' && <span style={{ fontSize: '12px', color: 'var(--color-green)', marginLeft: 'auto' }}>🤖 AI就绪</span>}
        </div>
        {skipMsg && <div className="mt-2 p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-text2)' }}>{skipMsg}</div>}
      </div>

      {/* 计划 */}
      <div className="mx-5 rounded-2xl p-4 mb-3" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>📋 今日计划</h2>
          <button onClick={handleGeneratePlan} disabled={generating} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}>{generating ? '生成中...' : plan ? '重新生成' : '生成计划'}</button>
        </div>

        {plan ? (
          <div className="flex flex-col gap-2">
            {plan.exercises.map((ex, i) => {
              const exercise = DEFAULT_EXERCISES.find(e => e.id === ex.exerciseId);
              const exSets = getSetsForExercise(ex.exerciseId);
              const hasSets = exSets.length > 0;
              const isCurrent = i === currentExIndex;
              const isPast = i < currentExIndex;
              const isFuture = i > currentExIndex;
              const exKey = ex.exerciseId;
              const isCardio = exercise?.category === 'cardio';
              const isStretch = exercise?.category === 'stretch';

              return (
                <div key={i} className="rounded-xl overflow-hidden" style={{ backgroundColor: hasSets ? 'rgba(92,184,120,0.1)' : isCurrent ? 'var(--color-surface2)' : 'var(--color-surface)', border: `1.5px solid ${hasSets ? 'var(--color-green)' : isCurrent ? 'var(--color-accent)' : 'transparent'}`, opacity: isFuture ? 0.35 : 1 }}>
                  {/* 动作头部 */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '14px' }}>{isPast ? '✅' : isCurrent ? '▶️' : '⬛'}</span>
                      <span className="font-medium" style={{ fontSize: '15px', color: isFuture ? 'var(--color-text3)' : 'var(--color-text)' }}>{i + 1}. {exercise?.name || ex.exerciseId}</span>
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--color-text3)' }}>{ex.targetSets}×{ex.targetReps}</span>
                  </div>

                  {/* 已记录组 */}
                  {hasSets && (
                    <div className="px-4 pb-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ fontSize: '12px', color: 'var(--color-text3)' }}>
                      {exSets.map((s, j) => (
                        <span key={s.id}>
                          {j + 1}: {[s.weight && `${s.weight}kg`, s.reps && `${s.reps}次`, s.duration && `${s.duration}分钟`, s.rpe && `RPE ${s.rpe}`].filter(Boolean).join(' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 行内输入（仅当前动作） */}
                  {isCurrent && (
                    <div className="px-4 pb-2.5 pt-1 flex items-center gap-2" style={{ borderTop: hasSets ? '1px solid var(--color-border)' : 'none' }}>
                      {isCardio || isStretch ? (
                        <input type="number" inputMode="numeric" value={inlineDuration[exKey] || ''} onChange={e => setInlineDuration(prev => ({ ...prev, [exKey]: e.target.value }))} placeholder={isStretch ? '5分钟' : '20分钟'} className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                      ) : (
                        <>
                          <input type="number" inputMode="decimal" value={inlineWeight[exKey] || ''} onChange={e => setInlineWeight(prev => ({ ...prev, [exKey]: e.target.value }))} placeholder="kg" className="w-20 px-3 py-2 rounded-lg text-sm outline-none" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                          <input type="number" inputMode="numeric" value={inlineReps[exKey] || ''} onChange={e => setInlineReps(prev => ({ ...prev, [exKey]: e.target.value }))} placeholder="次" className="w-16 px-3 py-2 rounded-lg text-sm outline-none" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                        </>
                      )}
                      <button onClick={() => quickRecord(ex.exerciseId, exercise?.category || 'strength')} className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}>记录</button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 当前动作操作 */}
            {currentPlanEx && (
              <div className="flex gap-2 mt-1">
                <button onClick={handleSkipExercise} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-text2)' }}>{isLastExercise ? '完成全部 →' : '跳过此动作 →'}</button>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '14px', color: 'var(--color-text3)', lineHeight: 1.6 }}>还没有今日计划。点击"生成计划"让臻臻帮你安排。</p>
        )}
      </div>

      <div className="flex-1" />

      {/* 底部输入 + 完成按钮 */}
      <div className="px-5 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        {parseError && <div className="mb-2 p-2 rounded-lg text-sm" style={{ backgroundColor: 'rgba(224,85,85,0.1)', color: 'var(--color-red)' }}>{parseError} <button onClick={() => setParseError('')} className="underline ml-2">知道了</button></div>}
        <div className="flex gap-2 items-center">
          <input ref={inputRef} type="text" value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={parsing ? 'AI 解析中...' : '额外补充：跑步20分钟刚好'} disabled={parsing} className="flex-1 px-4 py-3 rounded-xl text-base outline-none" style={{ backgroundColor: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }} />
          <button onClick={() => handleTextSubmit(textInput)} disabled={parsing || !textInput.trim()} className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold" style={{ backgroundColor: 'var(--color-accent)', color: '#000', opacity: textInput.trim() ? 1 : 0.3 }}>→</button>
        </div>
        {currentSession && sets.length > 0 && (
          <div className="flex gap-2 mt-3">
            <button onClick={cancelWorkout} className="flex-1 py-3 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-text2)' }}>放弃</button>
            <button onClick={finishWorkout} className="flex-[2] py-3 rounded-xl text-base font-semibold" style={{ backgroundColor: 'var(--color-green)', color: '#000' }}>完成训练 · 查看总结</button>
          </div>
        )}
      </div>
    </div>
  );
}
