import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { useRequest } from 'nitro/context'
import {
    getValidatedQuery,
    getValidatedRouterParams,
    HTTPError,
    readValidatedBody,
    H3Event,
} from 'nitro/h3'
import type { z } from 'zod'

import { logger } from './logger'
import sanitizeObject from './sanitizeObject'

const throwIfFailed = <T>(
    tag: string,
    result: z.ZodSafeParseSuccess<T> | z.ZodSafeParseError<unknown>
): T => {
    if (!result.success) {
        if (import.meta.dev) logger(tag).error(result.error)
        throw new HTTPError({
            status: StatusCodes.BAD_REQUEST,
            statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
            message: 'Validation Error',
        })
    }
    return result.data
}

export const validateBody = async <T extends z.ZodTypeAny>(
    s: T,
    o?: { sanitize?: boolean }
): Promise<z.infer<T>> =>
    throwIfFailed(
        'validateBody',
        await readValidatedBody(new H3Event(useRequest()), (b) =>
            s.safeParse(o?.sanitize ? sanitizeObject(b) : b)
        )
    )

export const validateParams = async <T extends z.ZodTypeAny>(s: T): Promise<z.infer<T>> =>
    throwIfFailed(
        'validateParams',
        await getValidatedRouterParams(new H3Event(useRequest()), (p) => s.safeParse(p))
    )

export const validateQuery = async <T extends z.ZodTypeAny>(s: T): Promise<z.infer<T>> =>
    throwIfFailed(
        'validateQuery',
        await getValidatedQuery(new H3Event(useRequest()), (q) => s.safeParse(q))
    )
