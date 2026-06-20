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
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);

  // 开始训练
  const startWorkout = useCallback((type: 'planned' | 'freestyle' = 'freestyle') => {
    const session: WorkoutSession = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      startTime: Date.now(),
      sets: [],
      type,
    };
    setCurrentSession(session);
    setSets([]);
    setFeedback(null);
    setActiveExerciseId(null);
  }, []);

  // 添加一组（可传 exerciseId 跳过动作名解析）
  const addSet = useCallback((
    input: ParsedTrainingInput | { exerciseId: string; weight?: number; reps?: number; distance?: number; duration?: number; rpe?: number },
  ) => {
    let exerciseId: string;

    if ('exerciseId' in input && input.exerciseId) {
      // 计划动作直接传 ID
      exerciseId = input.exerciseId;
    } else {
      // 语音/文字解析
      const parsed = input as ParsedTrainingInput;
      const exercise = DEFAULT_EXERCISES.find(
        e => e.name === parsed.exerciseName || e.id === parsed.exerciseName
      );
      exerciseId = exercise?.id || parsed.exerciseName;
    }

    const newSet: TrainingSet = {
      id: generateId(),
      exerciseId,
      weight: input.weight,
      reps: input.reps,
      distance: input.distance,
      duration: input.duration,
      rpe: input.rpe as TrainingSet['rpe'],
      completed: true,
      timestamp: Date.now(),
    };

    setSets(prev => [...prev, newSet]);
    setIsResting(true);
    setRestSeconds(90);
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

  const skipRest = useCallback(() => {
    setIsResting(false);
    setRestSeconds(0);
  }, []);

  const removeSet = useCallback((setId: string) => {
    setSets(prev => prev.filter(s => s.id !== setId));
  }, []);

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

    await db.workoutSessions.put(session);

    setIsAnalyzing(true);
    try {
      const recentSessions = await db.workoutSessions
        .orderBy('date')
        .reverse()
        .limit(10)
        .toArray();
      const analysis = await analyzeWorkout(session, recentSessions);

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
    setActiveExerciseId(null);
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
    setActiveExerciseId(null);
  }, [sets]);

  return {
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
  };
}
