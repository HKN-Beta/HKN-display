<!--
  FACILITIES ONBOARDING SUBMISSION: jorgenel

  REQUIREMENT COMPLIANCE:
  1) Reactive Clock:
     - Provided by JorgenelTimeWidget, which renders continuously updating date/time.
  2) Required Server API (Alias-scoped full-stack flow):
     - Implements and consumes alias routes under `/api/jorgenel/display/...`.
  3) Asynchronous Data Integration:
     - Display widgets fetch live data through alias-scoped API routes under `/api/jorgenel/display`
       (weather, bus, announcements, stocks, system load).
  4) User-Configurable Settings:
     - Background video is user-configurable via Alt+W modal.
     - Users can set a YouTube URL/ID and reset to default; preference is persisted in localStorage.
  5) Component Architecture:
     - Main page composes multiple alias-scoped components:
       JorgenelBackground, JorgenelStockTicker, JorgenelTimeWidget,
       JorgenelBusWidget, JorgenelMultiWidget, JorgenelWeatherWidget, JorgenelSysLoadWidget.
  6) Lifecycle Safety:
     - Intervals and timers are cleaned up with onUnmounted hooks
       (hourly refresh checks, daily page refresh timer, and per-widget intervals).
-->
<script setup>
definePageMeta({
  layout: false,
  title: 'Jorgenel display',
  description: 'Legacy HKN Lounge display migrated under the jorgenel alias.',
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

// --- Background video configuration ---
const DEFAULT_VIDEO_ID = 'tEtg5Kg3voQ'

// Read localStorage synchronously so the watcher in Background.vue only
// ever sees one video ID — avoids a double-check (default → saved).
let _initialVideoId = DEFAULT_VIDEO_ID
if (import.meta.client) {
  try {
    const _saved = localStorage.getItem('hkn-display-video-id')
    if (_saved) {
      _initialVideoId = _saved
      console.info(`[Display] Restored background video ID from localStorage: "${_saved}"`)
    } else {
      console.info(`[Display] No saved background video ID — using default: "${DEFAULT_VIDEO_ID}"`)
    }
  } catch {
    console.warn('[Display] localStorage unavailable — using default video ID')
  }
}

const bgVideoId = ref(_initialVideoId)
const settingsOpen = ref(false)
const youtubeUrlInput = ref('')
const urlError = ref('')

/**
     * Extract a YouTube video ID from various URL formats:
     *   - https://www.youtube.com/watch?v=VIDEO_ID
     *   - https://youtu.be/VIDEO_ID
     *   - https://www.youtube.com/embed/VIDEO_ID
     *   - https://www.youtube.com/live/VIDEO_ID
     *   - plain VIDEO_ID (11 chars)
     */
const parseVideoId = (input) => {
  if (!input) return null
  const trimmed = input.trim()

  // Plain 11-char video ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    // youtu.be/VIDEO_ID
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null
    // youtube.com variants
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtube-nocookie.com')) {
      // /watch?v=VIDEO_ID
      const v = url.searchParams.get('v')
      if (v) return v
      // /embed/VIDEO_ID or /live/VIDEO_ID
      const parts = url.pathname.split('/')
      const embedIdx = parts.indexOf('embed')
      if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1]
      const liveIdx = parts.indexOf('live')
      if (liveIdx !== -1 && parts[liveIdx + 1]) return parts[liveIdx + 1]
    }
  } catch { /* not a valid URL */ }

  return null
}

const applyVideoUrl = () => {
  const id = parseVideoId(youtubeUrlInput.value)
  if (!id) {
    urlError.value = 'Could not extract a video ID. Paste a YouTube URL or 11-character video ID.'
    return
  }
  urlError.value = ''
  bgVideoId.value = id
  try {
    localStorage.setItem('hkn-display-video-id', id)
  } catch {
    // noop
  }
  settingsOpen.value = false
  youtubeUrlInput.value = ''
}

const resetToDefault = () => {
  bgVideoId.value = DEFAULT_VIDEO_ID
  try {
    localStorage.removeItem('hkn-display-video-id')
  } catch {
    // noop
  }
  urlError.value = ''
  youtubeUrlInput.value = ''
  settingsOpen.value = false
}

