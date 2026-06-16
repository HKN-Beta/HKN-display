// POST /api/jorgenel/display/citybus/trips - Fetch trip updates for a specific stop
import { defineEventHandler, readBody } from 'h3'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationError
} from '../../../../utils/jorgenel/response-helpers'

const GTFS_TRIP_UPDATES_URL
  = 'https://bus.gocitybus.com/GTFSRT/GTFS_TripUpdates.pb'
const DEFAULT_STOP_CODE = 'BUS538'

interface GroupedTrips {
  [routeId: string]: string[]
}

interface TripResult {
  routeId: string
  arrivalMessages: string[]
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
    const feed = await fetchGtfsRealtimeFeed(GTFS_TRIP_UPDATES_URL)

    // Group arrival times by route
    const groupedTrips = groupArrivalTimes(feed, stopCode)

    // Sort and format results
    const results: TripResult[] = Object.entries(groupedTrips)
      .sort(([routeIdA], [routeIdB]) => {
        const [numA, alphaA] = sortRouteIds(routeIdA)
        const [numB, alphaB] = sortRouteIds(routeIdB)
        return numA - numB || alphaA.localeCompare(alphaB)
      })
      .map(([routeId, arrivalTimes]) => {
        const now = new Date()
        const futureArrivalTimes = arrivalTimes
          .map(time => new Date(time))
          .filter(arrivalDate => arrivalDate >= now)

        // Get the next two arrival times
        const nextTwoTimes = futureArrivalTimes
          .sort((a, b) => a.getTime() - b.getTime())
          .slice(0, 2)

        const arrivalMessages = nextTwoTimes.map(time =>
          timeLeftUntilNextBus(time)
        )

        return { routeId, arrivalMessages }
      })

    return createSuccessResponse(results)
  } catch (error: unknown) {
    console.error('Error fetching trip updates:', error)

    return createErrorResponse(
      'FETCH_ERROR',
      getErrorMessage(error, 'Failed to fetch trip updates')
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
 * Group arrival times by route ID for a specific stop
 */
function groupArrivalTimes(
  feed: GtfsRealtimeBindings.transit_realtime.FeedMessage,
  desiredStopCode: string
): GroupedTrips {
  const groupedTrips: GroupedTrips = {}

  feed.entity.forEach(
    (entity: GtfsRealtimeBindings.transit_realtime.IFeedEntity) => {
      if (entity.tripUpdate) {
        const tripUpdate = entity.tripUpdate

        tripUpdate.stopTimeUpdate?.forEach((stopTimeUpdate) => {
          if (stopTimeUpdate.stopId === desiredStopCode) {
            const routeId = tripUpdate.trip.routeId

            if (!routeId) return

            // Handle arrival time which can be a number or Long
            const arrivalTimeInSeconds
              = typeof stopTimeUpdate.arrival?.time === 'number'
                ? stopTimeUpdate.arrival.time
                : stopTimeUpdate.arrival?.time?.toNumber()

            if (!arrivalTimeInSeconds) return

            const arrivalTime = new Date(arrivalTimeInSeconds * 1000)
            const formattedArrivalTime = arrivalTime.toISOString()

            if (!groupedTrips[routeId]) {
              groupedTrips[routeId] = []
            }
            groupedTrips[routeId].push(formattedArrivalTime)
          }
        })
      }
    }
  )

  return groupedTrips
}

/**
 * Sort route IDs by numeric and alphabetic components
 */
function sortRouteIds(routeId: string): [number, string] {
  const match = routeId.match(/(\d+)([A-Za-z]*)/)
  return match ? [parseInt(match[1] ?? '0'), match[2] ?? ''] : [0, '']
}

/**
 * Calculate time left until the next bus
 */
function timeLeftUntilNextBus(arrivalTime: Date): string {
  const now = new Date()
  const diffInMinutes = Math.floor(
    (arrivalTime.getTime() - now.getTime()) / 60000
  )

  if (diffInMinutes > 60) return '60+ min'
  if (diffInMinutes > 0) return `${diffInMinutes} min`
  return 'Arr'
}
