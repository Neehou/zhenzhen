// AI 教练服务 — 对接 Claude API

import type { WorkoutSession, DailyPlan, PlannedExercise } from '../types';
import { getOrCreateProfile } from '../db/database';
import { DEFAULT_EXERCISES } from '../db/database';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

function getApiKey(): string | null {
  const stored = localStorage.getItem('zhenzhen-api-key');
  return stored || null;
}

export function setApiKey(key: string): void {
  localStorage.setItem('zhenzhen-api-key', key);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('请先在设置中填写 Anthropic API Key。');

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 请求失败 (${res.status})`);
  }

  const data = await res.json();
  return data.content[0].text;
}

// ============ 生成训练计划 ============

export async function generateTrainingPlan(
  recentSessions: WorkoutSession[],
  todayPlan?: DailyPlan,
): Promise<DailyPlan> {
  const today = new Date().toISOString().slice(0, 10);

  // 如果已有计划，直接返回
  if (todayPlan && todayPlan.date === today) {
    return todayPlan;
  }

  // 如果已设置 API Key，使用 AI 生成
  if (hasApiKey()) {
    try {
      return await aiGeneratePlan(recentSessions, today);
    } catch (e) {
      console.warn('AI 计划生成失败，使用基础计划:', e);
    }
  }

  // 基础规则生成（无 AI 时）
  return ruleBasedPlan(recentSessions, today);
}

async function aiGeneratePlan(
  recentSessions: WorkoutSession[],
  today: string,
): Promise<DailyPlan> {
  // Ensure profile exists
  await getOrCreateProfile();

  const recentSummary = recentSessions.slice(0, 5).map(s => {
    const setList = s.sets.map(set => {
      const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
      return `${ex?.name || set.exerciseId} ${set.weight ? set.weight + 'kg' : ''} ${set.reps ? set.reps + '次' : ''}${set.distance ? set.distance + 'km' : ''}${set.duration ? set.duration + '分钟' : ''}`;
    }).join('、');
    return `${s.date}: ${setList}${s.aiFeedback ? `\n上次点评: ${s.aiFeedback}` : ''}`;
  }).join('\n');

  const systemPrompt = `你是臻臻，一个严厉但关心学员的AI健身教练。你的学员是纯新手，还在摸索动作模式。

你的学员常用的动作：高位下拉、坐姿划船、坐姿推胸、坐姿推肩、腿举、腿弯举、腿屈伸、二头弯举、三头下压、跑步、爬楼机、跑步机、骑行、拉伸、引体向上、俯卧撑、自重深蹲。

你需要输出一个JSON格式的今日训练计划。规则：
1. 新手每周练3-4次，每次包含力量+有氧
2. 力量训练选3-5个动作，覆盖不同的身体部位
3. 每个动作3-4组，新手用轻重量高次数（12-15次）先建立动作模式
4. 根据上次训练的部位轮换（不连续两天练同一部位）
5. 有氧15-25分钟
6. 最后一定要有拉伸

只输出JSON，格式：
{
  "exercises": [
    {"exerciseId": "...", "targetSets": 3, "targetReps": "12-15", "targetWeight": null, "notes": "..."}
  ],
  "planNote": "给学员的一句话说明"
}`;

  const userMessage = `学员信息：纯新手，还在摸索阶段。
最近训练记录：
${recentSummary || '没有训练记录，这是第一次训练。'}

请生成今天的训练计划。`;

  const response = await callClaude(systemPrompt, userMessage);

  // 解析 AI 返回的 JSON
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 返回格式异常');

  const parsed = JSON.parse(jsonMatch[0]);

  // 验证并补充 exerciseId
  const exercises: PlannedExercise[] = parsed.exercises.map((ex: any) => {
    const found = DEFAULT_EXERCISES.find(
      e => e.id === ex.exerciseId || e.name === ex.exerciseId
    );
    return {
      exerciseId: found?.id || ex.exerciseId,
      targetSets: ex.targetSets || 3,
      targetReps: ex.targetReps || '12-15',
      targetWeight: ex.targetWeight || undefined,
      notes: ex.notes || '',
    };
  });

  return {
    date: today,
    exercises,
    generatedAt: Date.now(),
  };
}

function ruleBasedPlan(
  recentSessions: WorkoutSession[],
  today: string,
): DailyPlan {
  // 获取最近一次训练的部位
  const lastBodyParts = new Set<string>();
  const lastSession = recentSessions[0];
  if (lastSession) {
    lastSession.sets.forEach(set => {
      const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
      if (ex) lastBodyParts.add(ex.bodyPart);
    });
  }

  // 新手全身训练（未分化），每次覆盖主要肌群，但避开上次练过的部位
  const allExercises = DEFAULT_EXERCISES.filter(e =>
    e.category === 'strength' || e.category === 'bodyweight'
  );

  // 优先选上次没练到的部位
  const priority = allExercises.filter(e => !lastBodyParts.has(e.bodyPart));
  const backup = allExercises.filter(e => lastBodyParts.has(e.bodyPart));

  const selected = [...priority, ...backup].slice(0, 4);

  const exercises: PlannedExercise[] = [
    ...selected.map(e => ({
      exerciseId: e.id,
      targetSets: 3,
      targetReps: '12-15',
      targetWeight: undefined,
      notes: e.instructions.slice(0, 30),
    })),
    {
      exerciseId: 'running',
      targetSets: 1,
      targetReps: '20分钟',
      targetWeight: undefined,
      notes: '保持稳定配速',
    },
    {
      exerciseId: 'stretching',
      targetSets: 1,
      targetReps: '5分钟',
      targetWeight: undefined,
      notes: '全身拉伸收尾',
    },
  ];

  return {
    date: today,
    exercises,
    generatedAt: Date.now(),
  };
}

// ============ 分析训练 ============

export async function analyzeWorkout(
  session: WorkoutSession,
  recentSessions: WorkoutSession[],
): Promise<string> {
  if (hasApiKey()) {
    try {
      return await aiAnalyze(session, recentSessions);
    } catch (e) {
      console.warn('AI 分析失败，使用基础分析:', e);
    }
  }

  return ruleBasedAnalysis(session, recentSessions);
}

async function aiAnalyze(
  session: WorkoutSession,
  recentSessions: WorkoutSession[],
): Promise<string> {
  const setDetails = session.sets.map(s => {
    const ex = DEFAULT_EXERCISES.find(e => e.id === s.exerciseId);
    return `${ex?.name || s.exerciseId}: ${s.weight ? s.weight + 'kg' : '自重'} × ${s.reps || '-'}次 (RPE ${s.rpe || '未标'})`;
  }).join('\n');

  const historyForExercises: string[] = [];
  const exerciseIds = [...new Set(session.sets.map(s => s.exerciseId))];
  for (const eid of exerciseIds) {
    const ex = DEFAULT_EXERCISES.find(e => e.id === eid);
    const past: string[] = [];
    for (const s of recentSessions.slice(1, 4)) {
      const pastSets = s.sets.filter(set => set.exerciseId === eid);
      if (pastSets.length > 0) {
        past.push(`${s.date}: ${pastSets.map(ps => `${ps.weight || '?'}kg×${ps.reps || '?'}次`).join(', ')}`);
      }
    }
    if (past.length > 0) {
      historyForExercises.push(`${ex?.name || eid} 历史:\n${past.join('\n')}`);
    }
  }

  const systemPrompt = `你是臻臻，一个严厉但关心学员的AI健身教练。学员是纯新手。

风格要求：
- 先指出问题（严厉但有建设性），再给予鼓励
- 每个问题都要给出具体、可操作的建议
- 语言简洁有力，像真实教练说话的方式
- 用口语化的中文，不要官方腔`;

  const userMessage = `分析这次训练：

训练时间：${session.date}
动作记录：
${setDetails}

${historyForExercises.length > 0 ? '该动作的历史表现：\n' + historyForExercises.join('\n\n') : '这是这些动作的第一次训练。'}

请给出：
1. 这次训练的问题（如有）
2. 进步的地方（如有）
3. 下次训练的具体调整建议
4. 一句鼓励的话

控制在200字以内。`;

  return callClaude(systemPrompt, userMessage);
}

function ruleBasedAnalysis(
  session: WorkoutSession,
  _recentSessions: WorkoutSession[],
): string {
  const issues: string[] = [];
  const goods: string[] = [];

  for (const set of session.sets) {
    const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);

    if (set.rpe && set.rpe <= 4) {
      issues.push(`${ex?.name || set.exerciseId}太轻松了，下次试试加一点重量。`);
    }

    if (set.reps && set.reps < 5) {
      issues.push(`${ex?.name || set.exerciseId}次数偏少，可能重量太重了。新手阶段先保证动作质量。`);
    }

    if (!set.rpe) {
      issues.push('记得标注每组的感觉（RPE），这样我才能更好地帮你调整。');
    }
  }

  if (session.sets.length < 5) {
    issues.push('动作太少了，下次至少做5个动作，覆盖更多肌群。');
  }

  if (session.type === 'freestyle') {
    goods.push('能来训练就比不来强！');
  }

  goods.push('每次训练都是一次进步。');

  if (issues.length === 0) {
    return `完成得不错！${goods.join(' ')}注意每次训练后标记RPE，我会更准确地帮你调整。`;
  }

  return [
    ...issues.map(i => `⚠️ ${i}`),
    '',
    ...goods.map(g => `✅ ${g}`),
  ].join('\n');
}

// ============ 周报 ============

export async function generateWeeklyReport(
  sessions: WorkoutSession[],
): Promise<string> {
  if (!hasApiKey() || sessions.length === 0) {
    return weeklyReportBasic(sessions);
  }

  try {
    return await aiWeeklyReport(sessions);
  } catch {
    return weeklyReportBasic(sessions);
  }
}

async function aiWeeklyReport(sessions: WorkoutSession[]): Promise<string> {
  const summary = sessions.map(s => {
    const sets = s.sets.map(set => {
      const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
      return `${ex?.name}: ${set.weight || '-'}kg × ${set.reps || '-'}次`;
    }).join(' | ');
    return `${s.date}: ${sets}`;
  }).join('\n');

  const systemPrompt = `你是臻臻，严厉分析型教练。用口语化中文，简洁有力。`;

  const userMessage = `这是一周的训练记录：
${summary}

训练次数：${sessions.length}次

请给出：
1. 本周总体评价（1-2句）
2. 亮点
3. 主要问题
4. 下周方向
5. 一句迫使他们下周来的话

控制在250字以内。`;

  return callClaude(systemPrompt, userMessage);
}

function weeklyReportBasic(sessions: WorkoutSession[]): string {
  if (sessions.length === 0) {
    return '这周没有训练记录。臻臻在等你。下周，哪怕只来一次，也是开始。';
  }

  const totalSets = sessions.reduce((sum, s) => sum + s.sets.length, 0);
  return [
    `📊 本周训练 ${sessions.length} 次，共 ${totalSets} 组`,
    '',
    `来训练就好。新手阶段，保持规律比追求重量更重要。`,
    '',
    `下周目标：至少 ${sessions.length + 1} 次训练。`,
    `—— 臻臻相信你。`,
  ].join('\n');
}
