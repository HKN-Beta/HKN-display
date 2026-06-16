<!--
  FACILITIES ONBOARDING SUBMISSION: default (reference sample)

  REQUIREMENT COMPLIANCE:
  1) Reactive Clock:
     - `now` is updated every second and reflected in computed `timeText` / `dateText`.
  2) Required Server API (Alias-scoped full-stack flow):
     - Uses `/api/default/display/weather` from `server/api/default/...` instead of calling an external API directly from the page.
     - Passes a `location` query to the server API (`lat,lon` format).
  3) Asynchronous Data Integration:
     - Fetches weather asynchronously on mount and refreshes every 10 minutes.
  4) User-Configurable Settings:
     - Toggle 12h/24h time format.
     - Toggle Celsius/Fahrenheit display.
  5) Component Architecture:
     - Uses reusable components (`AppLogo`, `UCard`, `USwitch`) instead of a monolith-only UI.
  6) Lifecycle Safety:
     - All intervals are cleaned up in `onUnmounted`.
-->
<script setup lang="ts">
definePageMeta({
  layout: false,
  title: 'Default display',
  description: 'Simple reference page that demonstrates onboarding requirements.',
  status: 'sample'
})

interface DefaultWeatherResponse {
  current?: {
    temperatureC: number | null
    weatherCode: number | null
    observedAt: string | null
    location: string
  }
  request?: {
    latitude: number
    longitude: number
  }
}

// Requirement 1: reactive clock state.
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | undefined

// Requirement 4: simple user settings.
const use24Hour = ref(false)
const useCelsius = ref(true)

// Requirement 2 and 3: async data loaded through local server API route.
const weatherC = ref<number | null>(null)
const weatherCode = ref<number | null>(null)
const weatherUpdatedAt = ref<string | null>(null)
const weatherLocationUsed = ref<string>('42.44,-76.5')
const weatherError = ref<string | null>(null)
const weatherLoading = ref(false)
const geolocationStatus = ref<string | null>(null)
const showManualLocationFallback = ref(false)
let weatherTimer: ReturnType<typeof setInterval> | undefined

// User-editable location fields (latitude/longitude).
const latitudeInput = ref('42.44')
const longitudeInput = ref('-76.5')

const parseCoordinates = (): { lat: number, lon: number } | null => {
  const lat = Number(latitudeInput.value.trim())
  const lon = Number(longitudeInput.value.trim())

  if (Number.isNaN(lat) || Number.isNaN(lon)) return null
  if (lat < -90 || lat > 90) return null
  if (lon < -180 || lon > 180) return null

  return { lat, lon }
}

const fetchWeather = async (): Promise<void> => {
  const coords = parseCoordinates()
  if (!coords) {
    weatherError.value = 'Invalid coordinates. Latitude must be -90..90 and longitude -180..180.'
    return
  }

  weatherLoading.value = true
  weatherError.value = null
  const location = `${coords.lat},${coords.lon}`

  try {
    const payload = await $fetch<DefaultWeatherResponse>('/api/default/display/weather', {
      query: { location }
    })
    weatherC.value = payload.current?.temperatureC ?? null
    weatherCode.value = payload.current?.weatherCode ?? null
    weatherUpdatedAt.value = payload.current?.observedAt ?? null
    weatherLocationUsed.value = payload.current?.location ?? location
  } catch {
    weatherError.value = 'Weather request failed. Check local API route and network/API availability.'
  } finally {
    weatherLoading.value = false
  }
}

const applyLocation = async (): Promise<void> => {
  await fetchWeather()
}

// Optional browser geolocation helper. Falls back to manual coordinates if unavailable.
const tryApplyBrowserLocation = async (): Promise<boolean> => {
  geolocationStatus.value = null

  if (!import.meta.client || !('geolocation' in navigator)) {
    geolocationStatus.value = 'Browser geolocation is not available here. Using manual coordinates.'
    showManualLocationFallback.value = true
    return false
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000
      })
    })

    latitudeInput.value = position.coords.latitude.toFixed(5)
    longitudeInput.value = position.coords.longitude.toFixed(5)
    geolocationStatus.value = 'Using browser location.'
    showManualLocationFallback.value = false
    await fetchWeather()
    return true
  } catch {
    geolocationStatus.value = 'Location permission denied/unavailable. Using manual coordinates.'
    showManualLocationFallback.value = true
    return false
  }
}

