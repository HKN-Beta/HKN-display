<script setup lang="ts">
import { useApiV2 } from '~/composables/jorgenel/useApiV2'
import { useLiquidGlass } from '~/composables/jorgenel/useLiquidGlass'

const { get } = useApiV2()
const { init: initGlass, destroy: destroyGlass } = useLiquidGlass()
const cardEl = ref<HTMLElement | null>(null)

// ---- types ------------------------------------------------------------------
interface SysloadMemory {
  total: number
  used: number
  free: number
  usedPercent: number
}

interface SysloadData {
  cpuModel: string
  cpus: number[]
  memory: SysloadMemory
  uptime: string
  loadAvg: number[]
}

// ---- state ------------------------------------------------------------------
const data = ref<SysloadData | null>(null)
const loading = ref(true)
let pollInterval: ReturnType<typeof setInterval> | null = null

// ---- EMA smoothing ----------------------------------------------------------
// α controls responsiveness vs. smoothness: lower = smoother, higher = faster.
const EMA_ALPHA = 0.25

interface SmoothedState {
  cpus: number[]
  memUsedPercent: number
}

const smoothed = ref<SmoothedState | null>(null)

function applyEma(raw: SysloadData): void {
  if (!smoothed.value) {
    smoothed.value = {
      cpus: [...raw.cpus],
      memUsedPercent: raw.memory.usedPercent
    }
    return
  }

  const newCpus = raw.cpus.map((rawPct: number, i: number) => {
    const prev = smoothed.value!.cpus[i] ?? rawPct
    return prev + EMA_ALPHA * (rawPct - prev)
  })

  const newMem
    = smoothed.value.memUsedPercent
      + EMA_ALPHA * (raw.memory.usedPercent - smoothed.value.memUsedPercent)

  smoothed.value = { cpus: newCpus, memUsedPercent: newMem }
}
// -----------------------------------------------------------------------------

const fetchSysload = async (): Promise<void> => {
  const response = await get('/sysload')
  if (response.success) {
    data.value = response.data as SysloadData
    applyEma(response.data as SysloadData)
  } else {
    console.error('[SysLoad] API error:', response.error)
  }
  loading.value = false
}

onMounted(() => {
  nextTick(() => {
    if (cardEl.value) initGlass(cardEl.value)
  })
  fetchSysload()
  pollInterval = setInterval(fetchSysload, 1000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  destroyGlass()
})

// ---- helpers ----------------------------------------------------------------

/** Human-readable memory size (GiB or MiB) */
const fmtMem = (bytes: number): string => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' G'
  return (bytes / 1048576).toFixed(0) + ' M'
}

/** Bar fill colour based on percentage, mimicking htop's green→yellow→red */
const cpuColor = (pct: number): string => {
  if (pct >= 80) return '#ff5555' // red
  if (pct >= 50) return '#f1c40f' // yellow
  return '#55cc55' // green
}

/** Memory bar colour — raw CSS colour value */
const memColor = computed((): string => {
  if (!smoothed.value) return '#55cc55'
  const pct = smoothed.value.memUsedPercent
  if (pct >= 80) return '#ff5555'
  if (pct >= 50) return '#f1c40f'
  return '#55cc55'
})

/** Number of placeholder skeleton bars to show while first loading */
const SKELETON_CORE_COUNT = 8
</script>

