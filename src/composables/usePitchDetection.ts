import { onUnmounted, ref } from "vue";

// 定义调弦方案类型
export interface TuningPreset {
  name: string;
  strings: Array<{
    name: string;
    string: number;
    frequency: number;
    octave: number;
  }>;
}

// 标准吉他调音频率 (E2, A2, D3, G3, B3, E4)
export const STANDARD_TUNING: TuningPreset = {
  name: "标准调弦",
  strings: [
    { name: "E", string: 6, frequency: 82.41, octave: 2 },
    { name: "A", string: 5, frequency: 110.0, octave: 2 },
    { name: "D", string: 4, frequency: 146.83, octave: 3 },
    { name: "G", string: 3, frequency: 196.0, octave: 3 },
    { name: "B", string: 2, frequency: 246.94, octave: 3 },
    { name: "E", string: 1, frequency: 329.63, octave: 4 },
  ],
};

// Drop D 调弦
export const DROP_D_TUNING: TuningPreset = {
  name: "Drop D",
  strings: [
    { name: "D", string: 6, frequency: 73.42, octave: 2 },
    { name: "A", string: 5, frequency: 110.0, octave: 2 },
    { name: "D", string: 4, frequency: 146.83, octave: 3 },
    { name: "G", string: 3, frequency: 196.0, octave: 3 },
    { name: "B", string: 2, frequency: 246.94, octave: 3 },
    { name: "E", string: 1, frequency: 329.63, octave: 4 },
  ],
};

// 半音降调
export const HALF_STEP_DOWN_TUNING: TuningPreset = {
  name: "半音降调",
  strings: [
    { name: "D#", string: 6, frequency: 77.78, octave: 2 },
    { name: "G#", string: 5, frequency: 103.83, octave: 2 },
    { name: "C#", string: 4, frequency: 138.59, octave: 3 },
    { name: "F#", string: 3, frequency: 185.0, octave: 3 },
    { name: "A#", string: 2, frequency: 233.08, octave: 3 },
    { name: "D#", string: 1, frequency: 311.13, octave: 4 },
  ],
};

// Open G 调弦
export const OPEN_G_TUNING: TuningPreset = {
  name: "Open G",
  strings: [
    { name: "D", string: 6, frequency: 73.42, octave: 2 },
    { name: "G", string: 5, frequency: 98.0, octave: 2 },
    { name: "D", string: 4, frequency: 146.83, octave: 3 },
    { name: "G", string: 3, frequency: 196.0, octave: 3 },
    { name: "B", string: 2, frequency: 246.94, octave: 3 },
    { name: "D", string: 1, frequency: 293.66, octave: 4 },
  ],
};

export const TUNING_PRESETS = [
  STANDARD_TUNING,
  DROP_D_TUNING,
  HALF_STEP_DOWN_TUNING,
  OPEN_G_TUNING,
];

// 兼容旧代码
export const GUITAR_STRINGS = STANDARD_TUNING.strings;

