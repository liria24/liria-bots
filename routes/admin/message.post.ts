import type { APIEmbed, MessageCreateOptions } from 'discord.js'
import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { HTTPError } from 'nitro/h3'
import { z } from 'zod'

import { getDiscordBotController } from '../../utils/discord/bot'
import { adminHandler } from '../../utils/eventHandler'
import { logger } from '../../utils/logger'
import { markApiKeyUsed } from '../../utils/services/apiKeyService'
import { listUsersByPermission } from '../../utils/services/userService'
import { validateBody } from '../../utils/validateRequest'

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

export default adminHandler(async ({ apiKeyRecord }) => {
    const { content, embeds } = await validateBody(adminMessageBodySchema, { sanitize: true })
    const trimmedContent = content?.trim()

    const controller = getDiscordBotController()

    if (!controller) {
        logger('adminMessage').error('Discord bot controller is not available')
        throw new HTTPError({
            status: StatusCodes.SERVICE_UNAVAILABLE,
            statusText: getReasonPhrase(StatusCodes.SERVICE_UNAVAILABLE),
            message: 'Discord bot is not running',
        })
    }

    if (!controller.isReady()) {
        logger('adminMessage').warn('Discord bot client is not ready to send messages')
        throw new HTTPError({
            status: StatusCodes.SERVICE_UNAVAILABLE,
            statusText: getReasonPhrase(StatusCodes.SERVICE_UNAVAILABLE),
            message: 'Discord bot is not ready yet',
        })
    }

    const client = controller.client

    try {
        // admin権限を持つユーザーを取得し、DM受信をオプトアウトしていないユーザーのみフィルタリング
        const allAdminUsers = await listUsersByPermission('admin')
        const adminUsers = allAdminUsers.filter((user) => !user.adminDmOptOut)

        if (!adminUsers || adminUsers.length === 0) {
            logger('adminMessage').warn('No admin users found to send DM (or all opted out)')
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
                logger('adminMessage').error(`Failed to send DM to admin user ${admin.id}:`, error)
                results.failed++
                results.errors.push(`User ${admin.username || admin.id}: ${error}`)
            }
        }

        await markApiKeyUsed(apiKeyRecord.id)

        if (results.sent === 0) {
            throw new HTTPError({
                status: StatusCodes.BAD_REQUEST,
                statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
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
        logger('adminMessage').error('Failed to deliver admin message to Discord', error)
        throw new HTTPError({
            status: StatusCodes.BAD_REQUEST,
            statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
            message: 'Failed to deliver message to Discord',
            cause: error,
        })
    }
})
