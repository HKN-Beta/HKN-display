<script setup lang="ts">
import { useApiV2 } from '~/composables/jorgenel/useApiV2'
import { useLiquidGlass } from '~/composables/jorgenel/useLiquidGlass'

interface RouteInfo {
  route_id: string
  route_color: string
  route_long_name: string
}

interface ArrivalSchedule {
  routeId: string
  arrivalMessages?: string[]
}

interface ServiceAlert {
  routeId: string
  severityLevel: string
}

interface ApiEnvelope<T> {
  success: boolean
  data: T
  error?: string
}

const { get, post } = useApiV2()
const { init: initGlass, destroy: destroyGlass } = useLiquidGlass()
const { init: initHeaderGlass, destroy: destroyHeaderGlass } = useLiquidGlass({
  frostBlur: 8,
  bezelWidth: 18,
  maxDisplacement: 20,
  specularOpacity: 0.2,
  borderRadius: 12,
  tintColor: '#1a1a2e',
  tintOpacity: 0.7
})
const cardEl = ref<HTMLElement | null>(null)
const headerEl = ref<HTMLElement | null>(null)

const routeInfo = ref<ApiEnvelope<RouteInfo[]> | null>(null)
const tripUpdates = ref<ApiEnvelope<ArrivalSchedule[]> | null>(null)
const serviceAlerts = ref<ApiEnvelope<ServiceAlert[]> | null>(null)

const routeData = (routeId: string): RouteInfo | undefined => {
  const data = routeInfo.value?.success ? routeInfo.value.data : []
  return data.find(r => r.route_id === routeId)
}

const routeDirection = (routeId: string): string => {
  return routeData(routeId)?.route_long_name ?? ''
}

const mapServiceAlert = (routeId: string): string | false => {
  const data = serviceAlerts.value?.success ? serviceAlerts.value.data : []
  const found = data.find(r => r.routeId === routeId)
  return found ? found.severityLevel : false
}

const parseTime = (msg: string | undefined): { value: string, unit: string } => {
  if (!msg) return { value: String.fromCharCode(8212), unit: '' }
  const match = msg.match(/^(\d[\d+]*)\s*(.*)$/)
  if (match) return { value: match[1] ?? String.fromCharCode(8212), unit: match[2] ?? '' }
  return { value: msg, unit: '' }
}

const fetchRouteInfo = async (): Promise<void> => {
  const response = await get('/citybus/routes')
  if (response.success) {
    routeInfo.value = response as ApiEnvelope<RouteInfo[]>
  } else if (response.error) {
    console.error('Route Info API error:', response.error)
  }
}

const fetchTripUpdates = async (): Promise<void> => {
  const response = await post('/citybus/trips', { stopCode: 'BUS538' })
  if (response.success) {
    tripUpdates.value = response as ApiEnvelope<ArrivalSchedule[]>
  } else if (response.error) {
    console.error('Trip Updates API error:', response.error)
  }
}

const fetchServiceAlerts = async (): Promise<void> => {
  const response = await post('/citybus/alerts', { stopCode: 'BUS538' })
  if (response.success) {
    serviceAlerts.value = response as ApiEnvelope<ServiceAlert[]>
  } else if (response.error) {
    console.error('Service Alerts API error:', response.error)
  }
}

let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await Promise.all([
    fetchRouteInfo(),
    fetchTripUpdates(),
    fetchServiceAlerts()
  ])
  nextTick(() => {
    if (cardEl.value) initGlass(cardEl.value)
    if (headerEl.value) initHeaderGlass(headerEl.value)
  })
  refreshInterval = setInterval(() => {
    fetchTripUpdates()
    fetchServiceAlerts()
  }, 1000 * 20)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  destroyGlass()
  destroyHeaderGlass()
})
</script>

