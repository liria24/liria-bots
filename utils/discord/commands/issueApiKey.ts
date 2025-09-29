import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js'
import { createApiKey } from '../../services/apiKeyService'
import { ensureUser, getUserPermissionLevel } from '../../services/userService'
import type { DiscordCommand } from '../../types'

const isPermitted = (permission: string | null | undefined) =>
    permission === 'granted' || permission === 'admin'

export const issueApiKeyCommand = {
    data: new SlashCommandBuilder()
        .setName('issue-apikey')
        .setDescription('APIキーを発行します')
        .addStringOption((option) =>
            option
                .setName('name')
                .setDescription('APIキーの名前 (用途識別に利用)')
                .setRequired(false) // Made optional
                .setMaxLength(100)
        ) as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true })

        await ensureUser(interaction.user.id, interaction.user.tag)
        const permission = await getUserPermissionLevel(interaction.user.id)

        if (!isPermitted(permission)) {
            await interaction.editReply(
                'APIキーを発行する権限がありません。管理者に権限付与を依頼してください。'
            )
            return
        }

        const name = interaction.options.getString('name') || undefined
        const apiKey = await createApiKey(interaction.user.id, name)

        const dmEmbed = new EmbedBuilder()
            .setTitle('APIキーを発行しました')
            .setDescription('安全な場所に保管してください。')
            .addFields(
                { name: '名前', value: apiKey.name },
                { name: '末尾4桁', value: apiKey.lastFour }
            )
            .setColor(0x2ecc71)
            .setTimestamp()

        try {
            await interaction.user.send({
                embeds: [dmEmbed],
                content: `||${apiKey.rawKey}||`,
            })
        } catch (error) {
            console.error('Failed to DM API key', error)
            await interaction.editReply(
                'APIキーをDMで送信できませんでした。DMを有効にして再試行してください。'
            )
            return
        }

        await interaction.editReply(
            'APIキーをDMで送信しました。DMをご確認ください。'
        )
    },
} satisfies DiscordCommand

export type IssueApiKeyCommand = typeof issueApiKeyCommand
