/**
 * General-purpose composable for making alias-scoped display API calls.
 */

interface ApiV2Response<T = unknown> {
  success: boolean
  data: T
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
  meta?: {
    timestamp: string
    version: string
  }
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

interface ApiV2Options {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: ApiBody
  query?: Record<string, unknown>
  headers?: Record<string, string>
}

type ApiBody = BodyInit | Record<string, unknown> | null

type ErrorLike = {
  data?: {
    error?: {
      message?: string
      code?: string
    }
    message?: string
  }
  statusCode?: number
  message?: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseError = (error: unknown): ErrorLike => {
  if (!isObject(error)) return {}
  const result: ErrorLike = {}

  if (typeof error.message === 'string') {
    result.message = error.message
  }
  if (typeof error.statusCode === 'number') {
    result.statusCode = error.statusCode
  }
  if (isObject(error.data)) {
    const data: ErrorLike['data'] = {}
    if (typeof error.data.message === 'string') {
      data.message = error.data.message
    }
    if (isObject(error.data.error)) {
      data.error = {}
      if (typeof error.data.error.message === 'string') {
        data.error.message = error.data.error.message
      }
      if (typeof error.data.error.code === 'string') {
        data.error.code = error.data.error.code
      }
    }
    result.data = data
  }

  return result
}

export const useApiV2 = () => {
  const toast = useToast()

  const baseURL = '/api/jorgenel/display'

  // Forward cookies on SSR so auth session is preserved
  const requestHeaders = useRequestHeaders(['cookie'])

  /**
   * Make an API call
   */
  const apiCall = async <T = unknown>(
    endpoint: string,
    options: ApiV2Options = {}
  ): Promise<ApiV2Response<T>> => {
    try {
      // Ensure endpoint starts with /
      const normalizedEndpoint = endpoint.startsWith('/')
        ? endpoint
        : `/${endpoint}`

      // Build full URL
      const fullURL = `${baseURL}${normalizedEndpoint}`

      const response = await $fetch<ApiV2Response<T>>(fullURL, {
        method: options.method || 'GET',
        body: options.body,
        query: options.query,
        headers: {
          ...requestHeaders,
          ...options.headers
        }
      })

      return response
    } catch (error: unknown) {
      console.error(`API call failed for ${endpoint}:`, error)
      const parsedError = parseError(error)

      // Extract error message from different error formats
      let errorMessage = 'An unexpected error occurred'
      let errorCode = 'UNKNOWN_ERROR'

      if (parsedError.data?.error?.message) {
        errorMessage = parsedError.data.error.message
        errorCode = parsedError.data.error.code || 'API_ERROR'
      } else if (parsedError.data?.message) {
        errorMessage = parsedError.data.message
        errorCode = parsedError.statusCode?.toString() || 'HTTP_ERROR'
      } else if (parsedError.message) {
        errorMessage = parsedError.message
        errorCode = 'NETWORK_ERROR'
      }

      // Return standardized error response
      return {
        success: false,
        data: null as T,
        error: {
          code: errorCode,
          message: errorMessage,
          details: parsedError.data || parsedError
        }
      }
    }
  }

  /**
   * Convenience methods for common HTTP operations
   */
  const get = <T = unknown>(endpoint: string, query?: Record<string, unknown>) =>
    apiCall<T>(endpoint, { method: 'GET', query })

  const post = <T = unknown>(endpoint: string, body?: ApiBody) =>
    apiCall<T>(endpoint, { method: 'POST', body })

  const put = <T = unknown>(endpoint: string, body?: ApiBody) =>
    apiCall<T>(endpoint, { method: 'PUT', body })

  const del = <T = unknown>(endpoint: string) =>
    apiCall<T>(endpoint, { method: 'DELETE' })

  const patch = <T = unknown>(endpoint: string, body?: ApiBody) =>
    apiCall<T>(endpoint, { method: 'PATCH', body })

  /**
   * Show error toast from API response
   */
  const handleApiError = (
    response: ApiV2Response,
    defaultMessage = 'Operation failed'
  ) => {
    if (response.error) {
      toast.add({
        title: 'Error',
        description: response.error.message || defaultMessage,
        color: 'error'
      })
    }
  }

  /**
   * Show success toast
   */
  const showSuccess = (message: string, title = 'Success') => {
    toast.add({
      title,
      description: message,
      color: 'success'
    })
  }

  return {
    apiCall,
    get,
    post,
    put,
    del,
    patch,
    handleApiError,
    showSuccess
  }
}
