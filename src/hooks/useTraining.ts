import { useState, useCallback, useEffect } from 'react';
import type { WorkoutSession, TrainingSet, ParsedTrainingInput } from '../types';
import { db, generateId, DEFAULT_EXERCISES } from '../db/database';
import { analyzeWorkout } from '../services/ai-coach';

export function useTraining() {
  const [currentSession, setCurrentSession] = useState<WorkoutSession | null>(null);
  const [sets, setSets] = useState<TrainingSet[]>([]);
  const [isResting, setIsResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 开始训练
  const startWorkout = useCallback(() => {
    const session: WorkoutSession = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      startTime: Date.now(),
      sets: [],
      type: 'freestyle',
    };
    setCurrentSession(session);
    setSets([]);
    setFeedback(null);
  }, []);

  // 添加一组
  const addSet = useCallback((parsed: ParsedTrainingInput) => {
    const exercise = DEFAULT_EXERCISES.find(
      e => e.name === parsed.exerciseName || e.id === parsed.exerciseName
    );

    const newSet: TrainingSet = {
      id: generateId(),
      exerciseId: exercise?.id || parsed.exerciseName,
      weight: parsed.weight,
      reps: parsed.reps,
      distance: parsed.distance,
      duration: parsed.duration,
      rpe: parsed.rpe,
      completed: true,
      timestamp: Date.now(),
    };

    setSets(prev => [...prev, newSet]);

    // 开始组间休息计时
    setIsResting(true);
    setRestSeconds(90); // 默认90秒
  }, []);

  // 倒计时
  useEffect(() => {
    if (!isResting || restSeconds <= 0) return;

    const timer = setInterval(() => {
      setRestSeconds(prev => {
        if (prev <= 1) {
          setIsResting(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isResting, restSeconds]);

  // 提前结束休息
  const skipRest = useCallback(() => {
    setIsResting(false);
    setRestSeconds(0);
  }, []);

  // 删除一组
  const removeSet = useCallback((setId: string) => {
    setSets(prev => prev.filter(s => s.id !== setId));
  }, []);

  // 更新RPE
  const updateRPE = useCallback((setId: string, rpe: number) => {
    setSets(prev =>
      prev.map(s => (s.id === setId ? { ...s, rpe: rpe as TrainingSet['rpe'] } : s))
    );
  }, []);

  // 结束训练
  const finishWorkout = useCallback(async () => {
    if (!currentSession) return;

    const session: WorkoutSession = {
      ...currentSession,
      endTime: Date.now(),
      sets,
    };

    // 存入数据库
    await db.workoutSessions.put(session);

    // AI 分析
    setIsAnalyzing(true);
    try {
      const recentSessions = await db.workoutSessions
        .orderBy('date')
        .reverse()
        .limit(10)
        .toArray();
      const analysis = await analyzeWorkout(session, recentSessions);

      // 更新 session 加入 AI 反馈
      const updatedSession = { ...session, aiFeedback: analysis };
      await db.workoutSessions.put(updatedSession);
      setFeedback(analysis);
    } catch (e) {
      console.error('分析失败:', e);
      setFeedback('训练已保存。分析功能需要 AI 服务，请检查网络或 API Key。');
    }
    setIsAnalyzing(false);

    setCurrentSession(null);
    setSets([]);
  }, [currentSession, sets]);

  // 放弃训练
  const cancelWorkout = useCallback(() => {
    if (sets.length > 0) {
      if (!window.confirm('确定放弃本次训练？已记录的数据将丢失。')) return;
    }
    setCurrentSession(null);
    setSets([]);
    setIsResting(false);
    setRestSeconds(0);
    setFeedback(null);
  }, [sets]);

  return {
    currentSession,
    sets,
    isResting,
    restSeconds,
    feedback,
    isAnalyzing,
    startWorkout,
    addSet,
    removeSet,
    updateRPE,
    skipRest,
    finishWorkout,
    cancelWorkout,
  };
}
