// AI 教练服务 — DeepSeek API

import type { WorkoutSession, DailyPlan, PlannedExercise } from '../types';
import { db, DEFAULT_EXERCISES, getOrCreateProfile } from '../db/database';

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

function getApiKey(): string | null {
  return localStorage.getItem('zhenzhen-api-key') || null;
}

export function setApiKey(key: string): void {
  localStorage.setItem('zhenzhen-api-key', key);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

async function callDeepSeek(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('请先在设置中填写 DeepSeek API Key。');

  const res = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 请求失败 (${res.status})`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ==================== 构建训练历史摘要 ====================

async function getTrainingHistory(): Promise<string> {
  const sessions = await db.workoutSessions.orderBy('date').reverse().limit(20).toArray();
  if (sessions.length === 0) return '没有训练记录。';

  // 按部位/动作汇总趋势
  const exMap = new Map<string, { name: string; history: { date: string; weight: number; reps: number }[] }>();
  for (const s of sessions) {
    for (const set of s.sets) {
      const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
      const name = ex?.name || set.exerciseId;
      if (!exMap.has(set.exerciseId)) exMap.set(set.exerciseId, { name, history: [] });
      exMap.get(set.exerciseId)!.history.push({
        date: s.date,
        weight: set.weight || 0,
        reps: set.reps || 0,
      });
    }
  }

  const lines: string[] = [];
  for (const [_, info] of exMap) {
    const h = info.history.slice(0, 5);
    const first = h[h.length - 1];
    const last = h[0];
    if (h.length >= 2 && last.weight > 0 && first.weight > 0) {
      lines.push(`${info.name}: ${first.date.slice(5)} ${first.weight}kg→${last.date.slice(5)} ${last.weight}kg (${h.length}次训练)`);
    } else if (h.length === 1) {
      lines.push(`${info.name}: 仅${h[0].date.slice(5)}一次，${h[0].weight}kg`);
    }
  }

  // 训练频率
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  const last7 = dates.filter(d => d >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).length;
  const last14 = dates.filter(d => d >= new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)).length;

  return [
    `最近14天训练${last14}次（近7天${last7}次）`,
    lines.length > 0 ? '动作趋势：\n' + lines.join('\n') : '',
  ].filter(Boolean).join('\n');
}

// ==================== 新用户引导 ====================

export async function onboardingMessage(): Promise<string> {
  if (!hasApiKey()) return '你好！我是臻臻，你的私人教练。先告诉我你每周能练几天？（2-3天/3-4天/5天以上）';

  const profile = await getOrCreateProfile();
  const systemPrompt = `你是臻臻，一个专业严厉但关心学员的AI健身教练。学员是纯新手，第一次见你。
你的目标是让他感到被关注、被理解。问得简短，不超过2句话。
先欢迎，再问下一个问题。`;

  if (!profile.weeklyDays) {
    const msg = await callDeepSeek(systemPrompt, '新学员来了。先欢迎他，然后问他每周能练几天。', 150);
    return msg;
  }

  if (!profile.equipment) {
    const msg = await callDeepSeek(systemPrompt, `学员每周练${profile.weeklyDays}天。问他有什么器械可用（健身房全器械/家里哑铃/自重）。`, 150);
    return msg;
  }

  if (!profile.goal) {
    const msg = await callDeepSeek(systemPrompt, `学员每周练${profile.weeklyDays}天，在${profile.equipment}训练。问他主要目标（增力/减脂/养成运动习惯/学动作）。`, 150);
    return msg;
  }

  // 全部答完
  profile.onboarded = true;
  await db.userProfile.put(profile);
  const msg = await callDeepSeek(
    `你是臻臻。学员：每周${profile.weeklyDays}天，${profile.equipment}，目标"${profile.goal}"。欢迎他加入，给一句有力的鼓励，然后说今天开始生成第一份训练计划。2句话以内。`,
    '开始吧。',
    200,
  );
  return msg;
}

// ==================== 解析引导回复 ====================

export async function parseOnboardingAnswer(raw: string): Promise<{ field: string; value: string } | null> {
  const profile = await getOrCreateProfile();

  if (!hasApiKey()) {
    // 无AI时简单解析
    if (!profile.weeklyDays) {
      const n = raw.match(/(\d+)/);
      return { field: 'weeklyDays', value: n ? n[1] : '3' };
    }
    if (!profile.equipment) {
      return { field: 'equipment', value: raw.includes('健身') ? '健身房全器械' : raw.includes('哑铃') ? '家里哑铃' : '自重' };
    }
    if (!profile.goal) {
      return { field: 'goal', value: raw };
    }
    return null;
  }

  const systemPrompt = `解析用户的回答。当前需要收集的信息：
${!profile.weeklyDays ? '- 每周训练天数（数字）' : ''}
${!profile.equipment ? '- 器械（健身房全器械/家里哑铃/自重）' : ''}
${!profile.goal ? '- 目标（增力/减脂/养成习惯/学动作）' : ''}

输出JSON: {"field": "...", "value": "..."}`;

  const response = await callDeepSeek(systemPrompt, raw, 150);
  const m = response.match(/\{[\s\S]*\}/);
  if (!m) return null;
  return JSON.parse(m[0]);
}

// ==================== AI 输入解析 ====================

export interface ParsedInput {
  exerciseId: string;
  exerciseName: string;
  weight?: number;
  reps?: number;
  distance?: number;
  duration?: number;
  rpe?: number;
}

const EXERCISE_LIST = DEFAULT_EXERCISES.map(e =>
  `"${e.id}" (${e.name},${e.category})`
).join(' ');

export async function parseUserInput(raw: string): Promise<ParsedInput | null> {
  if (!raw.trim()) return null;
  if (hasApiKey()) {
    try { return await aiParse(raw); } catch { /* fallback */ }
  }
  return localParse(raw);
}

async function aiParse(raw: string): Promise<ParsedInput | null> {
  const response = await callDeepSeek(
    `你是训练记录解析器。动作库：${EXERCISE_LIST}。解析用户输入为JSON。力量提取weight(kg)/reps，有氧提取duration(分钟)/distance(km)。RPE: 太轻松=4 轻松=5 刚好=6 有点累=7 很累=8。只输出JSON。`,
    `"${raw}"`,
    200,
  );
  const m = response.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const p = JSON.parse(m[0]);
  if (!p.exerciseId) return null;
  const ex = DEFAULT_EXERCISES.find(e => e.id === p.exerciseId);
  return { exerciseId: p.exerciseId, exerciseName: ex?.name || p.exerciseId, weight: p.weight, reps: p.reps, distance: p.distance, duration: p.duration, rpe: p.rpe };
}

function localParse(raw: string): ParsedInput | null {
  const aliases: Record<string, string> = {
    '高位下拉':'lat-pulldown','下拉':'lat-pulldown','坐姿划船':'seated-row','划船':'seated-row',
    '坐姿推胸':'chest-press','推胸':'chest-press','坐姿推肩':'shoulder-press','推肩':'shoulder-press',
    '腿举':'leg-press','腿弯举':'leg-curl','腿屈伸':'leg-extension',
    '二头弯举':'bicep-curl','弯举':'bicep-curl','三头下压':'tricep-pushdown',
    '跑步':'running','爬楼机':'stair-climber','骑行':'cycling','跑步机':'treadmill',
    '拉伸':'stretching','引体向上':'pull-up','引体':'pull-up','俯卧撑':'push-up','自重深蹲':'squat',
  };
  let id = '';
  for (const [k, v] of Object.entries(aliases)) { if (raw.includes(k)) { id = v; break; } }
  if (!id) return null;
  const ex = DEFAULT_EXERCISES.find(e => e.id === id);
  const w = raw.match(/(\d+\.?\d*)\s*(kg|公斤)/);
  const r = raw.match(/(\d+)\s*(次|个)/);
  const d = raw.match(/(\d+)\s*(min|分钟)/);
  let rpe: number | undefined;
  if (/太轻松|很轻松/.test(raw)) rpe = 4; else if (/轻松/.test(raw)) rpe = 5;
  else if (/刚好/.test(raw)) rpe = 6; else if (/有点累/.test(raw)) rpe = 7; else if (/很累/.test(raw)) rpe = 8;
  return { exerciseId: id, exerciseName: ex?.name || id, weight: w ? parseFloat(w[1]) : undefined, reps: r ? parseInt(r[1]) : undefined, duration: d ? parseInt(d[1]) : undefined, rpe };
}

// ==================== 生成训练计划 ====================

export async function generateTrainingPlan(recentSessions: WorkoutSession[], todayPlan?: DailyPlan): Promise<DailyPlan> {
  const today = new Date().toISOString().slice(0, 10);
  if (todayPlan && todayPlan.date === today) return todayPlan;
  if (hasApiKey()) {
    try { return await aiGeneratePlan(recentSessions, today); } catch {}
  }
  return ruleBasedPlan(recentSessions, today);
}

async function aiGeneratePlan(_recentSessions: WorkoutSession[], today: string): Promise<DailyPlan> {
  const profile = await getOrCreateProfile();
  const history = await getTrainingHistory();

  const response = await callDeepSeek(
    `你是臻臻，AI健身教练。学员：纯新手，每周${profile.weeklyDays || 3}天，${profile.equipment || '健身房'}，目标"${profile.goal || '养成习惯'}"。
训练历史：${history}
动作库：${DEFAULT_EXERCISES.map(e => `"${e.id}"(${e.name},${e.category})`).join(' ')}
生成今日计划JSON：{"exercises":[{"exerciseId":"...","targetSets":3,"targetReps":"12-15","notes":""}],"planNote":""}
规则：选4-5个不同部位力量动作+1个有氧+拉伸。优先练历史中没练过的部位。只输出JSON。`,
    '生成今日计划。',
    800,
  );

  const m = response.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI 返回格式异常');
  const parsed = JSON.parse(m[0]);
  const exercises: PlannedExercise[] = parsed.exercises.map((e: any) => {
    const found = DEFAULT_EXERCISES.find(x => x.id === e.exerciseId || x.name === e.exerciseId);
    return { exerciseId: found?.id || e.exerciseId, targetSets: e.targetSets || 3, targetReps: e.targetReps || '12-15', targetWeight: e.targetWeight, notes: e.notes || '' };
  });

  return { date: today, exercises, generatedAt: Date.now() };
}

function ruleBasedPlan(recentSessions: WorkoutSession[], today: string): DailyPlan {
  const lastParts = new Set<string>();
  if (recentSessions[0]) recentSessions[0].sets.forEach(s => {
    const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId);
    if (e) lastParts.add(e.bodyPart);
  });
  const strength = DEFAULT_EXERCISES.filter(e => e.category === 'strength' || e.category === 'bodyweight');
  const picks = [...strength.filter(e => !lastParts.has(e.bodyPart)), ...strength.filter(e => lastParts.has(e.bodyPart))].slice(0, 4);
  return {
    date: today,
    exercises: [
      ...picks.map(e => ({ exerciseId: e.id, targetSets: 3, targetReps: '12-15' as const, notes: e.instructions.slice(0, 20) })),
      { exerciseId: 'running', targetSets: 1, targetReps: '20分钟' as const, notes: '保持稳定配速' },
      { exerciseId: 'stretching', targetSets: 1, targetReps: '5分钟' as const, notes: '全身拉伸' },
    ],
    generatedAt: Date.now(),
  };
}

// ==================== 分析训练（深度版） ====================

export async function analyzeWorkout(session: WorkoutSession, recentSessions: WorkoutSession[]): Promise<string> {
  if (hasApiKey()) {
    try { return await aiAnalyze(session, recentSessions); } catch {}
  }
  return ruleBasedAnalysis(session, recentSessions);
}

async function aiAnalyze(session: WorkoutSession, _recent: WorkoutSession[]): Promise<string> {
  const profile = await getOrCreateProfile();
  const history = await getTrainingHistory();

  // 区分力量和有氧
  const strengthSets = session.sets.filter(s => {
    const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId);
    return e?.category === 'strength' || e?.category === 'bodyweight';
  });
  const cardioSets = session.sets.filter(s => {
    const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId);
    return e?.category === 'cardio';
  });

  const detail = session.sets.map(s => {
    const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId);
    const parts: string[] = [];
    if (s.weight) parts.push(`${s.weight}kg`);
    if (s.reps) parts.push(`${s.reps}次`);
    if (s.distance) parts.push(`${s.distance}km`);
    if (s.duration) parts.push(`${s.duration}分钟`);
    return `${e?.name || s.exerciseId}(${e?.category || '?'}): ${parts.join(' ')} RPE ${s.rpe || '?'}`;
  }).join('\n');

  const systemPrompt = `你是臻臻，一个严厉但真心为学员好的AI健身教练。

学员情况：纯新手，每周${profile.weeklyDays || 3}天，${profile.equipment || '健身房'}，目标"${profile.goal || '养成习惯'}"。

训练历史趋势：
${history}

风格要求：
- 先看整体，再看细节
- 有氧和力量区别对待（今天包含了${strengthSets.length}组力量+${cardioSets.length}组有氧）
- 如果今天有氧强度高，不要说"动作太少"
- 指出问题时附带具体建议
- 提到进步的地方（对比历史）
- 像真人教练说话，口语化
- 控制在200字以内`;

  return callDeepSeek(systemPrompt, `分析今日训练：\n${detail}`, 500);
}

function ruleBasedAnalysis(session: WorkoutSession, _r: WorkoutSession[]): string {
  const issues: string[] = [];
  const goods: string[] = [];
  for (const s of session.sets) {
    const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId);
    if (s.rpe && s.rpe <= 4) issues.push(`${e?.name || '?'}太轻松，下次加重量。`);
    if (s.rpe && s.rpe >= 9) issues.push(`${e?.name || '?'}接近极限，注意动作别变形。`);
  }
  const cardioCount = session.sets.filter(s => {
    const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId);
    return e?.category === 'cardio';
  }).length;
  const strCount = session.sets.filter(s => {
    const e = DEFAULT_EXERCISES.find(x => x.id === s.exerciseId);
    return e?.category === 'strength' || e?.category === 'bodyweight';
  }).length;
  if (strCount < 6 && cardioCount === 0) issues.push('力量训练量偏少，下次加到至少6组。');
  if (issues.length === 0) goods.push('今天练得不错！');
  goods.push('每次训练都是一次进步。');
  return [...issues.map(i => `⚠️ ${i}`), '', ...goods.map(g => `✅ ${g}`)].join('\n');
}

// ==================== 跳过动作微评 ====================

export async function skipComment(exerciseName: string, exerciseCategory: string): Promise<string> {
  if (!hasApiKey()) {
    return exerciseCategory === 'strength'
      ? `跳过了${exerciseName}。没关系，但下次优先补上。`
      : `跳过了${exerciseName}。`;
  }
  try {
    const profile = await getOrCreateProfile();
    return await callDeepSeek(
      `你是臻臻。学员跳过了"${exerciseName}"(${exerciseCategory})。学员目标"${profile.goal || '养成习惯'}"。说1句话：如果这个动作重要就提醒下次补，不重要就说没关系。口语化。`,
      '点评跳过。',
      100,
    );
  } catch { return `跳过了${exerciseName}。`; }
}

// ==================== 周报 ====================

export async function generateWeeklyReport(sessions: WorkoutSession[]): Promise<string> {
  if (sessions.length === 0) return '这周没有训练记录。臻臻在等你。';
  if (!hasApiKey()) {
    return `📊 本周训练 ${sessions.length} 次。保持规律比追求重量更重要。`;
  }
  try {
    const profile = await getOrCreateProfile();
    const summary = sessions.map(s =>
      s.date.slice(5) + ': ' + s.sets.map(set => {
        const e = DEFAULT_EXERCISES.find(x => x.id === set.exerciseId);
        const parts: string[] = [];
        if (set.weight) parts.push(`${set.weight}kg`);
        if (set.reps) parts.push(`${set.reps}次`);
        if (set.duration) parts.push(`${set.duration}分钟`);
        return `${e?.name}: ${parts.join(' ')}`;
      }).join(' | ')
    ).join('\n');

    return await callDeepSeek(
      `你是臻臻。学员每周${profile.weeklyDays || 3}天，目标"${profile.goal || '养成习惯'}"。回顾这周训练，给总体评价、亮点、问题和下周方向。200字以内，口语化。`,
      `本周训练：\n${summary}\n共${sessions.length}次。`,
      500,
    );
  } catch {
    return `📊 本周训练 ${sessions.length} 次。保持规律比追求重量更重要。`;
  }
}
