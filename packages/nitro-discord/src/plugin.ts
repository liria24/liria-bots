import { createEmailMonitor } from '@liria/email-monitor'
import type { EmailAccount, ParsedMail } from '@liria/email-monitor'
import { consola } from 'consola'
import {
    ActivityType,
    type ButtonInteraction,
    Client,
    Collection,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    type Interaction,
    REST,
    Routes,
} from 'discord.js'
import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { definePlugin } from 'nitro'
import type { EventHandler, H3Event } from 'nitro/h3'
import { HTTPError, readBody } from 'nitro/h3'
import type { Driver } from 'unstorage'

import { clearBotStatusStorage, getBotStatusStorage, setBotStatusStorage } from './botStatus.js'
import { BotStatusStorage } from './botStatusStorage.js'
import type { DiscordBotController } from './client.js'
import {
    clearDiscordBotController,
    getDiscordBotController,
    setDiscordBotController,
} from './client.js'
import { createEmailCommand } from './commands/email.js'
import { createHelpCommand } from './commands/help.js'
import { createStatusCommand } from './commands/status.js'
import { clearEmailMonitor, getEmailMonitor, setEmailMonitor } from './emailMonitor.js'
import type { DiscordCommand, PermissionChecker } from './types.js'

type EmailMonitor = ReturnType<typeof createEmailMonitor>

declare module 'nitro/types' {
    interface NitroApp {
        emailMonitor?: EmailMonitor
    }
}

export interface EmailMonitorConfig {
    enabled: boolean
    driver: Driver
    onNewEmail: (params: {
        embed: EmbedBuilder
        account: EmailAccount
        email: ParsedMail
    }) => Promise<void>
}

export interface BotStatusConfig {
    /** unstorage Driver for persisting status history. */
    driver: Driver
    /**
     * Wrap the internal route handler with authentication/authorization.
     * e.g. `(inner) => adminHandler(({ event }) => inner(event))`
     * When omitted the POST /admin/status route is not registered.
     */
    routeWrapper?: (inner: (event: H3Event) => Promise<unknown>) => EventHandler
}

export interface DiscordPluginConfig {
    name?: string /* Bot name. */
    emailMonitor?: EmailMonitorConfig
    botStatus?: BotStatusConfig
    permissionChecker?: PermissionChecker
    help?: { enabled?: boolean; footer?: string }
}

const log = consola.withTag('discord')

export interface DiscordPluginHooks {
    /** Called when the bot becomes Ready. Used for restoring persisted state. */
    onReady?: (client: Client<true>) => Promise<void>
    /** Called when a button interaction occurs. */
    onButton?: (interaction: ButtonInteraction) => Promise<boolean | void>
    /** Called after the bot starts. Used for starting additional services. */
    onStart?: () => Promise<void>
    /** Called before the bot shuts down. Used for stopping additional services. */
    onClose?: () => Promise<void>
}

const handleInteraction = async (
    interaction: Interaction,
    commandMap: Collection<string, DiscordCommand>,
    hooks: DiscordPluginHooks
) => {
    if (interaction.isChatInputCommand()) {
        const command = commandMap.get(interaction.commandName)
        if (!command) {
            log.warn(`Received interaction for unknown command: ${interaction.commandName}`)
            await interaction.reply({
                content: 'This command is not available anymore.',
                ephemeral: true,
            })
            return
        }
        try {
            log.info(
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
            log.error({ error }, `Error while executing command ${interaction.commandName}`)
            const reply = {
                content: 'An error occurred while executing the command.',
                ephemeral: true,
            }
            await (interaction.replied || interaction.deferred
                ? interaction.followUp(reply)
                : interaction.reply(reply))
        }
        return
    }

    if (interaction.isButton()) {
        await hooks.onButton?.(interaction)
    }
}

async function registerCommands(
    token: string,
    clientId: string,
    guildId: string,
    commands: DiscordCommand[]
) {
    const rest = new REST({ version: '10' }).setToken(token)
    const route = guildId
        ? Routes.applicationGuildCommands(clientId, guildId)
        : Routes.applicationCommands(clientId)
    log.log(
        `Registering ${commands.length} slash command(s) on ${guildId ? `guild ${guildId}` : 'global scope'}`
    )
    await rest.put(route, { body: commands.map((c) => c.data.toJSON()) })
    log.success('Slash commands registered successfully')
}

const buildEmailEmbed = (account: EmailAccount, email: ParsedMail): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setTitle(`📧 New Mail: ${account.name}`)
        .setDescription(account.email)
        .setColor(0x3498db)
        .addFields(
            { name: 'From', value: email.from?.text ?? 'Unknown', inline: true },
            { name: 'Subject', value: email.subject ?? '(No Subject)', inline: true }
        )
        .setFooter({
            text: email.date ? `${email.date.toLocaleString('en-US')} UTC+0000` : 'Unknown Time',
        })
        .setTimestamp()

    if (email.text) {
        const textContent =
            email.text.length > 1024 ? `${email.text.slice(0, 1021)}...` : email.text
        embed.addFields({ name: 'Body', value: textContent, inline: false })
    }

    if (email.attachments && email.attachments.length > 0) {
        const attachmentList = email.attachments
            .map((att) => `• ${att.filename} (${(att.size / 1024).toFixed(1)} KB)`)
            .join('\n')
        embed.addFields({ name: 'Attachments', value: attachmentList, inline: false })
    }

    return embed
}

const activityTypeMap = {
    Playing: ActivityType.Playing,
    Streaming: ActivityType.Streaming,
    Listening: ActivityType.Listening,
    Watching: ActivityType.Watching,
    Custom: ActivityType.Custom,
    Competing: ActivityType.Competing,
} as const

