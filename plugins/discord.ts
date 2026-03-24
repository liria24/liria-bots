import { definePlugin } from 'nitro'
import { useRuntimeConfig } from 'nitro/runtime-config'

import {
    clearDiscordBotController,
    getDiscordBotController,
    setDiscordBotController,
    startDiscordBot,
} from '../utils/discord/bot'
import { discordCommands } from '../utils/discord/commands'
import { startEmailMonitoring, stopEmailMonitoring } from '../utils/emailMonitor'
import { logger } from '../utils/logger'

const log = logger('discord')

export default definePlugin(async (nitroApp) => {
    const existingController = getDiscordBotController()

    if (existingController?.isReady()) {
        log.info('Discord bot is already running. Reusing existing instance.')
        return
    }

    const { discord } = useRuntimeConfig()

    if (!discord.token) {
        log.warn('DISCORD_TOKEN is not set. Discord bot will not be started.')
        return
    }

    if (!discord.clientId) {
        log.warn('DISCORD_CLIENT_ID is not set. Discord bot will not be started.')
        return
    }

    try {
        const controller = await startDiscordBot({
            token: discord.token,
            clientId: discord.clientId,
            guildId: discord.guildId,
            commands: discordCommands,
        })

        setDiscordBotController(controller)

        // メール監視を開始（環境変数で制御）
        const { email } = useRuntimeConfig()
        if (email.monitor) {
            log.info('Starting email monitoring service')
            await startEmailMonitoring()
        } else {
            log.info('Email monitoring is disabled by configuration')
        }

        nitroApp.hooks.hook('close', async () => {
            if (email.monitor) {
                log.info('Stopping email monitoring service')
                stopEmailMonitoring()
            }
            await controller.shutdown()
            clearDiscordBotController()
        })
    } catch (error) {
        log.error({ error }, 'Failed to start Discord bot')
    }
})
