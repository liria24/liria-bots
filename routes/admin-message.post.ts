import type { APIEmbed, MessageCreateOptions } from 'discord.js'
import { defineHandler, HTTPError } from 'nitro/h3'
import { z } from 'zod'
import { getDiscordBotController } from '../utils/discord/bot'
import { markApiKeyUsed, verifyApiKey } from '../utils/services/apiKeyService'
import { listUsersByPermission } from '../utils/services/userService'
import { validateBody } from '../utils/validateRequest'

const embedFieldSchema = z.object({
    name: z.string(),
    value: z.string(),
    inline: z.boolean().optional(),
})

const embedImageSchema = z
    .object({
        url: z.url(),
    })
    .optional()

const embedAuthorSchema = z
    .object({
        name: z.string(),
        url: z.url().optional(),
        icon_url: z.url().optional(),
    })
    .optional()

const embedFooterSchema = z
    .object({
        text: z.string(),
        icon_url: z.url().optional(),
    })
    .optional()

const embedSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    color: z.number().int().min(0).max(0xffffff).optional(),
    url: z.url().optional(),
    timestamp: z.iso.datetime().optional(),
    thumbnail: embedImageSchema,
    image: embedImageSchema,
    author: embedAuthorSchema,
    fields: z.array(embedFieldSchema).max(25).optional(),
    footer: embedFooterSchema,
})

const adminMessageBodySchema = z
    .object({
        content: z.string().optional(),
        embeds: z.array(embedSchema).max(10).optional(),
    })
    .refine(
        (data) => {
            const hasContent = typeof data.content === 'string' && data.content.trim().length > 0
            const hasEmbeds = Array.isArray(data.embeds) && data.embeds.length > 0
            return hasContent || hasEmbeds
        },
        {
            message: 'Either content or embeds must be provided',
        }
    )

export default defineHandler(async (event) => {
    const headers = Object.fromEntries(event.req.headers.entries())
    const authHeader = headers.authorization?.trim()

    if (!authHeader?.startsWith('Bearer ')) {
        console.warn('Missing or invalid Authorization header')
        throw new HTTPError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
            message: 'Invalid API key',
        })
    }

    const rawApiKey = authHeader.slice('Bearer '.length).trim()
    const apiKeyRecord = await verifyApiKey(rawApiKey)

    if (!apiKeyRecord) {
        console.warn('Unauthorized request with unknown API key prefix')
        throw new HTTPError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
            message: 'Invalid API key',
        })
    }

    const permissionLevel = apiKeyRecord.user?.permissionLevel

    if (permissionLevel !== 'granted' && permissionLevel !== 'admin') {
        console.warn('Authenticated user lacks permission to post messages', {
            userId: apiKeyRecord.userId,
        })
        throw new HTTPError({
            statusCode: 403,
            statusMessage: 'Forbidden',
            message: 'Permission denied',
        })
    }

    const { content, embeds } = await validateBody(event, adminMessageBodySchema, {
        sanitize: true,
    })
    const trimmedContent = content?.trim()

    const controller = getDiscordBotController()

    if (!controller) {
        console.error('Discord bot controller is not available')
        throw new HTTPError({
            statusCode: 503,
            statusMessage: 'Service Unavailable',
            message: 'Discord bot is not running',
        })
    }

    if (!controller.isReady()) {
        console.warn('Discord bot client is not ready to send messages')
        throw new HTTPError({
            statusCode: 503,
            statusMessage: 'Service Unavailable',
            message: 'Discord bot is not ready yet',
        })
    }

    const client = controller.client

    try {
        // admin権限を持つユーザーを取得し、DM受信をオプトアウトしていないユーザーのみフィルタリング
        const allAdminUsers = await listUsersByPermission('admin')
        const adminUsers = allAdminUsers.filter((user) => !user.adminDmOptOut)

        if (!adminUsers || adminUsers.length === 0) {
            console.warn('No admin users found to send DM (or all opted out)')
            return {
                status: 'skipped',
                reason: 'No admin users available (all may have opted out)',
            }
        }

        const messageOptions: MessageCreateOptions = {}
        if (trimmedContent) messageOptions.content = trimmedContent
        if (embeds) messageOptions.embeds = embeds as APIEmbed[]

        const results = {
            sent: 0,
            failed: 0,
            errors: [] as string[],
        }

        // 各adminユーザーにDMを送信
        for (const admin of adminUsers) {
            try {
                const user = await client.users.fetch(admin.id)
                await user.send(messageOptions)
                results.sent++
            } catch (error) {
                console.error(`Failed to send DM to admin user ${admin.id}:`, error)
                results.failed++
                results.errors.push(`User ${admin.username || admin.id}: ${error}`)
            }
        }

        await markApiKeyUsed(apiKeyRecord.id)

        if (results.sent === 0) {
            throw new HTTPError({
                statusCode: 502,
                statusMessage: 'Bad Gateway',
                message: 'Failed to deliver message to any admin users',
                data: results,
            })
        }

        return {
            status: 'ok',
            sent: results.sent,
            failed: results.failed,
            ...(results.failed > 0 && { errors: results.errors }),
        }
    } catch (error) {
        console.error('Failed to deliver admin message to Discord', error)
        throw new HTTPError({
            statusCode: 502,
            statusMessage: 'Bad Gateway',
            message: 'Failed to deliver message to Discord',
            cause: error,
        })
    }
})
