import { useState, useEffect, useRef, useCallback } from 'react';
import { db, getTodayPlan, getStreak, DEFAULT_EXERCISES, saveDailyPlan } from '../db/database';
import { generateTrainingPlan } from '../services/ai-coach';
import { parseTrainingInput } from '../services/format';
import { startSpeechRecognition, stopSpeechRecognition, isSpeechSupported } from '../services/speech';
import { useTraining } from '../hooks/useTraining';
import type { DailyPlan, WorkoutSession, TrainingSet } from '../types';

export default function Dashboard() {
  // ─── 计划状态 ───
  const [streak, setStreak] = useState(0);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);

  // ─── 训练状态（从 hook） ───
  const {
    currentSession,
    sets,
    isResting,
    restSeconds,
    feedback,
    isAnalyzing,
    activeExerciseId,
    setActiveExerciseId,
    startWorkout,
    addSet,
    removeSet,
    updateRPE,
    skipRest,
    finishWorkout,
    cancelWorkout,
  } = useTraining();

  // ─── 输入状态 ───
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordText, setRecordText] = useState('');
  const [parseError, setParseError] = useState('');
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── 初始化 ───
  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  // ─── 生成计划 ───
  async function handleGeneratePlan() {
    setGenerating(true);
    try {
      const recentSessions = await db.workoutSessions
        .orderBy('date').reverse().limit(10).toArray();
      const newPlan = await generateTrainingPlan(recentSessions, undefined);

      // 如果已有活跃训练，且当前是 planned，使用新计划
      setPlan(newPlan);
      await saveDailyPlan(newPlan);
    } catch (e: any) {
      alert(e.message || '生成失败');
    }
    setGenerating(false);
  }

  // ─── 开始训练（从计划） ───
  function beginPlannedWorkout() {
    if (!currentSession) {
      startWorkout('planned');
    }
  }

  // ─── 记录计划动作的一组 ───
  function quickRecordSet(exerciseId: string) {
    if (!currentSession) startWorkout('planned');
    setActiveExerciseId(exerciseId);
    setExpandedExerciseId(exerciseId);

    // 把动作名填入输入框，用户只需补重量次数
    const ex = DEFAULT_EXERCISES.find(e => e.id === exerciseId);
    if (ex) {
      setTextInput(`${ex.name} `);
      inputRef.current?.focus();
    }
  }

  // ─── 文字/语音提交 ───
  const handleSubmit = useCallback((raw: string) => {
    if (!raw.trim()) return;

    if (!currentSession) {
      startWorkout('freestyle');
    }

    // 尝试解析动作名+数量
    const parsed = parseTrainingInput(raw);
    if (parsed) {
      addSet(parsed);
      setParseError('');
    } else {
      // 无法解析时，检查是否只有动作名（从计划快捷填入后用户补充了内容）
      // 尝试在输入里找动作名
      const ex = DEFAULT_EXERCISES.find(e => raw.includes(e.name));
      if (ex && activeExerciseId) {
        // 用活跃动作ID，只提取数字
        const weightMatch = raw.match(/(\d+\.?\d*)\s*(kg|公斤)?/i);
        const repsMatch = raw.match(/(\d+)\s*(次|个|rep)/i);
        addSet({
          exerciseId: activeExerciseId,
          weight: weightMatch ? parseFloat(weightMatch[1]) : undefined,
          reps: repsMatch ? parseInt(repsMatch[1]) : undefined,
        });
        setParseError('');
      } else {
        setParseError(`没听懂，请说清楚。比如"高位下拉 25公斤 8次"`);
      }
    }

    setTextInput('');
    setRecordText('');
  }, [currentSession, activeExerciseId, startWorkout, addSet]);

  // ─── 语音 ───
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopSpeechRecognition();
      setIsRecording(false);
      return;
    }

    if (!isSpeechSupported()) {
      alert('你的浏览器不支持语音输入。请在 Safari 中打开。');
      return;
    }

    setIsRecording(true);
    setRecordText('');

    startSpeechRecognition(
      (result) => {
        setRecordText(result.transcript);
        if (result.isFinal) {
          handleSubmit(result.transcript);
          setIsRecording(false);
        }
      },
      (error) => {
        setParseError(error);
        setIsRecording(false);
      },
    );
  }, [isRecording, handleSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(textInput);
    }
  };

  // ─── 获取某个动作已记录的所有组 ───
  function getSetsForExercise(exerciseId: string): TrainingSet[] {
    return sets.filter(s => s.exerciseId === exerciseId);
  }

  // ─── 问候语 ───
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

  // ─── 加载中 ───
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text3)' }}>
        加载中...
      </div>
    );
  }

  // ─── 分析中 ───
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full pb-24 safe-top">
        <p style={{ fontSize: '48px' }}>🧠</p>
        <p style={{ fontSize: '16px', color: 'var(--color-text2)', marginTop: '12px' }}>
          臻臻在分析你的训练...
        </p>
      </div>
    );
  }

  // ─── 训练完成 ───
  if (feedback) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 pb-24 safe-top">
        <div className="text-center mb-8">
          <p style={{ fontSize: '48px', margin: 0 }}>✅</p>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '12px 0 4px' }}>训练完成</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text3)' }}>
            {sets.length} 组已完成
          </p>
        </div>

        <div
          className="w-full rounded-2xl p-5 mb-6"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h3 className="font-semibold mb-2" style={{ fontSize: '15px' }}>💬 臻臻点评</h3>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text2)', whiteSpace: 'pre-wrap' }}>
            {feedback}
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3.5 rounded-xl text-base font-semibold"
          style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
        >
          返回首页
        </button>
      </div>
    );
  }

  // ─── 主界面 ───
  return (
    <div className="flex flex-col h-full pb-24 safe-top">
      {/* ======== 顶部问候 ======== */}
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
        </div>
      </div>

      {/* ======== 今日计划 ======== */}
      <div
        className="mx-5 rounded-2xl p-4"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>📋 今日计划</h2>
          {!plan && (
            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
            >
              {generating ? '生成中...' : '生成计划'}
            </button>
          )}
        </div>

        {plan ? (
          <div className="flex flex-col gap-1.5">
            {plan.exercises.map((ex, i) => {
              const exercise = DEFAULT_EXERCISES.find(e => e.id === ex.exerciseId);
              const exerciseSets = getSetsForExercise(ex.exerciseId);
              const isExpanded = expandedExerciseId === ex.exerciseId;
              const hasSets = exerciseSets.length > 0;

              return (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden transition-all"
                  style={{
                    backgroundColor: 'var(--color-surface2)',
                    border: `1.5px solid ${
                      hasSets
                        ? 'var(--color-green)'
                        : isExpanded
                          ? 'var(--color-accent)'
                          : 'transparent'
                    }`,
                  }}
                >
                  {/* 动作头部 */}
                  <button
                    onClick={() => {
                      beginPlannedWorkout();
                      setExpandedExerciseId(isExpanded ? null : ex.exerciseId);
                      if (!isExpanded) setActiveExerciseId(ex.exerciseId);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '14px' }}>
                        {hasSets ? '✅' : '⬜'}
                      </span>
                      <span className="font-medium" style={{ fontSize: '15px' }}>
                        {exercise?.name || ex.exerciseId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '13px', color: 'var(--color-text3)' }}>
                        {ex.targetSets}×{ex.targetReps}
                        {ex.targetWeight ? ` ${ex.targetWeight}kg` : ''}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text3)' }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {/* 展开：已记录组 + 添加按钮 */}
                  {isExpanded && (
                    <div
                      className="px-4 pb-3 slide-up"
                      style={{ borderTop: '1px solid var(--color-border)' }}
                    >
                      {exerciseSets.length > 0 && (
                        <div className="flex flex-col gap-1 mt-2">
                          {exerciseSets.map((set, j) => (
                            <div
                              key={set.id}
                              className="flex items-center justify-between py-1.5 px-3 rounded-lg"
                              style={{ backgroundColor: 'var(--color-surface)' }}
                            >
                              <span style={{ fontSize: '14px', color: 'var(--color-text2)' }}>
                                第{j + 1}组：
                                {set.weight && ` ${set.weight}kg`}
                                {set.reps && ` ${set.reps}次`}
                                {set.distance && ` ${set.distance}km`}
                                {set.duration && ` ${set.duration}分钟`}
                              </span>
                              <div className="flex items-center gap-1">
                                {[6, 7, 8, 9, 10].map(rpe => (
                                  <button
                                    key={rpe}
                                    onClick={() => updateRPE(set.id, rpe)}
                                    className="w-6 h-6 rounded-full text-xs font-medium"
                                    style={{
                                      backgroundColor: set.rpe === rpe ? 'var(--color-accent)' : 'var(--color-surface2)',
                                      color: set.rpe === rpe ? '#000' : 'var(--color-text3)',
                                    }}
                                  >
                                    {rpe}
                                  </button>
                                ))}
                                <button
                                  onClick={() => removeSet(set.id)}
                                  className="ml-1 w-5 h-5 rounded-full text-xs flex items-center justify-center"
                                  style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-red)' }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          quickRecordSet(ex.exerciseId);
                        }}
                        className="w-full mt-2 py-2 rounded-lg text-sm font-medium"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-accent)',
                          border: '1px dashed var(--color-accent)',
                        }}
                      >
                        + 添加一组
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: '14px', color: 'var(--color-text3)', lineHeight: 1.6 }}>
            还没有今日计划。点击"生成计划"，臻臻为你想好今天练什么。
          </p>
        )}
      </div>

      {/* ======== 组间休息 ======== */}
      {isResting && (
        <div
          className="mx-5 mt-3 p-3 rounded-xl text-center"
          style={{ backgroundColor: 'var(--color-surface2)' }}
        >
          <div className="flex items-center justify-center gap-3">
            <span style={{ fontSize: '13px', color: 'var(--color-text2)' }}>⏱️ 组间休息</span>
            <span style={{ fontSize: '28px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {restSeconds}s
            </span>
            <button
              onClick={skipRest}
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text2)' }}
            >
              跳过
            </button>
          </div>
        </div>
      )}

      {/* ======== 错误提示 ======== */}
      {parseError && (
        <div
          className="mx-5 mt-2 p-3 rounded-xl text-sm"
          style={{ backgroundColor: 'rgba(224,85,85,0.1)', color: 'var(--color-red)' }}
        >
          {parseError}
          <button onClick={() => setParseError('')} className="ml-3 underline">知道了</button>
        </div>
      )}

      {/* ======== 间距 ======== */}
      <div className="flex-1" />

      {/* ======== 底部操作区 ======== */}
      <div
        className="px-5 py-3"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        {/* 输入框 */}
        <div className="flex gap-2 items-center mb-3">
          <input
            ref={inputRef}
            type="text"
            value={isRecording ? recordText : textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording
                ? '正在聆听...'
                : activeExerciseId
                  ? '输入重量和次数...'
                  : '说或输入动作：高位下拉 25公斤 8次'
            }
            disabled={isRecording}
            className="flex-1 px-4 py-3 rounded-xl text-base outline-none"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: `1.5px solid ${isRecording ? 'var(--color-red)' : 'var(--color-border)'}`,
              color: 'var(--color-text)',
            }}
          />

          <button
            onClick={toggleRecording}
            className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
              isRecording ? 'recording-pulse' : ''
            }`}
            style={{
              backgroundColor: isRecording ? 'var(--color-red)' : 'var(--color-surface)',
              border: `1.5px solid ${isRecording ? 'var(--color-red)' : 'var(--color-border)'}`,
            }}
          >
            🎤
          </button>

          <button
            onClick={() => handleSubmit(isRecording ? recordText : textInput)}
            disabled={!textInput.trim() && !isRecording}
            className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl"
            style={{
              backgroundColor: 'var(--color-accent)',
              opacity: textInput.trim() || isRecording ? 1 : 0.3,
              color: '#000',
            }}
          >
            +
          </button>
        </div>

        {/* 动作快捷选择 */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span style={{ fontSize: '11px', color: 'var(--color-text3)', lineHeight: '28px' }}>
            快捷：
          </span>
          {DEFAULT_EXERCISES.filter(e => e.category === 'strength' || e.category === 'cardio').slice(0, 8).map(ex => (
            <button
              key={ex.id}
              onClick={() => {
                beginPlannedWorkout();
                setTextInput(`${ex.name} `);
                inputRef.current?.focus();
              }}
              className="px-2 py-1 rounded-lg text-xs font-medium"
              style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-text2)' }}
            >
              {ex.name}
            </button>
          ))}
        </div>

        {/* 完成 / 放弃按钮 */}
        {currentSession && sets.length > 0 && (
          <div className="flex gap-2">
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
    </div>
  );
}
