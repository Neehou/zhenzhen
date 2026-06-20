import { useState, useCallback, useEffect, useRef } from 'react';
import type { WorkoutSession, TrainingSet, ParsedTrainingInput } from '../types';
import { db, generateId, DEFAULT_EXERCISES } from '../db/database';
import { analyzeWorkout } from '../services/ai-coach';

const SESSION_KEY = 'zhenzhen-current-session';
const SETS_KEY = 'zhenzhen-current-sets';

function saveToStorage(session: WorkoutSession | null, sets: TrainingSet[]) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(SETS_KEY, JSON.stringify(sets));
  } else {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SETS_KEY);
  }
}

function loadFromStorage(): { session: WorkoutSession | null; sets: TrainingSet[] } | null {
  try {
    const rawSession = localStorage.getItem(SESSION_KEY);
    const rawSets = localStorage.getItem(SETS_KEY);
    if (!rawSession) return null;
    return {
      session: JSON.parse(rawSession),
      sets: rawSets ? JSON.parse(rawSets) : [],
    };
  } catch {
    return null;
  }
}

export function useTraining() {
  const [currentSession, setCurrentSession] = useState<WorkoutSession | null>(null);
  const [sets, setSets] = useState<TrainingSet[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastComment, setLastComment] = useState<string>('');
  const [hasRestored, setHasRestored] = useState(false);
  const sessionRef = useRef<WorkoutSession | null>(null);
  const setsRef = useRef<TrainingSet[]>([]);

  // 保持 ref 同步
  sessionRef.current = currentSession;
  setsRef.current = sets;

  // 挂载时恢复未完成的训练
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved?.session) {
      const now = Date.now();
      const age = now - saved.session.startTime;
      // 只恢复6小时内的训练（超过6小时说明用户放弃了）
      if (age < 6 * 60 * 60 * 1000) {
        setCurrentSession(saved.session);
        setSets(saved.sets);
      } else {
        saveToStorage(null, []);
      }
    }
    setHasRestored(true);
  }, []);

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
    setLastComment('');
    saveToStorage(session, []);
  }, []);

  const addSet = useCallback((
    input: ParsedTrainingInput | { exerciseId: string; weight?: number; reps?: number; distance?: number; duration?: number; rpe?: number },
    comment?: string,
  ) => {
    let exerciseId: string;
    if ('exerciseId' in input && input.exerciseId) {
      exerciseId = input.exerciseId;
    } else {
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

    setSets(prev => {
      const updated = [...prev, newSet];
      // 持久化到 localStorage
      if (sessionRef.current) {
        saveToStorage(sessionRef.current, updated);
      }
      return updated;
    });
    if (comment) setLastComment(comment);
  }, []);

  const removeSet = useCallback((setId: string) => {
    setSets(prev => {
      const updated = prev.filter(s => s.id !== setId);
      if (sessionRef.current) {
        saveToStorage(sessionRef.current, updated);
      }
      return updated;
    });
  }, []);

  const updateRPE = useCallback((setId: string, rpe: number) => {
    setSets(prev => {
      const updated = prev.map(s => (s.id === setId ? { ...s, rpe: rpe as TrainingSet['rpe'] } : s));
      if (sessionRef.current) {
        saveToStorage(sessionRef.current, updated);
      }
      return updated;
    });
  }, []);

  const finishWorkout = useCallback(async () => {
    const session = sessionRef.current;
    const currentSets = setsRef.current;
    if (!session) return;

    // 先清除 localStorage 中的暂存
    saveToStorage(null, []);

    const completedSession: WorkoutSession = { ...session, endTime: Date.now(), sets: currentSets };
    await db.workoutSessions.put(completedSession);
    setIsAnalyzing(true);
    try {
      const recentSessions = await db.workoutSessions.orderBy('date').reverse().limit(10).toArray();
      const analysis = await analyzeWorkout(completedSession, recentSessions);
      const updatedSession = { ...completedSession, aiFeedback: analysis };
      await db.workoutSessions.put(updatedSession);
      setFeedback(analysis);
    } catch (e) {
      console.error('分析失败:', e);
      setFeedback('训练已保存。');
    }
    setIsAnalyzing(false);
    setCurrentSession(null);
    setSets([]);
  }, []);

  const cancelWorkout = useCallback(() => {
    if (setsRef.current.length > 0) {
      if (!window.confirm('确定放弃本次训练？已记录的数据将丢失。')) return;
    }
    saveToStorage(null, []);
    setCurrentSession(null);
    setSets([]);
    setFeedback(null);
    setLastComment('');
  }, []);

  return {
    currentSession, sets, feedback, isAnalyzing, lastComment, hasRestored,
    startWorkout, addSet, removeSet, updateRPE, finishWorkout, cancelWorkout,
  };
}