// Hourly check: 1% chance to play easter egg video (ephemeral — not saved to localStorage).
// Otherwise, restore whatever is saved in localStorage (in case the easter egg was playing).
const EASTER_EGG_VIDEO_ID = 'vTfD20dbxho'
if (import.meta.client) {
  const easterEggInterval = setInterval(() => {
    if (Math.random() < 0.005) {
      console.info('[Display] 🎉 Easter egg triggered — switching background video (not saved)')
      bgVideoId.value = EASTER_EGG_VIDEO_ID
      // intentionally NOT writing to localStorage so the normal video is restored next hour
    } else {
      // Restore saved video (reverts easter egg if it was showing, or keeps normal video)
      try {
        const saved = localStorage.getItem('hkn-display-video-id')
        const restored = saved || DEFAULT_VIDEO_ID
        bgVideoId.value = restored
        console.info(`[Display] Hourly check — restored video ID: "${restored}"`)
      } catch {
        bgVideoId.value = DEFAULT_VIDEO_ID
      }
    }
  }, 60 * 60 * 1000) // every hour
  onUnmounted(() => clearInterval(easterEggInterval))
}

// Auto-refresh the page at 7am every day
if (import.meta.client) {
  const scheduleNextRefresh = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(7, 0, 0, 0)

    const timeUntilRefresh = tomorrow.getTime() - now.getTime()
    console.info(`[Display] Next refresh scheduled in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`)

    return setTimeout(() => {
      window.location.reload()
      scheduleNextRefresh()
    }, timeUntilRefresh)
  }

  const refreshTimer = scheduleNextRefresh()
  onUnmounted(() => clearTimeout(refreshTimer))
}

// Alt+W to toggle the settings modal
defineShortcuts({
  alt_w: () => {
    settingsOpen.value = !settingsOpen.value
    console.log(`[Display] Toggled background video settings modal: ${settingsOpen.value ? 'OPEN' : 'CLOSED'}`)
    if (settingsOpen.value) urlError.value = ''
  }
})
</script>

<template>
  <ClientOnly>
    <JorgenelBackground :video-id="bgVideoId" />

    <div class="display-grid">
      <div class="ticker-row">
        <JorgenelStockTicker />
      </div>
      <JorgenelTimeWidget />
      <JorgenelBusWidget />
      <JorgenelMultiWidget />
      <JorgenelWeatherWidget />
      <div class="sysload-sidebar">
        <JorgenelSysLoadWidget style="flex: 1;" />
      </div>
    </div>

    <!-- Background video settings modal (Alt+W) -->
    <UModal
      v-model:open="settingsOpen"
      title="Background Video"
      description="Change the YouTube video used as the display background."
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Current Video ID</label>
            <code class="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{{ bgVideoId }}</code>
          </div>

          <UInput
            v-model="youtubeUrlInput"
            placeholder="Paste YouTube URL or video ID"
            icon="i-heroicons-link"
            size="lg"
            name="videoUrlInput"
            @keydown.enter="applyVideoUrl"
          />

          <p
            v-if="urlError"
            class="text-sm text-red-500"
          >
            {{ urlError }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-between w-full">
          <UButton
            label="Reset to Default"
            color="gray"
            variant="outline"
            @click="resetToDefault"
          />
          <UButton
            label="Apply"
            color="primary"
            @click="applyVideoUrl"
          />
        </div>
      </template>
    </UModal>
  </ClientOnly>
</template>

<style scoped>
/* ── display grid layout ─────────────────────────────────────── */
.display-grid {
  margin: auto;
  font-family: 'Open Sans', 'Helvetica Neue', sans-serif;
  /* Viewport-responsive root font-size — all em values in child widgets
     scale automatically. vmin targets the smallest dimension so the layout
     stays coherent whether the screen is 720p, 1080p, 1440p, or 4K. */
  font-size: clamp(8px, 1.3vmin, 22px);
  box-sizing: border-box;
  width: 100dvw;
  height: 100dvh;
  max-width: 100dvw;
  max-height: 100dvh;
  overflow: hidden;
  display: grid;
  grid-template-columns: 6fr 4fr 10rem;
  grid-template-rows: auto 1fr 1fr;
  gap: 1svh 2svh;
  padding: 1svh 2svh 2svh;
}

.ticker-row {
  grid-column: 1 / -1;
  grid-row: 1;
  min-height: 0;
  margin: -0.5svh -0.5svh 0;
}

.sysload-sidebar {
  grid-column: 3;
  grid-row: 2 / -1;
  display: flex;
  min-width: 0;
  overflow: hidden;
}
</style>
