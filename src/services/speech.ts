// 浏览器语音识别封装

interface SpeechResult {
  transcript: string;
  isFinal: boolean;
}

type SpeechCallback = (result: SpeechResult) => void;
type ErrorCallback = (error: string) => void;

let recognition: SpeechRecognition | null = null;
let isSupported: boolean | null = null;

export function isSpeechSupported(): boolean {
  if (isSupported !== null) return isSupported;
  isSupported = !!(
    window.SpeechRecognition ||
    window.webkitSpeechRecognition
  );
  return isSupported;
}

export function startSpeechRecognition(
  onResult: SpeechCallback,
  onError: ErrorCallback,
): boolean {
  if (!isSpeechSupported()) {
    onError('你的浏览器不支持语音输入，请在 Safari 中打开（iOS 支持语音识别）。');
    return false;
  }

  const SpeechRecognitionCtor =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  recognition = new SpeechRecognitionCtor();

  if (!recognition) {
    onError('语音识别初始化失败。');
    return false;
  }

  recognition.lang = 'zh-CN';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const result = event.results[event.results.length - 1];
    onResult({
      transcript: result[0].transcript,
      isFinal: result.isFinal,
    });
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    let msg: string;
    switch (event.error) {
      case 'not-allowed':
        msg = '麦克风权限被拒绝，请在设置中允许。';
        break;
      case 'no-speech':
        msg = '没有检测到语音，请再说一次。';
        break;
      case 'audio-capture':
        msg = '找不到麦克风设备。';
        break;
      default:
        msg = `语音识别出错：${event.error}`;
    }
    onError(msg);
  };

  recognition.onend = () => {
    // 不做任何事，等待回调
  };

  recognition.start();
  return true;
}

export function stopSpeechRecognition(): void {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}
