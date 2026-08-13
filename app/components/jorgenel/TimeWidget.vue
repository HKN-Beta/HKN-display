<script setup lang="ts">
import { useApiV2 } from '~/composables/jorgenel/useApiV2'
import { useLiquidGlass } from '~/composables/jorgenel/useLiquidGlass'

// Yes, I'm just using system time. Your device should be online anyway
const TZ = 'America/Indiana/Indianapolis'

// ── Weather (current conditions only) ────────────────────────
interface WeatherCurrent {
  tempF: number | null
  feelsLikeF: number | null
  description: string
  icon: string
  humidity: number | null
  windSpeedMph: number | null
  windDirection: string | null
  windGustMph: number | null
  pressureInHg: number | null
  visibilityMi: number | null
}
interface WeatherSun {
  sunrise: string | null
  sunset: string | null
}
interface WeatherData {
  current: WeatherCurrent
  sun: WeatherSun | null
}

const { get } = useApiV2()
const weather = ref<WeatherData | null>(null)

const fetchWeather = async (): Promise<void> => {
  const res = await get('/weather')
  if (res.success) weather.value = res.data as WeatherData
}

let wxInterval: ReturnType<typeof setInterval> | null = null

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Date().toLocaleString('en-US', { ...opts, timeZone: TZ })

const time = ref(fmt({ timeStyle: 'short' }))
const date = ref(fmt({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))

let refreshInterval: ReturnType<typeof setInterval> | null = null

// ── Custom liquid-glass config ────────────────────────────────────
// Intentionally minimal: the time display should stay crisp and legible,
// so blur, displacement, and specular are kept very low — just enough
// for a subtle edge-glass look without distorting the large numerals.
const { init: initGlass, destroy: destroyGlass } = useLiquidGlass({
  bezelWidth: 10,
  maxDisplacement: 8,
  frostBlur: 0.4,
  saturation: 1.0,
  specularOpacity: 0.07,
  borderRadius: 20
})
const cardEl = ref<HTMLElement | null>(null)

onMounted(async () => {
  await fetchWeather()
  nextTick(() => {
    if (cardEl.value) initGlass(cardEl.value)
  })
  refreshInterval = setInterval(() => {
    const newTime = fmt({ timeStyle: 'short' })
    const newDate = fmt({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    if (time.value !== newTime) time.value = newTime
    if (date.value !== newDate) date.value = newDate
  }, 1000)
  wxInterval = setInterval(fetchWeather, 1000 * 60 * 5)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  if (wxInterval) clearInterval(wxInterval)
  destroyGlass()
})
</script>

<template>
  <div
    ref="cardEl"
    class="time-glass-card"
  >
    <!-- Header -->
    <div class="tw-header tw-text">
      <NuxtImg
        src="IEEEHKNCrest.png"
        alt="HKN Crest"
        class="tw-crest"
      />
      <span>Welcome to the HKN Lounge, Est. 1968</span>
    </div>

    <!-- Time & Date -->
    <div class="tw-clock-block">
      <div class="tw-time tw-text">
        {{ time }}
      </div>
      <div class="tw-date tw-text">
        {{ date }}
      </div>
    </div>

    <!-- Current conditions -->
    <div
      v-if="weather"
      class="tw-weather tw-text"
    >
      <!-- Icon + Temp + Description -->
      <div class="tw-wx-primary">
        <UIcon
          :name="weather.current.icon"
          class="tw-wx-icon"
        />
        <div class="tw-wx-temp-block">
          <span class="tw-wx-temp">{{ weather.current.tempF ?? '\u2014' }}<span class="tw-wx-unit">&deg;F</span></span>
          <span
            v-if="weather.current.feelsLikeF != null"
            class="tw-wx-feels"
          >Feels like {{ weather.current.feelsLikeF }}&deg;</span>
        </div>
        <div class="tw-wx-desc-block">
          <span class="tw-wx-desc">{{ weather.current.description }}</span>
          <span class="tw-wx-location">West Lafayette, IN</span>
        </div>
      </div>
      <!-- Stats row -->
      <div class="tw-wx-stats">
        <div class="tw-wx-stat">
          <UIcon
            name="wi:humidity"
            class="tw-wx-stat-icon"
          />
          <span>{{ weather.current.humidity ?? '\u2014' }}%</span>
          <span class="tw-wx-stat-label">Humidity</span>
        </div>
        <div class="tw-wx-stat">
          <UIcon
            name="wi:strong-wind"
            class="tw-wx-stat-icon"
          />
          <span>{{ weather.current.windSpeedMph ?? '\u2014' }} mph{{ weather.current.windDirection ? ' ' + weather.current.windDirection : '' }}</span>
          <span
            v-if="weather.current.windGustMph"
            class="tw-wx-stat-label"
          >Gust {{ weather.current.windGustMph }} mph</span>
          <span
            v-else
            class="tw-wx-stat-label"
          >Wind</span>
        </div>
        <div
          v-if="weather.sun"
          class="tw-wx-stat"
        >
          <UIcon
            name="wi:sunrise"
            class="tw-wx-stat-icon"
          />
          <span>{{ weather.sun.sunrise }}</span>
          <span class="tw-wx-stat-label">Sunrise</span>
        </div>
        <div
          v-if="weather.sun"
          class="tw-wx-stat"
        >
          <UIcon
            name="wi:sunset"
            class="tw-wx-stat-icon"
          />
          <span>{{ weather.sun.sunset }}</span>
          <span class="tw-wx-stat-label">Sunset</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Glass card base ──────────────────────────────────────────────
   Replicates .rounded-glass-card from display.vue so this widget
   is fully self-contained. The .rounded-glass-card class is
   intentionally NOT used here — the parent's useLiquidGlass init
   would otherwise overwrite the custom filter applied below.       */
.time-glass-card {
    position: relative;
    background: transparent;
    /* CSS fallback — overridden by SVG liquid-glass filter on mount */
    backdrop-filter: blur(4px) saturate(1.2);
    -webkit-backdrop-filter: blur(4px) saturate(1.2);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow:
        0 4px 24px rgba(0, 0, 0, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.18);
    overflow: hidden;
    isolation: isolate;

    /* Layout */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 0.75em 1.1em 0.85em;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    text-align: center;
}

/* Subtle inner rim glow (mirrors .rounded-glass-card::before) */
.time-glass-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 12px -4px rgba(255, 255, 255, 0.18);
    pointer-events: none;
    z-index: 3;
}

/* ── Typography ──────────────────────────────────────────────────── */
.tw-text {
    color: #f0f0f0;
    text-shadow:
        0 1px 4px rgba(0, 0, 0, 0.7),
        0 0 10px rgba(0, 0, 0, 0.35);
    position: relative;
    z-index: 1;
}

/* ── Header row ──────────────────────────────────────────────────── */
.tw-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.55em;
    font-size: 2em;
    font-weight: 400;
    width: 100%;
}

.tw-crest {
    width: 2.2em;
    height: auto;
    flex-shrink: 0;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.55));
}

