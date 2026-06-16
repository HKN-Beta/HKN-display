// GET /api/jorgenel/display/announcements - Fetch announcements for display
import { defineEventHandler } from 'h3'
import {
  createSuccessResponse,
  createErrorResponse
} from '../../../utils/jorgenel/response-helpers'

interface AnnouncementData {
  title: string
  body: string
  date: string
  image: string
}

interface AnnouncementApiItem {
  id?: string | number
  image?: unknown
  title?: string
  body?: string
  expirydate?: string
  expirytime?: string
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

export default defineEventHandler(async (_event) => {
  try {
    const response = await fetch(
      'https://engineering.purdue.edu/hkn/announcements/?fetch=all'
    )

    if (!response.ok) {
      console.log(`Failed to fetch announcements. Response Data: ${await response.text()}`)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = asRecord(await response.json())

    const announcements: AnnouncementData[] = Object.values(data).map(
      (announcement) => {
        const item = announcement as AnnouncementApiItem
        const imageUrl = item.image
          ? `https://engineering.purdue.edu/hkn/announcements/?fetch=${item.id ?? ''}&img=1`
          : ''

        return {
          title: item.title ?? '',
          body: item.body ?? '',
          date: `${item.expirydate ?? ''} ${item.expirytime ?? ''}`.trim(),
          image: imageUrl
        }
      }
    )

    // Sort by date (newest first)
    announcements.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return createSuccessResponse(announcements)
  } catch (error: unknown) {
    console.error('Error fetching announcements:', error)

    return createErrorResponse(
      'FETCH_ERROR',
      getErrorMessage(error, 'Failed to fetch announcements')
    )
  }
})
