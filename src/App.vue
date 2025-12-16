<script setup>
import TheHeader from './components/TheHeader.vue'
</script>

<template>
  <div font-sans text="dark:gray-200" class="flex flex-col min-h-screen" style="background-color: var(--color-background); color: var(--color-foreground)">
    <TheHeader />
    <RouterView />
  </div>
</template>
