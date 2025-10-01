import {
    ActivityType,
    type ChatInputCommandInteraction,
    SlashCommandBuilder,
} from 'discord.js'
import { saveBotStatus } from '../../services/statusService'
import { ensureUser, getUserPermissionLevel } from '../../services/userService'
import type { DiscordCommand } from '../../types'

const isAdmin = (permission: string | null | undefined) =>
    permission === 'admin'

const activityTypeChoices = [
    { name: 'Playing', value: ActivityType.Playing },
    { name: 'Streaming', value: ActivityType.Streaming },
    { name: 'Listening', value: ActivityType.Listening },
    { name: 'Watching', value: ActivityType.Watching },
    { name: 'Competing', value: ActivityType.Competing },
]

export const setStatusCommand = {
    data: new SlashCommandBuilder()
        .setName('set-status')
        .setDescription('Botのステータスメッセージを変更します (管理者のみ)')
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('ステータスメッセージ')
                .setRequired(true)
                .setMaxLength(128)
        )
        .addIntegerOption((option) =>
            option
                .setName('type')
                .setDescription('アクティビティタイプ')
                .setRequired(false)
                .addChoices(...activityTypeChoices)
        ) as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true })

        await ensureUser(interaction.user.id, interaction.user.tag)
        const permission = await getUserPermissionLevel(interaction.user.id)

        if (!isAdmin(permission)) {
            await interaction.editReply(
                'このコマンドを実行する権限がありません。管理者のみが実行できます。'
            )
            return
        }

        const message = interaction.options.getString('message', true)
        const activityType =
            interaction.options.getInteger('type') ?? ActivityType.Playing

        try {
            interaction.client.user?.setActivity(message, {
                type: activityType,
            })

            // ステータスをデータベースに保存
            await saveBotStatus({
                message,
                activityType,
                setBy: interaction.user.id,
            })

            const activityTypeName =
                activityTypeChoices.find((c) => c.value === activityType)
                    ?.name ?? 'Playing'

            await interaction.editReply(
                `✅ Botのステータスを更新しました:\n**${activityTypeName}**: ${message}`
            )
        } catch (error) {
            console.error('Failed to set status', error)
            await interaction.editReply(
                'ステータスの更新に失敗しました。もう一度お試しください。'
            )
        }
    },
} satisfies DiscordCommand

export type SetStatusCommand = typeof setStatusCommand
