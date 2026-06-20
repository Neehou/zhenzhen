// AI 教练服务 — DeepSeek API

import type { WorkoutSession, DailyPlan, PlannedExercise } from '../types';
import { DEFAULT_EXERCISES } from '../db/database';

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
  `"${e.id}" (${e.name}, 类型:${e.category}, 部位:${e.bodyPart})`
).join('\n');

export async function parseUserInput(raw: string): Promise<ParsedInput | null> {
  if (!raw.trim()) return null;

  if (hasApiKey()) {
    try {
      return await aiParse(raw);
    } catch (e) {
      console.warn('AI 解析失败，使用本地解析:', e);
    }
  }

  return localParse(raw);
}

async function aiParse(raw: string): Promise<ParsedInput | null> {
  const systemPrompt = `你是臻臻健身系统的输入解析器。将用户的自然语言训练记录解析为JSON。

可用动作列表（只能用这些ID）：
${EXERCISE_LIST}

规则：
- 力量训练提取 weight(kg) 和 reps(次数)
- 有氧训练提取 duration(分钟) 或 distance(km)
- 拉伸提取 duration(分钟)
- RPE从用户描述推断：太轻松=4 轻松=5 刚好=6 有点累=7 很累=8 极限=9-10
- 只输出JSON，不要其他文字
- 如果识别不到任何动作，返回 {"exerciseId": null}`;

  const response = await callDeepSeek(systemPrompt, `解析这段训练记录："${raw}"`, 200);

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.exerciseId) return null;

  const ex = DEFAULT_EXERCISES.find(e => e.id === parsed.exerciseId);
  return {
    exerciseId: parsed.exerciseId,
    exerciseName: ex?.name || parsed.exerciseId,
    weight: parsed.weight,
    reps: parsed.reps,
    distance: parsed.distance,
    duration: parsed.duration,
    rpe: parsed.rpe,
  };
}

function localParse(raw: string): ParsedInput | null {
  const cleaned = raw.toLowerCase().trim();
  if (!cleaned) return null;

  // 动作别名匹配
  const aliases: Record<string, string> = {
    '高位下拉': 'lat-pulldown', '下拉': 'lat-pulldown',
    '坐姿划船': 'seated-row', '划船': 'seated-row',
    '坐姿推胸': 'chest-press', '推胸': 'chest-press',
    '坐姿推肩': 'shoulder-press', '推肩': 'shoulder-press',
    '腿举': 'leg-press', '倒蹬': 'leg-press',
    '腿弯举': 'leg-curl', '腿屈伸': 'leg-extension',
    '二头弯举': 'bicep-curl', '弯举': 'bicep-curl',
    '三头下压': 'tricep-pushdown', '三头': 'tricep-pushdown',
    '跑步': 'running', '跑': 'running',
    '爬楼机': 'stair-climber', '爬楼': 'stair-climber',
    '骑行': 'cycling', '骑车': 'cycling',
    '跑步机': 'treadmill',
    '拉伸': 'stretching', '拉筋': 'stretching',
    '引体向上': 'pull-up', '引体': 'pull-up',
    '俯卧撑': 'push-up',
    '自重深蹲': 'squat', '深蹲': 'squat',
  };

  let exerciseId = '';
  for (const [key, id] of Object.entries(aliases)) {
    if (cleaned.includes(key)) { exerciseId = id; break; }
  }
  if (!exerciseId) return null;

  const ex = DEFAULT_EXERCISES.find(e => e.id === exerciseId);

  // 提取数字
  const weightMatch = cleaned.match(/(\d+\.?\d*)\s*(kg|公斤)/);
  const repsMatch = cleaned.match(/(\d+)\s*(次|个|rep)/);
  const distMatch = cleaned.match(/(\d+\.?\d*)\s*(km|公里)/);
  const durMatch = cleaned.match(/(\d+)\s*(min|分钟|分)/);

  // RPE
  let rpe: number | undefined;
  if (/太轻松|很轻松/.test(cleaned)) rpe = 4;
  else if (/轻松/.test(cleaned)) rpe = 5;
  else if (/刚好|适中/.test(cleaned)) rpe = 6;
  else if (/有点累|稍累/.test(cleaned)) rpe = 7;
  else if (/很累|非常累/.test(cleaned)) rpe = 8;
  else if (/极限/.test(cleaned)) rpe = 9;

  return {
    exerciseId,
    exerciseName: ex?.name || exerciseId,
    weight: weightMatch ? parseFloat(weightMatch[1]) : undefined,
    reps: repsMatch ? parseInt(repsMatch[1]) : undefined,
    distance: distMatch ? parseFloat(distMatch[1]) : undefined,
    duration: durMatch ? parseInt(durMatch[1]) : undefined,
    rpe,
  };
}

