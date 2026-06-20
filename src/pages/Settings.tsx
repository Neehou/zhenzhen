import { useState, useEffect } from 'react';
import { hasApiKey, setApiKey } from '../services/ai-coach';
import { db, getStreak } from '../db/database';

export default function Settings() {
  const [apiKey, setApiKeyState] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [stats, setStats] = useState({ totalSessions: 0, streak: 0 });
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setHasKey(hasApiKey());
    loadStats();
  }, []);

  async function loadStats() {
    const [sessions, streak] = await Promise.all([
      db.workoutSessions.count(),
      getStreak(),
    ]);
    setStats({ totalSessions: sessions, streak });
  }

  function handleSaveKey() {
    if (!apiKey.trim()) return;
    setApiKey(apiKey.trim());
    setHasKey(true);
    setSaved(true);
    setApiKeyState('');
    setTimeout(() => setSaved(false), 2000);
  }

  function handleRemoveKey() {
    if (!window.confirm('确定移除 API Key？AI 教练功能将不可用。')) return;
    localStorage.removeItem('zhenzhen-api-key');
    setHasKey(false);
    setSaved(false);
  }

  async function handleClearData() {
    if (!window.confirm('⚠️ 这将删除所有训练记录。此操作不可恢复。确定吗？')) return;
    await db.workoutSessions.clear();
    await db.dailyPlans.clear();
    setStats({ totalSessions: 0, streak: 0 });
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-8 pb-24 safe-top">
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>⚙️ 设置</h1>

      {/* 统计 */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px' }}>📈 数据概览</h2>
        <div className="flex gap-6">
          <div>
            <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-accent)' }}>
              {stats.totalSessions}
            </span>
            <p style={{ fontSize: '13px', color: 'var(--color-text3)', marginTop: '2px' }}>总训练次数</p>
          </div>
          <div>
            <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-green)' }}>
              {stats.streak}
            </span>
            <p style={{ fontSize: '13px', color: 'var(--color-text3)', marginTop: '2px' }}>连续天数</p>
          </div>
        </div>
      </div>

      {/* API Key */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>🤖 AI 教练</h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text3)', marginBottom: '12px', lineHeight: 1.5 }}>
          {hasKey
            ? '✅ 已配置 Anthropic API Key，臻臻将为你提供 AI 驱动的个性化指导。'
            : '填写 Anthropic API Key 以启用 AI 教练功能。没有 Key 也能用基础功能。'
          }
        </p>

        {hasKey ? (
          <button
            onClick={handleRemoveKey}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-red)' }}
          >
            移除 Key
          </button>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKeyState(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: 'var(--color-surface2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-text2)' }}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: '#000',
                  opacity: apiKey.trim() ? 1 : 0.4,
                }}
              >
                保存
              </button>
            </div>
            {saved && (
              <p className="mt-2" style={{ fontSize: '13px', color: 'var(--color-green)' }}>
                ✅ 已保存
              </p>
            )}
            <p className="mt-3" style={{ fontSize: '11px', color: 'var(--color-text3)', lineHeight: 1.5 }}>
              Key 仅保存在你的浏览器本地，不会上传到任何服务器。
              <br />
              前往{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener"
                style={{ color: 'var(--color-blue)', textDecoration: 'underline' }}
              >
                console.anthropic.com
              </a>
              {' '}获取 API Key。
            </p>
          </>
        )}
      </div>

      {/* 关于 */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 8px' }}>💡 关于臻臻</h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text3)', lineHeight: 1.7 }}>
          臻臻是你的 AI 私人教练。她关心你的进步，处理你没做到的事情。
          <br />
          你只需要训练，其他事情都交给她。
        </p>

        <div className="mt-3" style={{ fontSize: '13px', color: 'var(--color-text3)' }}>
          <p>使用方法：</p>
          <ol className="list-decimal pl-4" style={{ lineHeight: 1.8 }}>
            <li>在"今日"页面生成训练计划</li>
            <li>在"训练"页面用语音或文字记录每组训练</li>
            <li>训练结束后臻臻会给你分析反馈</li>
            <li>在"日志"页面回顾你的成长轨迹</li>
          </ol>
        </div>
      </div>

      {/* 危险操作 */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid rgba(224,85,85,0.3)' }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 8px', color: 'var(--color-red)' }}>
          ⚠️ 危险区域
        </h2>
        <button
          onClick={handleClearData}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity active:opacity-80"
          style={{ backgroundColor: 'rgba(224,85,85,0.15)', color: 'var(--color-red)' }}
        >
          清除所有数据
        </button>
      </div>
    </div>
  );
}
