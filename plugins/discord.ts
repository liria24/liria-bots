import { startDiscordBot } from '../utils/discord/bot'
import { discordCommands } from '../utils/discord/commands'
import {
    clearDiscordBotController,
    getDiscordBotController,
    setDiscordBotController,
} from '../utils/discord/controller'

const logger = createConsola({ defaults: { tag: 'discord' } })

export default defineNitroPlugin(async (nitroApp) => {
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

        nitroApp.hooks.hook('close', async () => {
            await controller.shutdown()
            clearDiscordBotController()
        })
    } catch (error) {
        logger.error({ error }, 'Failed to start Discord bot')
    }
})
