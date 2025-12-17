<script setup>
import { computed, onUnmounted, ref } from 'vue'

const isListening = ref(false)
const detectedNote = ref(null)
const frequency = ref(null)
const cents = ref(null)
const selectedMode = ref('standard')
const showSettings = ref(false)
const sensitivity = ref(0.5)
const a4Frequency = ref(440)

let audioContext = null
let analyser = null
let microphone = null
let scriptProcessor = null
let mediaStream = null

// 音频处理参数
const SAMPLE_RATE = 44100
const MIN_RMS = 0.01 // Noise Gate 阈值
const ATTACK_TIME = 200 // 忽略起音时间（ms）
const MIN_FREQUENCY = 60 // 吉他最低音 (约 B1)
const MAX_FREQUENCY = 400 // 吉他最高音 (约 G4)
const CONSISTENCY_FRAMES = 3 // 需要连续一致的帧数
const EMA_ALPHA = 0.3 // 指数移动平均平滑系数

// 状态变量
let startTime = 0
let lastFrequencies = []
let smoothedFrequency = null
let animationFrameId = null

// UI 显示值（用于缓动）
const displayFrequency = ref(null)
const displayCents = ref(null)
const errorMessage = ref(null)

const tuningModes = [
  { id: 'standard', name: '标准调音' },
  { id: 'dropD', name: 'Drop D' },
  { id: 'halfStep', name: '降半音' },
  { id: 'openG', name: 'Open G' },
]

const tuningPresets = {
  standard: [
    { note: 'E2', frequency: 82.41 },
    { note: 'A2', frequency: 110.00 },
    { note: 'D3', frequency: 146.83 },
    { note: 'G3', frequency: 196.00 },
    { note: 'B3', frequency: 246.94 },
    { note: 'E4', frequency: 329.63 },
  ],
  dropD: [
    { note: 'D2', frequency: 73.42 },
    { note: 'A2', frequency: 110.00 },
    { note: 'D3', frequency: 146.83 },
    { note: 'G3', frequency: 196.00 },
    { note: 'B3', frequency: 246.94 },
    { note: 'E4', frequency: 329.63 },
  ],
  halfStep: [
    { note: 'E♭2', frequency: 77.78 },
    { note: 'A♭2', frequency: 103.83 },
    { note: 'D♭3', frequency: 138.59 },
    { note: 'G♭3', frequency: 185.00 },
    { note: 'B♭3', frequency: 233.08 },
    { note: 'E♭4', frequency: 311.13 },
  ],
  openG: [
    { note: 'D2', frequency: 73.42 },
    { note: 'G2', frequency: 98.00 },
    { note: 'D3', frequency: 146.83 },
    { note: 'G3', frequency: 196.00 },
    { note: 'B3', frequency: 246.94 },
    { note: 'D4', frequency: 293.66 },
  ],
}

const currentStrings = computed(() => tuningPresets[selectedMode.value])

const noteColor = computed(() => {
  if (!cents.value)
    return 'text-muted-foreground'
  if (Math.abs(cents.value) < 5)
    return 'text-accent'
  if (Math.abs(cents.value) < 10)
    return 'text-primary'
  return 'text-foreground'
})

const centsColor = computed(() => {
  if (!cents.value)
    return 'text-muted-foreground'
  if (Math.abs(cents.value) < 5)
    return 'text-accent'
  return 'text-foreground'
})

const centIndicatorColor = computed(() => {
  if (!cents.value)
    return 'bg-muted-foreground'
  if (Math.abs(cents.value) < 5)
    return 'bg-accent'
  if (Math.abs(cents.value) < 10)
    return 'bg-primary'
  return 'bg-destructive'
})

function noteFromPitch(frequency) {
  const noteNum = 12 * (Math.log(frequency / a4Frequency.value) / Math.log(2))
  return Math.round(noteNum) + 69
}

function frequencyFromNoteNumber(note) {
  return a4Frequency.value * 2 ** ((note - 69) / 12)
}

function centsOffFromPitch(frequency, note) {
  return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2))
}

// ========== 音高检测核心算法 ==========

