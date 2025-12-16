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

function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length
  const MAX_SAMPLES = Math.floor(SIZE / 2)
  let best_offset = -1
  let best_correlation = 0
  let rms = 0
  let foundGoodCorrelation = false

  for (let i = 0; i < SIZE; i++) {
    const val = buf[i]
    rms += val * val
  }
  rms = Math.sqrt(rms / SIZE)

  if (rms < sensitivity.value * 0.01)
    return -1

  let lastCorrelation = 1
  for (let offset = 1; offset < MAX_SAMPLES; offset++) {
    let correlation = 0
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buf[i] - buf[i + offset])
    }
    correlation = 1 - correlation / MAX_SAMPLES

    if (correlation > 0.9 && correlation > lastCorrelation) {
      foundGoodCorrelation = true
      if (correlation > best_correlation) {
        best_correlation = correlation
        best_offset = offset
      }
    }
    lastCorrelation = correlation
  }

  if (foundGoodCorrelation) {
    return sampleRate / best_offset
  }
  return -1
}

function updatePitch(time) {
  const buf = new Float32Array(2048)
  analyser.getFloatTimeDomainData(buf)
  const detectedFreq = autoCorrelate(buf, audioContext.sampleRate)

  if (detectedFreq > 0) {
    frequency.value = detectedFreq
    const note = noteFromPitch(detectedFreq)
    const centsOff = centsOffFromPitch(detectedFreq, note)
    cents.value = centsOff

    const noteName = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][note % 12]
    const octave = Math.floor(note / 12) - 1
    detectedNote.value = noteName + octave
  }
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048

    microphone = audioContext.createMediaStreamSource(stream)
    microphone.connect(analyser)

    scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1)
    scriptProcessor.onaudioprocess = updatePitch
    analyser.connect(scriptProcessor)
    scriptProcessor.connect(audioContext.destination)

    isListening.value = true
  }
  catch (error) {
    console.error('Error accessing microphone:', error)
    alert('无法访问麦克风，请检查浏览器权限设置')
  }
}

function stopListening() {
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
            class="p-2 rounded-lg transition-colors hover:opacity-80"
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
            class="text-sm font-medium px-4 py-2 rounded-lg transition-all"
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
            class="p-3 border-2 rounded-lg transition-all"
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

      <!-- Start/Stop Button -->
      <button
        class="text-lg font-semibold py-4 rounded-xl w-full transition-all hover:opacity-90"
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
        class="font-medium mt-6 py-3 rounded-lg w-full transition-opacity hover:opacity-90"
        style="background-color: var(--color-primary-foreground); color: var(--color-primary)"
        @click="showSettings = false"
      >
        完成
      </button>
    </div>
  </div>
</template>