// ==================== 生成训练计划 ====================

export async function generateTrainingPlan(
  recentSessions: WorkoutSession[],
  todayPlan?: DailyPlan,
): Promise<DailyPlan> {
  const today = new Date().toISOString().slice(0, 10);
  if (todayPlan && todayPlan.date === today) return todayPlan;

  if (hasApiKey()) {
    try {
      return await aiGeneratePlan(recentSessions, today);
    } catch (e) {
      console.warn('AI 计划生成失败，使用基础计划:', e);
    }
  }
  return ruleBasedPlan(recentSessions, today);
}

async function aiGeneratePlan(recentSessions: WorkoutSession[], today: string): Promise<DailyPlan> {
  const recentSummary = recentSessions.slice(0, 5).map(s => {
    const setList = s.sets.map(set => {
      const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
      return `${ex?.name || set.exerciseId} ${set.weight || ''}${set.reps || ''}${set.duration || ''}`;
    }).join('、');
    return `${s.date}: ${setList}`;
  }).join('\n');

  const systemPrompt = `你是臻臻，一个严厉但关心学员的AI健身教练。学员是纯新手。

可用动作：${DEFAULT_EXERCISES.map(e => `"${e.id}"(${e.name})`).join(', ')}

输出JSON格式今日训练计划：
{
  "exercises": [
    {"exerciseId": "...", "targetSets": 3, "targetReps": "12-15", "notes": "简短提示"}
  ],
  "planNote": "给学员的一句话"
}

规则：新手全身训练，选4-5个不同部位力量动作+1个有氧+拉伸。只输出JSON。`;

  const userMessage = `最近训练：\n${recentSummary || '无记录，第一次训练。'}\n生成今日计划。`;

  const response = await callDeepSeek(systemPrompt, userMessage, 800);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 返回格式异常');

  const parsed = JSON.parse(jsonMatch[0]);
  const exercises: PlannedExercise[] = parsed.exercises.map((ex: any) => {
    const found = DEFAULT_EXERCISES.find(e => e.id === ex.exerciseId || e.name === ex.exerciseId);
    return {
      exerciseId: found?.id || ex.exerciseId,
      targetSets: ex.targetSets || 3,
      targetReps: ex.targetReps || '12-15',
      targetWeight: ex.targetWeight || undefined,
      notes: ex.notes || '',
    };
  });

  return { date: today, exercises, generatedAt: Date.now() };
}

function ruleBasedPlan(recentSessions: WorkoutSession[], today: string): DailyPlan {
  const lastBodyParts = new Set<string>();
  const lastSession = recentSessions[0];
  if (lastSession) {
    lastSession.sets.forEach(set => {
      const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
      if (ex) lastBodyParts.add(ex.bodyPart);
    });
  }

  const strength = DEFAULT_EXERCISES.filter(e => e.category === 'strength' || e.category === 'bodyweight');
  const priority = strength.filter(e => !lastBodyParts.has(e.bodyPart));
  const backup = strength.filter(e => lastBodyParts.has(e.bodyPart));
  const selected = [...priority, ...backup].slice(0, 4);

  const exercises: PlannedExercise[] = [
    ...selected.map(e => ({
      exerciseId: e.id,
      targetSets: 3,
      targetReps: '12-15',
      notes: e.instructions.slice(0, 20),
    })),
    { exerciseId: 'running', targetSets: 1, targetReps: '20分钟', notes: '保持稳定配速' },
    { exerciseId: 'stretching', targetSets: 1, targetReps: '5分钟', notes: '全身拉伸' },
  ];

  return { date: today, exercises, generatedAt: Date.now() };
}