function parseStatusBody(body: unknown): { message: string; activityType: number } {
    if (!body || typeof body !== 'object') {
        throw new HTTPError({
            status: StatusCodes.BAD_REQUEST,
            statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
            message: 'Invalid request body',
        })
    }
    const { message, activityType: activityTypeStr } = body as Record<string, unknown>
    if (typeof message !== 'string' || message.length === 0) {
        throw new HTTPError({
            status: StatusCodes.BAD_REQUEST,
            statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
            message: 'message is required',
        })
    }
    const actTypeName = (activityTypeStr ?? 'Playing') as string as keyof typeof activityTypeMap
    const activityType =
        actTypeName in activityTypeMap ? activityTypeMap[actTypeName] : ActivityType.Playing
    return { message, activityType }
}

const handleStatusRoute = async (event: H3Event): Promise<unknown> => {
    const body = await readBody(event)
    const { message, activityType } = parseStatusBody(body)

    const storage = getBotStatusStorage()
    if (!storage) {
        throw new HTTPError({
            status: StatusCodes.SERVICE_UNAVAILABLE,
            statusText: getReasonPhrase(StatusCodes.SERVICE_UNAVAILABLE),
            message: 'Status storage is not initialized',
        })
    }

    const entry = await storage.save({ message, activityType })

    const controller = getDiscordBotController()
    if (controller?.isReady()) {
        controller.client.user?.setActivity(message, { type: activityType })
    }

    return entry
}

export const defineDiscordPlugin = (
    commands: DiscordCommand[],
    hooks: DiscordPluginHooks = {},
    config?: DiscordPluginConfig
) => {
    let baseCommands = config?.emailMonitor
        ? [...commands, createEmailCommand(config.permissionChecker)]
        : commands
    if (config?.botStatus) {
        baseCommands = [...baseCommands, createStatusCommand(config.permissionChecker)]
    }
    const allCommands =
        config?.help?.enabled !== false
            ? [
                  createHelpCommand(baseCommands, {
                      footer: config?.help?.footer,
                      name: config?.name,
                  }),
                  ...baseCommands,
              ]
            : baseCommands
    return definePlugin(async (nitroApp) => {
        const token = process.env.DISCORD_TOKEN ?? ''
        const clientId = process.env.DISCORD_CLIENT_ID ?? ''
        const guildId = process.env.DISCORD_GUILD_ID ?? ''

        if (!token || !clientId) {
            log.warn(
                'Discord bot configuration is incomplete (missing token or client ID). Discord bot will not be started.'
            )
            return
        }

        if (getDiscordBotController()?.isReady()) {
            log.info('Discord bot is already running. Reusing existing instance.')
            return
        }

        // Initialize bot status storage early so it's available for the onReady handler
        if (config?.botStatus) {
            setBotStatusStorage(new BotStatusStorage(config.botStatus.driver))
        }

        try {
            const client = new Client({ intents: [GatewayIntentBits.Guilds] })
            const commandMap = new Collection(
                allCommands.map((cmd) => [cmd.data.name, cmd] as [string, DiscordCommand])
            )

            client.once(Events.ClientReady, async (readyClient) => {
                log.success(`Bot logged in as ${readyClient.user.tag}`)

                // Restore last bot status from storage
                if (config?.botStatus) {
                    try {
                        const latest = await getBotStatusStorage()?.getLatest()
                        if (latest) {
                            readyClient.user.setActivity(latest.message, {
                                type: latest.activityType,
                            })
                            log.info(
                                { message: latest.message, type: latest.activityType },
                                'Restored last bot status'
                            )
                        }
                    } catch (error) {
                        log.warn({ error }, 'Failed to restore bot status')
                    }
                }

                try {
                    await hooks.onReady?.(readyClient)
                } catch (error) {
                    log.warn({ error }, 'onReady hook failed')
                }
            })

            client.on(Events.InteractionCreate, (interaction) =>
                handleInteraction(interaction, commandMap, hooks)
            )

            await registerCommands(token, clientId, guildId, allCommands)

            log.info('Logging in to Discord API…')
            await client.login(token)

            const controller: DiscordBotController = {
                client,
                isReady: () => client.isReady(),
                async shutdown() {
                    log.info('Shutting down Discord bot')
                    await client.destroy()
                },
            }
            setDiscordBotController(controller)

            // Register the bot status HTTP route if routeWrapper is provided
            if (config?.botStatus?.routeWrapper) {
                nitroApp.h3?.['~addRoute']({
                    route: '/admin/status',
                    method: 'POST',
                    handler: config.botStatus.routeWrapper(handleStatusRoute),
                })
            }

            if (config?.emailMonitor) {
                const monitor = createEmailMonitor(config.emailMonitor.driver, {
                    onNewEmail: async (account, email) => {
                        const embed = buildEmailEmbed(account, email)
                        await config.emailMonitor!.onNewEmail({ embed, account, email })
                    },
                })
                setEmailMonitor(monitor)
                nitroApp.emailMonitor = monitor
                if (config.emailMonitor.enabled) await monitor.start()
            }

            await hooks.onStart?.()

            nitroApp.hooks.hook('close', async () => {
                await hooks.onClose?.()
                if (config?.emailMonitor) {
                    getEmailMonitor()?.stop()
                    clearEmailMonitor()
                    nitroApp.emailMonitor = undefined
                }
                if (config?.botStatus) {
                    clearBotStatusStorage()
                }
                await controller.shutdown()
                clearDiscordBotController()
            })
        } catch (error) {
            log.error({ error }, 'Failed to start Discord bot')
        }
    })
}