// YIN 算法实现
function yinAlgorithm(buffer) {
  const bufferSize = buffer.length
  const yinBuffer = new Float32Array(bufferSize / 2)
  const threshold = 0.15

  // 步骤 1: 计算差分函数
  yinBuffer[0] = 1
  for (let tau = 1; tau < yinBuffer.length; tau++) {
    let sum = 0
    for (let i = 0; i < yinBuffer.length; i++) {
      const delta = buffer[i] - buffer[i + tau]
      sum += delta * delta
    }
    yinBuffer[tau] = sum
  }

  // 步骤 2: 累积平均归一化
  let runningSum = 0
  yinBuffer[0] = 1
  for (let tau = 1; tau < yinBuffer.length; tau++) {
    runningSum += yinBuffer[tau]
    yinBuffer[tau] *= tau / runningSum
  }

  // 步骤 3: 寻找第一个低于阈值的谷值
  let tau = 2
  while (tau < yinBuffer.length) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 < yinBuffer.length && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++
      }
      break
    }
    tau++
  }

  // 如果没有找到合适的周期，返回 -1
  if (tau === yinBuffer.length || yinBuffer[tau] >= threshold) {
    return -1
  }

  // 步骤 4: 使用抛物线插值提高精度
  let betterTau = tau
  if (tau > 0 && tau < yinBuffer.length - 1) {
    const s0 = yinBuffer[tau - 1]
    const s1 = yinBuffer[tau]
    const s2 = yinBuffer[tau + 1]
    betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0))
  }

  return SAMPLE_RATE / betterTau
}

// 检查 Noise Gate（音量阈值）
function checkNoiseGate(buffer) {
  let rms = 0
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i]
  }
  rms = Math.sqrt(rms / buffer.length)
  return rms >= sensitivity.value * MIN_RMS
}

// 检查起音时间
function checkAttackTime() {
  return (Date.now() - startTime) >= ATTACK_TIME
}

// 检测频率
function detectFrequency(buffer) {
  return yinAlgorithm(buffer)
}

// 检查频率是否在有效范围内
function isValidFrequency(freq) {
  return freq >= MIN_FREQUENCY && freq <= MAX_FREQUENCY
}

// 检查连续帧一致性
function checkConsistency(freq) {
  lastFrequencies.push(freq)
  if (lastFrequencies.length > CONSISTENCY_FRAMES) {
    lastFrequencies.shift()
  }

  if (lastFrequencies.length < CONSISTENCY_FRAMES) {
    return false
  }

  // 计算标准差
  const mean = lastFrequencies.reduce((a, b) => a + b, 0) / lastFrequencies.length
  const variance = lastFrequencies.reduce((sum, f) => sum + (f - mean) ** 2, 0) / lastFrequencies.length
  const stdDev = Math.sqrt(variance)

  return stdDev < 2 // 标准差小于 2Hz 认为稳定
}

// 应用 EMA 平滑
function applyEMA(freq) {
  if (smoothedFrequency === null) {
    smoothedFrequency = freq
  }
  else {
    smoothedFrequency = EMA_ALPHA * freq + (1 - EMA_ALPHA) * smoothedFrequency
  }
  return smoothedFrequency
}

// UI 缓动显示
function animateDisplay() {
  if (!isListening.value || !smoothedFrequency) {
    return
  }

  const targetFreq = smoothedFrequency
  const currentFreq = displayFrequency.value || targetFreq

  // 线性插值
  const newFreq = currentFreq + (targetFreq - currentFreq) * 0.2
  displayFrequency.value = newFreq

  // 计算音符和音分
  const note = noteFromPitch(newFreq)
  const centsOff = centsOffFromPitch(newFreq, note)

  const currentCents = displayCents.value || centsOff
  const newCents = currentCents + (centsOff - currentCents) * 0.2
  displayCents.value = newCents

  // 更新显示
  frequency.value = Math.round(newFreq * 10) / 10
  cents.value = Math.round(newCents)

  const noteName = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][note % 12]
  const octave = Math.floor(note / 12) - 1
  detectedNote.value = noteName + octave

  // 继续动画
  animationFrameId = requestAnimationFrame(animateDisplay)
}