// ==================== 分析训练 ====================

export async function analyzeWorkout(
  session: WorkoutSession,
  recentSessions: WorkoutSession[],
): Promise<string> {
  if (hasApiKey()) {
    try {
      return await aiAnalyze(session, recentSessions);
    } catch (e) {
      console.warn('AI 分析失败:', e);
    }
  }
  return ruleBasedAnalysis(session, recentSessions);
}

async function aiAnalyze(session: WorkoutSession, _recentSessions: WorkoutSession[]): Promise<string> {
  const setDetails = session.sets.map(s => {
    const ex = DEFAULT_EXERCISES.find(e => e.id === s.exerciseId);
    const parts: string[] = [];
    if (s.weight) parts.push(`${s.weight}kg`);
    if (s.reps) parts.push(`${s.reps}次`);
    if (s.distance) parts.push(`${s.distance}km`);
    if (s.duration) parts.push(`${s.duration}分钟`);
    return `${ex?.name || s.exerciseId}: ${parts.join(' ')} RPE${s.rpe || '?'}`;
  }).join('\n');

  const systemPrompt = `你是臻臻，严厉分析型AI健身教练。学员纯新手。
风格：先指出问题（严厉但有建设性），再鼓励。口语化中文，简洁有力。200字以内。`;

  const userMessage = `分析训练：\n${session.date}\n${setDetails}\n\n指出问题和进步，给下次建议。`;

  return callDeepSeek(systemPrompt, userMessage, 500);
}

function ruleBasedAnalysis(session: WorkoutSession, _recent: WorkoutSession[]): string {
  const issues: string[] = [];
  const goods: string[] = [];

  for (const set of session.sets) {
    const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
    if (set.rpe && set.rpe <= 4) issues.push(`${ex?.name}太轻松，下次加重量。`);
    if (set.reps && set.reps < 5) issues.push(`${ex?.name}次数偏少，可能太重了。`);
  }
  if (session.sets.length < 5) issues.push('动作太少，下次至少5个动作。');
  goods.push('能来训练就比不来强！');

  if (issues.length === 0) return `完成得不错！${goods.join(' ')}`;
  return [...issues.map(i => `⚠️ ${i}`), '', ...goods.map(g => `✅ ${g}`)].join('\n');
}

// ==================== 周报 ====================

export async function generateWeeklyReport(sessions: WorkoutSession[]): Promise<string> {
  if (!hasApiKey() || sessions.length === 0) {
    return sessions.length === 0
      ? '这周没有训练记录。臻臻在等你。'
      : `📊 本周训练 ${sessions.length} 次。保持规律比追求重量更重要。`;
  }
  try {
    const summary = sessions.map(s => {
      const sets = s.sets.map(set => {
        const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
        return `${ex?.name}: ${set.weight || '-'}kg×${set.reps || '-'}次`;
      }).join(' | ');
      return `${s.date}: ${sets}`;
    }).join('\n');

    const systemPrompt = '你是臻臻，严厉分析型教练。口语化中文，200字以内。';
    const userMessage = `一周训练：\n${summary}\n共${sessions.length}次。给总体评价、亮点、问题和下周方向。`;
    return callDeepSeek(systemPrompt, userMessage, 500);
  } catch {
    return `📊 本周训练 ${sessions.length} 次。保持规律比追求重量更重要。`;
  }
}