/* ── Clock block ─────────────────────────────────────────────── */
.tw-clock-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
}

/* ── Time ────────────────────────────────────────────────────── */
.tw-time {
    font-size: 10em;
    font-weight: 700;
    text-align: center;
    line-height: 1;
    letter-spacing: -0.02em;
}

/* ── Date ────────────────────────────────────────────────────────── */
.tw-date {
    font-size: 2.2em;
    font-weight: 400;
    text-align: center;
    letter-spacing: 0.01em;
}

/* ── Current conditions strip ─────────────────────────────────── */
.tw-weather {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4em;
    width: 100%;
    border-top: 1px solid rgba(255, 255, 255, 0.18);
    padding-top: 0.55em;
}

/* Primary row: icon | temp+feels | desc+location */
.tw-wx-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.7em;
    width: 100%;
}

.tw-wx-icon {
    font-size: 3.5em;
    flex-shrink: 0;
    filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.6));
}

.tw-wx-temp-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.05em;
}

.tw-wx-temp {
    font-size: 2.8em;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
}

.tw-wx-unit {
    font-size: 0.5em;
    font-weight: 300;
    margin-left: 0.1em;
    opacity: 0.8;
}

.tw-wx-feels {
    font-size: 1.1em;
    opacity: 0.7;
    white-space: nowrap;
}

.tw-wx-desc-block {
    display: flex;
    flex-direction: column;
    gap: 0.1em;
    border-left: 1px solid rgba(255, 255, 255, 0.2);
    padding-left: 0.65em;
}

.tw-wx-desc {
    font-size: 1.5em;
    font-weight: 600;
    line-height: 1.2;
}

.tw-wx-location {
    font-size: 1.1em;
    opacity: 0.6;
    letter-spacing: 0.02em;
}

/* Stats grid */
.tw-wx-stats {
    display: flex;
    justify-content: center;
    gap: 0.5em 1.5em;
    flex-wrap: wrap;
    width: 100%;
    padding: 0.4em 0.6em;
}

.tw-wx-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1em;
    min-width: 4em;
}

.tw-wx-stat-icon {
    font-size: 1.7em;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.tw-wx-stat > span:nth-child(2) {
    font-size: 1.2em;
    font-weight: 600;
    white-space: nowrap;
}

.tw-wx-stat-label {
    font-size: 0.9em;
    opacity: 0.6;
    white-space: nowrap;
}
</style>
