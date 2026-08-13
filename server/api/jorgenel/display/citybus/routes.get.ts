// GET /api/jorgenel/display/citybus/routes - Fetch CityBus route information
import { defineEventHandler } from 'h3'
import AdmZip from 'adm-zip'
import { Buffer } from 'buffer'
import {
  createSuccessResponse,
  createErrorResponse
} from '../../../../utils/jorgenel/response-helpers'

const GTFS_URL = 'https://bus.gocitybus.com/GTFSRT/citybus-lafayette-in-us.zip'

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

const parseCsvLine = (line: string): string[] => {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
      continue
    }

    current += ch
  }

  fields.push(current)
  return fields
}

const parseCsvWithHeader = (
  csvText: string
): Array<Record<string, string>> => {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)

  if (lines.length === 0) return []

  const headers = parseCsvLine(lines[0] ?? '')
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row: Record<string, string> = {}

    headers.forEach((header, index) => {
      row[header] = cells[index] ?? ''
    })

    return row
  })
}

let routesCache: { data: Array<Record<string, string>>, ts: number } | null = null
const ROUTES_CACHE_TTL = 60 * 60 * 1000 // 1 hour

export default defineEventHandler(async (_event) => {
  try {
    if (routesCache && Date.now() - routesCache.ts < ROUTES_CACHE_TTL) {
      return createSuccessResponse(routesCache.data)
    }

    // Fetch the GTFS ZIP file
    const response = await fetch(GTFS_URL)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Read the response as an ArrayBuffer
    const arrayBuffer = await response.arrayBuffer()

    // Create an instance of AdmZip with the fetched data
    const zip = new AdmZip(Buffer.from(arrayBuffer))

    // Get all entries in the zip
    const zipEntries = zip.getEntries()

    // Find and read the routes.txt file
    const routesEntry = zipEntries.find(
      entry => entry.entryName === 'routes.txt'
    )

    if (!routesEntry) {
      throw new Error('routes.txt not found in the ZIP file')
    }

    const content = zip.readAsText(routesEntry)
    const parsedData = parseCsvWithHeader(content)

    routesCache = { data: parsedData, ts: Date.now() }
    return createSuccessResponse(parsedData)
  } catch (error: unknown) {
    console.error('Error fetching CityBus routes:', error)

    if (routesCache) {
      return createSuccessResponse(routesCache.data)
    }

    return createErrorResponse(
      'FETCH_ERROR',
      getErrorMessage(error, 'Failed to fetch CityBus routes')
    )
  }
})
