<script setup>
definePageMeta({
  layout: false,
  title: 'Rwurtz display',
  description: 'HKN Lounge display without the background video.',
  status: 'migrated'
})

useHead({
  title: 'HKN Lounge Display',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { charset: 'utf-8' },
    { name: 'description', content: 'HKN Lounge Display' }
  ],
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
  ]
})

if (import.meta.client) {
  const now = new Date()
  const nextRefresh = new Date(now)
  nextRefresh.setDate(nextRefresh.getDate() + 1)
  nextRefresh.setHours(7, 0, 0, 0)

  const refreshTimer = setTimeout(() => {
    window.location.reload()
  }, nextRefresh.getTime() - now.getTime())

  onUnmounted(() => clearTimeout(refreshTimer))
}
</script>

<template>
  <ClientOnly>
    <div class="display-background" />

    <div class="display-grid">
      <div class="ticker-row">
        <JorgenelStockTicker />
      </div>
      <JorgenelTimeWidget />
      <JorgenelBusWidget />
      <JorgenelMultiWidget />
      <JorgenelWeatherWidget />
    </div>
  </ClientOnly>
</template>

<style scoped>
.display-background {
  position: fixed;
  inset: 0;
  z-index: -2;
  background-color: #1d1d1d;
}

.display-grid {
  margin: auto;
  font-family: 'Open Sans', 'Helvetica Neue', sans-serif;
  font-size: clamp(8px, 1.3vmin, 22px);
  box-sizing: border-box;
  width: 100dvw;
  height: 100dvh;
  max-width: 100dvw;
  max-height: 100dvh;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto 1fr 1fr;
  gap: 1.5svh 2svh;
  padding: 1svh 2svh 2svh;
}

.ticker-row {
  grid-column: 1 / -1;
  grid-row: 1;
  min-height: 0;
  margin: -0.5svh -0.5svh 0;
}
</style>
