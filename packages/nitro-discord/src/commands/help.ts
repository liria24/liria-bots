import {
    ApplicationCommandOptionType,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js'

import type { DiscordCommand } from '../types.js'

export const createHelpCommand = (
    commands: DiscordCommand[],
    options?: { footer?: string; name?: string }
): DiscordCommand => ({
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show available commands and usage') as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const embed = new EmbedBuilder()
            .setTitle(options?.name ? `📚 ${options.name} Help` : '📚 Help')
            .setDescription('Available commands and information for this bot.')
            .setColor(0x5865f2)

        embed.addFields({
            name: '❓ `/help`',
            value: 'Show this help message.',
            inline: false,
        })

        for (const cmd of commands) {
            if (cmd.showInHelp && !(await cmd.showInHelp(interaction))) continue

            const json = cmd.data.toJSON()
            const subcommands =
                json.options?.filter(
                    (opt) => opt.type === ApplicationCommandOptionType.Subcommand
                ) ?? []

            let value = json.description
            if (subcommands.length > 0) {
                value +=
                    '\n\n' +
                    subcommands
                        .map((sub) => `・\`/${json.name} ${sub.name}\` - ${sub.description}`)
                        .join('\n')
            }

            embed.addFields({
                name: `📌 \`/${json.name}\``,
                value,
                inline: false,
            })
        }

        if (options?.footer) embed.setFooter({ text: options.footer })
        embed.setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    },
})
