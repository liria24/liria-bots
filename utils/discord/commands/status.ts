import {
    ActivityType,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js'

const activityTypeChoices = [
    { name: 'Playing', value: ActivityType.Playing },
    { name: 'Streaming', value: ActivityType.Streaming },
    { name: 'Listening', value: ActivityType.Listening },
    { name: 'Watching', value: ActivityType.Watching },
    { name: 'Competing', value: ActivityType.Competing },
]

const activityTypeNames: Record<number, string> = {
    [ActivityType.Playing]: 'Playing',
    [ActivityType.Streaming]: 'Streaming',
    [ActivityType.Listening]: 'Listening',
    [ActivityType.Watching]: 'Watching',
    [ActivityType.Competing]: 'Competing',
}

export const statusCommand = {
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
        await interaction.deferReply({ ephemeral: true })

        // 権限チェック - admin権限がない場合はプロンプトを表示
        const lacksPermission = await showPermissionPromptIfNeeded(interaction, 'admin')
        if (lacksPermission) {
            return
        }

        const subcommand = interaction.options.getSubcommand()

        if (subcommand === 'set') {
            await handleSetStatus(interaction)
        } else if (subcommand === 'history') {
            await handleStatusHistory(interaction)
        }
    },
} satisfies DiscordCommand

async function handleSetStatus(interaction: ChatInputCommandInteraction) {
    const message = interaction.options.getString('message', true)
    const activityType = interaction.options.getInteger('type') ?? ActivityType.Playing

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
            activityTypeChoices.find((c) => c.value === activityType)?.name ?? 'Playing'

        await interaction.editReply(
            `✅ Botのステータスを更新しました:\n**${activityTypeName}**: ${message}`
        )
    } catch (error) {
        console.error('Failed to set status', error)
        await interaction.editReply('ステータスの更新に失敗しました。もう一度お試しください。')
    }
}

async function handleStatusHistory(interaction: ChatInputCommandInteraction) {
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
        await interaction.editReply('ステータス履歴の取得に失敗しました。もう一度お試しください。')
    }
}

export type StatusCommand = typeof statusCommand
