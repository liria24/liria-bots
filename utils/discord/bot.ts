import {
    ActivityType,
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    REST,
    Routes,
    type ChatInputCommandInteraction,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
    type Snowflake,
} from 'discord.js'
import { getLatestBotStatus } from '../services/statusService'

const logger = createConsola({ defaults: { tag: 'discord' } })

export interface DiscordBotOptions {
    token: string
    clientId: Snowflake
    guildId?: Snowflake
    commands: DiscordCommand[]
}

export interface DiscordBotController {
    client: Client
    isReady: () => boolean
    shutdown: () => Promise<void>
}

const registerSlashCommands = async (
    options: DiscordBotOptions
): Promise<void> => {
    const { token, clientId, guildId, commands } = options
    const rest = new REST({ version: '10' }).setToken(token)

    const slashPayload: RESTPostAPIChatInputApplicationCommandsJSONBody[] =
        commands.map((command) => command.data.toJSON())

    const route = guildId
        ? Routes.applicationGuildCommands(clientId, guildId)
        : Routes.applicationCommands(clientId)

    logger.log(
        `Registering ${slashPayload.length} slash command(s) on ${
            guildId ? `guild ${guildId}` : 'global scope'
        }`
    )

    await rest.put(route, { body: slashPayload })
    logger.success('Slash commands registered successfully')
}

const createInteractionHandler = (
    commandMap: Collection<string, DiscordCommand>
): ((interaction: ChatInputCommandInteraction) => Promise<void>) => {
    return async (interaction: ChatInputCommandInteraction) => {
        const command = commandMap.get(interaction.commandName)

        if (!command) {
            logger.warn(
                `Received interaction for unknown command: ${interaction.commandName}`
            )
            await interaction.reply({
                content: 'This command is not available anymore.',
                ephemeral: true,
            })
            return
        }

        try {
            logger.info(
                {
                    command: interaction.commandName,
                    userId: interaction.user.id,
                    userTag: interaction.user.tag,
                    guildId: interaction.guildId,
                    channelId: interaction.channelId,
                },
                'Slash command invoked'
            )
            await command.execute(interaction)
        } catch (error) {
            logger.error(
                { error },
                `Error while executing command ${interaction.commandName}`
            )

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'コマンド実行中にエラーが発生しました。',
                    ephemeral: true,
                })
            } else {
                await interaction.reply({
                    content: 'コマンド実行中にエラーが発生しました。',
                    ephemeral: true,
                })
            }
        }
    }
}

export const startDiscordBot = async (
    options: DiscordBotOptions
): Promise<DiscordBotController> => {
    const { token, commands } = options

    if (!commands.length) {
        throw new Error('At least one Discord command must be provided.')
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds] })

    const commandMap = new Collection<string, DiscordCommand>()
    for (const command of commands) {
        commandMap.set(command.data.name, command)
    }

    client.once(Events.ClientReady, async (readyClient) => {
        logger.success(`Bot logged in as ${readyClient.user.tag}`)

        // 最後に設定されたステータスを復元
        try {
            const latestStatus = await getLatestBotStatus()
            if (latestStatus) {
                readyClient.user.setActivity(latestStatus.message, {
                    type: latestStatus.activityType as ActivityType,
                })
                logger.info(
                    {
                        message: latestStatus.message,
                        type: latestStatus.activityType,
                    },
                    'Restored last bot status'
                )
            }
        } catch (error) {
            logger.warn({ error }, 'Failed to restore last bot status')
        }
    })

    const interactionHandler = createInteractionHandler(commandMap)

    client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.isChatInputCommand()) {
            await interactionHandler(interaction)
            return
        }

        if (interaction.isButton()) {
            const handled = await handlePermissionRequestButton(interaction)
            if (handled) return
        }
    })

    try {
        await registerSlashCommands(options)
    } catch (error) {
        logger.error({ error }, 'Failed to register slash commands')
        throw error
    }

    logger.info('Logging in to Discord API…')
    await client.login(token)

    return {
        client,
        isReady: () => client.isReady(),
        async shutdown() {
            logger.info('Shutting down Discord bot')
            await client.destroy()
        },
    }
}
