import { useState, useRef, useCallback } from 'react';
import { useTraining } from '../hooks/useTraining';
import { parseTrainingInput } from '../services/format';
import { startSpeechRecognition, stopSpeechRecognition, isSpeechSupported } from '../services/speech';
import { DEFAULT_EXERCISES } from '../db/database';

export default function Training() {
  const {
    currentSession,
    sets,
    isResting,
    restSeconds,
    feedback,
    isAnalyzing,
    startWorkout,
    addSet,
    removeSet,
    updateRPE,
    skipRest,
    finishWorkout,
    cancelWorkout,
  } = useTraining();

  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordText, setRecordText] = useState('');
  const [parseError, setParseError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 处理输入提交
  const handleSubmit = useCallback((raw: string) => {
    if (!raw.trim()) return;

    const parsed = parseTrainingInput(raw);
    if (!parsed) {
      setParseError(`没听懂，请说清楚动作名+数量。比如"高位下拉 25公斤 8次"`);
      return;
    }

    if (!currentSession) {
      // 自动开始训练
      startWorkout();
    }

    addSet(parsed);
    setParseError('');
    setTextInput('');
    setRecordText('');
  }, [currentSession, startWorkout, addSet]);

  // 语音输入
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopSpeechRecognition();
      setIsRecording(false);
      return;
    }

    if (!isSpeechSupported()) {
      alert('你的浏览器不支持语音输入。请在 Safari 中打开（iOS 支持）。');
      return;
    }

    setIsRecording(true);
    setRecordText('');

    startSpeechRecognition(
      (result) => {
        setRecordText(result.transcript);
        if (result.isFinal) {
          handleSubmit(result.transcript);
          setIsRecording(false);
        }
      },
      (error) => {
        setParseError(error);
        setIsRecording(false);
      },
    );
  }, [isRecording, handleSubmit]);

  // 键盘提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(textInput);
    }
  };

  // 快捷添加：从动作库选择
  const quickAdd = (exerciseId: string) => {
    const ex = DEFAULT_EXERCISES.find(e => e.id === exerciseId);
    if (!ex) return;
    setTextInput(`${ex.name} `);
    inputRef.current?.focus();
  };

  // ---- 训练后反馈页面 ----
  if (feedback) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 pb-24 safe-top">
        <div className="text-center mb-8">
          <p style={{ fontSize: '48px', margin: 0 }}>✅</p>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '12px 0 4px' }}>训练完成</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text3)' }}>
            {sets.length} 组已完成
          </p>
        </div>

        <div
          className="w-full rounded-2xl p-5 mb-6"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h3 className="font-semibold mb-2" style={{ fontSize: '15px' }}>💬 臻臻点评</h3>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text2)', whiteSpace: 'pre-wrap' }}>
            {feedback}
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3.5 rounded-xl text-base font-semibold transition-opacity active:opacity-80"
          style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
        >
          返回首页
        </button>
      </div>
    );
  }

  // ---- 分析中 ----
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full pb-24 safe-top">
        <p style={{ fontSize: '48px' }}>🧠</p>
        <p style={{ fontSize: '16px', color: 'var(--color-text2)', marginTop: '12px' }}>
          臻臻在分析你的训练...
        </p>
      </div>
    );
  }

  // ---- 训练中 ----
  return (
    <div className="flex flex-col h-full pb-24 safe-top">
      {/* 顶部状态栏 */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div>
          <span style={{ fontSize: '17px', fontWeight: 600 }}>
            {currentSession ? '🏋️ 训练中' : '⚡ 开始训练'}
          </span>
          {currentSession && (
            <span className="ml-3" style={{ fontSize: '13px', color: 'var(--color-text3)' }}>
              {sets.length} 组
            </span>
          )}
        </div>

        {currentSession && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity"
              style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-text2)' }}
            >
              {showHistory ? '收起' : '查看记录'}
            </button>
            <button
              onClick={cancelWorkout}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity"
              style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-red)' }}
            >
              结束
            </button>
          </div>
        )}
      </div>

      {/* 组间休息计时器 */}
      {isResting && (
        <div
          className="mx-5 mt-3 p-3 rounded-xl text-center"
          style={{ backgroundColor: 'var(--color-surface2)' }}
        >
          <div className="flex items-center justify-center gap-3">
            <span style={{ fontSize: '13px', color: 'var(--color-text2)' }}>⏱️ 组间休息</span>
            <span style={{ fontSize: '28px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {restSeconds}s
            </span>
            <button
              onClick={skipRest}
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text2)' }}
            >
              跳过
            </button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {parseError && (
        <div
          className="mx-5 mt-3 p-3 rounded-xl text-sm"
          style={{ backgroundColor: 'rgba(224,85,85,0.1)', color: 'var(--color-red)' }}
        >
          {parseError}
          <button
            onClick={() => setParseError('')}
            className="ml-3 underline"
          >
            知道了
          </button>
        </div>
      )}

      {/* 输入区域 */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={isRecording ? recordText : textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording
                ? '正在聆听...'
                : '说或输入：高位下拉 25公斤 8次'
            }
            disabled={isRecording}
            className="flex-1 px-4 py-3 rounded-xl text-base outline-none transition-colors"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: `1.5px solid ${isRecording ? 'var(--color-red)' : 'var(--color-border)'}`,
              color: 'var(--color-text)',
            }}
          />

          <button
            onClick={toggleRecording}
            className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${
              isRecording ? 'recording-pulse' : ''
            }`}
            style={{
              backgroundColor: isRecording ? 'var(--color-red)' : 'var(--color-surface)',
              border: `1.5px solid ${isRecording ? 'var(--color-red)' : 'var(--color-border)'}`,
            }}
          >
            🎤
          </button>

          <button
            onClick={() => handleSubmit(isRecording ? recordText : textInput)}
            disabled={!textInput.trim() && !isRecording}
            className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-opacity"
            style={{
              backgroundColor: 'var(--color-accent)',
              opacity: textInput.trim() || isRecording ? 1 : 0.3,
              color: '#000',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* 动作库快捷选择 */}
      <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <p style={{ fontSize: '11px', color: 'var(--color-text3)', marginBottom: '6px' }}>
          点击快速填入动作
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_EXERCISES.filter(e => e.category === 'strength' || e.category === 'cardio').map(ex => (
            <button
              key={ex.id}
              onClick={() => quickAdd(ex.id)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity active:opacity-70"
              style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-text2)' }}
            >
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      {/* 已记录列表 */}
      {currentSession && (sets.length > 0 || showHistory) && (
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {sets.length === 0 && (
            <p style={{ fontSize: '14px', color: 'var(--color-text3)', textAlign: 'center', paddingTop: '40px' }}>
              还没有记录任何组
            </p>
          )}

          {sets.map((set, i) => {
            const ex = DEFAULT_EXERCISES.find(e => e.id === set.exerciseId);
            return (
              <div
                key={set.id}
                className="flex items-center justify-between py-3 px-3 rounded-xl mb-2"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '13px', color: 'var(--color-text3)' }}>
                      #{i + 1}
                    </span>
                    <span className="font-medium" style={{ fontSize: '15px' }}>
                      {ex?.name || set.exerciseId}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-3" style={{ fontSize: '14px', color: 'var(--color-text2)' }}>
                    {set.weight && <span>{set.weight}kg</span>}
                    {set.reps && <span>{set.reps}次</span>}
                    {set.distance && <span>{set.distance}km</span>}
                    {set.duration && <span>{set.duration}分钟</span>}
                  </div>
                </div>

                {/* RPE 选择器 */}
                <div className="flex items-center gap-1">
                  {[6, 7, 8, 9, 10].map(rpe => (
                    <button
                      key={rpe}
                      onClick={() => updateRPE(set.id, rpe)}
                      className="w-7 h-7 rounded-full text-xs font-medium transition-all"
                      style={{
                        backgroundColor: set.rpe === rpe
                          ? 'var(--color-accent)'
                          : 'var(--color-surface2)',
                        color: set.rpe === rpe ? '#000' : 'var(--color-text3)',
                      }}
                    >
                      {rpe}
                    </button>
                  ))}
                  <button
                    onClick={() => removeSet(set.id)}
                    className="ml-2 w-6 h-6 rounded-full text-xs flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-surface2)', color: 'var(--color-red)' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 底部按钮 */}
      {currentSession && sets.length > 0 && (
        <div
          className="px-5 py-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={finishWorkout}
            className="w-full py-3.5 rounded-xl text-base font-semibold transition-opacity active:opacity-80"
            style={{ backgroundColor: 'var(--color-green)', color: '#000' }}
          >
            完成训练 · 查看臻臻点评
          </button>
        </div>
      )}
    </div>
  );
}
