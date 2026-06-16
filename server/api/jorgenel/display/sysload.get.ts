// GET /api/jorgenel/display/sysload - Returns per-core CPU usage and memory utilization.
// On Linux (including Docker on a Linux host) the implementation reads /proc/stat
// and /proc/meminfo, which always reflect the real host kernel metrics.
// NOTE: On Docker Desktop for Windows/macOS the container runs inside a WSL2 / HyperKit
// VM, so /proc/stat reflects that VM's idle clocks — not the Windows/macOS host.
// This is a fundamental isolation boundary; host metrics are only accurate on a Linux host.
// On non-Linux platforms the os module fallback is used.
import { defineEventHandler } from 'h3'
import os from 'os'
import fs from 'fs'
import { createSuccessResponse } from '../../../utils/jorgenel/response-helpers'

// ── helpers ────────────────────────────────────────────────────────────────

function readFile(path: string): string | null {
  try {
    return fs.readFileSync(path, 'utf8').trim()
  } catch {
    return null
  }
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

// ── CPU via /proc/stat (Linux / Docker) ────────────────────────────────────
// Fields: user nice system idle iowait irq softirq steal guest guest_nice
interface ProcCpuTick {
  user: number
  nice: number
  system: number
  idle: number
  iowait: number
  irq: number
  softirq: number
}

function readProcStat(): ProcCpuTick[] | null {
  const raw = readFile('/proc/stat')
  if (!raw) return null
  return raw
    .split('\n')
    .filter(l => /^cpu\d+/.test(l))
    .map((line) => {
      const p = line.split(/\s+/)
      return {
        user: parseInt(p[1] ?? '0') || 0,
        nice: parseInt(p[2] ?? '0') || 0,
        system: parseInt(p[3] ?? '0') || 0,
        idle: parseInt(p[4] ?? '0') || 0,
        iowait: parseInt(p[5] ?? '0') || 0,
        irq: parseInt(p[6] ?? '0') || 0,
        softirq: parseInt(p[7] ?? '0') || 0
      }
    })
}

function procCpuPercent(a: ProcCpuTick, b: ProcCpuTick): number {
  const aIdle = a.idle + a.iowait
  const bIdle = b.idle + b.iowait
  const aTotal = a.user + a.nice + a.system + a.idle + a.iowait + a.irq + a.softirq
  const bTotal = b.user + b.nice + b.system + b.idle + b.iowait + b.irq + b.softirq
  const totalDiff = bTotal - aTotal
  if (totalDiff === 0) return 0
  return Math.min(100, Math.max(0, ((totalDiff - (bIdle - aIdle)) / totalDiff) * 100))
}

// ── CPU via os.cpus() fallback (Windows / macOS) ───────────────────────────
interface OsCpuTick { user: number, nice: number, sys: number, idle: number, irq: number }

function getOsCpuSnapshots(): OsCpuTick[] {
  return os.cpus().map((c: os.CpuInfo) => ({ ...c.times }))
}

function osCpuPercent(a: OsCpuTick, b: OsCpuTick): number {
  const aTotal = a.user + a.nice + a.sys + a.idle + a.irq
  const bTotal = b.user + b.nice + b.sys + b.idle + b.irq
  const totalDiff = bTotal - aTotal
  if (totalDiff === 0) return 0
  return Math.min(100, Math.max(0, ((totalDiff - (b.idle - a.idle)) / totalDiff) * 100))
}

// ── Memory via /proc/meminfo (Linux / Docker — always host-level) ──────────
// os.totalmem()/freemem() can lie inside containers; /proc/meminfo reports
// the real host figures because Linux containers share the host kernel procfs.
// On Windows/macOS we fall back to the os module.
interface MemInfo { total: number, used: number, free: number, usedPercent: number }

function getMemoryInfo(): MemInfo {
  const raw = readFile('/proc/meminfo')
  if (raw) {
    const get = (key: string): number => {
      const m = raw.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))
      return m ? parseInt(m[1] ?? '0') * 1024 : 0 // /proc/meminfo values are in kB
    }
    const total = get('MemTotal')
    const available = get('MemAvailable') // accounts for buffers/cache
    if (total > 0 && available > 0) {
      const used = total - available
      return {
        total, used, free: available,
        usedPercent: parseFloat(((used / total) * 100).toFixed(1))
      }
    }
  }

  // Fallback: os module (Windows / macOS dev machines)
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free
  return {
    total, used, free,
    usedPercent: parseFloat(((used / total) * 100).toFixed(1))
  }
}

// ── Uptime (/proc/uptime gives container uptime; os.uptime() gives host) ───
function getUptimeString(): string {
  const raw = readFile('/proc/uptime')
  const seconds = raw ? parseFloat(raw.split(' ')[0] ?? '0') : os.uptime()
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

// ── Handler ────────────────────────────────────────────────────────────────

export default defineEventHandler(async () => {
  // Prefer /proc/stat on Linux; fall back to os.cpus() on other platforms.
  // 500ms window: 250ms was marginal for low utilization (5% ≈ 12ms active ticks).
  const before = readProcStat()
  const osBefore = before ? null : getOsCpuSnapshots()

  await sleep(500)

  const after = readProcStat()
  const osAfter = after ? null : getOsCpuSnapshots()

  let cpuPercents: number[]
  if (before && after && before.length === after.length && before.length > 0) {
    cpuPercents = before.map((b, i) =>
      parseFloat(procCpuPercent(b, after[i]!).toFixed(1))
    )
  } else if (osBefore && osAfter && osBefore.length === osAfter.length && osBefore.length > 0) {
    cpuPercents = osBefore.map((b, i) =>
      parseFloat(osCpuPercent(b, osAfter[i]!).toFixed(1))
    )
  } else {
    cpuPercents = []
  }

  const cpuModel = os.cpus()[0]?.model ?? 'Unknown CPU'

  return createSuccessResponse({
    cpuModel,
    cpus: cpuPercents,
    memory: getMemoryInfo(),
    uptime: getUptimeString(),
    loadAvg: os.loadavg().map((v: number) => parseFloat(v.toFixed(2)))
  })
})
