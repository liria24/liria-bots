import { createConsola } from 'consola'
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

const logger = createConsola({ defaults: { tag: 'discord' } })

export default definePlugin(async (nitroApp) => {
    const existingController = getDiscordBotController()

    if (existingController?.isReady()) {
        logger.info('Discord bot is already running. Reusing existing instance.')
        return
    }

    const { discord } = useRuntimeConfig()

    if (!discord.token) {
        logger.warn('DISCORD_TOKEN is not set. Discord bot will not be started.')
        return
    }

    if (!discord.clientId) {
        logger.warn('DISCORD_CLIENT_ID is not set. Discord bot will not be started.')
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
            logger.info('Starting email monitoring service')
            await startEmailMonitoring()
        } else {
            logger.info('Email monitoring is disabled by configuration')
        }

        nitroApp.hooks.hook('close', async () => {
            if (email.monitor) {
                logger.info('Stopping email monitoring service')
                stopEmailMonitoring()
            }
            await controller.shutdown()
            clearDiscordBotController()
        })
    } catch (error) {
        logger.error({ error }, 'Failed to start Discord bot')
    }
})
