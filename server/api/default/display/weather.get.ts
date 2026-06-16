import { createError, defineEventHandler, getQuery } from 'h3'

interface OpenMeteoResponse {
  current_weather?: {
    temperature: number
    weathercode: number
    time: string
  }
}

const FALLBACK_LOCATION = '42.44,-76.5'

const parseLocation = (location: string): { lat: number, lon: number } | null => {
  const [latRaw, lonRaw] = location.split(',').map(part => part.trim())
  const lat = Number(latRaw)
  const lon = Number(lonRaw)

  if (Number.isNaN(lat) || Number.isNaN(lon)) return null
  if (lat < -90 || lat > 90) return null
  if (lon < -180 || lon > 180) return null

  return { lat, lon }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const location = typeof query.location === 'string' && query.location.length > 0
    ? query.location
    : FALLBACK_LOCATION

  const coords = parseLocation(location)
  if (!coords) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid location. Use "lat,lon" (example: 42.44,-76.5).'
    })
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&temperature_unit=celsius`
  const payload = await $fetch<OpenMeteoResponse>(weatherUrl)

  return {
    current: {
      temperatureC: payload.current_weather?.temperature ?? null,
      weatherCode: payload.current_weather?.weathercode ?? null,
      observedAt: payload.current_weather?.time ?? null,
      location
    },
    request: {
      latitude: coords.lat,
      longitude: coords.lon
    }
  }
})
