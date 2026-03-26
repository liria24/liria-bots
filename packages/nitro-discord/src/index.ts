export type { DiscordCommand, PermissionChecker } from './types.js'
export { createHelpCommand } from './commands/help.js'
export type { DiscordBotController } from './client.js'
export {
    getDiscordBotController,
    setDiscordBotController,
    clearDiscordBotController,
    requireReadyDiscordClient,
} from './client.js'
export type { DiscordPluginHooks, EmailMonitorConfig, BotStatusConfig } from './plugin.js'
export { defineDiscordPlugin } from './plugin.js'
export { getEmailMonitor } from './emailMonitor.js'
export { getBotStatusStorage } from './botStatus.js'
export type { BotStatusEntry } from './botStatusStorage.js'
export type { EmailAccount, CreateEmailAccountInput, EmailMonitorDeps } from '@liria/email-monitor'
export type { ParsedMail } from '@liria/email-monitor'
export type { Driver } from 'unstorage'