<template>
  <div
    ref="cardEl"
    class="rounded-glass-card sl-wrap"
  >
    <!-- header -->
    <div class="sl-header">
      <span class="sl-title">&#9632; sysload</span>
      <span
        v-if="data"
        class="sl-meta"
      >&#8593;{{ data.uptime }}</span>
    </div>

    <!-- skeleton while awaiting first data -->
    <div
      v-if="loading && !data"
      class="sl-body sl-skeleton-body"
    >
      <div class="sl-cpu-col">
        <div
          v-for="n in SKELETON_CORE_COUNT"
          :key="n"
          class="sl-cpu-row"
        >
          <USkeleton class="sl-skeleton-bar" />
        </div>
      </div>
      <USkeleton class="sl-skeleton-mem" />
    </div>

    <template v-else-if="data && smoothed">
      <!-- column labels -->
      <div class="sl-col-labels">
        <span class="sl-col-label">CPU</span>
        <span class="sl-col-label">Mem</span>
      </div>

      <!-- body: CPU bars (left) + vertical mem bar (right) -->
      <div class="sl-body">
        <div class="sl-cpu-col">
          <div
            v-for="(pct, i) in smoothed.cpus"
            :key="i"
            class="sl-cpu-row"
          >
            <div class="sl-bar-track">
              <div
                class="sl-bar-fill"
                :style="{ width: pct + '%', background: cpuColor(pct) }"
              />
              <span class="sl-bar-text sl-bar-text-left">{{ i + 1 }}</span>
              <span class="sl-bar-text sl-bar-text-right">{{ Math.round(pct) }}%</span>
            </div>
          </div>
        </div>

        <!-- vertical memory bar -->
        <div class="sl-mem-col">
          <div
            class="sl-mem-fill"
            :style="{ height: smoothed.memUsedPercent + '%', background: memColor }"
          />
        </div>
      </div>

      <!-- footer: mem label -->
      <div class="sl-footer">
        {{ fmtMem(data.memory.used) }}/{{ fmtMem(data.memory.total) }}
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ── outer card ──────────────────────────────────────────────── */
.sl-wrap {
    /* Override rounded-glass-card centering so we can lay out as a column */
    align-items: stretch;
    justify-content: flex-start;
    flex-direction: column;
    background: transparent;
    overflow: hidden;
    /* Fill the sidebar fully — critical for the height chain */
    width: 100%;
    height: 100%;
    box-sizing: border-box;
}

/* ── header ──────────────────────────────────────────────────── */
.sl-header {
    display: flex;
    flex-direction: column;
    gap: 0.15em;
    padding: 0.55em 0.65em 0.35em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
}
.sl-title {
    font-family: 'Courier New', monospace;
    font-size: 1.1em;
    color: #7ee787;
    font-weight: bold;
    letter-spacing: 0.04em;
}
.sl-meta {
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    color: #8b949e;
}

/* ── column labels ───────────────────────────────────────────── */
.sl-col-labels {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 0.2em 0.55em 0.1em;
    flex-shrink: 0;
}
.sl-col-label {
    font-family: 'Courier New', monospace;
    font-size: 1.2rem;
    color: #58a6ff;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

/* ── body ────────────────────────────────────────────────────── */
.sl-body {
    /* Take all remaining height between labels and footer */
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: row;
    gap: 0.4em;
    padding: 0 0.55em 0.45em;
    overflow: hidden;
    align-items: stretch;
}

/* ── CPU column ──────────────────────────────────────────────── */
.sl-cpu-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.sl-cpu-row {
    /* Each row takes equal share of the available column height */
    flex: 1 1 0;
    min-height: 0;
    /* Enable container queries so bar text can size to the row height */
    container-type: size;
}

.sl-bar-track {
    position: relative;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    overflow: hidden;
    box-sizing: border-box;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.sl-bar-fill {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    border-radius: 2px;
    transition: width 0.5s ease;
    opacity: 0.75;
}

/* Text overlaid on the bar */
.sl-bar-text {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-family: 'Courier New', monospace;
    /* cqh = % of the container's height (the .sl-cpu-row);
       clamp keeps it legible when there are very few or very many cores */
    font-size: clamp(0.35rem, 30cqh, 1.6rem);
    color: #e6edf3;
    text-shadow: 0 0 4px rgba(0,0,0,0.9);
    pointer-events: none;
    line-height: 1;
    z-index: 1;
    white-space: nowrap;
}
.sl-bar-text-left  { left:  3px; color: #e6edf3; }
.sl-bar-text-right { right: 3px; }

/* ── vertical memory bar ─────────────────────────────────────────────── */
.sl-mem-col {
    width: 14px;
    flex-shrink: 0;
    position: relative;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    overflow: hidden;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.sl-mem-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    border-radius: 2px;
    transition: height 0.5s ease, background 0.5s ease;
    opacity: 0.75;
}

/* ── footer ──────────────────────────────────────────────────── */
.sl-footer {
    font-family: 'Courier New', monospace;
    font-size: 0.65em;
    color: #8b949e;
    text-align: center;
    padding: 0.25em 0.5em 0.45em;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
}

/* ── skeleton placeholders ───────────────────────────────────── */
.sl-skeleton-bar {
    width: 100%;
    height: 100%;
    border-radius: 3px;
}
.sl-skeleton-mem {
    width: 14px;
    flex-shrink: 0;
    border-radius: 3px;
}

/* ── placeholder (kept for safety) ──────────────────────────── */
.sl-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Courier New', monospace;
    font-size: 0.65rem;
    color: #8b949e;
}
</style>
