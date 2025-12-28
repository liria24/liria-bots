import { ActivityType } from 'discord.js'
import { defineHandler, HTTPError } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { z } from 'zod'
import { getDiscordBotController } from '../../utils/discord/bot'
import { saveBotStatus } from '../../utils/services/statusService'
import { validateBody } from '../../utils/validateRequest'

const activityTypeMap = {
    Playing: ActivityType.Playing,
    Streaming: ActivityType.Streaming,
    Listening: ActivityType.Listening,
    Watching: ActivityType.Watching,
    Custom: ActivityType.Custom,
    Competing: ActivityType.Competing,
} as const

const body = z.object({
    message: z.string().min(1),
    activityType: z
        .enum(['Playing', 'Streaming', 'Listening', 'Watching', 'Custom', 'Competing'])
        .default('Playing'),
    userId: z.string().min(1),
})

export default defineHandler(async (event) => {
    const config = useRuntimeConfig()

    const authorization = event.req.headers.get('authorization')
    if (authorization !== `Bearer ${config.key}`)
        throw new HTTPError({ statusCode: 401, statusMessage: 'Unauthorized' })

    const { message, activityType: activityTypeStr, userId } = await validateBody(event, body)
    const activityType = activityTypeMap[activityTypeStr]

    const status = await saveBotStatus({
        message,
        activityType,
        setBy: userId,
    })

    const controller = getDiscordBotController()
    if (controller?.isReady())
        try {
            controller.client.user?.setActivity(message, {
                type: activityType as ActivityType,
            })
        } catch (error) {
            console.error('Failed to update live bot status:', error)
        }

    return status
})
