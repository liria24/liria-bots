import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    EmbedBuilder,
} from '@liria/nitro-discord/discord.js'

export const showPermissionPromptIfNeeded = async (
    interaction: ChatInputCommandInteraction,
    requiredPermission: 'granted' | 'admin'
) => {
    await ensureUser(interaction.user.id, interaction.user.tag)
    const userPermission = await getUserPermissionLevel(interaction.user.id)

    // 権限チェック
    const hasPermission =
        userPermission === 'admin' ||
        (requiredPermission === 'granted' && userPermission === 'granted')

    if (hasPermission) return false

    // 既に申請中かチェック
    const existingRequest = await findPendingRequestByRequester(interaction.user.id)

    if (existingRequest) {
        await interaction.editReply({
            content:
                '❌ この操作には権限が必要です。\n' +
                '申請は既に受け付け済みです。管理者からの回答をお待ちください。',
        })
        return true
    }

    // 権限リクエストのプロンプトを表示
    const embed = new EmbedBuilder()
        .setTitle('🔒 権限が必要です')
        .setDescription(
            `この操作を実行するには **${requiredPermission}** 権限が必要です。\n\n` +
                '管理者に権限をリクエストしますか？'
        )
        .setColor(0xf1c40f)
        .addFields({
            name: '📝 リクエストについて',
            value:
                'リクエストを送信すると、管理者にDMで通知が届きます。\n' +
                '管理者が承認すると、APIキーの作成や管理ができるようになります。',
            inline: false,
        })
        .setTimestamp()

    const components = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('権限をリクエスト')
                .setStyle(ButtonStyle.Primary)
                .setCustomId('permission-prompt:request')
                .setEmoji('📝'),
            new ButtonBuilder()
                .setLabel('キャンセル')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('permission-prompt:cancel')
                .setEmoji('❌')
        ),
    ]

    await interaction.editReply({
        embeds: [embed],
        components,
    })

    return true // 権限なし、プロンプト表示済み
}
