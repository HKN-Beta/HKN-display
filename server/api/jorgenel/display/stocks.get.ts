// GET /api/jorgenel/display/stocks — top market movers for the display ticker
import { defineEventHandler } from 'h3'
import {
  createSuccessResponse,
  createErrorResponse
} from '../../../utils/jorgenel/response-helpers'

// Top 10 tickers: major indices + mega-caps
const TICKERS = [
  '^GSPC', // S&P 500
  '^DJI', // Dow Jones
  '^IXIC', // NASDAQ Composite
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'NVDA',
  'TSLA',
  'META'
]

const DISPLAY_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^DJI': 'DOW',
  '^IXIC': 'NASDAQ'
}

const UA
  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

interface StockQuote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketState: string
}

interface YahooQuote {
  symbol?: string
  shortName?: string
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  marketState?: string
}

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: YahooQuote[]
  }
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

// ── Yahoo Finance auth (crumb + cookie) ─────────────────────────
// Yahoo now requires a consent cookie + crumb token for all v7/v8 API calls.
// Flow: GET fc.yahoo.com → extract Set-Cookie → GET getcrumb → use both.
let authCache: { cookie: string, crumb: string, ts: number } | null = null
const AUTH_TTL = 30 * 60_000 // refresh auth every 30 min

async function getYahooAuth(): Promise<{ cookie: string, crumb: string }> {
  if (authCache && Date.now() - authCache.ts < AUTH_TTL) {
    return { cookie: authCache.cookie, crumb: authCache.crumb }
  }

  // Step 1: Hit fc.yahoo.com to obtain a consent cookie
  const cookieRes = await fetch('https://fc.yahoo.com/', {
    headers: { 'User-Agent': UA },
    redirect: 'manual'
  })
  // Extract Set-Cookie — we need the entire header value(s)
  const rawCookies = cookieRes.headers.getSetCookie?.() ?? []
  // Fall back for environments where getSetCookie isn't available
  const cookieHeader
    = rawCookies.length > 0
      ? rawCookies.map((c: string) => c.split(';')[0]).join('; ')
      : cookieRes.headers.get('set-cookie')?.split(';')[0] ?? ''

  if (!cookieHeader) {
    throw new Error('Failed to obtain Yahoo consent cookie')
  }

  // Step 2: Use the cookie to fetch a crumb
  const crumbRes = await fetch(
    'https://query2.finance.yahoo.com/v1/test/getcrumb',
    {
      headers: {
        'User-Agent': UA,
        'Cookie': cookieHeader
      }
    }
  )

  if (!crumbRes.ok) {
    throw new Error(`Crumb request failed: ${crumbRes.status}`)
  }

  const crumb = await crumbRes.text()
  if (!crumb || crumb.length > 50) {
    throw new Error('Invalid crumb response')
  }

  authCache = { cookie: cookieHeader, crumb, ts: Date.now() }
  return { cookie: cookieHeader, crumb }
}

// ── Data cache ──────────────────────────────────────────────────
let cache: { data: StockQuote[], ts: number } | null = null
const CACHE_TTL = 60_000

export default defineEventHandler(async () => {
  try {
    // Return cached data if fresh
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return createSuccessResponse(cache.data)
    }

    const { cookie, crumb } = await getYahooAuth()

    const symbols = TICKERS.join(',')
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}&fields=symbol,shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,marketState`

    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Cookie': cookie
      }
    })

    if (!res.ok) {
      // Invalidate auth cache on 401 so next request re-auths
      if (res.status === 401 || res.status === 403) {
        authCache = null
      }
      throw new Error(`Yahoo Finance API returned ${res.status}`)
    }

    const json = await res.json() as YahooQuoteResponse
    const results = json.quoteResponse?.result ?? []

    const quotes: StockQuote[] = results.map((q) => {
      const symbol = q.symbol ?? ''
      return {
        symbol: DISPLAY_NAMES[symbol] ?? symbol,
        name: q.shortName ?? symbol,
        price: Math.round((q.regularMarketPrice ?? 0) * 100) / 100,
        change: Math.round((q.regularMarketChange ?? 0) * 100) / 100,
        changePercent:
          Math.round((q.regularMarketChangePercent ?? 0) * 100) / 100,
        marketState: q.marketState ?? 'CLOSED'
      }
    })

    cache = { data: quotes, ts: Date.now() }
    return createSuccessResponse(quotes)
  } catch (error: unknown) {
    console.error('[Stocks] Error:', error)
    // Return stale cache if available
    if (cache) {
      return createSuccessResponse(cache.data)
    }
    return createErrorResponse(
      'FETCH_ERROR',
      getErrorMessage(error, 'Failed to fetch stock data')
    )
  }
})
