import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { defineHandler, HTTPError, type H3Event } from 'nitro/h3'

import { logger } from './logger'
import { verifyApiKey } from './services/apiKeyService'

export const authedHandler = <T = unknown>(
    handler: ({
        event,
        apiKeyRecord,
    }: {
        event: H3Event
        apiKeyRecord: NonNullable<Awaited<ReturnType<typeof verifyApiKey>>>
    }) => Promise<T> | T
) =>
    defineHandler(async (event) => {
        const authHeader = event.req.headers.get('authorization')?.trim()

        if (!authHeader?.startsWith('Bearer ')) {
            logger('eventHandler').warn('Missing or invalid Authorization header')
            throw new HTTPError({
                status: StatusCodes.UNAUTHORIZED,
                statusText: getReasonPhrase(StatusCodes.UNAUTHORIZED),
                message: 'Invalid API key',
            })
        }

        const rawApiKey = authHeader.slice('Bearer '.length).trim()
        const apiKeyRecord = await verifyApiKey(rawApiKey)

        if (!apiKeyRecord) {
            logger('eventHandler').warn('Unauthorized request with unknown API key prefix')
            throw new HTTPError({
                status: StatusCodes.UNAUTHORIZED,
                statusText: getReasonPhrase(StatusCodes.UNAUTHORIZED),
                message: 'Invalid API key',
            })
        }

        return await handler({ event, apiKeyRecord })
    })

export const adminHandler = <T = unknown>(
    handler: ({
        event,
        apiKeyRecord,
    }: {
        event: H3Event
        apiKeyRecord: NonNullable<Awaited<ReturnType<typeof verifyApiKey>>>
    }) => Promise<T> | T
) =>
    authedHandler(async ({ event, apiKeyRecord }) => {
        const permissionLevel = apiKeyRecord.user?.permissionLevel

        if (permissionLevel !== 'granted' && permissionLevel !== 'admin') {
            logger('eventHandler').warn('Authenticated user lacks permission to post messages', {
                userId: apiKeyRecord.userId,
            })
            throw new HTTPError({
                status: StatusCodes.FORBIDDEN,
                statusText: getReasonPhrase(StatusCodes.FORBIDDEN),
                message: 'Permission denied',
            })
        }

        return await handler({ event, apiKeyRecord })
    })