// 主更新函数
function updatePitch() {
  const buffer = new Float32Array(2048)
  analyser.getFloatTimeDomainData(buffer)

  // 阶段 1: Noise Gate
  if (!checkNoiseGate(buffer)) {
    return
  }

  // 阶段 2: 忽略起音
  if (!checkAttackTime()) {
    return
  }

  // 阶段 3: YIN 检测基频
  const freq = detectFrequency(buffer)
  if (freq === -1) {
    return
  }

  // 阶段 4: 频率范围过滤
  if (!isValidFrequency(freq)) {
    return
  }

  // 阶段 5: 连续帧一致性判断
  if (!checkConsistency(freq)) {
    return
  }

  // 阶段 6: 时间平滑（EMA）
  applyEMA(freq)

  // 阶段 7: UI 缓动显示（在 animateDisplay 中处理）
}

async function toggleTuner() {
  if (isListening.value) {
    stopListening()
  }
  else {
    await startListening()
  }
}

async function startListening() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048

    microphone = audioContext.createMediaStreamSource(mediaStream)
    microphone.connect(analyser)

    scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1)
    scriptProcessor.onaudioprocess = updatePitch
    analyser.connect(scriptProcessor)
    scriptProcessor.connect(audioContext.destination)

    isListening.value = true
    startTime = Date.now()

    // 启动 UI 缓动动画
    animateDisplay()
  }
  catch (error) {
    console.error('Error accessing microphone:', error)
    errorMessage.value = '无法访问麦克风，请检查浏览器权限设置'
    isListening.value = false
  }
}

