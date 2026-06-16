<script setup>
const props = defineProps({
  videoId: {
    type: String,
    default: 'tEtg5Kg3voQ'
  }
})

const showVideo = ref(false)
let player = null
let healthCheckInterval = null

const currentVideoId = computed(() => props.videoId)

const iframeUrl = computed(() => {
  // origin is required by YouTube's IFrame API when enablejsapi=1.
  // Omitting it causes error 153 on some live streams even when oEmbed reports
  // the video as embeddable.
  const originParam = import.meta.client
    ? `&origin=${encodeURIComponent(window.location.origin)}`
    : ''
  return `https://www.youtube-nocookie.com/embed/${currentVideoId.value}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${currentVideoId.value}&enablejsapi=1&vq=hd2160${originParam}`
})

// YouTube IFrame API error code descriptions
const YT_ERRORS = {
  2: 'Invalid parameter value (check video ID format)',
  5: 'HTML5 player error (browser may not support this video)',
  100: 'Video not found, removed, or marked private',
  101: 'Embedding disabled by video owner',
  150: 'Embedding disabled by video owner (same as 101)',
  153: 'Embedding disabled for this live stream by the broadcaster'
}

// YouTube player state names
const YT_STATES = {
  '-1': 'UNSTARTED',
  '0': 'ENDED',
  '1': 'PLAYING',
  '2': 'PAUSED',
  '3': 'BUFFERING',
  '5': 'VIDEO_CUED'
}

/**
 * Check if the YouTube video is embeddable.
 *
 * Primary:  YouTube's own oEmbed endpoint (https://www.youtube.com/oembed).
 *   - 200 → video exists AND embedding is allowed
 *   - 401 → video exists but embedding is DISABLED (catches error 153 etc.)
 *   - 404 → video not found / private
 *   This is the authoritative source — it will prevent the iframe from loading
 *   videos that would otherwise produce IFrame API errors 101/150/153.
 *
 * Fallback: noembed.com (third-party proxy, doesn't distinguish embeddability)
 * Last resort: thumbnail Image() load (governed by img-src CSP)
 */
const isVideoAvailable = async () => {
  const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId.value}`

  // --- Primary: YouTube oEmbed (connect-src already allows youtube.com) ---
  const ytOembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
  console.debug(`[Display:BG] Checking embeddability for "${currentVideoId.value}" via YouTube oEmbed...`)
  try {
    const res = await fetch(ytOembedUrl, { signal: AbortSignal.timeout(5000) })
    console.debug(`[Display:BG] YouTube oEmbed HTTP ${res.status} ${res.statusText}`)
    if (res.status === 401) {
      console.warn(`[Display:BG] YouTube oEmbed 401 — embedding is disabled for this video (would produce error 101/150/153). Skipping iframe.`)
      return false
    }
    if (res.status === 404) {
      console.warn(`[Display:BG] YouTube oEmbed 404 — video not found or private.`)
      return false
    }
    if (!res.ok) {
      console.warn(`[Display:BG] YouTube oEmbed unexpected status ${res.status} — falling back to noembed`)
      throw new Error(`oEmbed status ${res.status}`)
    }
    const data = await res.json()
    console.debug('[Display:BG] YouTube oEmbed response:', data)
    console.info(`[Display:BG] Video embeddable: "${data.title}" by ${data.author_name}`)
    return true
  } catch (err) {
    console.warn('[Display:BG] YouTube oEmbed failed, falling back to noembed:', err)
  }

  // --- Fallback: noembed (does NOT distinguish embedding-disabled) ---
  const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`
  console.debug(`[Display:BG] Trying noembed fallback...`)
  try {
    const res = await fetch(noembedUrl, { signal: AbortSignal.timeout(5000) })
    console.debug(`[Display:BG] noembed HTTP ${res.status} ${res.statusText}`)
    if (!res.ok) {
      console.warn(`[Display:BG] noembed returned non-OK status ${res.status} — treating video as unavailable`)
      return false
    }
    const data = await res.json()
    console.debug('[Display:BG] noembed response:', data)
    if (data.error) {
      console.warn(`[Display:BG] noembed error: "${data.error}" — video unavailable`)
      return false
    }
    console.info(`[Display:BG] Video available via noembed (embeddability unknown): "${data.title}" by ${data.author_name}`)
    return true
  } catch (err) {
    console.warn('[Display:BG] noembed fetch failed, falling back to thumbnail check:', err)
    return new Promise((resolve) => {
      const img = new Image()
      const timeout = setTimeout(() => {
        console.warn('[Display:BG] Thumbnail check timed out — treating video as unavailable')
        resolve(false)
      }, 5000)
      img.onload = () => {
        clearTimeout(timeout)
        console.info('[Display:BG] Thumbnail loaded — video appears available')
        resolve(true)
      }
      img.onerror = (e) => {
        clearTimeout(timeout)
        console.warn('[Display:BG] Thumbnail load failed — video unavailable:', e)
        resolve(false)
      }
      img.src = `https://img.youtube.com/vi/${currentVideoId.value}/hqdefault.jpg`
      console.debug(`[Display:BG] Loading thumbnail: ${img.src}`)
    })
  }
}