const applyBrowserLocation = async (): Promise<void> => {
  await tryApplyBrowserLocation()
}

const timeText = computed(() =>
  now.value.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !use24Hour.value
  })
)

const dateText = computed(() =>
  now.value.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
)

const weatherTempText = computed(() => {
  if (weatherC.value === null) return '--'
  if (useCelsius.value) return `${weatherC.value.toFixed(1)} C`
  const fahrenheit = (weatherC.value * 9) / 5 + 32
  return `${fahrenheit.toFixed(1)} F`
})

const weatherCodeText = computed(() => {
  if (weatherCode.value === null) return 'Unknown'

  if (weatherCode.value === 0) return 'Clear'
  if (weatherCode.value <= 3) return 'Partly cloudy'
  if (weatherCode.value <= 67) return 'Rain'
  if (weatherCode.value <= 77) return 'Snow'
  if (weatherCode.value <= 82) return 'Showers'
  if (weatherCode.value <= 99) return 'Storm'

  return 'Unknown'
})

onMounted(async () => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)

  const usedBrowserLocation = await tryApplyBrowserLocation()
  if (!usedBrowserLocation) {
    await fetchWeather()
  }
  weatherTimer = setInterval(fetchWeather, 1000 * 60 * 10)
})

// Requirement 6: cleanup intervals to avoid leaks.
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (weatherTimer) clearInterval(weatherTimer)
})
</script>

<template>
  <main class="min-h-screen bg-[#020420] px-6 py-10 text-white">
    <section class="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <!-- Requirement 5 example: reusable component usage. -->
      <AppLogo class="h-10 w-auto text-[var(--display-gold)]" />

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <h1 class="text-xl font-semibold">
              Default Sample Display
            </h1>
            <p class="text-sm text-[var(--display-muted)]">
              Use this page as a reference while building your alias page.
            </p>
          </div>
        </template>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.2em] text-[var(--display-gold)]">
              Live Clock
            </p>
            <p class="font-mono text-4xl font-bold tabular-nums">
              {{ timeText }}
            </p>
            <p class="text-base text-[var(--display-muted)]">
              {{ dateText }}
            </p>
          </div>

          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.2em] text-[var(--display-gold)]">
              Async Weather (via /api/default/display/weather)
            </p>
            <p class="text-3xl font-semibold">
              {{ weatherTempText }}
            </p>
            <p class="text-base text-[var(--display-muted)]">
              {{ weatherCodeText }}
            </p>
            <p class="text-xs text-[var(--display-muted)]">
              Updated: {{ weatherUpdatedAt ?? 'pending' }}
            </p>
            <p class="text-xs text-[var(--display-muted)]">
              Location: {{ weatherLocationUsed }}
            </p>
            <p
              v-if="geolocationStatus"
              class="text-xs text-[var(--display-muted)]"
            >
              {{ geolocationStatus }}
            </p>
            <p
              v-if="weatherLoading"
              class="text-xs text-[var(--display-muted)]"
            >
              Refreshing weather...
            </p>
            <p
              v-if="weatherError"
              class="text-xs text-red-300"
            >
              {{ weatherError }}
            </p>
          </div>
        </div>

        <template #footer>
          <!-- Requirement 4: two settings that immediately change UI output. -->
          <div class="flex flex-wrap gap-6 items-end">
            <div class="flex items-center gap-3">
              <USwitch v-model="use24Hour" />
              <span class="text-sm">Use 24-hour clock</span>
            </div>
            <div class="flex items-center gap-3">
              <USwitch v-model="useCelsius" />
              <span class="text-sm">Use Celsius</span>
            </div>
            <div class="flex flex-wrap items-end gap-2">
              <UButton
                label="Retry Browser Location"
                color="neutral"
                variant="soft"
                @click="applyBrowserLocation"
              />
              <template v-if="showManualLocationFallback">
                <UInput
                  v-model="latitudeInput"
                  class="w-32"
                  label="Latitude"
                  placeholder="42.44"
                  @keydown.enter="applyLocation"
                />
                <UInput
                  v-model="longitudeInput"
                  class="w-32"
                  label="Longitude"
                  placeholder="-76.5"
                  @keydown.enter="applyLocation"
                />
                <UButton
                  label="Update Location"
                  color="primary"
                  @click="applyLocation"
                />
              </template>
            </div>
          </div>
        </template>
      </UCard>
    </section>
  </main>
</template>
