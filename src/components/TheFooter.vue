<script setup lang="ts">
import { isDark, toggleDark } from '../composables'
</script>

<template>
  <nav text-xl mt-6 inline-flex gap-2>
    <button
      icon-btn
      :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
      @click="toggleDark()"
    >
      <div i-carbon-sun dark:i-carbon-moon />
    </button>

    <a
      i-carbon-logo-github icon-btn
      rel="noreferrer"
      href="https://github.com/antfu-collective/vitesse-lite"
      target="_blank"
      title="GitHub"
    />
  </nav>
</template>
