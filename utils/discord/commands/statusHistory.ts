import {
    ActivityType,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js'
import { getBotStatusHistory } from '../../services/statusService'
import { ensureUser, getUserPermissionLevel } from '../../services/userService'
import type { DiscordCommand } from '../../types'

const isAdmin = (permission: string | null | undefined) => permission === 'admin'

const activityTypeNames: Record<number, string> = {
    [ActivityType.Playing]: 'Playing',
    [ActivityType.Streaming]: 'Streaming',
    [ActivityType.Listening]: 'Listening',
    [ActivityType.Watching]: 'Watching',
    [ActivityType.Competing]: 'Competing',
}

export const statusHistoryCommand = {
    data: new SlashCommandBuilder()
        .setName('status-history')
        .setDescription('Botのステータス変更履歴を表示します (管理者のみ)')
        .addIntegerOption((option) =>
            option
                .setName('limit')
                .setDescription('表示する履歴の件数')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(25)
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

        const limit = interaction.options.getInteger('limit') ?? 10

        try {
            const history = await getBotStatusHistory(limit)

            if (!history || history.length === 0) {
                await interaction.editReply('ステータス変更履歴がありません。')
                return
            }

            const embed = new EmbedBuilder()
                .setTitle('📜 Botステータス変更履歴')
                .setColor(0x5865f2)
                .setDescription(`最新${history.length}件のステータス変更履歴を表示しています。`)
                .setTimestamp()

            for (const status of history) {
                const typeName = activityTypeNames[status.activityType] ?? 'Unknown'
                const username = status.setByUser?.username ?? status.setBy ?? 'Unknown'
                const date = status.createdAt.toLocaleString('ja-JP', {
                    timeZone: 'Asia/Tokyo',
                })

                embed.addFields({
                    name: `${typeName}: ${status.message}`,
                    value: `設定者: ${username}\n日時: ${date}`,
                    inline: false,
                })
            }

            await interaction.editReply({ embeds: [embed] })
        } catch (error) {
            console.error('Failed to get status history', error)
            await interaction.editReply(
                'ステータス履歴の取得に失敗しました。もう一度お試しください。'
            )
        }
    },
} satisfies DiscordCommand

export type StatusHistoryCommand = typeof statusHistoryCommand
