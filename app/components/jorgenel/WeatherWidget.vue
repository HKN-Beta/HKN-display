<script setup lang="ts">
import { Autoplay, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/pagination'
import { useApiV2 } from '~/composables/jorgenel/useApiV2'
import { useLiquidGlass } from '~/composables/jorgenel/useLiquidGlass'

// ── Interfaces ─────────────────────────────────────────────────────
interface WeatherCurrent {
  tempF: number | null
  tempC: number | null
  feelsLikeF: number | null
  description: string
  icon: string
  humidity: number | null
  windSpeedMph: number | null
  windGustMph: number | null
  windDirection: string | null
  dewpointF: number | null
  pressureInHg: number | null
  visibilityMi: number | null
  cloudLayers: { coverage: string, baseFt: number | null }[]
}

interface WeatherSun {
  sunrise: string | null
  sunset: string | null
  civilDawn: string | null
  civilDusk: string | null
}

interface WeatherHour {
  time: string
  tempF: number
  icon: string
  precipPct: number
  humidity: number | null
  wind: string
  windDir: string
  short: string
}

interface WeatherExtended {
  name: string
  isDaytime: boolean
  tempF: number
  icon: string
  wind: string
  windDir: string
  short: string
  detailed: string
  precipPct: number
}

interface WeatherAlert {
  event: string
  headline: string
  severity: string
  urgency: string
  description: string
  instruction: string | null
  expires: string | null
}

interface WeatherData {
  current: WeatherCurrent
  sun: WeatherSun | null
  hourly: WeatherHour[]
  extended: WeatherExtended[]
  alerts: WeatherAlert[]
}

const { get } = useApiV2()
const { init: initGlass, destroy: destroyGlass } = useLiquidGlass()
const cardEl = ref<HTMLElement | null>(null)

const weather = ref<WeatherData | null>(null)
const loaded = ref(false)

const fetchWeather = async (): Promise<void> => {
  const response = await get('/weather')
  if (response.success) {
    weather.value = response.data as WeatherData
    loaded.value = true
  } else if (response.error) {
    console.error('Weather API error:', response.error)
  }
}

// Client-only fetch to avoid hydration mismatches
let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await fetchWeather()
  nextTick(() => {
    if (cardEl.value) initGlass(cardEl.value)
  })
  refreshInterval = setInterval(fetchWeather, 1000 * 60 * 5)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  destroyGlass()
})

// ── Computed helpers ───────────────────────────────────────────────
const hasAlerts = computed(() => (weather.value?.alerts?.length ?? 0) > 0)

/** Only show first 8 hourly entries on the combined slide */
const hourlySlice = computed(() => (weather.value?.hourly ?? []).slice(0, 8))

/** Pair extended periods into day/night rows */
const dailyPairs = computed(() => {
  if (!weather.value?.extended?.length) return []
  const pairs: { day: WeatherExtended | null, night: WeatherExtended | null }[] = []
  const periods = weather.value.extended
  let i = 0
  while (i < periods.length) {
    const currentPeriod = periods[i]!
    if (currentPeriod.isDaytime) {
      pairs.push({ day: currentPeriod, night: periods[i + 1] ?? null })
      i += 2
    } else {
      pairs.push({ day: null, night: currentPeriod })
      i += 1
    }
  }
  return pairs.slice(0, 5)
})

const slideCount = computed(() => 1 + (hasAlerts.value ? 1 : 0))

function alertColor(severity: string): string {
  switch (severity) {
    case 'Extreme': return '#ff1744'
    case 'Severe': return '#ff6d00'
    case 'Moderate': return '#ffd600'
    case 'Minor': return '#76ff03'
    default: return '#90a4ae'
  }
}
</script>