function stopListening() {
  // 停止所有音频轨道，释放麦克风占用
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }

  if (scriptProcessor) {
    scriptProcessor.disconnect()
    scriptProcessor = null
  }
  if (analyser) {
    analyser.disconnect()
    analyser = null
  }
  if (microphone) {
    microphone.disconnect()
    microphone = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  isListening.value = false
  detectedNote.value = null
  frequency.value = null
  cents.value = null

  // 清空所有状态
  lastFrequencies = []
  smoothedFrequency = null
  displayFrequency.value = null
  displayCents.value = null

  // 停止动画
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

function playReference(freq) {
  const context = new (window.AudioContext || window.webkitAudioContext)()
  const oscillator = context.createOscillator()
  const gainNode = context.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(context.destination)

  oscillator.frequency.value = freq
  oscillator.type = 'sine'

  gainNode.gain.setValueAtTime(0.3, context.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1)

  oscillator.start(context.currentTime)
  oscillator.stop(context.currentTime + 1)
}

onUnmounted(() => {
  if (isListening.value) {
    stopListening()
  }
})
</script>

<template>
  <!-- Main Content -->
  <main class="p-6 flex flex-1 items-center justify-center">
    <div class="max-w-2xl w-full">
      <!-- Tuning Mode Selector -->
      <div class="mb-6">
        <div class="mb-3 flex items-center justify-between">
          <label class="text-sm font-medium" style="color: var(--color-muted-foreground)">调音模式</label>
          <button
            class="p-2 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:scale-105"
            style="background-color: var(--color-muted)"
            title="设置"
            @click="showSettings = !showSettings"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="mode in tuningModes"
            :key="mode.id"
            class="text-sm font-medium px-4 py-2 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:scale-105"
            :style="selectedMode === mode.id
              ? { backgroundColor: 'var(--color-primary-foreground)', color: 'var(--color-primary)' }
              : { backgroundColor: 'var(--color-card)', color: 'var(--color-card-foreground)' }"
            @click="selectedMode = mode.id"
          >
            {{ mode.name }}
          </button>
        </div>
      </div>

      <!-- Tuner Display -->
      <div class="mb-6 p-6 rounded-xl" style="background-color: var(--color-card); border: 1px solid var(--color-border)">
        <!-- Current Note Display -->
        <div class="mb-6 text-center">
          <div class="text-6xl font-bold mb-2" :class="noteColor">
            {{ detectedNote || '—' }}
          </div>
          <div class="text-xl" style="color: var(--color-muted-foreground)">
            {{ frequency ? `${frequency.toFixed(1)} Hz` : '等待输入...' }}
          </div>
        </div>

        <!-- Tuning Indicator -->
        <div class="mb-6">
          <div class="rounded-full h-3 relative overflow-hidden" style="background-color: var(--color-muted)">
            <div
              class="opacity-20 h-full w-1 left-1/2 top-0 absolute -translate-x-1/2"
              style="background-color: var(--color-foreground)"
            />
            <div
              v-if="cents !== null"
              class="rounded-full h-full w-2 transition-all duration-100 top-0 absolute"
              :class="centIndicatorColor"
              :style="{ left: `calc(50% + ${cents}%)`, transform: 'translateX(-50%)' }"
            />
          </div>
          <div class="text-xs mt-2 flex justify-between" style="color: var(--color-muted-foreground)">
            <span>偏低</span>
            <span>准确</span>
            <span>偏高</span>
          </div>
        </div>

        <!-- Cents Display -->
        <div class="text-center">
          <div class="text-3xl font-semibold" :class="centsColor">
            {{ cents !== null ? (cents > 0 ? '+' : '') + cents.toFixed(0) : '—' }}
            <span class="text-lg ml-1" style="color: var(--color-muted-foreground)">cents</span>
          </div>
        </div>
      </div>

      <!-- String Reference -->
      <div class="mb-6 p-5 rounded-xl" style="background-color: var(--color-card); border: 1px solid var(--color-border)">
        <h3 class="text-sm font-medium mb-3" style="color: var(--color-muted-foreground)">
          标准音参考
        </h3>
        <div class="gap-2.5 grid grid-cols-6">
          <button
            v-for="string in currentStrings"
            :key="string.note"
            class="p-3 border-2 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:scale-105"
            :style="detectedNote === string.note
              ? { backgroundColor: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent-foreground)' }
              : { backgroundColor: 'var(--color-muted)', borderColor: 'transparent' }"
            @click="playReference(string.frequency)"
          >
            <div class="text-sm font-bold">
              {{ string.note }}
            </div>
            <div class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">
              {{ string.frequency }}Hz
            </div>
          </button>
        </div>
      </div>

      <!-- Error Message -->
      <div
        v-if="errorMessage"
        class="mb-6 p-4 rounded-lg"
        style="background-color: var(--color-destructive); color: #ffffff"
      >
        <div class="flex items-center justify-between">
          <span>{{ errorMessage }}</span>
          <button class="font-bold ml-2" @click="errorMessage = null">
            ✕
          </button>
        </div>
      </div>

      <!-- Start/Stop Button -->
      <button
        class="text-lg font-semibold py-4 rounded-xl w-full cursor-pointer transition-all"
        :style="isListening
          ? { backgroundColor: 'var(--color-destructive)', color: '#ffffff' }
          : { backgroundColor: 'var(--color-primary-foreground)', color: 'var(--color-primary)' }"
        @click="toggleTuner"
      >
        {{ isListening ? '停止调音' : '开始调音' }}
      </button>
    </div>
  </main>

  <!-- Settings Modal -->
  <div
    v-if="showSettings"
    class="p-4 flex items-center inset-0 justify-center fixed z-50"
    style="background-color: rgba(0, 0, 0, 0.5)"
    @click="showSettings = false"
  >
    <div
      class="p-6 rounded-2xl max-w-md w-full"
      style="background-color: var(--color-card); border: 1px solid var(--color-border)"
      @click.stop
    >
      <h2 class="text-xl font-semibold mb-4">
        设置
      </h2>
      <div class="space-y-4">
        <div>
          <label class="text-sm font-medium mb-2 block">灵敏度</label>
          <input
            v-model="sensitivity"
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            class="w-full"
          >
          <div class="text-xs mt-1" style="color: var(--color-muted-foreground)">
            当前: {{ sensitivity }}
          </div>
        </div>
        <div>
          <label class="text-sm font-medium mb-2 block">标准音高 (A4)</label>
          <input
            v-model="a4Frequency"
            type="number"
            min="430"
            max="450"
            class="px-3 py-2 rounded-lg w-full"
            style="background-color: var(--color-muted); border: 1px solid var(--color-border)"
          >
          <div class="text-xs mt-1" style="color: var(--color-muted-foreground)">
            通常为 440 Hz
          </div>
        </div>
      </div>
      <button
        class="font-medium mt-6 py-3 rounded-lg w-full cursor-pointer transition-all hover:shadow-lg hover:scale-105"
        style="background-color: var(--color-primary-foreground); color: var(--color-primary)"
        @click="showSettings = false"
      >
        完成
      </button>
    </div>
  </div>
</template>
