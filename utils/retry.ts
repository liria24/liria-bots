import retry from 'async-retry'
import { createConsola } from 'consola'

const logger = createConsola({ defaults: { tag: 'db-retry' } })

export interface RetryOptions {
    maxRetries?: number
    minTimeout?: number
    maxTimeout?: number
    factor?: number
    retryableErrors?: string[]
}

export const DEFAULT_RETRYABLE_ERRORS = [
    'ECONNREFUSED',
    'connect ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'EPIPE',
    'connection terminated unexpectedly',
    'Connection terminated',
    'server closed the connection unexpectedly',
    'SSL SYSCALL error',
]

export const isRetryableError = (
    error: unknown,
    retryableErrors: string[] = DEFAULT_RETRYABLE_ERRORS
): boolean => {
    if (!error) return false

    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode =
        error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : ''

    return retryableErrors.some(
        (retryableError) =>
            errorMessage.includes(retryableError) ||
            errorCode === retryableError
    )
}

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 5,
        minTimeout = 1000,
        maxTimeout = 30000,
        factor = 2,
        retryableErrors = DEFAULT_RETRYABLE_ERRORS,
    } = options

    return retry(
        async (bail, attemptNumber) => {
            try {
                return await fn()
            } catch (error) {
                // リトライ不可能なエラーの場合は即座に失敗
                if (!isRetryableError(error, retryableErrors)) {
                    logger.error(
                        {
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        },
                        'Non-retryable error encountered'
                    )
                    bail(error as Error)
                    return
                }

                logger.warn(
                    {
                        attempt: attemptNumber,
                        maxRetries,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    },
                    'Database connection failed, retrying...'
                )

                throw error
            }
        },
        {
            retries: maxRetries,
            minTimeout,
            maxTimeout,
            factor,
            onRetry: (error, attempt) => {
                logger.info(
                    {
                        attempt,
                        maxRetries,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    },
                    'Retrying database connection...'
                )
            },
        }
    )
}
