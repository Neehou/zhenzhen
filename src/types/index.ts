// ============ 基础枚举 ============

export type ExerciseCategory = 'strength' | 'cardio' | 'bodyweight' | 'stretch';

export type RPE = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ============ 动作库 ============

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  bodyPart: string;
  instructions: string;
}

// ============ 训练记录 ============

export interface TrainingSet {
  id: string;
  exerciseId: string;
  weight?: number;   // kg
  reps?: number;
  distance?: number; // km
  duration?: number; // minutes
  rpe?: RPE;
  completed: boolean;
  timestamp: number;
}

export interface WorkoutSession {
  id: string;
  date: string;       // ISO date YYYY-MM-DD
  startTime: number;
  endTime?: number;
  sets: TrainingSet[];
  notes?: string;
  aiFeedback?: string;
  type: 'planned' | 'freestyle';
}

// ============ 训练计划 ============

export interface PlannedExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: string;
  targetWeight?: number;
  notes?: string;
}

export interface DailyPlan {
  date: string;
  exercises: PlannedExercise[];
  generatedAt: number;
}

// ============ 体重记录 ============

export interface WeightRecord {
  id: string;
  date: string;
  weight: number;
}

// ============ 用户配置 ============

export interface UserProfile {
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  apiKey?: string;
  createdAt: number;
  bodyWeight?: number;
  onboarded?: boolean;
  weeklyDays?: number;
  equipment?: string;
  goal?: string;
}

// ============ 语音输入解析结果 ============

export interface ParsedTrainingInput {
  exerciseName: string;
  weight?: number;
  reps?: number;
  distance?: number;
  duration?: number;
  rpe?: RPE;
  notes?: string;
}

// ============ AI 分析结果 ============

export interface AIWorkoutAnalysis {
  summary: string;
  highlights: string[];
  problems: string[];
  suggestions: string;
  nextSessionAdjustments: string;
}
