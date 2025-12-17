<script setup lang="ts">
import { isDark, toggleDark } from '../composables'
</script>

<template>
  <header class="px-6 py-3" style="border-bottom: 1px solid var(--color-border)">
    <div class="mx-auto flex max-w-4xl items-center justify-between">
      <div class="flex gap-3 items-center">
        <svg class="h-7 w-7" style="color: var(--color-primary-foreground)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <h1 class="text-xl font-semibold">
          吉他调音器
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