// 音高检测使用自相关算法
export function usePitchDetection() {
  const isListening = ref(false);
  const currentFrequency = ref(0);
  const currentNote = ref("");
  const detuneAmount = ref(0); // -50 到 +50 cents
  const closestString = ref<(typeof GUITAR_STRINGS)[0] | null>(null);
  const volumeLevel = ref(0);
  const mode = ref<"auto" | "manual">("auto");
  const selectedString = ref<(typeof GUITAR_STRINGS)[0] | null>(null);
  const currentTuning = ref<TuningPreset>(STANDARD_TUNING);
  const spectrumData = ref<Uint8Array>(new Uint8Array(0));

  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let microphone: MediaStreamAudioSourceNode | null = null;
  let mediaStream: MediaStream | null = null;
  let animationId: number | null = null;
  let oscillator: OscillatorNode | null = null;
  let gainNode: GainNode | null = null;

  // 自相关算法检测音高
  function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let best_offset = -1;
    let best_correlation = 0;
    let rms = 0;

    // 计算 RMS (音量)
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    // 音量太小，返回 -1
    if (rms < 0.01) return -1;

    // 找到第一个过零点
    let lastCorrelation = 1;
    for (let offset = 0; offset < MAX_SAMPLES; offset++) {
      let correlation = 0;
      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs(buffer[i] - buffer[i + offset]);
      }
      correlation = 1 - correlation / MAX_SAMPLES;

      if (correlation > 0.9 && correlation > lastCorrelation) {
        const foundGoodCorrelation =
          correlation > best_correlation && offset > 0;

        if (foundGoodCorrelation) {
          best_correlation = correlation;
          best_offset = offset;
        }
      }
      lastCorrelation = correlation;
    }

    if (best_correlation > 0.01 && best_offset !== -1) {
      const fundamental = sampleRate / best_offset;
      return fundamental;
    }
    return -1;
  }

  // 频率转音符
  function frequencyToNote(frequency: number): {
    note: string;
    octave: number;
    detune: number;
  } {
    const A4 = 440;
    const C0 = A4 * 2 ** -4.75;
    const noteNames = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];

    const h = Math.round(12 * Math.log2(frequency / C0));
    const octave = Math.floor(h / 12);
    const noteIndex = h % 12;

    const exactNote = 12 * Math.log2(frequency / C0);
    const detune = Math.round((exactNote - h) * 100);

    return {
      note: noteNames[noteIndex],
      octave,
      detune,
    };
  }

  // 找到最接近的吉他弦（根据当前调弦方案）
  function findClosestString(frequency: number) {
    const strings = currentTuning.value.strings;
    let closest = strings[0];
    let minDiff = Math.abs(frequency - closest.frequency);

    for (const string of strings) {
      const diff = Math.abs(frequency - string.frequency);
      if (diff < minDiff) {
        minDiff = diff;
        closest = string;
      }
    }

    // 计算与标准音的偏差 (cents)
    const detune = 1200 * Math.log2(frequency / closest.frequency);

    return { string: closest, detune };
  }

  // 分析音频数据
  function detectPitch() {
    if (!analyser || !isListening.value) return;

    const bufferLength = analyser.fftSize;
    const buffer = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(buffer);

    // 获取频谱数据用于可视化
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);
    spectrumData.value = frequencyData;

    // 计算音量
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    const volume = Math.sqrt(sum / buffer.length);
    volumeLevel.value = Math.min(100, volume * 500);

    const sampleRate = audioContext!.sampleRate;
    const frequency = autoCorrelate(buffer, sampleRate);

    if (frequency > 0 && frequency < 1000) {
      currentFrequency.value = Math.round(frequency * 10) / 10;

      const noteInfo = frequencyToNote(frequency);
      currentNote.value = `${noteInfo.note}${noteInfo.octave}`;

      if (mode.value === "auto") {
        const { string, detune } = findClosestString(frequency);
        closestString.value = string;
        detuneAmount.value = Math.round(detune);
        selectedString.value = string;
      } else if (mode.value === "manual" && selectedString.value) {
        const detune =
          1200 * Math.log2(frequency / selectedString.value.frequency);
        detuneAmount.value = Math.round(detune);
        closestString.value = selectedString.value;
      }
    }

    animationId = requestAnimationFrame(detectPitch);
  }

  // 开始监听
  async function startListening() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.8;

      microphone = audioContext.createMediaStreamSource(mediaStream);
      microphone.connect(analyser);

      isListening.value = true;
      detectPitch();
    } catch (error) {
      console.error("无法访问麦克风:", error);
      alert("请允许访问麦克风以使用调音器功能");
    }
  }

  // 停止监听
  function stopListening() {
    isListening.value = false;

    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    if (microphone) {
      microphone.disconnect();
      microphone = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    analyser = null;
    currentFrequency.value = 0;
    currentNote.value = "";
    detuneAmount.value = 0;
    closestString.value = null;
    volumeLevel.value = 0;
    stopReferenceTone();
  }

  // 播放标准音（参考音）并切换到手动模式 - 带淡入淡出效果
  function playReferenceTone(
    stringInfo: (typeof GUITAR_STRINGS)[0],
    duration = 3000,
  ) {
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContext();
    }
    stopReferenceTone();

    const now = audioContext.currentTime;
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();

    // 淡入淡出效果
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.1); // 淡入 100ms
    gainNode.gain.setValueAtTime(0.1, now + duration / 1000 - 0.2); // 保持
    gainNode.gain.linearRampToValueAtTime(0, now + duration / 1000); // 淡出 200ms

    oscillator.type = "sine";
    oscillator.frequency.value = stringInfo.frequency;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration / 1000);

    // 自动停止后清理
    setTimeout(() => {
      stopReferenceTone();
    }, duration);

    // 切换模式为手动，并锁定所选弦
    mode.value = "manual";
    selectedString.value = stringInfo;
  }

  function stopReferenceTone() {
    try {
      if (oscillator) {
        oscillator.disconnect();
        oscillator = null;
      }
      if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
      }
    } catch {}
  }

  function setMode(nextMode: "auto" | "manual") {
    mode.value = nextMode;
  }

  function setSelectedString(stringInfo: (typeof GUITAR_STRINGS)[0] | null) {
    selectedString.value = stringInfo;
  }

  function setTuning(preset: TuningPreset) {
    currentTuning.value = preset;
    // 切换调弦方案后重置选择
    selectedString.value = null;
    closestString.value = null;
  }

  onUnmounted(() => {
    stopListening();
  });

  return {
    isListening,
    currentFrequency,
    currentNote,
    detuneAmount,
    closestString,
    volumeLevel,
    mode,
    selectedString,
    currentTuning,
    spectrumData,
    startListening,
    stopListening,
    setMode,
    setSelectedString,
    setTuning,
    playReferenceTone,
    stopReferenceTone,
  };
}
