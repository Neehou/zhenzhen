import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { WorkoutSession, DailyPlan, WeightRecord, UserProfile } from '../types';

class ZhenZhenDB extends Dexie {
  workoutSessions!: Table<WorkoutSession, string>;
  dailyPlans!: Table<DailyPlan, string>;
  weightRecords!: Table<WeightRecord, string>;
  userProfile!: Table<UserProfile, string>;

  constructor() {
    super('ZhenZhenDB');

    this.version(1).stores({
      workoutSessions: 'id, date',
      dailyPlans: 'date',
      weightRecords: 'id, date',
      userProfile: 'id',
    });
  }
}

export const db = new ZhenZhenDB();

// ============ 默认动作库 ============

export const DEFAULT_EXERCISES = [
  {
    id: 'lat-pulldown',
    name: '高位下拉',
    category: 'strength' as const,
    bodyPart: '背',
    instructions: '沉肩、挺胸、下拉至锁骨，控制离心2-3秒。不要借力后仰。',
  },
  {
    id: 'seated-row',
    name: '坐姿划船',
    category: 'strength' as const,
    bodyPart: '背',
    instructions: '保持背部挺直，拉向腹部，挤压肩胛骨。',
  },
  {
    id: 'chest-press',
    name: '坐姿推胸',
    category: 'strength' as const,
    bodyPart: '胸',
    instructions: '收紧肩胛骨，推至手臂伸直但不锁死。',
  },
  {
    id: 'shoulder-press',
    name: '坐姿推肩',
    category: 'strength' as const,
    bodyPart: '肩',
    instructions: '核心收紧，推至头顶上方，不要耸肩。',
  },
  {
    id: 'leg-press',
    name: '腿举',
    category: 'strength' as const,
    bodyPart: '腿',
    instructions: '腰部贴紧靠背，控制下放幅度，膝盖不要锁死。',
  },
  {
    id: 'leg-curl',
    name: '腿弯举',
    category: 'strength' as const,
    bodyPart: '腿',
    instructions: '匀速完成，顶峰收缩1秒，缓慢下放。',
  },
  {
    id: 'leg-extension',
    name: '腿屈伸',
    category: 'strength' as const,
    bodyPart: '腿',
    instructions: '脚尖朝上，控制全程，膝盖不要超伸。',
  },
  {
    id: 'bicep-curl',
    name: '二头弯举',
    category: 'strength' as const,
    bodyPart: '手臂',
    instructions: '大臂固定不动，全程控制。',
  },
  {
    id: 'tricep-pushdown',
    name: '三头下压',
    category: 'strength' as const,
    bodyPart: '手臂',
    instructions: '大臂贴紧身体，只动前臂。',
  },
  {
    id: 'running',
    name: '跑步',
    category: 'cardio' as const,
    bodyPart: '全身',
    instructions: '保持稳定配速，注意呼吸节奏。',
  },
  {
    id: 'stair-climber',
    name: '爬楼机',
    category: 'cardio' as const,
    bodyPart: '腿',
    instructions: '不要扶着扶手，保持身体直立。',
  },
  {
    id: 'cycling',
    name: '骑行',
    category: 'cardio' as const,
    bodyPart: '腿',
    instructions: '调整座椅至合适高度，保持踏频。',
  },
  {
    id: 'treadmill',
    name: '跑步机',
    category: 'cardio' as const,
    bodyPart: '全身',
    instructions: '设置坡度1-2模拟户外，不要扶扶手。',
  },
  {
    id: 'stretching',
    name: '拉伸',
    category: 'stretch' as const,
    bodyPart: '全身',
    instructions: '每个动作保持15-30秒，不要弹震。',
  },
  {
    id: 'pull-up',
    name: '引体向上',
    category: 'bodyweight' as const,
    bodyPart: '背',
    instructions: '全程控制，下巴过杠，下放时手臂完全伸直。',
  },
  {
    id: 'push-up',
    name: '俯卧撑',
    category: 'bodyweight' as const,
    bodyPart: '胸',
    instructions: '身体呈一条直线，胸贴地面。',
  },
  {
    id: 'squat',
    name: '自重深蹲',
    category: 'bodyweight' as const,
    bodyPart: '腿',
    instructions: '双脚与肩同宽，蹲至大腿平行地面。',
  },
  {
    id: 'plank',
    name: '平板支撑',
    category: 'bodyweight' as const,
    bodyPart: '核心',
    instructions: '肘撑地，身体成一条直线，收紧腹部和臀部，保持呼吸。',
  },
  {
    id: 'crunch',
    name: '卷腹',
    category: 'bodyweight' as const,
    bodyPart: '核心',
    instructions: '仰卧屈膝，下巴收紧，用腹部力量卷起上半身，不要抱头拉脖子。',
  },
  {
    id: 'lunge',
    name: '弓步蹲',
    category: 'bodyweight' as const,
    bodyPart: '腿',
    instructions: '前后脚站立，下蹲至双膝90度，保持上身直立。',
  },
  {
    id: 'bench-press',
    name: '杠铃卧推',
    category: 'strength' as const,
    bodyPart: '胸',
    instructions: '收紧肩胛骨，杠铃下放至胸骨，推起时手臂不锁死。',
  },
  {
    id: 'deadlift',
    name: '硬拉',
    category: 'strength' as const,
    bodyPart: '背',
    instructions: '挺胸收背，杠铃贴紧小腿，髋膝同步伸展。',
  },
];

// ============ 数据库操作辅助函数 ============

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 获取或创建用户配置
export async function getOrCreateProfile(): Promise<UserProfile> {
  let profile = await db.userProfile.get('default');
  if (!profile) {
    profile = {
      experienceLevel: 'beginner',
      createdAt: Date.now(),
    };
    await db.userProfile.put(profile, 'default');
  }
  return profile;
}

// 获取今日计划
export async function getTodayPlan(): Promise<DailyPlan | undefined> {
  const today = new Date().toISOString().slice(0, 10);
  return db.dailyPlans.get(today);
}

// 保存今日计划
export async function saveDailyPlan(plan: DailyPlan): Promise<void> {
  await db.dailyPlans.put(plan);
}

// 获取最近的训练记录
export async function getRecentSessions(days: number = 30): Promise<WorkoutSession[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return db.workoutSessions
    .where('date')
    .between(cutoffStr, '9999-99-99', true, true)
    .reverse()
    .toArray();
}

// 计算连续训练天数
export async function getStreak(): Promise<number> {
  const sessions = await db.workoutSessions
    .orderBy('date')
    .reverse()
    .toArray();

  if (sessions.length === 0) return 0;

  // 获取唯一日期并排序
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // 最近一天必须是今天或昨天
  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const diff = (prevDate.getTime() - currDate.getTime()) / 86400000;
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// 本周训练统计
export async function getWeeklyStats(): Promise<{ trainedDays: number; goalDays: number; weekStart: string }> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekStart = monday.toISOString().slice(0, 10);
  const weekEnd = now.toISOString().slice(0, 10);

  const sessions = await db.workoutSessions
    .where('date')
    .between(weekStart, weekEnd, true, true)
    .toArray();

  const trainedDays = new Set(sessions.map(s => s.date)).size;

  const profile = await getOrCreateProfile();
  const goalDays = profile.weeklyDays || 3;

  return { trainedDays, goalDays, weekStart };
}

// 获取所有训练过的日期
export async function getTrainedDates(days: number = 30): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const sessions = await db.workoutSessions
    .where('date')
    .between(cutoffStr, '9999-99-99', true, true)
    .toArray();

  return [...new Set(sessions.map(s => s.date))].sort();
}