<template>
  <div
    ref="cardEl"
    class="rounded-glass-card"
  >
    <div class="widget-content">
      <!-- ── Skeleton loading ─────────────────────────────── -->
      <div
        v-if="!loaded"
        class="weather-skeleton"
      >
        <USkeleton class="sk-pill" />
        <div class="sk-row">
          <USkeleton class="sk-temp" />
          <USkeleton class="sk-icon" />
          <div class="sk-details">
            <USkeleton class="sk-line" />
            <USkeleton class="sk-line" />
            <USkeleton class="sk-line" />
          </div>
        </div>
        <div class="sk-forecast">
          <USkeleton
            v-for="n in 6"
            :key="n"
            class="sk-hour"
          />
        </div>
      </div>

      <!-- ── Live data swiper ─────────────────────────────── -->
      <ClientOnly v-else>
        <Swiper
          :css-mode="false"
          :modules="[Autoplay, Pagination]"
          :slides-per-view="1"
          :loop="slideCount > 1"
          :autoplay="{ delay: 14000, disableOnInteraction: false }"
          :pagination="{ clickable: true, type: 'bullets', dynamicBullets: true, dynamicMainBullets: 4 }"
          :speed="1800"
          class="weather-swiper"
        >
          <!-- ═══ SLIDE 1 — Combined Hourly + Extended ═══ -->
          <SwiperSlide>
            <div class="slide slide-forecast wx-text">
              <!-- Hourly strip (top) -->
              <div class="section-label">
                Next 8 Hours
              </div>
              <div class="hourly-grid">
                <div
                  v-for="(h, i) in hourlySlice"
                  :key="i"
                  class="hour-cell"
                >
                  <span class="hour-time">{{ h.time }}</span>
                  <UIcon
                    :name="h.icon"
                    class="hour-icon"
                  />
                  <span class="hour-temp">{{ h.tempF }}°</span>
                  <div class="hour-precip-bar">
                    <div
                      class="hour-precip-fill"
                      :style="{ height: `${h.precipPct}%` }"
                    />
                  </div>
                  <span class="hour-precip-label">{{ h.precipPct }}%</span>
                </div>
              </div>

              <!-- Divider -->
              <div class="forecast-divider" />

              <!-- Extended forecast (bottom) -->
              <div class="section-label">
                5-Day Forecast
              </div>
              <div class="extended-list">
                <div
                  v-for="(pair, i) in dailyPairs"
                  :key="i"
                  class="extended-row"
                >
                  <span class="ext-name">{{ pair.day?.name ?? pair.night?.name ?? '' }}</span>
                  <UIcon
                    :name="(pair.day ?? pair.night)?.icon ?? 'wi:na'"
                    class="ext-icon"
                  />
                  <span
                    v-if="pair.day"
                    class="ext-hi"
                  >{{ pair.day.tempF }}°</span>
                  <span
                    v-else
                    class="ext-hi ext-placeholder"
                  >—</span>
                  <span
                    v-if="pair.night"
                    class="ext-lo"
                  >{{ pair.night.tempF }}°</span>
                  <span
                    v-else
                    class="ext-lo ext-placeholder"
                  >—</span>
                  <span class="ext-short">{{ (pair.day ?? pair.night)?.short ?? '' }}</span>
                </div>
              </div>
            </div>
          </SwiperSlide>

          <!-- ═══ SLIDE 3 — Alerts (conditional) ═══ -->
          <SwiperSlide v-if="hasAlerts">
            <div class="slide slide-alerts wx-text">
              <div class="slide-title alert-title">
                <UIcon name="wi:storm-warning" /> Weather Alerts
              </div>
              <div class="alerts-list">
                <div
                  v-for="(a, i) in weather?.alerts"
                  :key="i"
                  class="alert-card"
                  :style="{ borderLeftColor: alertColor(a.severity) }"
                >
                  <div class="alert-header">
                    <span class="alert-event">{{ a.event }}</span>
                    <span
                      class="alert-severity"
                      :style="{ color: alertColor(a.severity) }"
                    >{{ a.severity }}</span>
                  </div>
                  <p class="alert-headline">
                    {{ a.headline }}
                  </p>
                  <p
                    v-if="a.expires"
                    class="alert-expires"
                  >
                    Expires {{ a.expires }}
                  </p>
                </div>
              </div>
            </div>
          </SwiperSlide>
        </Swiper>

        <template #fallback>
          <div class="w-full h-full flex items-center justify-center">
            <p class="text-gray-500">
              Loading weather…
            </p>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
/* ── High-contrast text that reads on both light-blue and dark bgs ── */
.wx-text {
    color: #f0f0f0;
    text-shadow:
        0 1px 4px rgba(0,0,0,0.7),
        0 0 10px rgba(0,0,0,0.35);
    transition: color 5000ms, text-shadow 5000ms;
}

/* Give SVG/icon elements a matching drop-shadow for contrast */
.wx-text :deep(.iconify),
.wx-text :deep(svg) {
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 6px rgba(0,0,0,0.3));
    color: inherit;
}

