import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js'

const COMPONENT_PREFIX = 'perm-request'

export const handlePermissionRequestButton = async (
    interaction: ButtonInteraction
): Promise<boolean> => {
    if (!interaction.customId.startsWith(`${COMPONENT_PREFIX}:`)) {
        return false
    }

    const [, action, requestId] = interaction.customId.split(':')

    if (!action || !requestId) {
        await interaction.reply({
            content: '無効な操作です。',
            ephemeral: true,
        })
        return true
    }

    if (action !== 'approve' && action !== 'reject') {
        await interaction.reply({
            content: 'この操作はサポートされていません。',
            ephemeral: true,
        })
        return true
    }

    await ensureUser(interaction.user.id, interaction.user.tag)
    const permission = await getUserPermissionLevel(interaction.user.id)

    if (permission !== 'admin') {
        await interaction.reply({
            content: 'この操作を実行する権限がありません。',
            ephemeral: true,
        })
        return true
    }

    const request = await getPermissionRequestById(requestId)

    if (!request) {
        await interaction.reply({
            content: 'このリクエストは存在しません。',
            ephemeral: true,
        })
        return true
    }

    if (request.status !== 'pending') {
        await interaction.reply({
            content: 'このリクエストはすでに処理されています。',
            ephemeral: true,
        })
        return true
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    if (newStatus === 'approved') {
        await setUserPermission(request.requesterId, 'granted')
    }

    await updatePermissionRequestStatus(requestId, newStatus, interaction.user.id)

    const originalEmbed = interaction.message.embeds[0]
    const updatedEmbed = originalEmbed
        ? EmbedBuilder.from(originalEmbed)
        : new EmbedBuilder().setTitle('API権限リクエスト')

    const decisionText = newStatus === 'approved' ? '許可済み' : '拒否済み'
    const decisionColor = newStatus === 'approved' ? 0x2ecc71 : 0xe74c3c

    updatedEmbed
        .setColor(decisionColor)
        .setFooter({ text: `${interaction.user.tag} が ${decisionText}` })
        .setTimestamp(new Date())

    const disabledComponents = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`${COMPONENT_PREFIX}:approve:${requestId}`)
                .setLabel('許可')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`${COMPONENT_PREFIX}:reject:${requestId}`)
                .setLabel('拒否')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
        ),
    ]

    await interaction.update({
        embeds: [updatedEmbed],
        components: disabledComponents,
        content: `リクエストは${decisionText}です。`,
    })

    await interaction.followUp({
        content: `リクエストを${decisionText}にしました。`,
        ephemeral: true,
    })

    try {
        const requester = await interaction.client.users.fetch(request.requesterId)
        await requester.send({
            content:
                newStatus === 'approved'
                    ? 'あなたの API 権限リクエストが許可されました。'
                    : 'あなたの API 権限リクエストは拒否されました。',
            embeds: [updatedEmbed],
        })
    } catch (error) {
        console.error('Failed to notify requester about decision', {
            requesterId: request.requesterId,
            error,
        })
    }

    return true
}
