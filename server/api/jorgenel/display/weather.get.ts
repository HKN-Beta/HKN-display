// GET /api/jorgenel/display/weather - comprehensive NWS weather data for display
import { defineEventHandler } from 'h3'
import {
  createSuccessResponse,
  createErrorResponse
} from '../../../utils/jorgenel/response-helpers'

const LOUNGE_COORDS = { lat: 40.4287, lng: -86.9113 }
const TIMEZONE = 'America/Indiana/Indianapolis'
const NWS_UA = '(HKN Lounge Display, hkn-beta@purdue.edu)'

const nwsHeaders = {
  'User-Agent': NWS_UA,
  'Accept': 'application/geo+json'
}

interface QV {
  value: number | null
  unitCode?: string
}

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null

const asObject = (value: unknown): JsonObject =>
  isObject(value) ? value : {}

const asObjectArray = (value: unknown): JsonObject[] =>
  Array.isArray(value) ? value.filter(isObject) : []

const getString = (obj: JsonObject, key: string): string | null =>
  typeof obj[key] === 'string' ? obj[key] : null

const getNumber = (obj: JsonObject, key: string): number | null =>
  typeof obj[key] === 'number' ? obj[key] : null

const getBoolean = (obj: JsonObject, key: string): boolean | null =>
  typeof obj[key] === 'boolean' ? obj[key] : null

const getObject = (obj: JsonObject, key: string): JsonObject | null =>
  isObject(obj[key]) ? obj[key] : null

const toQV = (value: unknown): QV => {
  if (!isObject(value)) return { value: null }
  return {
    value: typeof value.value === 'number' ? value.value : null,
    unitCode: typeof value.unitCode === 'string' ? value.unitCode : undefined
  }
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

function cToF(c: number): number {
  return Math.round(c * 1.8 + 32)
}

function qvToF(qv: QV): number | null {
  if (qv.value == null) return null
  if (qv.unitCode?.includes('degC') || qv.unitCode?.includes('Cel')) {
    return cToF(qv.value)
  }
  return Math.round(qv.value)
}

function qvToMph(qv: QV): number | null {
  if (qv.value == null) return null
  if (qv.unitCode?.includes('km_h') || qv.unitCode?.includes('km/h')) {
    return Math.round(qv.value * 0.621371)
  }
  return Math.round(qv.value)
}

function qvToMiles(qv: QV): number | null {
  if (qv.value == null) return null
  if (qv.unitCode?.includes('m') && !qv.unitCode?.includes('mi')) {
    return Math.round((qv.value / 1609.34) * 10) / 10
  }
  return Math.round(qv.value * 10) / 10
}

function qvToInHg(qv: QV): number | null {
  if (qv.value == null) return null
  if (qv.unitCode?.includes('Pa')) {
    return Math.round((qv.value / 3386.39) * 100) / 100
  }
  return Math.round(qv.value * 100) / 100
}

function degreesToCompass(deg: number | null): string {
  if (deg == null) return '-'
  const dirs = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
  ]
  return dirs[Math.round(deg / 22.5) % 16] ?? '-'
}

function fmtTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      hour12: true
    })
    .replace(' AM', 'am')
    .replace(' PM', 'pm')
}

function fmtShortTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    .replace(' AM', 'am')
    .replace(' PM', 'pm')
}

function forecastToIcon(text: string, isDaytime: boolean): string {
  const w = text.toLowerCase()

  if (w.includes('tornado') || w.includes('funnel')) return 'wi:tornado'
  if (w.includes('hurricane') || w.includes('tropical')) return 'wi:hurricane'
  if (w.includes('blizzard')) return 'wi:snowflake-cold'
  if (w.includes('storm') || w.includes('thunder')) return 'wi:thunderstorm'
  if (w.includes('freezing') && w.includes('rain')) return 'wi:rain-mix'
  if (w.includes('freezing')) return 'wi:rain-mix'
  if (w.includes('sleet') || (w.includes('snow') && w.includes('rain'))) return 'wi:rain-mix'
  if (w.includes('hail')) return 'wi:hail'
  if (w.includes('snow') && w.includes('shower')) return 'wi:snow'
  if (w.includes('snow')) return 'wi:snow'
  if (w.includes('drizzle')) return 'wi:sprinkle'
  if (w.includes('shower')) return isDaytime ? 'wi:day-showers' : 'wi:night-alt-showers'
  if (w.includes('rain')) return 'wi:rain'
  if (w.includes('fog')) return 'wi:fog'
  if (w.includes('haze')) return 'wi:day-fog'
  if (w.includes('smoke')) return 'wi:smoke'
  if (w.includes('windy')) return 'wi:day-windy'
  if (w.includes('breezy')) return 'wi:day-light-wind'
  if (w.includes('overcast') || (w.includes('cloudy') && !w.includes('partly') && !w.includes('mostly'))) return 'wi:cloudy'
  if (w.includes('mostly cloudy') || (w.includes('mostly') && !w.includes('sunny'))) {
    return isDaytime ? 'wi:day-cloudy' : 'wi:night-alt-cloudy'
  }
  if (w.includes('partly') || w.includes('few') || w.includes('mostly sunny')) {
    return isDaytime ? 'wi:day-sunny-overcast' : 'wi:night-alt-partly-cloudy'
  }
  if (w.includes('sunny') || w.includes('clear') || w.includes('fair')) {
    return isDaytime ? 'wi:day-sunny' : 'wi:night-clear'
  }

  return isDaytime ? 'wi:day-sunny' : 'wi:night-clear'
}

