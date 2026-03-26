import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'

export interface DiscordCommand {
    data: SlashCommandBuilder
    execute(interaction: ChatInputCommandInteraction): Promise<void>
    showInHelp?: (interaction: ChatInputCommandInteraction) => Promise<boolean> | boolean
}

/**
 * Type for the permission check function.
 * Returning `true` means "no permission (abort)", returning `false` means "permission granted (continue)".
 * If `undefined`, the permission check is skipped and everyone is allowed.
 */
export type PermissionChecker = (
    interaction: ChatInputCommandInteraction,
    permission: 'granted' | 'admin'
) => Promise<boolean>
