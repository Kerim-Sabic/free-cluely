/**
 * Horalix Halo Backend - Structured Logging Utility
 *
 * Professional logging with context, levels, and formatting.
 * Production-ready with support for external logging services.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogMetadata {
  [key: string]: any
}

/**
 * Logger class with contextual logging
 */
export class Logger {
  private context: string
  private isDevelopment: boolean

  constructor(context: string) {
    this.context = context
    this.isDevelopment = process.env.NODE_ENV !== 'production'
  }

  /**
   * Format log message with timestamp, level, and context
   */
  private format(level: LogLevel, message: string, meta?: LogMetadata): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] ${level} [${this.context}] ${message}${metaStr}`
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, meta?: LogMetadata): void {
    if (this.isDevelopment) {
      console.log(this.format(LogLevel.DEBUG, message, meta))
    }
  }

  /**
   * Log info message
   */
  info(message: string, meta?: LogMetadata): void {
    console.log(this.format(LogLevel.INFO, message, meta))
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: LogMetadata): void {
    console.warn(this.format(LogLevel.WARN, message, meta))
  }

  /**
   * Log error message with full error details
   */
  error(message: string, error?: Error | unknown, meta?: LogMetadata): void {
    const errorMeta = {
      ...meta,
      ...(error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: this.isDevelopment ? error.stack : undefined, // Hide stack traces in production logs
          }
        : { error: String(error) }),
    }
    console.error(this.format(LogLevel.ERROR, message, errorMeta))
  }

  /**
   * Log HTTP request (useful for API debugging)
   */
  request(method: string, path: string, meta?: LogMetadata): void {
    this.debug(`${method} ${path}`, meta)
  }

  /**
   * Log successful operation
   */
  success(message: string, meta?: LogMetadata): void {
    this.info(`✓ ${message}`, meta)
  }
}

/**
 * Create a logger instance for a specific context
 *
 * @example
 * const logger = createLogger('AuthService')
 * logger.info('User created', { userId: '123', email: 'user@example.com' })
 * logger.error('Database error', error)
 */
export function createLogger(context: string): Logger {
  return new Logger(context)
}

// Export a default logger for quick use
export const logger = createLogger('Backend')
