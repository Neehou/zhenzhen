import { useState, useEffect, useRef } from 'react';
import { db, getTodayPlan, getWeeklyStats, DEFAULT_EXERCISES, saveDailyPlan, getOrCreateProfile } from '../db/database';
import { generateTrainingPlan, coachChat, hasApiKey, onboardingMessage, parseOnboardingAnswer, skipComment, getAIStatus, processOfflineQueue, getOfflineQueue } from '../services/ai-coach';
import { useTraining } from '../hooks/useTraining';
import { IconFlag, IconStrength, IconBrain, IconRefresh, IconSparkle, IconSend, IconSkip, IconCheck, IconDumbbell } from '../components/Icons';
import type { DailyPlan, WorkoutSession } from '../types';

/* ═══════════════════ 训练完成页 ═══════════════════ */

function StatBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="glass-raise rounded-card2 p-3.5 text-center">
      <p className="stat-number" style={{ color: 'var(--color-accent)' }}>{value}</p>
      <p className="stat-label">{unit}</p>
      <p style={{ fontSize: '11px', color: 'var(--color-text3)', marginTop: 1 }}>{label}</p>
    </div>
  );
}

function CompletionScreen({ sets, feedback, currentSession }: {
  sets: any[]; feedback: string; currentSession: any;
}) {
  const strSets = sets.filter((s: any) => {
    const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId);
    return e?.category === 'strength' || e?.category === 'bodyweight';
  });
  const totalVolume = strSets.reduce((sum: number, s: any) => sum + (s.weight || 0) * (s.reps || 0), 0);
  const totalDuration = sets.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
  const totalDistance = sets.reduce((sum: number, s: any) => sum + (s.distance || 0), 0);
  const workoutMin = currentSession?.endTime && currentSession?.startTime
    ? Math.round((currentSession.endTime - currentSession.startTime) / 60000) : null;
  const exercisesDone = [...new Set(sets.map((s: any) => {
    const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId);
    return e?.name || s.exerciseId;
  }))];

  const stats: [string, string, string][] = [
    ['总组数', `${sets.length}`, '组'],
    ['力量组', `${strSets.length}`, '组'],
  ];
  if (totalVolume > 0) stats.push(['总容量', totalVolume.toLocaleString(), 'kg']);
  if (totalDuration > 0) stats.push(['有氧时长', `${totalDuration}`, '分钟']);
  if (totalDistance > 0) stats.push(['有氧距离', `${totalDistance}`, 'km']);
  if (workoutMin) stats.push(['训练用时', `${workoutMin}`, '分钟']);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 pb-28 safe-top fade-in">
      {/* 头部 */}
      <div className="text-center pt-8 pb-6">
        <div className="scale-in" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
          <IconFlag size={48} color="var(--color-accent)" />
        </div>
        <h2 className="heading-xl" style={{ margin: 0 }}>训练完成</h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text3)', marginTop: '6px' }}>
          {exercisesDone.join(' · ')}
        </p>
      </div>

      {/* 数据卡片 */}
      <div className="glass rounded-card p-5 mb-4 fade-up delay-1">
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text2)', margin: '0 0 14px', letterSpacing: '1px', textTransform: 'uppercase' }}>
          今日数据
        </h3>
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map(([label, value, unit]) => (
            <StatBox key={label} label={label} value={value} unit={unit} />
          ))}
        </div>
      </div>

      {/* 臻臻总评 */}
      <div className="glass rounded-card p-5 mb-4 fade-up delay-2">
        <div className="flex items-center gap-2 mb-3">
          <IconBrain size={22} color="var(--color-accent)" />
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>臻臻总评</h3>
        </div>
        <p style={{ fontSize: '14px', lineHeight: 1.9, color: 'var(--color-text2)', whiteSpace: 'pre-wrap', margin: 0 }}>
          {feedback}
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="btn-primary w-full py-4 rounded-btn text-base fade-up delay-3"
      >
        返回首页
      </button>
    </div>
  );
}

/* ═══════════════════ 引导页 ═══════════════════ */

