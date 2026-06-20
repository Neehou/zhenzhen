import { useState, useCallback } from 'react';
import type { WorkoutSession, TrainingSet, ParsedTrainingInput } from '../types';
import { db, generateId, DEFAULT_EXERCISES } from '../db/database';
import { analyzeWorkout } from '../services/ai-coach';

export function useTraining() {
  const [currentSession, setCurrentSession] = useState<WorkoutSession | null>(null);
  const [sets, setSets] = useState<TrainingSet[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastComment, setLastComment] = useState<string>('');

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

    setSets(prev => [...prev, newSet]);
    if (comment) setLastComment(comment);
  }, []);

  const removeSet = useCallback((setId: string) => {
    setSets(prev => prev.filter(s => s.id !== setId));
  }, []);

  const updateRPE = useCallback((setId: string, rpe: number) => {
    setSets(prev =>
      prev.map(s => (s.id === setId ? { ...s, rpe: rpe as TrainingSet['rpe'] } : s))
    );
  }, []);

  const finishWorkout = useCallback(async () => {
    if (!currentSession) return;
    const session: WorkoutSession = { ...currentSession, endTime: Date.now(), sets };
    await db.workoutSessions.put(session);
    setIsAnalyzing(true);
    try {
      const recentSessions = await db.workoutSessions.orderBy('date').reverse().limit(10).toArray();
      const analysis = await analyzeWorkout(session, recentSessions);
      const updatedSession = { ...session, aiFeedback: analysis };
      await db.workoutSessions.put(updatedSession);
      setFeedback(analysis);
    } catch (e) {
      console.error('分析失败:', e);
      setFeedback('训练已保存。');
    }
    setIsAnalyzing(false);
    setCurrentSession(null);
    setSets([]);
  }, [currentSession, sets]);

  const cancelWorkout = useCallback(() => {
    if (sets.length > 0) {
      if (!window.confirm('确定放弃本次训练？已记录的数据将丢失。')) return;
    }
    setCurrentSession(null);
    setSets([]);
    setFeedback(null);
    setLastComment('');
  }, [sets]);

  return {
    currentSession, sets, feedback, isAnalyzing, lastComment,
    startWorkout, addSet, removeSet, updateRPE, finishWorkout, cancelWorkout,
  };
}
