// 将语音/文字输入解析为结构化的训练记录

import type { ParsedTrainingInput, RPE } from '../types';
import { DEFAULT_EXERCISES } from '../db/database';

const EXERCISE_ALIASES: Record<string, string> = {
  '高位下拉': '高位下拉',
  '下拉': '高位下拉',
  'lat pulldown': '高位下拉',
  '坐姿划船': '坐姿划船',
  '划船': '坐姿划船',
  '推胸': '坐姿推胸',
  '坐姿推胸': '坐姿推胸',
  '胸推': '坐姿推胸',
  '推肩': '坐姿推肩',
  '坐姿推肩': '坐姿推肩',
  '肩推': '坐姿推肩',
  '腿举': '腿举',
  '倒蹬': '腿举',
  '腿弯举': '腿弯举',
  '腿屈伸': '腿屈伸',
  '二头弯举': '二头弯举',
  '弯举': '二头弯举',
  '三头下压': '三头下压',
  '三头': '三头下压',
  '跑步': '跑步',
  '跑': '跑步',
  '爬楼机': '爬楼机',
  '爬楼': '爬楼机',
  '楼梯机': '爬楼机',
  '骑行': '骑行',
  '骑车': '骑行',
  '自行车': '骑行',
  '跑步机': '跑步机',
  '拉伸': '拉伸',
  '拉筋': '拉伸',
  '引体向上': '引体向上',
  '引体': '引体向上',
  'pull up': '引体向上',
  '俯卧撑': '俯卧撑',
  'push up': '俯卧撑',
  '自重深蹲': '自重深蹲',
  '深蹲': '自重深蹲',
};

const RPE_KEYWORDS: Record<string, RPE> = {
  '太轻松': 4, '轻松': 5, '刚好': 7,
  '有点累': 8, '很累': 9, '极限': 10,
  'rpe4': 4, 'rpe5': 5, 'rpe6': 6, 'rpe7': 7,
  'rpe8': 8, 'rpe9': 9, 'rpe10': 10,
};

function findExerciseName(raw: string): string | null {
  // 先直接匹配
  for (const [alias, name] of Object.entries(EXERCISE_ALIASES)) {
    if (raw.includes(alias)) return name;
  }
  // 模糊匹配
  for (const ex of DEFAULT_EXERCISES) {
    if (raw.includes(ex.name)) return ex.name;
  }
  return null;
}

function extractNumber(raw: string, ...units: string[]): number | null {
  const patterns = units.map(u =>
    new RegExp(`(\\d+[\\.\\d]*)\\s*${u}`, 'i')
  );
  for (const p of patterns) {
    const m = raw.match(p);
    if (m) return parseFloat(m[1]);
  }
  // 尝试匹配 "数字" 后跟单位的情况
  const generalMatch = raw.match(/(\d+\.?\d*)\s*(kg|公斤|公里|km|分钟|min|次)/i);
  if (generalMatch) return parseFloat(generalMatch[1]);
  return null;
}

export function parseTrainingInput(raw: string): ParsedTrainingInput | null {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned || cleaned.length < 2) return null;

  const exerciseName = findExerciseName(cleaned);
  if (!exerciseName) return null;

  const result: ParsedTrainingInput = { exerciseName };

  // 提取重量
  const weight = extractNumber(cleaned, 'kg', '公斤');
  if (weight !== null) result.weight = weight;

  // 提取次数
  const reps = extractNumber(cleaned, '次', '个', 'rep', 'reps');
  if (reps !== null) result.reps = reps;

  // 提取距离（有氧）
  const distance = extractNumber(cleaned, 'km', '公里');
  if (distance !== null) result.distance = distance;

  // 提取时长（有氧）
  const duration = extractNumber(cleaned, 'min', '分钟');
  if (duration !== null) result.duration = duration;

  // 如果没有找到 reps 但有数字，且数字在 1-50 之间，可能是次数
  if (result.reps === undefined && result.weight === undefined && result.distance === undefined) {
    const nums = cleaned.match(/\d+/g);
    if (nums) {
      for (const n of nums) {
        const v = parseInt(n);
        if (v >= 1 && v <= 50) {
          result.reps = v;
          break;
        }
      }
    }
  }

  // RPE
  for (const [keyword, rpe] of Object.entries(RPE_KEYWORDS)) {
    if (cleaned.includes(keyword)) {
      result.rpe = rpe;
      break;
    }
  }

  return result;
}

// 格式化 ParsedTrainingInput 为统一文本显示
export function formatSetDisplay(input: ParsedTrainingInput): string {
  const parts: string[] = [input.exerciseName];
  if (input.weight) parts.push(`${input.weight}kg`);
  if (input.reps) parts.push(`${input.reps}次`);
  if (input.distance) parts.push(`${input.distance}km`);
  if (input.duration) parts.push(`${input.duration}分钟`);
  if (input.rpe) parts.push(`RPE ${input.rpe}`);
  return parts.join(' · ');
}

// 获取某个动作的历史数据用于对比
export function getExerciseHistory(
  exerciseId: string,
  sessions: { date: string; sets: { exerciseId: string; weight?: number; reps?: number }[] }[]
): { date: string; maxWeight: number; maxReps: number }[] {
  return sessions
    .map(s => {
      const exerciseSets = s.sets.filter(set => set.exerciseId === exerciseId);
      if (exerciseSets.length === 0) return null;
      return {
        date: s.date,
        maxWeight: Math.max(...exerciseSets.map(set => set.weight || 0)),
        maxReps: Math.max(...exerciseSets.map(set => set.reps || 0)),
      };
    })
    .filter(Boolean) as { date: string; maxWeight: number; maxReps: number }[];
}
