import { consola } from 'consola'
import type { Client } from 'discord.js'
import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { HTTPError } from 'nitro/h3'

const log = consola.withTag('discordClient')

export interface DiscordBotController {
    client: Client
    isReady: () => boolean
    shutdown: () => Promise<void>
}

let discordBotController: DiscordBotController | undefined

export const getDiscordBotController = () => discordBotController

export const setDiscordBotController = (controller: DiscordBotController) => {
    discordBotController = controller
}

export const clearDiscordBotController = () => {
    discordBotController = undefined
}

/**
 * Ensures the Discord bot controller exists and is ready, then returns the client.
 * Throws HTTP 503 if the controller is unavailable or not yet ready.
 */
export const requireReadyDiscordClient = (): Client<true> => {
    const controller = getDiscordBotController()

    if (!controller) {
        log.error('Discord bot controller is not available')
        throw new HTTPError({
            status: StatusCodes.SERVICE_UNAVAILABLE,
            statusText: getReasonPhrase(StatusCodes.SERVICE_UNAVAILABLE),
            message: 'Discord bot is not running',
        })
    }

    if (!controller.isReady()) {
        log.warn('Discord bot client is not ready to send messages')
        throw new HTTPError({
            status: StatusCodes.SERVICE_UNAVAILABLE,
            statusText: getReasonPhrase(StatusCodes.SERVICE_UNAVAILABLE),
            message: 'Discord bot is not ready yet',
        })
    }

    return controller.client as Client<true>
}
