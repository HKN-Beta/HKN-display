// POST /api/jorgenel/display/citybus/alerts - Fetch service alerts for a specific stop
import { defineEventHandler, readBody } from 'h3'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationError
} from '../../../../utils/jorgenel/response-helpers'

const GTFS_ALERTS_URL
  = 'https://bus.gocitybus.com/GTFSRT/GTFS_ServiceAlerts.pb'
const DEFAULT_STOP_CODE = 'BUS538'

interface GroupedAlerts {
  [routeId: string]: number
}

interface AlertResult {
  routeId: string
  severityLevel: number
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch((): unknown => ({}))
    const stopCode = (
      typeof body === 'object'
      && body !== null
      && 'stopCode' in body
      && typeof body.stopCode === 'string'
    )
      ? body.stopCode
      : DEFAULT_STOP_CODE

    // Validate stopCode format (basic validation)
    if (typeof stopCode !== 'string' || stopCode.trim().length === 0) {
      return createValidationError({ stopCode: 'Invalid stop code format' })
    }

    // Fetch GTFS-realtime feed
    const feed = await fetchGtfsRealtimeFeed(GTFS_ALERTS_URL)

    // Get max alert severity for the stop
    const groupedAlerts = getMaxAlertSeverity(feed, stopCode)

    // Sort and format results
    const results: AlertResult[] = Object.entries(groupedAlerts)
      .sort(([routeIdA], [routeIdB]) => {
        const [numA, alphaA] = sortRouteIds(routeIdA)
        const [numB, alphaB] = sortRouteIds(routeIdB)
        return numA - numB || alphaA.localeCompare(alphaB)
      })
      .map(([routeId, severityLevel]) => ({
        routeId,
        severityLevel
      }))

    return createSuccessResponse(results)
  } catch (error: unknown) {
    console.error('Error fetching service alerts:', error)

    return createErrorResponse(
      'FETCH_ERROR',
      getErrorMessage(error, 'Failed to fetch service alerts')
    )
  }
})

/**
 * Fetch GTFS-realtime feed from URL
 */
async function fetchGtfsRealtimeFeed(
  url: string
): Promise<GtfsRealtimeBindings.transit_realtime.FeedMessage> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `${response.url}: ${response.status} ${response.statusText}`
    )
  }

  const buffer = await response.arrayBuffer()
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer)
  )

  return feed
}

/**
 * Get maximum alert severity for each route at a specific stop
 */
function getMaxAlertSeverity(
  feed: GtfsRealtimeBindings.transit_realtime.FeedMessage,
  stopCode: string
): GroupedAlerts {
  const groupedAlerts: GroupedAlerts = {}

  feed.entity.forEach(
    (entity: GtfsRealtimeBindings.transit_realtime.IFeedEntity) => {
      if (entity.alert) {
        const routeAlert = entity.alert

        routeAlert.informedEntity?.forEach((informedEntity) => {
          const routeId = informedEntity.routeId

          if (informedEntity.stopId === stopCode && routeId) {
            if (!groupedAlerts[routeId]) {
              groupedAlerts[routeId] = 1
            }

            if (
              routeAlert.severityLevel
              && routeAlert.severityLevel > groupedAlerts[routeId]
            ) {
              groupedAlerts[routeId] = routeAlert.severityLevel
            }
          }
        })
      }
    }
  )

  return groupedAlerts
}

/**
 * Sort route IDs by numeric and alphabetic components
 */
function sortRouteIds(routeId: string): [number, string] {
  const match = routeId.match(/(\d+)([A-Za-z]*)/)
  return match ? [parseInt(match[1] ?? '0'), match[2] ?? ''] : [0, '']
}
