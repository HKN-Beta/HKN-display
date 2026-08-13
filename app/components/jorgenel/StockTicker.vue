<script setup lang="ts">
import { useApiV2 } from '~/composables/jorgenel/useApiV2'
import { useLiquidGlass } from '~/composables/jorgenel/useLiquidGlass'

interface StockQuote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketState: string
}

const { get } = useApiV2()
const { init: initGlass, destroy: destroyGlass } = useLiquidGlass()
const cardEl = ref<HTMLElement | null>(null)

const quotes = ref<StockQuote[]>([])
const loaded = ref(false)

const fetchStocks = async (): Promise<void> => {
  const response = await get('/stocks')
  if (response.success) {
    quotes.value = response.data as StockQuote[]
    loaded.value = true
  } else {
    console.error('[StockTicker] API error:', response.error)
  }
}

let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await fetchStocks()
  nextTick(() => {
    if (cardEl.value) initGlass(cardEl.value)
  })
  refreshInterval = setInterval(fetchStocks, 1000 * 60) // refresh every 60s
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  destroyGlass()
})

function changeClass(change: number): string {
  if (change > 0) return 'up'
  if (change < 0) return 'down'
  return 'flat'
}

function arrow(change: number): string {
  if (change > 0) return '▲'
  if (change < 0) return '▼'
  return '–'
}
</script>

<template>
  <div
    v-if="loaded && quotes.length"
    ref="cardEl"
    class="rounded-glass-card ticker-bar"
  >
    <div class="ticker-track">
      <!-- Duplicate the list for seamless looping -->
      <div class="ticker-content">
        <span
          v-for="(q, i) in quotes"
          :key="'a-' + i"
          class="ticker-item"
        >
          <span class="ticker-symbol">{{ q.symbol }}</span>
          <span class="ticker-price">{{ q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          <span
            class="ticker-change"
            :class="changeClass(q.change)"
          >
            {{ arrow(q.change) }} {{ Math.abs(q.changePercent).toFixed(2) }}%
          </span>
        </span>
      </div>
      <div
        class="ticker-content"
        aria-hidden="true"
      >
        <span
          v-for="(q, i) in quotes"
          :key="'b-' + i"
          class="ticker-item"
        >
          <span class="ticker-symbol">{{ q.symbol }}</span>
          <span class="ticker-price">{{ q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          <span
            class="ticker-change"
            :class="changeClass(q.change)"
          >
            {{ arrow(q.change) }} {{ Math.abs(q.changePercent).toFixed(2) }}%
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ticker-bar {
    width: 100%;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.25);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    /* Override the 20px from .rounded-glass-card — ticker needs a tighter radius */
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.ticker-track {
    display: flex;
    width: max-content;
    animation: ticker-scroll 60s linear infinite;
    will-change: transform;
    transform: translateZ(0);
}

.ticker-content {
    display: flex;
    flex-shrink: 0;
}

.ticker-item {
    display: inline-flex;
    align-items: center;
    gap: 0.55em;
    padding: 0.35em 1.8em;
    white-space: nowrap;
    font-size: 1.7em;
    color: #f0f0f0;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    border-right: 1px solid rgba(255,255,255,0.08);
}

.ticker-symbol {
    font-weight: 700;
    letter-spacing: 0.03em;
}

.ticker-price {
    font-weight: 500;
    opacity: 0.9;
}

.ticker-change {
    font-weight: 600;
    font-size: 0.95em;
}

.ticker-change.up {
    color: #4ade80;
}

.ticker-change.down {
    color: #f87171;
}

.ticker-change.flat {
    color: #94a3b8;
}

@keyframes ticker-scroll {
    0% {
        transform: translateX(0);
    }
    100% {
        transform: translateX(-50%);
    }
}

/* Pause on hover for readability */
.ticker-bar:hover .ticker-track {
    animation-play-state: paused;
}
</style>