/** Load the YouTube IFrame Player API for runtime error detection */
const loadYouTubeAPI = () => {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      console.debug('[Display:BG] YouTube IFrame API already loaded')
      resolve(window.YT)
      return
    }
    console.debug('[Display:BG] Injecting YouTube IFrame API script...')
    let timeoutHandle = null
    const done = (fn, val) => {
      clearTimeout(timeoutHandle)
      fn(val)
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      console.info('[Display:BG] YouTube IFrame API ready')
      prev?.()
      done(resolve, window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = (err) => {
      console.error('[Display:BG] Failed to load YouTube IFrame API script:', err)
      done(reject, err)
    }
    document.head.appendChild(script)
    timeoutHandle = setTimeout(() => {
      console.error('[Display:BG] YouTube IFrame API load timed out after 15s — the script may be blocked by CSP (check script-src in nuxt.config.ts)')
      reject(new Error('YT API timeout'))
    }, 15000)
  })
}

// Incremented each time checkAndShowVideo starts; lets an in-flight run
// detect that a newer run has superseded it and bail out early.
let currentRunId = 0

const checkAndShowVideo = async () => {
  if (!import.meta.client) return // no DOM on server
  const runId = ++currentRunId
  console.group(`[Display:BG] checkAndShowVideo #${runId} — video ID: "${currentVideoId.value}"`)

  // Clean up previous state
  showVideo.value = false
  if (healthCheckInterval) {
    console.debug('[Display:BG] Clearing previous health check interval')
    clearInterval(healthCheckInterval)
    healthCheckInterval = null
  }
  try {
    player?.destroy?.()
  } catch {
    // noop
  }
  player = null

  // Step 1: Pre-check video availability
  const available = await isVideoAvailable()

  if (runId !== currentRunId) {
    console.debug(`[Display:BG] Run #${runId} superseded by run #${currentRunId} — aborting`)
    console.groupEnd()
    return
  }

  if (!available) {
    console.warn('[Display:BG] Video unavailable — iframe will not be rendered')
    console.groupEnd()
    return
  }

  console.info('[Display:BG] Video confirmed available — rendering iframe')
  console.debug('[Display:BG] iframe src:', iframeUrl.value)
  showVideo.value = true
  await nextTick()

  // Step 2: Attach YouTube IFrame API for runtime error detection
  try {
    await loadYouTubeAPI()

    if (runId !== currentRunId) {
      console.debug(`[Display:BG] Run #${runId} superseded after YT API load — aborting player attach`)
      console.groupEnd()
      return
    }

    console.debug('[Display:BG] Attaching YT.Player to #bg-youtube-player...')
    player = new window.YT.Player('bg-youtube-player', {
      events: {
        onReady: (event) => {
          console.info('[Display:BG] Player ready. Video URL:', event.target.getVideoUrl?.())
        },
        onStateChange: (event) => {
          const stateName = YT_STATES[event.data] ?? `UNKNOWN(${event.data})`
          console.debug(`[Display:BG] Player state → ${stateName} (${event.data})`)
        },
        onError: (event) => {
          const code = event.data
          const description = YT_ERRORS[code] ?? 'Unknown error'
          console.error(`[Display:BG] Player error ${code}: ${description}`)

          if (code === 101 || code === 150 || code === 153) {
            console.warn(
              '[Display:BG] Embedding-disabled error fired despite oEmbed pre-check passing. '
              + 'This is a known YouTube API inconsistency — certain live streams return HTTP 200 '
              + 'from oEmbed but still block embedding in the player. The `origin` parameter is '
              + 'included in the iframe URL which may help; if not, the broadcaster has restricted '
              + 'embedding at a level the oEmbed API cannot detect.'
            )
            console.debug('[Display:BG] iframe origin used:', import.meta.client ? window.location.origin : '(server)')
            console.debug('[Display:BG] Full iframe URL at time of error:', iframeUrl.value)
          }

          if (code === 2) {
            console.warn('[Display:BG] Check that the video ID is exactly 11 chars and contains only A–Z, a–z, 0–9, _ or -.')
            console.debug('[Display:BG] Current video ID:', currentVideoId.value)
          }

          showVideo.value = false
        },
        onPlaybackQualityChange: (event) => {
          console.debug('[Display:BG] Playback quality:', event.data)
        }
      }
    })
    console.debug('[Display:BG] YT.Player instance created:', player)
  } catch (err) {
    console.warn('[Display:BG] Could not attach YT.Player for error monitoring (iframe may still play):', err)
  }

  // Step 3: Periodic health check every 10 minutes
  console.debug('[Display:BG] Scheduling health checks every 10 minutes')
  healthCheckInterval = setInterval(async () => {
    console.debug('[Display:BG] Running periodic health check...')
    if (!(await isVideoAvailable())) {
      console.warn('[Display:BG] Periodic health check: video no longer available — hiding iframe')
      showVideo.value = false
      clearInterval(healthCheckInterval)
      healthCheckInterval = null
    } else {
      console.debug('[Display:BG] Periodic health check: video still available')
    }
  }, 10 * 60 * 1000)

  console.groupEnd()
}

