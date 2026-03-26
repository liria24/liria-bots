import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from '@liria/nitro-discord/discord.js'

const PERM_PREFIX = 'perm-request'

const buildPermButtonId = (action: 'approve' | 'reject', id: string) =>
    `${PERM_PREFIX}:${action}:${id}`

const buildPermButtons = (requestId: string, disabled = false) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(buildPermButtonId('approve', requestId))
            .setLabel('許可')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(buildPermButtonId('reject', requestId))
            .setLabel('拒否')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    )

export const handlePermissionPromptButton = async (
    interaction: ButtonInteraction
): Promise<boolean> => {
    if (!interaction.customId.startsWith('permission-prompt:')) return false

    const action = interaction.customId.replace('permission-prompt:', '')

    if (action === 'cancel') {
        await interaction.update({
            content: 'キャンセルしました。',
            embeds: [],
            components: [],
        })
        return true
    }

    if (action !== 'request') return false

    await ensureUser(interaction.user.id, interaction.user.tag)

    const existingRequest = await findPendingRequestByRequester(interaction.user.id)
    if (existingRequest) {
        await interaction.update({
            content: '申請は既に受け付け済みです。管理者からの回答をお待ちください。',
            embeds: [],
            components: [],
        })
        return true
    }

    const admins = await listUsersByPermission('admin')
    if (!admins.length) {
        await interaction.update({
            content: '現在この申請を処理できる管理者が登録されていません。',
            embeds: [],
            components: [],
        })
        return true
    }

    const request = await createPermissionRequest(interaction.user.id)
    if (!request) {
        await interaction.update({
            content: '申請の作成に失敗しました。管理者にお問い合わせください。',
            embeds: [],
            components: [],
        })
        return true
    }

    const embed = new EmbedBuilder()
        .setTitle('API権限リクエスト')
        .setDescription(
            `${interaction.user.tag} (${interaction.user.id}) が granted 権限をリクエストしました。`
        )
        .addFields({ name: 'リクエストID', value: request.id })
        .setColor(0xf1c40f)
        .setTimestamp()

    let savedMessageId: string | undefined

    for (const admin of admins)
        try {
            const adminUser = await interaction.client.users.fetch(admin.id)
            const sentMessage = await adminUser.send({
                embeds: [embed],
                components: [buildPermButtons(request.id)],
            })
            if (!savedMessageId) {
                savedMessageId = sentMessage.id
            }
        } catch (dmError) {
            logger('permissionPrompt').error(`Failed to send DM to admin ${admin.id}:`, dmError)
        }

    if (savedMessageId) await saveAdminMessageId(request.id, savedMessageId)

    await interaction.update({
        content: '✅ 権限リクエストを送信しました。管理者からの回答をお待ちください。',
        embeds: [],
        components: [],
    })

    return true
}

export const handlePermissionRequestButton = async (
    interaction: ButtonInteraction
): Promise<boolean> => {
    if (!interaction.customId.startsWith(`${PERM_PREFIX}:`)) return false

    const [, action, requestId] = interaction.customId.split(':')

    if (!action || !requestId) {
        await interaction.reply({
            content: '無効な操作です。',
            flags: MessageFlags.Ephemeral,
        })
        return true
    }

    if (action !== 'approve' && action !== 'reject') {
        await interaction.reply({
            content: 'この操作はサポートされていません。',
            flags: MessageFlags.Ephemeral,
        })
        return true
    }

    await ensureUser(interaction.user.id, interaction.user.tag)
    const permission = await getUserPermissionLevel(interaction.user.id)

    if (permission !== 'admin') {
        await interaction.reply({
            content: 'この操作を実行する権限がありません。',
            flags: MessageFlags.Ephemeral,
        })
        return true
    }

    const request = await getPermissionRequestById(requestId)

    if (!request) {
        await interaction.reply({
            content: 'このリクエストは存在しません。',
            flags: MessageFlags.Ephemeral,
        })
        return true
    }

    if (request.status !== 'pending') {
        await interaction.reply({
            content: 'このリクエストはすでに処理されています。',
            flags: MessageFlags.Ephemeral,
        })
        return true
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    if (newStatus === 'approved') await setUserPermission(request.requesterId, 'granted')

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

    await interaction.update({
        embeds: [updatedEmbed],
        components: [buildPermButtons(requestId, true)],
        content: `リクエストは${decisionText}です。`,
    })

    await interaction.followUp({
        content: `リクエストを${decisionText}にしました。`,
        flags: MessageFlags.Ephemeral,
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
        logger('permissionRequest').error('Failed to notify requester about decision', {
            requesterId: request.requesterId,
            error,
        })
    }

    return true
}
