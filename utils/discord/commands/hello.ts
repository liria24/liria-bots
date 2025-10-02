import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'

export const helloCommand = {
    data: new SlashCommandBuilder()
        .setName('hello')
        .setDescription('Replies with a friendly greeting.'),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.reply('Hello world!')
    },
} satisfies DiscordCommand

export type HelloCommand = typeof helloCommand
