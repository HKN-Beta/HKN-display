// Response standardization utilities for API v2

// Type definitions (not auto-imported)
interface SuccessResponse<T = unknown> {
  success: true
  data: T
  meta: {
    timestamp: string
    version: string
  }
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
  meta: {
    timestamp: string
    version: string
  }
}

type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse

/**
 * Create a standardized success response
 */
function createSuccessResponse<T>(
  data: T,
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
): SuccessResponse<T> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
  }

  if (pagination) {
    response.pagination = pagination
  }

  return response
}

/**
 * Create a standardized error response
 */
function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
  }
}

/**
 * Common error responses
 */
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED'
} as const

/**
 * HTTP status codes for common responses
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
} as const

function createValidationError(details?: unknown) {
  return createErrorResponse(
    ErrorCodes.VALIDATION_ERROR,
    'Invalid request parameters',
    details
  )
}

function createUnauthorizedError() {
  return createErrorResponse(
    ErrorCodes.UNAUTHORIZED,
    'Authentication required'
  )
}

function createForbiddenError() {
  return createErrorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions')
}

function createNotFoundError(resource: string = 'Resource') {
  return createErrorResponse(ErrorCodes.NOT_FOUND, `${resource} not found`)
}

function createConflictError(message: string = 'Request conflict') {
  return createErrorResponse(ErrorCodes.CONFLICT, message)
}

function createInternalError(message: string = 'Internal server error') {
  return createErrorResponse(ErrorCodes.INTERNAL_ERROR, message)
}

// Consolidated exports for auto-import compatibility
export {
  createSuccessResponse,
  createErrorResponse,
  ErrorCodes,
  HTTP_STATUS,
  createValidationError,
  createUnauthorizedError,
  createForbiddenError,
  createNotFoundError,
  createConflictError,
  createInternalError,
  type ApiResponse,
  type SuccessResponse,
  type ErrorResponse
}