// Use immediate:true so the watch triggers on mount AND on prop changes,
// replacing the separate onMounted call and eliminating the race condition
// that occurred when display.vue's onMounted restored localStorage and
// changed the prop at the same time as the initial mount was running.
watch(currentVideoId, () => {
  checkAndShowVideo()
}, { immediate: true })

onUnmounted(() => {
  if (healthCheckInterval) clearInterval(healthCheckInterval)
  try {
    player?.destroy?.()
  } catch {
    // noop
  }
})
</script>

<template>
  <div>
    <ClientOnly>
      <div
        v-if="showVideo"
        class="video-background"
      >
        <iframe
          id="bg-youtube-player"
          :src="iframeUrl"
          title="HKN Lounge Background"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
          class="livestream-iframe"
        />
      </div>

      <!-- <div class="diamond-background bg-[#1d1d1d] bg-opacity-10 transition-colors duration-[5000ms]">
        <svg class="scarlet-diamond opacity-50" width="1524" height="884" viewBox="0 0 1524 884" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.98601 442L762 2.31209L1520.01 442L762 881.688L3.98601 442Z" stroke="#BA0C2F" stroke-width="4"/>
        </svg>
        <svg class="gold-diamond opacity-50" width="1143" height="663" viewBox="0 0 1143 663" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.98601 331.5L571.5 2.31209L1139.01 331.5L571.5 660.688L3.98601 331.5Z" stroke="#FFC72C" stroke-width="4"/>
        </svg>
        <svg class="navy-diamond opacity-50 stroke-[#002855] dark:stroke-white transition-colors duration-[5000ms]" width="1143" height="663" viewBox="0 0 1143 663" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.98601 331.5L571.5 2.31209L1139.01 331.5L571.5 660.688L3.98601 331.5Z" stroke-width="4"/>
        </svg>
      </div> -->

      <template #fallback>
        <div class="video-background-fallback" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.video-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -2;
  overflow: hidden;
}

.video-background-fallback {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -2;
  background-color: #1d1d1d;
}

.video-background iframe,
.video-background .livestream-iframe {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100vw;
  height: 100vh;
  transform: translate(-50%, -50%);
  pointer-events: none;
  border: none;
}

/* Scale video to cover screen while maintaining aspect ratio */
@media (min-aspect-ratio: 16/9) {
  .video-background iframe,
  .video-background .livestream-iframe {
    height: 56.25vw; /* 9/16 * 100 */
  }
}

@media (max-aspect-ratio: 16/9) {
  .video-background iframe,
  .video-background .livestream-iframe {
    width: 177.78vh; /* 16/9 * 100 */
  }
}

.diamond-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
}

.diamond-background svg {
  position: absolute;
}

.scarlet-diamond {
  top: -10%;
  left: -20%;
  animation: float 631s ease-in-out infinite;
}

.gold-diamond {
  top: 30%;
  left: 15%;
  animation: float-reverse 223s ease-in-out infinite;
}

.navy-diamond {
  top: 30%;
  left: 40%;
  animation: float 331s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translatey(-30%);
  }
  50% {
    transform: translatey(90%);
  }
}

@keyframes float-reverse {
  0%, 100% {
    transform: translatey(90%);
  }
  50% {
    transform: translatey(-30%);
  }
}
</style>
