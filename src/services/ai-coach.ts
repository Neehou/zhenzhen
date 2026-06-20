// AI 教练服务 — DeepSeek API

import type { WorkoutSession, DailyPlan, PlannedExercise } from '../types';
import { db, DEFAULT_EXERCISES, getOrCreateProfile, generateId } from '../db/database';

// API 端点列表 — 按优先级排列，一个不通就换下一个
const API_ENDPOINTS = [
  '/api/deepseek/chat/completions',           // Vite 代理（开发环境）
  'https://api.deepseek.com/chat/completions', // DeepSeek 直连
];

const MODEL = 'deepseek-chat';

function getApiKey(): string | null {
  return localStorage.getItem('zhenzhen-api-key') || null;
}

export function setApiKey(key: string): void {
  localStorage.setItem('zhenzhen-api-key', key);
  // 新 Key 保存时清除旧错误，给新 Key 一次干净的机会
  clearAIError();
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

export function getAIStatus(): 'connected' | 'no-key' | 'error' {
  if (!getApiKey()) return 'no-key';
  const lastErr = localStorage.getItem('zhenzhen-last-error');
  if (lastErr) {
    // 超过 30 分钟的错误自动清除（可能是网络波动）
    const errTime = localStorage.getItem('zhenzhen-last-error-time');
    if (errTime && Date.now() - parseInt(errTime) > 30 * 60 * 1000) {
      clearAIError();
      return 'connected';
    }
    return 'error';
  }
  return 'connected';
}

export function clearAIError(): void {
  localStorage.removeItem('zhenzhen-last-error');
}

export async function testConnection(): Promise<boolean> {
  if (!hasApiKey()) return false;
  try {
    await callDeepSeek('回复"OK"', 'test', 10);
    clearAIError();
    return true;
  } catch (e) {
    const msg = String(e).slice(0, 200);
    localStorage.setItem('zhenzhen-last-error', msg);
    localStorage.setItem('zhenzhen-last-error-time', String(Date.now()));
    return false;
  }
}

async function callDeepSeek(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('请先在设置中填写 DeepSeek API Key。');

  const body = JSON.stringify({
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  // 依次尝试所有端点，一个不通就换下一个，每个端点15秒超时
  let lastError: Error | null = null;
  for (let i = 0; i < API_ENDPOINTS.length; i++) {
    const url = API_ENDPOINTS[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        clearAIError();
        return data.choices[0].message.content;
      }

      // HTTP 错误 — 认证错误不重试（换端点也没用）
      const err = await res.json().catch(() => ({}));
      const rawMsg = err.error?.message || `API 请求失败 (${res.status})`;

      if (res.status === 401 || res.status === 403) {
        const msg = rawMsg.includes('Authentication') || rawMsg.includes('invalid')
          ? 'API Key 无效 — 请在 DeepSeek 平台检查 Key 是否正确、是否有余额。'
          : rawMsg;
        localStorage.setItem('zhenzhen-last-error', msg);
        localStorage.setItem('zhenzhen-last-error-time', String(Date.now()));
        throw new Error(msg); // 认证错误不重试
      }

      // 其他 HTTP 错误，记录并尝试下个端点
      lastError = new Error(rawMsg);
      console.warn(`[臻臻] 端点${i + 1} 失败 (${url}): ${rawMsg}`);
    } catch (e) {
      clearTimeout(timeoutId);
      if ((e as Error).message?.includes('API Key 无效')) throw e; // 认证错误立即抛出
      if ((e as Error).name === 'AbortError') {
        lastError = new Error(`请求超时 (${url})`);
      } else {
        lastError = e as Error;
      }
      console.warn(`[臻臻] 端点${i + 1} 不可达 (${url}): ${(e as Error).message}`);
    }
  }

  // 所有端点都失败
  const msg = lastError?.message || '所有 API 端点均不可达';
  throw new Error(msg);
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

// ==================== AI 对话式输入（解析+点评一次完成） ====================

export interface ParsedInput {
  exerciseId: string;
  exerciseName: string;
  weight?: number;
  reps?: number;       // 每组次数
  sets?: number;       // 组数
  distance?: number;
  duration?: number;
  rpe?: number;
}

export interface CoachResponse {
  parsed?: ParsedInput;  // 无则为自由对话，有则为训练数据
  comment: string;
}

const EXERCISE_LIST = DEFAULT_EXERCISES.map(e =>
  `"${e.id}" (${e.name},${e.category})`
).join(' ');

// 对话式AI：一次调用同时完成解析+教练点评
// 现在支持两种模式：
//  - 训练记录："平板支撑1min 4组" → 解析出数据 + 教练点评
//  - 自由对话："今天好累不想练" → 纯对话回复，无结构化数据
export async function coachChat(raw: string): Promise<CoachResponse | null> {
  if (!raw.trim()) return null;

  if (hasApiKey()) {
    try {
      const result = await aiChat(raw);
      if (result) return result;
    } catch (e) {
      console.error('AI对话失败，回退本地:', e);
    }
  }

  // 回退：本地解析
  const local = localParse(raw);
  if (local) {
    return {
      parsed: local,
      comment: localComment(local),
    };
  }

  // 无法解析 → AI 离线时的本地通用回复
  // 即使没识别出动作，也给用户反馈，不要静默失败
  return {
    comment: localChatReply(raw),
  };
}

// 无 AI 时的本地通用回复
function localChatReply(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (/累|不想|懒得|休息|没劲|困/.test(s)) return '听到了。累了就好好休息，休息也是训练的一部分。今天状态不好不用硬撑。';
  if (/疼|痛|伤|不舒服/.test(s)) return '注意身体！哪里不舒服先停下来，不要带伤训练。如果持续疼痛建议看医生。';
  if (/吃|饮食|减肥|减脂|瘦/.test(s)) return '饮食也很重要。训练配合干净饮食效果更好。需要我帮你安排吗？';
  if (/问|怎么|如何|什么|能不能|可以吗/.test(s)) return '这个问题问得好。你可以在设置里配置 AI Key，我就能更准确地回答你。';
  if (s.length < 20) return `收到「${raw}」。能具体说说动作、重量和次数吗？比如"跑步30分钟"或"高位下拉40kg 12次"。`;
  return `听到你说的了。但我不太确定你想记录什么动作。试试这样说：\n"平板支撑 1min 4组"\n"跑步 5km 30分钟 有点累"\n"高位下拉 40kg 12次"`;
}

async function aiChat(raw: string): Promise<CoachResponse | null> {
  const profile = await getOrCreateProfile();
  const history = await getTrainingHistory();

  const response = await callDeepSeek(
    `你是臻臻，一个专业、口语化、像真人朋友一样的AI健身教练。

学员情况：纯新手，每周${profile.weeklyDays || 3}天，${profile.equipment || '健身房'}，目标"${profile.goal || '养成习惯'}"。

训练历史：
${history || '暂无'}

动作库：${EXERCISE_LIST}

用户对你说了一句话。你需要判断类型并回应：

【类型A — 训练记录】
用户在描述刚做的训练动作。你需要：
1. 解析成结构化数据
2. 给一句教练点评（20-50字，口语化）
解析规则：
- 力量训练(weight+reps)、自重训练(reps或duration)、有氧(duration+可能distance)、拉伸(duration)
- 时间全部转为分钟：1h=60、半小时=30、1h30min=90
- 如果用户说"每组X分钟 Y组"，duration = X × Y（取乘积作为总时长）
- RPE从语气推断：太轻松=4 轻松=5 刚好=6 有点累=7 很累=8 极限=9
- 不要因为动作不在动作库里就拒绝，尝试匹配最接近的

【类型B — 自由对话】
用户在闲聊、提问、抱怨、或者说得模糊。你应该：
- 像朋友一样自然地回复
- 如果用户说累/疼/不想练，关心他并给出建议
- 如果用户问问题，认真回答
- 如果用户说的不是训练相关，也可以聊
- 回复控制在30-80字，口语化、有温度

输出JSON（只输出JSON，不要其他）：
{
  "type": "training" 或 "chat",
  "exerciseId": "动作ID（必须用动作库里列出的id，不要自己编）",
  "exerciseName": "动作中文名",
  "weight": null或数字(kg),
  "reps": null或数字(每组次数),
  "sets": null或数字(组数),
  "distance": null或数字(km),
  "duration": null或数字(分钟),
  "rpe": null或1-10,
  "comment": "你的回复"
}
重要：reps是每组次数，sets是组数。如果用户说"十个每组，四组"则reps=10,sets=4。如果用户只说"八组"没提次数，则sets=8,reps=null。`,
    `"${raw}"`,
    500,
  );

  const m = response.match(/\{[\s\S]*\}/);
  if (!m) { console.error('AI返回非JSON:', response.slice(0, 150)); return null; }

  let p: any;
  try { p = JSON.parse(m[0]); } catch { console.error('AI JSON解析失败:', m[0].slice(0, 150)); return null; }

  const comment = p.comment || '收到！';

  // 类型B：纯对话，不需要结构化数据
  if (p.type === 'chat' || !p.exerciseId) {
    return { comment };
  }

  // 类型A：训练记录
  const ex = DEFAULT_EXERCISES.find(e => e.id === p.exerciseId || e.name === p.exerciseId || e.name === p.exerciseName);
  return {
    parsed: {
      exerciseId: ex?.id || p.exerciseId || 'unknown',
      exerciseName: ex?.name || p.exerciseName || p.exerciseId || '未知动作',
      weight: p.weight || undefined,
      reps: p.reps || undefined,
      sets: p.sets || undefined,
      distance: p.distance || undefined,
      duration: p.duration || undefined,
      rpe: p.rpe || undefined,
    },
    comment,
  };
}

function localComment(input: ParsedInput): string {
  const parts: string[] = [];
  if (input.weight) parts.push(`${input.weight}kg`);
  if (input.reps) parts.push(`${input.reps}次`);
  if (input.distance) parts.push(`${input.distance}km`);
  if (input.duration) parts.push(`${input.duration}分钟`);
  const detail = parts.join(' ');

  if (input.rpe && input.rpe <= 5) return `${input.exerciseName} ${detail}，太轻松了，下次加重量。`;
  if (input.rpe && input.rpe >= 8) return `${input.exerciseName} ${detail}，强度到位，注意动作质量。`;
  return `${input.exerciseName} ${detail}，收到！`;
}

// 兼容旧接口
export async function parseUserInput(raw: string): Promise<ParsedInput | null> {
  const result = await coachChat(raw);
  return result?.parsed || null;
}

function localParse(raw: string): ParsedInput | null {
  // 中文数字标准化 → 阿拉伯数字（在量词前）
  let s = raw.toLowerCase().trim();
  s = s.replace(/十(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '10$1');
  s = s.replace(/九(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '9$1');
  s = s.replace(/八(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '8$1');
  s = s.replace(/七(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '7$1');
  s = s.replace(/六(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '6$1');
  s = s.replace(/五(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '5$1');
  s = s.replace(/四(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '4$1');
  s = s.replace(/三(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '3$1');
  s = s.replace(/两(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '2$1');
  s = s.replace(/二(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '2$1');
  s = s.replace(/一(\s*(?:个|组|次|下|分|min|rep|kg|公里|秒|s))/gi, '1$1');

  const aliases: Record<string, string> = {
    '高位下拉':'lat-pulldown','下拉':'lat-pulldown','坐姿划船':'seated-row','划船':'seated-row',
    '坐姿推胸':'chest-press','推胸':'chest-press','坐姿推肩':'shoulder-press','推肩':'shoulder-press',
    '腿举':'leg-press','腿弯举':'leg-curl','腿屈伸':'leg-extension',
    '二头弯举':'bicep-curl','弯举':'bicep-curl','三头下压':'tricep-pushdown',
    '跑步':'running','跑':'running','爬楼机':'stair-climber','爬楼':'stair-climber',
    '骑行':'cycling','骑车':'cycling','自行车':'cycling','跑步机':'treadmill',
    '拉伸':'stretching','拉筋':'stretching','引体向上':'pull-up','引体':'pull-up',
    '俯卧撑':'push-up','自重深蹲':'squat','深蹲':'squat',
    '平板支撑':'plank','平板':'plank','plank':'plank',
    '卷腹':'crunch','仰卧起坐':'crunch',
    '弓步蹲':'lunge','弓步':'lunge','箭步蹲':'lunge',
    '杠铃卧推':'bench-press','卧推':'bench-press','benchpress':'bench-press',
    '硬拉':'deadlift','deadlift':'deadlift',
  };
  let id = '';
  for (const [k, v] of Object.entries(aliases)) { if (s.includes(k)) { id = v; break; } }
  if (!id) return null;

  const ex = DEFAULT_EXERCISES.find(e => e.id === id);

  // 重量
  const w = s.match(/(\d+\.?\d*)\s*(kg|公斤)/);
  // 每组次数 — 支持 "12次" "12个" "12rep" "12下"（"组"不算，组数单独提取）
  const r = s.match(/(\d+)\s*(次|个|rep|下)(?!\s*组)/);
  // 距离
  const dist = s.match(/(\d+\.?\d*)\s*(km|公里)/);
  // 时长 - 支持 "1min" "1分钟" "1分" "30s" "30秒"
  let duration: number | undefined;
  const durMin = s.match(/(\d+)\s*(min|分钟|分)/);
  const durSec = s.match(/(\d+)\s*(s|秒)/);
  const durHr = s.match(/(\d+\.?\d*)\s*(h|小时|钟头)/);
  const halfHr = /半(小时|钟头|个钟)/.test(s);
  if (durMin) duration = parseInt(durMin[1]);
  else if (durSec) duration = Math.round(parseInt(durSec[1]) / 60) || 1; // 秒→分钟，最少1分钟
  else if (durHr) duration = Math.round(parseFloat(durHr[1]) * 60);
  else if (halfHr) duration = 30;
  // 如果只有数字没有单位，且是有氧/自重/拉伸，可能是分钟
  if (!duration && !w && !r && (ex?.category === 'cardio' || ex?.category === 'stretch' || ex?.category === 'bodyweight')) {
    const numMatch = s.match(/(\d+)/);
    if (numMatch) duration = parseInt(numMatch[1]);
  }

  // 提取组数: "4组" "共4组" "做4组" "四组"
  let sets: number | undefined;
  const setsMatch = s.match(/(\d+)\s*组/);
  if (setsMatch) sets = parseInt(setsMatch[1]);

  // RPE
  let rpe: number | undefined;
  if (/太轻松|很轻松/.test(s)) rpe = 4;
  else if (/轻松/.test(s)) rpe = 5;
  else if (/刚好|适中|合适/.test(s)) rpe = 6;
  else if (/有点累|稍累/.test(s)) rpe = 7;
  else if (/很累|非常累/.test(s)) rpe = 8;
  else if (/极限|力竭/.test(s)) rpe = 9;

  return {
    exerciseId: id, exerciseName: ex?.name || id,
    weight: w ? parseFloat(w[1]) : undefined,
    reps: r ? parseInt(r[1]) : undefined,
    sets,
    distance: dist ? parseFloat(dist[1]) : undefined,
    duration,
    rpe,
  };
}

// ==================== 离线队列 ====================

const QUEUE_KEY = 'zhenzhen-offline-queue';

export function addToOfflineQueue(raw: string): void {
  const queue = getOfflineQueue();
  queue.push({ raw, time: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  console.log('已加入离线队列:', raw.slice(0, 50));
}

export function getOfflineQueue(): { raw: string; time: number }[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch { return []; }
}

export async function processOfflineQueue(): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0 || !hasApiKey()) return 0;

  let processed = 0;
  for (const item of [...queue]) {
    try {
      const result = await aiChat(item.raw);
      if (result?.parsed) {
        const p = result.parsed;
        const session = await db.workoutSessions.orderBy('date').reverse().limit(1).toArray();
        const today = new Date().toISOString().slice(0, 10);
        const todaySession = session[0]?.date === today ? session[0] : null;

        if (todaySession) {
          todaySession.sets.push({
            id: generateId(),
            exerciseId: p.exerciseId,
            weight: p.weight,
            reps: p.reps,
            distance: p.distance,
            duration: p.duration,
            rpe: p.rpe as any,
            completed: true,
            timestamp: Date.now(),
          });
          await db.workoutSessions.put(todaySession);
        }
        processed++;
      }
    } catch (e) {
      console.error('离线队列处理失败:', item.raw, e);
    }
  }

  localStorage.removeItem(QUEUE_KEY);
  return processed;
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

// ==================== 逐组微评 ====================

export async function setFeedback(
  exerciseName: string, weight?: number, reps?: number, duration?: number, rpe?: number,
): Promise<string> {
  if (!hasApiKey()) {
    if (rpe && rpe <= 5) return '这组很轻松，下次可以考虑加一点重量。';
    if (rpe && rpe >= 8) return '这组很有挑战性，注意动作不要变形。';
    return '收到，继续加油！';
  }
  try {
    const rpeLabel = rpe ? ['','','','','太轻松','轻松','刚好','有点累','很累','极限','极限'][rpe] : '未标记';
    const detail = [weight && `${weight}kg`, reps && `${reps}次`, duration && `${duration}分钟`].filter(Boolean).join(' ');
    return await callDeepSeek(
      '你是臻臻。学员刚做完一组训练。给1句话微评（15字以内）：如果RPE太轻松建议加重量，太累提醒注意动作，刚好就鼓励。口语化。',
      `${exerciseName}: ${detail} 感觉${rpeLabel}`,
      80,
    );
  } catch {
    return rpe && rpe <= 5 ? '太轻松了，下次加重量。' : '收到！';
  }
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