function OnboardingChat({ onboardMsg, onboardInput, setOnboardInput, onboardWaiting, onSend }: {
  onboardMsg: string; onboardInput: string; setOnboardInput: (v: string) => void;
  onboardWaiting: boolean; onSend: () => void;
}) {
  return (
    <div className="flex flex-col h-full pb-24 safe-top fade-in">
      <div className="px-5 pt-8 pb-4">
        <h1 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>臻臻</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text3)', marginTop: '4px' }}>你的 AI 私人教练</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        <div className="glass rounded-card p-5 scale-in">
          <p style={{ fontSize: '15px', lineHeight: 1.9, whiteSpace: 'pre-wrap', margin: 0 }}>
            {onboardMsg}
          </p>
          {onboardWaiting && (
            <div className="flex gap-1.5 mt-3" style={{ alignItems: 'center' }}>
              <span style={{ width:6,height:6,borderRadius:3,backgroundColor:'var(--color-accent)',animation:'bounce-dot 1.4s infinite' }} />
              <span style={{ width:6,height:6,borderRadius:3,backgroundColor:'var(--color-accent)',animation:'bounce-dot 1.4s infinite .2s' }} />
              <span style={{ width:6,height:6,borderRadius:3,backgroundColor:'var(--color-accent)',animation:'bounce-dot 1.4s infinite .4s' }} />
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex gap-2">
          <input
            type="text" value={onboardInput}
            onChange={e => setOnboardInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSend()}
            placeholder={onboardWaiting ? '臻臻在思考...' : '输入你的回答...'}
            disabled={onboardWaiting}
            className="input-gym flex-1"
          />
          <button
            onClick={onSend}
            disabled={onboardWaiting || !onboardInput.trim()}
            className="btn-primary shrink-0 w-12 h-12 rounded-btn flex items-center justify-center text-lg"
            style={{ opacity: onboardInput.trim() ? 1 : 0.3 }}
          >
            <IconSend size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ 主页面 ═══════════════════ */

export default function Dashboard() {
  const [weekly, setWeekly] = useState({ trainedDays: 0, goalDays: 3 });
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
  const { currentSession, sets, feedback, isAnalyzing, hasRestored,
    startWorkout, addSet, finishWorkout, cancelWorkout } = useTraining();
  const [textInput, setTextInput] = useState('');
  const [awaitingAI, setAwaitingAI] = useState(false);
  const [parseError, setParseError] = useState('');
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [skipMsg, setSkipMsg] = useState('');
  const [aiChats, setAiChats] = useState<{ role: 'user' | 'coach'; text: string; time: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [inlineWeight, setInlineWeight] = useState<Record<string, string>>({});
  const [inlineReps, setInlineReps] = useState<Record<string, string>>({});
  const [inlineDuration, setInlineDuration] = useState<Record<string, string>>({});

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

        if (!p && !cancelled) {
          try {
            const recent = await db.workoutSessions.orderBy('date').reverse().limit(10).toArray();
            const newPlan = await generateTrainingPlan(recent, undefined);
            if (!cancelled) { setPlan(newPlan); await saveDailyPlan(newPlan); }
          } catch { /* auto-generate failed, user can click button */ }
        }
      } catch (e) { console.error('初始化失败', e); setOnboardStep('done'); }
      if (!cancelled) setLoading(false);

      if (hasApiKey() && getOfflineQueue().length > 0) processOfflineQueue();
    })();
    return () => { cancelled = true; };
  }, []);

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

  async function handleGeneratePlan() {
    setGenerating(true);
    try {
      const recent = await db.workoutSessions.orderBy('date').reverse().limit(10).toArray();
      const newPlan = await generateTrainingPlan(recent, undefined);
      setPlan(newPlan); await saveDailyPlan(newPlan); setCurrentExIndex(0);
    } catch (e: any) { alert(e.message || '生成失败'); }
    setGenerating(false);
  }

  async function submitToAI(raw: string, source: 'text' | 'inline', exerciseId?: string) {
    if (!raw.trim() && !exerciseId) return;
    if (!currentSession) startWorkout('planned');
    setAwaitingAI(true); setParseError('');
    setAiChats(prev => [...prev, { role: 'user', text: raw || '(行内录入)', time: Date.now() }]);

    try {
      if (exerciseId && source === 'inline') {
        const ex = DEFAULT_EXERCISES.find(e => e.id === exerciseId);
        const w = inlineWeight[exerciseId] ? parseFloat(inlineWeight[exerciseId]) : undefined;
        const r = inlineReps[exerciseId] ? parseInt(inlineReps[exerciseId]) : undefined;
        const d = inlineDuration[exerciseId] ? parseInt(inlineDuration[exerciseId]) : undefined;
        const text = `${ex?.name} ${w ? w + 'kg' : ''} ${r ? r + '次' : ''} ${d ? d + '分钟' : ''}`.trim();
        if (!text) { setAwaitingAI(false); return; }
        const res = await coachChat(text);
        if (res) {
          addSet({ exerciseId, weight: w, reps: r, duration: d }, res.comment);
          setInlineWeight(prev => ({ ...prev, [exerciseId]: '' }));
          setInlineReps(prev => ({ ...prev, [exerciseId]: '' }));
          setInlineDuration(prev => ({ ...prev, [exerciseId]: '' }));
          setAiChats(prev => [...prev, { role: 'coach', text: res.comment, time: Date.now() }]);
        }
      } else {
        const res = await coachChat(raw);
        if (res) {
          if (res.parsed) {
            const setCount = res.parsed.sets || 1;
            for (let i = 0; i < setCount; i++) {
              addSet({
                exerciseId: res.parsed.exerciseId,
                weight: res.parsed.weight, reps: res.parsed.reps,
                distance: res.parsed.distance, duration: res.parsed.duration,
                rpe: res.parsed.rpe,
              }, i === 0 ? res.comment : undefined);
            }
          }
          setTextInput('');
          setAiChats(prev => [...prev, { role: 'coach', text: res.comment, time: Date.now() }]);
        }
      }
    } catch (e: any) { setParseError(e.message || 'AI通信失败'); }
    setAwaitingAI(false);
  }

  function quickRecord(exerciseId: string) { submitToAI('', 'inline', exerciseId); }
  function handleTextSubmit(raw: string) { submitToAI(raw, 'text'); }
  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter' && !awaitingAI) handleTextSubmit(textInput); }

  async function handleSkipExercise() {
    if (!plan) return;
    const ex = plan.exercises[currentExIndex];
    if (!ex) return;
    const e = DEFAULT_EXERCISES.find(x => x.id === ex.exerciseId);
    const msg = await skipComment(e?.name || ex.exerciseId, e?.category || 'strength');
    setSkipMsg(msg); setTimeout(() => setSkipMsg(''), 3000);
    setAiChats(prev => [...prev, { role: 'coach', text: msg, time: Date.now() }]);
    setCurrentExIndex(prev => Math.min(prev + 1, (plan?.exercises.length || 1) - 1));
  }

  function getSetsForExercise(exId: string) { return sets.filter(s => s.exerciseId === exId); }

  const currentPlanEx = plan?.exercises[currentExIndex];
  const isLastExercise = currentExIndex >= (plan?.exercises.length || 1) - 1;
  const today = new Date().toISOString().slice(0, 10);
  const todayTrained = sets.length > 0 || lastSession?.date === today;
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了'; if (h < 9) return '早上好'; if (h < 12) return '上午好';
    if (h < 14) return '中午好'; if (h < 18) return '下午好'; return '晚上好';
  };
  const progressPct = weekly.goalDays > 0 ? Math.min(100, Math.round((weekly.trainedDays / weekly.goalDays) * 100)) : 0;

  if (loading || !hasRestored) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 24 }} />
      <div className="skeleton" style={{ width: 120, height: 16 }} />
      <div className="skeleton" style={{ width: 80, height: 12 }} />
    </div>
  );

  if (isAnalyzing) return (
    <div className="flex flex-col items-center justify-center h-full pb-24 safe-top fade-in">
      <div className="scale-in" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><IconBrain size={48} color="var(--color-accent)" /></div>
      <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text)' }}>臻臻在分析你的训练</p>
      <p style={{ fontSize: '13px', color: 'var(--color-text3)', marginTop: '6px' }}>稍等片刻...</p>
    </div>
  );

  if (feedback) return <CompletionScreen sets={sets} feedback={feedback} currentSession={currentSession} />;
  if (onboardStep === 'chatting') return (
    <OnboardingChat onboardMsg={onboardMsg} onboardInput={onboardInput}
      setOnboardInput={setOnboardInput} onboardWaiting={onboardWaiting} onSend={handleOnboardSend} />
  );

  /* ═══════════════════ 主界面 ═══════════════════ */
  return (
    <div className="flex flex-col h-full pb-24 safe-top">
      {/* ── 头部 ── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-.4px', margin: 0, lineHeight: 1.2 }}>
              {greeting()}<span style={{ color: 'var(--color-text3)', fontWeight: 400, fontSize: '16px', marginLeft: '8px' }}>yooyy</span>
            </h1>
            <div className="flex items-center gap-3 mt-2">
              {/* 本周进度条 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '48px', height: '6px', borderRadius: '3px',
                  backgroundColor: 'var(--color-border2)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${progressPct}%`, height: '100%', borderRadius: '3px',
                    background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent2))',
                    transition: 'width .6s cubic-bezier(.16,1,.3,1)',
                  }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)' }}>
                  {weekly.trainedDays}/{weekly.goalDays}
                </span>
              </div>
              {todayTrained && (
                <span className="badge badge-green">今日已练</span>
              )}
            </div>
          </div>

          {/* AI 状态指示器 */}
          <div style={{
            width: '10px', height: '10px', borderRadius: '5px', marginTop: '6px',
            backgroundColor: getAIStatus() === 'connected' ? 'var(--color-green)'
              : getAIStatus() === 'no-key' ? 'var(--color-text3)' : 'var(--color-red)',
            boxShadow: getAIStatus() === 'connected'
              ? '0 0 8px rgba(76,217,100,.4)' : 'none',
          }} title={getAIStatus() === 'connected' ? 'AI 就绪' : getAIStatus() === 'no-key' ? '未配置 AI' : 'AI 离线'} />
        </div>

        {skipMsg && (
          <div className="mt-2 p-2.5 rounded-card2 fade-down" style={{ backgroundColor: 'var(--color-surface2)', fontSize: '13px', color: 'var(--color-text2)' }}>
            {skipMsg}
          </div>
        )}
      </div>

      {/* ── 今日计划卡片 ── */}
      <div className="mx-5 glass rounded-card p-4 mb-3 fade-up delay-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <IconDumbbell size={20} color="var(--color-text2)" />
            <h2 className="heading-md" style={{ margin: 0 }}>今日计划</h2>
          </div>
          <button
            onClick={handleGeneratePlan} disabled={generating}
            className="btn-primary px-3.5 py-1.5 rounded-btn text-sm"
          >
            {generating ? '生成中...' : plan ? <span><IconRefresh size={14} /> 重新生成</span> : <span><IconSparkle size={14} /> 生成计划</span>}
          </button>
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

              // 类别色标
              const catColor = exercise?.category === 'strength' ? 'var(--color-blue)'
                : exercise?.category === 'cardio' ? 'var(--color-orange)'
                : exercise?.category === 'bodyweight' ? 'var(--color-purple)'
                : 'var(--color-green)';

              return (
                <div key={i} className="rounded-card2 overflow-hidden fade-up"
                  style={{
                    backgroundColor: hasSets ? 'var(--color-green2)' : 'var(--color-surface2)',
                    border: `1.5px solid ${
                      hasSets ? 'rgba(76,217,100,.25)' :
                      isCurrent ? 'rgba(255,255,255,.1)' : 'transparent'
                    }`,
                    opacity: isFuture ? 0.45 : 1,
                    transition: 'all .2s',
                  }}
                >
                  {/* 动作头部 */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        backgroundColor: isPast ? 'var(--color-green2)' : 'rgba(255,255,255,.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 700,
                        color: isPast ? 'var(--color-green)' : isCurrent ? 'var(--color-accent)' : 'var(--color-text3)',
                      }}>
                        {isPast ? <IconCheck size={14} color="var(--color-green)" /> : i + 1}
                      </span>
                      <div>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: isFuture ? 'var(--color-text3)' : 'var(--color-text)' }}>
                          {exercise?.name || ex.exerciseId}
                        </span>
                        <span style={{
                          fontSize: '10px', fontWeight: 600, color: catColor,
                          marginLeft: '8px', padding: '2px 6px', borderRadius: '4px',
                          backgroundColor: catColor.replace(')', ',.15)').replace('rgb', 'rgba'),
                        }}>
                          {exercise?.category === 'strength' ? '力量' : exercise?.category === 'cardio' ? '有氧' : exercise?.category === 'bodyweight' ? '自重' : '拉伸'}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text3)' }}>
                      {ex.targetSets}×{ex.targetReps}
                    </span>
                  </div>

                  {/* 已完成的组 */}
                  {hasSets && (
                    <div className="px-4 pb-2 flex flex-wrap gap-2" style={{ fontSize: '12px', color: 'var(--color-text3)' }}>
                      {exSets.map((s: any, j: number) => (
                        <span key={s.id} style={{
                          padding: '2px 8px', borderRadius: '6px',
                          backgroundColor: 'rgba(255,255,255,.05)', fontSize: '11px',
                        }}>
                          组{j + 1}: {[s.weight && `${s.weight}kg`, s.reps && `${s.reps}次`, s.duration && `${s.duration}分`, s.rpe && `RPE${s.rpe}`].filter(Boolean).join(' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 当前动作的快速录入 */}
                  {isCurrent && (
                    <div className="px-4 pb-3 pt-1 flex items-center gap-2" style={{ borderTop: hasSets ? '1px solid var(--color-border)' : 'none' }}>
                      {isCardio || isStretch ? (
                        <input type="number" inputMode="numeric"
                          value={inlineDuration[exKey] || ''}
                          onChange={e => setInlineDuration(prev => ({ ...prev, [exKey]: e.target.value }))}
                          placeholder={isStretch ? '5分钟' : '20分钟'}
                          className="input-gym flex-1" style={{ fontSize: '13px', padding: '8px 12px' }}
                        />
                      ) : (
                        <>
                          <input type="number" inputMode="decimal"
                            value={inlineWeight[exKey] || ''}
                            onChange={e => setInlineWeight(prev => ({ ...prev, [exKey]: e.target.value }))}
                            placeholder="kg"
                            className="input-gym" style={{ width: '72px', fontSize: '13px', padding: '8px 12px' }}
                          />
                          <input type="number" inputMode="numeric"
                            value={inlineReps[exKey] || ''}
                            onChange={e => setInlineReps(prev => ({ ...prev, [exKey]: e.target.value }))}
                            placeholder="次"
                            className="input-gym" style={{ width: '56px', fontSize: '13px', padding: '8px 12px' }}
                          />
                        </>
                      )}
                      <button
                        onClick={() => quickRecord(ex.exerciseId)}
                        className="btn-primary shrink-0 px-4 py-2 rounded-btn text-sm font-bold"
                      >
                        记录
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {currentPlanEx && (
              <div className="flex gap-2 mt-1 fade-up delay-1">
                <button onClick={handleSkipExercise}
                  className="btn-ghost flex-1 py-3 rounded-btn text-sm"
                >
                  {isLastExercise ? <span><IconFlag size={14} /> 完成全部</span> : <span><IconSkip size={14} /> 跳过此动作</span>}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <IconDumbbell size={40} color="var(--color-text3)" />
            <p style={{ fontSize: '14px', color: 'var(--color-text2)', lineHeight: 1.6, margin: 0 }}>
              还没有今日计划
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text3)', marginTop: '4px' }}>
              点击「生成计划」让臻臻帮你安排今天的训练
            </p>
          </div>
        )}
      </div>

      {/* ── AI 对话气泡 ── */}
      {aiChats.filter(c => c.role === 'coach').length > 0 && (
        <div className="flex-1 overflow-y-auto px-5">
          <div className="flex flex-col gap-2 pb-1">
            {aiChats.filter(c => c.role === 'coach').slice(-4).map((chat, i) => (
              <div key={i} className="glass rounded-card2 p-3.5 slide-up"
                style={{ animationDelay: `${i * .05}s` }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '6px',
                    backgroundColor: 'var(--color-accent3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><IconStrength size={12} color="var(--color-accent)" /></span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)' }}>臻臻</span>
                </div>
                <p style={{ fontSize: '14px', lineHeight: 1.75, color: 'var(--color-text2)', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {chat.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {aiChats.length === 0 && <div className="flex-1" />}

      {/* ── 底部输入 ── */}
      <div className="px-5 pt-3 pb-1">
        {parseError && (
          <div className="mb-2 p-2.5 rounded-card2 fade-down"
            style={{ backgroundColor: 'var(--color-red2)', color: 'var(--color-red)', fontSize: '13px' }}
          >
            {parseError}
            <button onClick={() => setParseError('')} style={{ marginLeft: '8px', fontWeight: 600, textDecoration: 'underline', color: 'var(--color-red)' }}>
              知道了
            </button>
          </div>
        )}
        <div style={{
          display: 'flex', gap: '10px', alignItems: 'center',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px', border: '1.5px solid var(--color-border)',
          padding: '6px 6px 6px 18px',
          transition: 'border-color .2s',
        }}>
          <input ref={inputRef} type="text"
            value={textInput} onChange={e => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={awaitingAI ? '臻臻在思考...' : '跟臻臻说：跑步5km 30分钟有点累'}
            disabled={awaitingAI}
            style={{
              flex: 1, backgroundColor: 'transparent', border: 'none',
              outline: 'none', color: 'var(--color-text)', fontSize: '15px',
              padding: '8px 0',
            }}
          />
          <button
            onClick={() => handleTextSubmit(textInput)}
            disabled={awaitingAI || !textInput.trim()}
            className="btn-primary"
            style={{
              width: '40px', height: '40px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', fontWeight: 700, opacity: textInput.trim() ? 1 : 0.3,
              transition: 'opacity .2s, transform .15s',
              flexShrink: 0,
            }}
          >
            <IconSend size={18} />
          </button>
        </div>

        {currentSession && sets.length > 0 && (
          <div className="flex gap-2 mt-3 fade-up">
            <button onClick={cancelWorkout} className="btn-ghost flex-1 py-3.5 rounded-btn text-sm font-semibold">
              放弃
            </button>
            <button onClick={finishWorkout} className="btn-primary flex-[2] py-3.5 rounded-btn text-base font-bold">
              完成训练 · 查看总结
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
