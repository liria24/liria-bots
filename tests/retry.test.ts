import { describe, expect, test } from 'bun:test'
import {
    isRetryableError,
    retryWithBackoff,
    type RetryOptions,
} from '../utils/retry'

describe('retry utilities', () => {
    test('detects connect ECONNREFUSED in error message as retryable', () => {
        const error = new Error('connect ECONNREFUSED 127.0.0.1:5432')
        expect(isRetryableError(error)).toBe(true)
    })

    test('retries async operation until success for retryable error', async () => {
        let attempts = 0
        const options: RetryOptions = {
            maxRetries: 5,
            minTimeout: 5,
            maxTimeout: 20,
            factor: 1.2,
        }

        const result = await retryWithBackoff(async () => {
            attempts += 1
            if (attempts < 3) {
                const error = new Error(
                    'connect ECONNREFUSED 127.0.0.1:5432 during cold start'
                )
                throw error
            }

            return 'ok'
        }, options)

        expect(result).toBe('ok')
        expect(attempts).toBe(3)
    })

    test('bails immediately on non-retryable errors', async () => {
        let attempts = 0

        await expect(
            retryWithBackoff(async () => {
                attempts += 1
                throw new Error('syntax error at or near "SELECT"')
            })
        ).rejects.toThrow('syntax error at or near "SELECT"')

        expect(attempts).toBe(1)
    })
})