/* ── Swiper container ─────────────────────────────────────────── */
.weather-swiper {
    width: 100%;
    height: 100%;
    --swiper-theme-color: #FFC72C;
    --swiper-pagination-bottom: 0.25em;
}

.weather-swiper :deep(.swiper-pagination-bullet) {
    width: 0.5em;
    height: 0.5em;
    opacity: 0.4;
}

.weather-swiper :deep(.swiper-pagination-bullet-active) {
    opacity: 1;
}

/* ── Shared slide layout ──────────────────────────────────────── */
.slide {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 0.4em 0.75em 1.4em;
    box-sizing: border-box;
    gap: 0.35em;
    overflow: hidden;
}

.slide-title {
    font-size: 1.7em;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.section-label {
    font-size: 1.3em;
    font-weight: 600;
    letter-spacing: 0.02em;
    align-self: flex-start;
    padding-left: 0.3em;
}

.forecast-divider {
    width: 90%;
    height: 1px;
    background: rgba(255,255,255,0.2);
    flex-shrink: 0;
}

/* ═══ SLIDE 1 — Combined Forecast ═════════════════════════════ */
.hourly-grid {
    display: flex;
    gap: 0.2em;
    width: 100%;
    justify-content: space-evenly;
    flex-shrink: 0;
}

.hour-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1em;
    flex: 1;
    min-width: 0;
}

.hour-time {
    font-size: 1em;
    opacity: 0.8;
    white-space: nowrap;
}

.hour-icon {
    font-size: 2.8em;
}

.hour-temp {
    font-size: 1.3em;
    font-weight: 600;
}

.hour-precip-bar {
    width: 0.5em;
    height: 1.8em;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 0.25em;
    position: relative;
    overflow: hidden;
}

.hour-precip-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    background: #42a5f5;
    border-radius: 0.25em;
    transition: height 0.6s ease;
}

.hour-precip-label {
    font-size: 0.8em;
    opacity: 0.7;
}

/* ── Extended list (bottom half of combined slide) ──────────── */
.extended-list {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.1em;
    overflow: hidden;
}

.extended-row {
    display: grid;
    grid-template-columns: 6em 2.4em 2.8em 2.8em 1fr;
    align-items: center;
    gap: 0.4em;
    padding: 0.15em 0.5em;
    font-size: 1.15em;
}

.ext-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ext-icon {
    font-size: 2em;
}

.ext-hi {
    font-weight: 700;
    text-align: right;
}

.ext-lo {
    opacity: 0.65;
    text-align: right;
}

.ext-placeholder {
    opacity: 0.3;
}

.ext-short {
    font-size: 1em;
    opacity: 0.8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ═══ SLIDE 3 — Alerts ════════════════════════════════════════ */
.alert-title {
    display: flex;
    align-items: center;
    gap: 0.4em;
    color: #ff6d00;
}

.alerts-list {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    overflow-y: auto;
}

.alert-card {
    border-left: 4px solid;
    padding: 0.5em 0.75em;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 0.4em;
}

.alert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.alert-event {
    font-weight: 700;
    font-size: 1.3em;
}

.alert-severity {
    font-weight: 600;
    font-size: 1.05em;
    text-transform: uppercase;
}

.alert-headline {
    font-size: 1.05em;
    opacity: 0.85;
    margin-top: 0.2em;
}

.alert-expires {
    font-size: 0.95em;
    opacity: 0.5;
    margin-top: 0.15em;
}

/* ── Skeleton ─────────────────────────────────────────────────── */
.weather-skeleton {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 0.75em;
    padding: 0.5em;
}

.sk-pill   { width: 55%; height: 2.2em; border-radius: 2em; }
.sk-row    { display: flex; gap: 1.5em; align-items: center; width: 85%; }
.sk-temp   { width: 4em; height: 3.5em; border-radius: 0.4em; }
.sk-icon   { width: 5em; height: 5em; border-radius: 0.5em; }
.sk-details { flex: 1; display: flex; flex-direction: column; gap: 0.4em; }
.sk-line   { width: 100%; height: 1.3em; border-radius: 0.4em; }
.sk-forecast { display: flex; gap: 0.8em; }
.sk-hour   { width: 3em; height: 5em; border-radius: 0.4em; }
</style>
