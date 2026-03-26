import { consola } from 'consola'
import {
    ActivityType,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js'

import { getBotStatusStorage } from '../botStatus.js'
import type { DiscordCommand, PermissionChecker } from '../types.js'

const log = consola.withTag('status')

const activityTypeChoices = [
    { name: 'Playing', value: ActivityType.Playing },
    { name: 'Streaming', value: ActivityType.Streaming },
    { name: 'Listening', value: ActivityType.Listening },
    { name: 'Watching', value: ActivityType.Watching },
    { name: 'Competing', value: ActivityType.Competing },
]

const activityTypeNames: Record<number, string> = Object.fromEntries(
    activityTypeChoices.map((c) => [c.value, c.name])
)

export const createStatusCommand = (checker?: PermissionChecker): DiscordCommand => ({
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Botのステータスを管理します (管理者のみ)')
        .addSubcommand((subcommand) =>
            subcommand
                .setName('set')
                .setDescription('Botのステータスメッセージを変更します')
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
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('history')
                .setDescription('Botのステータス変更履歴を表示します')
                .addIntegerOption((option) =>
                    option
                        .setName('limit')
                        .setDescription('表示する履歴の件数')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(25)
                )
        ) as SlashCommandBuilder,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const lacksPermission = (await checker?.(interaction, 'admin')) ?? false
        if (lacksPermission) return

        const subcommand = interaction.options.getSubcommand()

        if (subcommand === 'set') {
            await handleSetStatus(interaction)
        } else if (subcommand === 'history') {
            await handleStatusHistory(interaction)
        }
    },

    showInHelp: checker ? async (interaction) => !(await checker(interaction, 'admin')) : undefined,
})

async function handleSetStatus(interaction: ChatInputCommandInteraction) {
    const storage = getBotStatusStorage()
    const message = interaction.options.getString('message', true)
    const activityType = interaction.options.getInteger('type') ?? ActivityType.Playing

    try {
        interaction.client.user?.setActivity(message, { type: activityType })

        await storage?.save({ message, activityType, setBy: interaction.user.id })

        const activityTypeName = activityTypeNames[activityType] ?? 'Playing'
        await interaction.editReply(
            `✅ Botのステータスを更新しました:\n**${activityTypeName}**: ${message}`
        )
    } catch (error) {
        log.error('Failed to set status', error)
        await interaction.editReply('ステータスの更新に失敗しました。もう一度お試しください。')
    }
}

async function handleStatusHistory(interaction: ChatInputCommandInteraction) {
    const storage = getBotStatusStorage()
    const limit = interaction.options.getInteger('limit') ?? 10

    try {
        const history = await storage?.getHistory(limit)

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
            const setBy = status.setBy ? `<@${status.setBy}>` : 'API'
            const date = new Date(status.createdAt).toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo',
            })

            embed.addFields({
                name: `${typeName}: ${status.message}`,
                value: `設定者: ${setBy}\n日時: ${date}`,
                inline: false,
            })
        }

        await interaction.editReply({ embeds: [embed] })
    } catch (error) {
        log.error('Failed to get status history', error)
        await interaction.editReply('ステータス履歴の取得に失敗しました。もう一度お試しください。')
    }
}
