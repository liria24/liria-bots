import type { APIEmbed, MessageCreateOptions } from 'discord.js'

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

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig(event)

    if (!config.liria.discordChannelId)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: 'Discord channel ID is not configured',
        })

    const headers = getRequestHeaders(event)
    const authHeader = headers.authorization?.trim()

    if (!authHeader?.startsWith('Bearer ')) {
        console.warn('Missing or invalid Authorization header')
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
            message: 'Invalid API key',
        })
    }

    const rawApiKey = authHeader.slice('Bearer '.length).trim()
    const apiKeyRecord = await verifyApiKey(rawApiKey)

    if (!apiKeyRecord) {
        console.warn('Unauthorized request with unknown API key prefix')
        throw createError({
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
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden',
            message: 'Permission denied',
        })
    }

    const { content, embeds } = await validateBody(adminMessageBodySchema, {
        sanitize: true,
    })
    const trimmedContent = content?.trim()

    const controller = getDiscordBotController()

    if (!controller) {
        console.error('Discord bot controller is not available')
        throw createError({
            statusCode: 503,
            statusMessage: 'Service Unavailable',
            message: 'Discord bot is not running',
        })
    }

    if (!controller.isReady()) {
        console.warn('Discord bot client is not ready to send messages')
        throw createError({
            statusCode: 503,
            statusMessage: 'Service Unavailable',
            message: 'Discord bot is not ready yet',
        })
    }

    const client = controller.client

    try {
        const channel = await client.channels.fetch(config.liria.discordChannelId)

        if (!channel || !channel.isSendable()) {
            console.warn('Configured channel is not sendable:', config.liria.discordChannelId)
            return { status: 'skipped' }
        }

        const messageOptions: MessageCreateOptions = {}
        if (trimmedContent) messageOptions.content = trimmedContent
        if (embeds) messageOptions.embeds = embeds as APIEmbed[]

        await channel.send(messageOptions)
        await markApiKeyUsed(apiKeyRecord.id)
    } catch (error) {
        console.error('Failed to deliver admin message to Discord', error)
        throw createError({
            statusCode: 502,
            statusMessage: 'Bad Gateway',
            message: 'Failed to deliver message to Discord',
            cause: error,
        })
    }

    return { status: 'ok' }
})