function cloudAmountToText(amount: string | null): string {
  switch (amount) {
    case 'CLR':
    case 'SKC':
      return 'Clear'
    case 'FEW':
      return 'Few'
    case 'SCT':
      return 'Scattered'
    case 'BKN':
      return 'Broken'
    case 'OVC':
    case 'VV':
      return 'Overcast'
    default:
      return amount || '-'
  }
}

export default defineEventHandler(async () => {
  try {
    const pointUrl = `https://api.weather.gov/points/${LOUNGE_COORDS.lat},${LOUNGE_COORDS.lng}`
    const pointRes = await fetch(pointUrl, { headers: nwsHeaders })
    if (!pointRes.ok) throw new Error(`Point metadata failed: ${pointRes.status}`)

    const pointData = asObject(await pointRes.json())
    const props = asObject(pointData.properties)

    const gridWfo = getString(props, 'gridId')
    const gridX = getNumber(props, 'gridX')
    const gridY = getNumber(props, 'gridY')
    if (!gridWfo || gridX == null || gridY == null) {
      throw new Error('Point metadata missing grid coordinates')
    }

    const stationsUrl = `https://api.weather.gov/gridpoints/${gridWfo}/${gridX},${gridY}/stations`
    const hourlyUrl = `https://api.weather.gov/gridpoints/${gridWfo}/${gridX},${gridY}/forecast/hourly`
    const forecastUrl = `https://api.weather.gov/gridpoints/${gridWfo}/${gridX},${gridY}/forecast`
    const alertsUrl = `https://api.weather.gov/alerts/active?point=${LOUNGE_COORDS.lat},${LOUNGE_COORDS.lng}`

    const [stationsRes, hourlyRes, forecastRes, alertsRes] = await Promise.all([
      fetch(stationsUrl, { headers: nwsHeaders }),
      fetch(hourlyUrl, { headers: nwsHeaders }),
      fetch(forecastUrl, { headers: nwsHeaders }),
      fetch(alertsUrl, { headers: nwsHeaders })
    ])

    let observation: JsonObject | null = null
    if (stationsRes.ok) {
      const stationsData = asObject(await stationsRes.json())
      const stationsProps = asObject(stationsData.properties)
      const observationStations = Array.isArray(stationsProps.observationStations)
        ? stationsProps.observationStations.filter((v): v is string => typeof v === 'string')
        : []
      const featureStations = asObjectArray(stationsData.features)
        .map(feature => getString(feature, 'id'))
        .filter((v): v is string => Boolean(v))
      const stationUrls = observationStations.length > 0 ? observationStations : featureStations

      for (const url of stationUrls.slice(0, 3)) {
        try {
          const obsRes = await fetch(`${url}/observations/latest`, { headers: nwsHeaders })
          if (obsRes.ok) {
            const obsData = asObject(await obsRes.json())
            observation = getObject(obsData, 'properties')
            if (toQV(observation?.temperature).value != null) break
          }
        } catch {
          // try next station
        }
      }
    }

    let hourlyPeriods: JsonObject[] = []
    if (hourlyRes.ok) {
      const hourlyData = asObject(await hourlyRes.json())
      const hourlyProps = asObject(hourlyData.properties)
      hourlyPeriods = asObjectArray(hourlyProps.periods).slice(0, 12)
    }

    let forecastPeriods: JsonObject[] = []
    if (forecastRes.ok) {
      const forecastData = asObject(await forecastRes.json())
      const forecastProps = asObject(forecastData.properties)
      forecastPeriods = asObjectArray(forecastProps.periods)
    }

    const alerts = alertsRes.ok
      ? asObjectArray(asObject(await alertsRes.json()).features).map((f) => {
          const a = asObject(f.properties)
          const expires = getString(a, 'expires')
          return {
            event: getString(a, 'event'),
            headline: getString(a, 'headline'),
            severity: getString(a, 'severity'),
            urgency: getString(a, 'urgency'),
            description: getString(a, 'description'),
            instruction: getString(a, 'instruction'),
            expires: expires ? fmtShortTime(expires) : null
          }
        })
      : []

    const obs = observation
    const tempF = obs ? qvToF(toQV(obs.temperature)) : null
    const dewpointF = obs ? qvToF(toQV(obs.dewpoint)) : null

    const heatIndex = obs ? toQV(obs.heatIndex) : { value: null }
    const windChill = obs ? toQV(obs.windChill) : { value: null }
    const temperature = obs ? toQV(obs.temperature) : { value: null }
    const feelsLike = qvToF(
      heatIndex.value != null
        ? heatIndex
        : windChill.value != null
          ? windChill
          : temperature
    )

    const firstHourly = hourlyPeriods[0] ?? {}
    const firstHourlyShortForecast = getString(firstHourly, 'shortForecast') ?? ''
    const firstHourlyIsDaytime = getBoolean(firstHourly, 'isDaytime') ?? true
    const obsText = obs ? getString(obs, 'textDescription') : null

    const current = {
      tempF,
      tempC: tempF != null ? Math.round((tempF - 32) / 1.8) : null,
      feelsLikeF: feelsLike,
      description: obsText || firstHourlyShortForecast || '-',
      icon: forecastToIcon(obsText || firstHourlyShortForecast, firstHourlyIsDaytime),
      humidity: toQV(obs?.relativeHumidity).value,
      windSpeedMph: qvToMph(toQV(obs?.windSpeed)),
      windGustMph: qvToMph(toQV(obs?.windGust)),
      windDirection: degreesToCompass(toQV(obs?.windDirection).value),
      dewpointF,
      pressureInHg: qvToInHg(toQV(obs?.barometricPressure)),
      visibilityMi: qvToMiles(toQV(obs?.visibility)),
      cloudLayers: asObjectArray(obs?.cloudLayers).map((cl) => {
        const base = toQV(cl.base)
        return {
          coverage: cloudAmountToText(getString(cl, 'amount')),
          baseFt: base.value != null
            ? Math.round(base.unitCode?.includes('m') ? base.value * 3.28084 : base.value)
            : null
        }
      })
    }

    const astro = getObject(props, 'astronomicalData')
    const sun = astro
      ? {
          sunrise: getString(astro, 'sunrise') ? fmtShortTime(getString(astro, 'sunrise')!) : null,
          sunset: getString(astro, 'sunset') ? fmtShortTime(getString(astro, 'sunset')!) : null,
          civilDawn: getString(astro, 'civilTwilightBegin') ? fmtShortTime(getString(astro, 'civilTwilightBegin')!) : null,
          civilDusk: getString(astro, 'civilTwilightEnd') ? fmtShortTime(getString(astro, 'civilTwilightEnd')!) : null
        }
      : null

    const hourly = hourlyPeriods.map(p => ({
      time: fmtTime(getString(p, 'startTime') ?? new Date().toISOString()),
      tempF: getNumber(p, 'temperature'),
      icon: forecastToIcon(getString(p, 'shortForecast') ?? '', getBoolean(p, 'isDaytime') ?? true),
      precipPct: toQV(p.probabilityOfPrecipitation).value ?? 0,
      humidity: toQV(p.relativeHumidity).value,
      wind: getString(p, 'windSpeed'),
      windDir: getString(p, 'windDirection'),
      short: getString(p, 'shortForecast')
    }))

    const extended = forecastPeriods.slice(0, 14).map(p => ({
      name: getString(p, 'name'),
      isDaytime: getBoolean(p, 'isDaytime'),
      tempF: getNumber(p, 'temperature'),
      icon: forecastToIcon(getString(p, 'shortForecast') ?? '', getBoolean(p, 'isDaytime') ?? true),
      wind: getString(p, 'windSpeed'),
      windDir: getString(p, 'windDirection'),
      short: getString(p, 'shortForecast'),
      detailed: getString(p, 'detailedForecast'),
      precipPct: toQV(p.probabilityOfPrecipitation).value ?? 0
    }))

    return createSuccessResponse({ current, sun, hourly, extended, alerts })
  } catch (error: unknown) {
    console.error('[Weather] Error:', error)
    return createErrorResponse(
      'FETCH_ERROR',
      getErrorMessage(error, 'Failed to fetch weather data')
    )
  }
})
