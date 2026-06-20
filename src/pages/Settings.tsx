import { useState, useEffect } from 'react';
import { hasApiKey, setApiKey, testConnection, getAIStatus } from '../services/ai-coach';
import { db, getStreak } from '../db/database';
import { IconSettings, IconCheck, Dot } from '../components/Icons';

export default function Settings() {
  const [apiKey, setApiKeyState] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [stats, setStats] = useState({ totalSessions: 0, streak: 0 });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [aiStatus, setAiStatus] = useState(getAIStatus());

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
    const key = apiKey.trim();
    if (!key) return;
    if (!key.startsWith('sk-')) {
      alert('Key 格式应为 sk- 开头，请检查是否完整复制。');
      return;
    }
    setApiKey(key);
    setHasKey(true);
    setSaved(true);
    setApiKeyState('');
    setAiStatus(getAIStatus());
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTestConnection() {
    setTesting(true); setTestResult(null);
    const ok = await testConnection();
    setTestResult(ok ? 'ok' : 'fail');
    setAiStatus(getAIStatus());
    setTesting(false);
  }

  function handleRemoveKey() {
    if (!window.confirm('确定移除 API Key？AI 教练功能将不可用。')) return;
    localStorage.removeItem('zhenzhen-api-key');
    setHasKey(false);
    setSaved(false);
    setAiStatus(getAIStatus());
  }

  async function handleClearData() {
    if (!window.confirm('这将删除所有训练记录。此操作不可恢复。确定吗？')) return;
    await db.workoutSessions.clear();
    await db.dailyPlans.clear();
    setStats({ totalSessions: 0, streak: 0 });
    alert('数据已清除。');
  }

  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`glass rounded-card p-5 ${className}`}>{children}</div>
  );

  return (
    <div className="flex flex-col gap-4 px-5 pt-8 pb-28 safe-top fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconSettings size={22} color="var(--color-text)" />
          <h1 className="heading-xl" style={{ margin: 0 }}>设置</h1>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
          color: aiStatus === 'connected' ? 'var(--color-green)' : aiStatus === 'no-key' ? 'var(--color-text3)' : 'var(--color-red)',
        }}>
          <Dot color={aiStatus === 'connected' ? 'var(--color-green)' : aiStatus === 'no-key' ? 'var(--color-text3)' : 'var(--color-red)'} glow={aiStatus === 'connected'} />
          {aiStatus === 'connected' ? 'AI 就绪' : aiStatus === 'no-key' ? '未配置' : '离线'}
        </div>
      </div>

      {/* ── 数据概览 ── */}
      <Card>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text2)', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 16px' }}>
          数据概览
        </h2>
        <div className="flex gap-8">
          <div>
            <span className="stat-number" style={{ color: 'var(--color-accent)' }}>{stats.totalSessions}</span>
            <p className="stat-label">总训练次数</p>
          </div>
          <div>
            <span className="stat-number" style={{ color: 'var(--color-green)' }}>{stats.streak}</span>
            <p className="stat-label">连续天数</p>
          </div>
        </div>
      </Card>

      {/* ── AI 教练 ── */}
      <Card>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text2)', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 12px' }}>
          AI 教练
        </h2>

        {hasKey ? (
          <>
            <div style={{ fontSize: '13px', color: 'var(--color-text2)', marginBottom: '12px', lineHeight: 1.6 }}>
              {aiStatus === 'connected' ? <span><IconCheck size={14} color='var(--color-green)' /> AI 在线 — 臻臻正在等待你的训练</span> :
               aiStatus === 'error' ? '连接失败 — 检查 Key 或网络后重试' :
               'Key 已保存'}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleRemoveKey} className="btn-ghost px-4 py-2 rounded-btn text-sm">
                移除 Key
              </button>
              <button onClick={handleTestConnection} disabled={testing}
                className="btn-ghost px-4 py-2 rounded-btn text-sm font-semibold"
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
              {testResult === 'ok' && <span className="badge badge-green" style={{ alignSelf: 'center' }}><IconCheck size={14} color="var(--color-green)" />连接成功</span>}
              {testResult === 'fail' && <span className="badge badge-red" style={{ alignSelf: 'center' }}>连接失败</span>}
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKeyState(e.target.value)}
                placeholder="sk-..."
                className="input-gym flex-1"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="btn-ghost px-3 py-2 rounded-btn text-sm"
                style={{ minWidth: '40px' }}
              >
                {showKey ? '显示' : '隐藏'}
              </button>
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim()}
                className="btn-primary px-5 py-2 rounded-btn text-sm"
                style={{ opacity: apiKey.trim() ? 1 : 0.4 }}
              >
                保存
              </button>
            </div>
            {saved && <p className="badge badge-green" style={{ display: 'inline-flex', marginBottom: '8px' }}><IconCheck size={14} color="var(--color-green)" />已保存</p>}
            <p style={{ fontSize: '11px', color: 'var(--color-text3)', lineHeight: 1.6, margin: 0 }}>
              Key 仅保存在浏览器本地，不上传任何服务器。
              <br />
              前往{' '}
              <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--color-blue)', textDecoration: 'underline' }}>
                platform.deepseek.com
              </a>
              {' '}获取 API Key。
            </p>
          </>
        )}
      </Card>

      {/* ── 关于 ── */}
      <Card>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text2)', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 10px' }}>
          关于臻臻
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text3)', lineHeight: 1.8, margin: '0 0 12px' }}>
          臻臻是你的 AI 私人教练。她关心你的进步，处理你没做到的事情。
          你只需要训练，其他事都交给她。
        </p>
        <ol style={{ fontSize: '12px', color: 'var(--color-text3)', lineHeight: 2, paddingLeft: '16px', margin: 0 }}>
          <li>在「训练」页面生成计划</li>
          <li>用语音或文字记录每组训练</li>
          <li>训练结束后臻臻给你分析反馈</li>
          <li>在「日志」回顾成长轨迹</li>
        </ol>
      </Card>

      {/* ── 危险区域 ── */}
      <Card className="fade-up delay-3">
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-red)', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 10px' }}>
          危险区域
        </h2>
        <button
          onClick={handleClearData}
          className="btn-ghost px-5 py-2.5 rounded-btn text-sm font-semibold"
          style={{ color: 'var(--color-red)' }}
        >
          清除所有数据
        </button>
      </Card>
    </div>
  );
}
