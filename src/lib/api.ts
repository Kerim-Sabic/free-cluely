/**
 * Horalix Halo - API Client Utility
 *
 * Centralized API client for consistent error handling, logging, and auth.
 * Eliminates code duplication across components and contexts.
 */

import { createLogger } from './logger'

const logger = createLogger('ApiClient')

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ============================================================================
// TYPES
// ============================================================================

interface ApiRequestOptions extends RequestInit {
  token?: string | null
  skipAuth?: boolean
}

interface ApiError extends Error {
  status?: number
  data?: any
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Create a standardized API error
 */
function createApiError(status: number, message: string, data?: any): ApiError {
  const error = new Error(message) as ApiError
  error.status = status
  error.data = data
  return error
}

/**
 * Handle API response and extract data
 */
async function handleResponse<T>(response: Response): Promise<T> {
  // Handle different status codes
  if (response.status === 401) {
    throw createApiError(401, 'Authentication required. Please log in.')
  }

  if (response.status === 403) {
    throw createApiError(403, 'Access denied. You do not have permission.')
  }

  if (response.status === 404) {
    throw createApiError(404, 'Resource not found.')
  }

  if (response.status === 429) {
    throw createApiError(429, 'Too many requests. Please try again later.')
  }

  if (response.status >= 500) {
    throw createApiError(response.status, 'Server error. Please try again later.')
  }

  if (!response.ok) {
    let errorMessage = `API error: ${response.statusText}`
    let errorData: any

    try {
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
      } else {
        errorMessage = await response.text() || errorMessage
      }
    } catch {
      // If parsing fails, use default message
    }

    throw createApiError(response.status, errorMessage, errorData)
  }

  // Parse successful response
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return response.json()
  }

  // Return empty object for 204 No Content
  if (response.status === 204) {
    return {} as T
  }

  return response.text() as any
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Make an authenticated API request
 */
async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { token, skipAuth, ...fetchOptions } = options

  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  // Add auth token if provided and not skipped
  if (token && !skipAuth) {
    headers.Authorization = `Bearer ${token}`
  }

  // Build full URL
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

  // Log request in development
  logger.debug(`${fetchOptions.method || 'GET'} ${endpoint}`)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    })

    const data = await handleResponse<T>(response)

    logger.debug(`${fetchOptions.method || 'GET'} ${endpoint} - Success`)

    return data
  } catch (error) {
    if (error instanceof Error) {
      const apiError = error as ApiError
      logger.error(
        `${fetchOptions.method || 'GET'} ${endpoint} - Failed`,
        error,
        { status: apiError.status }
      )
    }
    throw error
  }
}

// ============================================================================
// CONVENIENCE METHODS
// ============================================================================

/**
 * GET request
 */
export async function apiGet<T = any>(
  endpoint: string,
  token?: string | null,
  options?: Omit<ApiRequestOptions, 'method' | 'token'>
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'GET',
    token,
  })
}

/**
 * POST request
 */
export async function apiPost<T = any>(
  endpoint: string,
  data: any,
  token?: string | null,
  options?: Omit<ApiRequestOptions, 'method' | 'token' | 'body'>
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    token,
    body: JSON.stringify(data),
  })
}

/**
 * PUT request
 */
export async function apiPut<T = any>(
  endpoint: string,
  data: any,
  token?: string | null,
  options?: Omit<ApiRequestOptions, 'method' | 'token' | 'body'>
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    token,
    body: JSON.stringify(data),
  })
}

/**
 * DELETE request
 */
export async function apiDelete<T = any>(
  endpoint: string,
  token?: string | null,
  options?: Omit<ApiRequestOptions, 'method' | 'token'>
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'DELETE',
    token,
  })
}

/**
 * PATCH request
 */
export async function apiPatch<T = any>(
  endpoint: string,
  data: any,
  token?: string | null,
  options?: Omit<ApiRequestOptions, 'method' | 'token' | 'body'>
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  })
}

// ============================================================================
// EXPORTS
// ============================================================================

export const api = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
  patch: apiPatch,
  baseUrl: API_BASE_URL,
}

export default api
