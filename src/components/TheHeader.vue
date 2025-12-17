<script setup lang="ts">
import { isDark, toggleDark } from '../composables'
</script>

<template>
  <header class="px-6 py-3" style="border-bottom: 1px solid var(--color-border)">
    <div class="mx-auto flex max-w-4xl items-center justify-between">
      <div class="flex gap-3 items-center">
        <img src="/logo.svg" alt="logo" class="h-7 w-7">
        <h1 class="text-2xl text-transparent font-bold from-cyan-500 to-indigo-600 via-blue-500 bg-gradient-to-r bg-clip-text">
          调音器
        </h1>
      </div>

      <div class="flex gap-3 items-center">
        <button
          icon-btn
          class="cursor-pointer transition-all hover:scale-110"
          :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
          @click="toggleDark()"
        >
          <div i-carbon-sun dark:i-carbon-moon />
        </button>

        <a
          i-carbon-logo-github
          icon-btn
          class="cursor-pointer transition-all hover:scale-110"
          rel="noreferrer"
          href="https://github.com/antfu-collective/vitesse-lite"
          target="_blank"
          title="GitHub"
        />
      </div>
    </div>
  </header>
</template>