<template>
  <div
    ref="cardEl"
    class="rounded-glass-card"
  >
    <div class="widget-content">
      <div class="bus-title-row">
        <UBadge
          size="lg"
          variant="solid"
          class="stop-badge"
          :ui="{ base: 'font-mono font-bold tracking-widest text-white' }"
          :style="`background: rgba(5,88,135,0.75); border:none;`"
        >
          BUS538
        </UBadge>
        <span class="bus-title-text">Electrical Engineering Bus Schedule</span>
      </div>

      <div class="bus-time-table">
        <div
          ref="headerEl"
          class="bus-header-row"
        >
          <span class="header-service">Service</span>
          <span class="header-time">Arriving</span>
          <span class="header-time">Next</span>
        </div>

        <template v-if="tripUpdates?.success">
          <div
            v-for="schedule of tripUpdates.data"
            :key="schedule.routeId"
            class="bus-time-row bus-route-glass"
            :style="`--route-accent: #${routeData(schedule.routeId)?.route_color ?? '334455'};`"
          >
            <div class="bus-route-cell">
              <UBadge
                :label="schedule.routeId"
                size="md"
                variant="solid"
                class="route-id-badge"
                :style="`background: #${routeData(schedule.routeId)?.route_color ?? '555'}; border: none;`"
              />
              <UIcon
                v-if="mapServiceAlert(schedule.routeId)"
                name="mdi:bus-alert"
                class="alert-icon"
              />
              <span class="route-name">{{ routeDirection(schedule.routeId) }}</span>
            </div>
            <div class="bus-time-cell">
              <span class="time-value">{{ parseTime(schedule.arrivalMessages?.[0]).value }}</span>
              <span
                v-if="parseTime(schedule.arrivalMessages?.[0]).unit"
                class="time-unit"
              >{{ parseTime(schedule.arrivalMessages?.[0]).unit }}</span>
            </div>
            <div class="bus-time-cell">
              <span class="time-value">{{ parseTime(schedule.arrivalMessages?.[1]).value }}</span>
              <span
                v-if="parseTime(schedule.arrivalMessages?.[1]).unit"
                class="time-unit"
              >{{ parseTime(schedule.arrivalMessages?.[1]).unit }}</span>
            </div>
          </div>
        </template>

        <div
          v-else-if="!tripUpdates"
          class="bus-loading"
        >
          <USkeleton
            v-for="n in 3"
            :key="n"
            class="bus-skeleton-row"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bus-title-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.75em;
    margin-bottom: 0.5dvh;
}
.stop-badge { font-size: 1.4em; flex-shrink: 0; }
.bus-title-text {
    font-size: 1.25em;
    font-weight: 400;
    color: #f0f0f0;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
.bus-time-table { display: flex; flex-direction: column; gap: 0.6dvh; }
.bus-header-row {
    display: grid;
    grid-template-columns: 5fr 2.5fr 2.5fr;
    align-items: center;
    padding: 0.45em 0.75em;
    border-radius: 12px;
}
.header-service, .header-time {
    font-size: 1.1em;
    font-weight: 800;
    color: #ffffff;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-shadow: 0 1px 4px rgba(0,0,0,0.4);
}
.header-time { text-align: center; }
.bus-time-row {
    display: grid;
    grid-template-columns: 5fr 2.5fr 2.5fr;
    gap: 0;
    min-height: 3.8em;
}
.bus-route-glass {
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-left: 4px solid var(--route-accent, rgba(255,255,255,0.2));
    box-shadow: 0 3px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.12);
    overflow: hidden;
}
.bus-route-cell {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.6em;
    padding: 0.5em 0.75em;
}
.route-id-badge {
    flex-shrink: 0;
    font-size: 1.3em;
    font-weight: 700;
    font-family: monospace;
    letter-spacing: 0.02em;
    color: #fff !important;
    padding: 0.3em 0.65em !important;
}
.alert-icon { font-size: 1.4em; color: #ffd600; flex-shrink: 0; }
.route-name {
    font-size: 1em;
    font-weight: 500;
    color: #f0f0f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.bus-time-cell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.3em 0.5em;
    gap: 0.05em;
}
.time-value {
    font-size: 2em;
    font-weight: 700;
    color: #ffffff;
    line-height: 1;
    text-shadow: 0 1px 6px rgba(0,0,0,0.6);
    letter-spacing: -0.02em;
}
.time-unit {
    font-size: 0.72em;
    font-weight: 500;
    opacity: 0.45;
    color: #f0f0f0;
    text-transform: lowercase;
    letter-spacing: 0.03em;
}
.bus-loading { display: flex; flex-direction: column; gap: 0.6dvh; }
.bus-skeleton-row { height: 3.8em; border-radius: 20px; }
</style>
