import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js'
import {
    createPermissionRequest,
    findPendingRequestByRequester,
    saveAdminMessageId,
} from '../../services/permissionRequestService'
import { ensureUser, listUsersByPermission } from '../../services/userService'

const buildButtonCustomId = (action: 'approve' | 'reject', id: string) =>
    `perm-request:${action}:${id}`

export async function handlePermissionPromptButton(
    interaction: ButtonInteraction
): Promise<boolean> {
    if (!interaction.customId.startsWith('permission-prompt:')) {
        return false
    }

    const action = interaction.customId.replace('permission-prompt:', '')

    if (action === 'cancel') {
        await interaction.update({
            content: 'キャンセルしました。',
            embeds: [],
            components: [],
        })
        return true
    }

    if (action === 'request') {
        await ensureUser(interaction.user.id, interaction.user.tag)

        // 再度チェック（同時実行対策）
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

        // 権限リクエストを作成
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

        // 各管理者にDMを送信
        for (const admin of admins) {
            try {
                const adminUser = await interaction.client.users.fetch(admin.id)
                const components = [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setLabel('許可')
                            .setStyle(ButtonStyle.Success)
                            .setCustomId(buildButtonCustomId('approve', request.id)),
                        new ButtonBuilder()
                            .setLabel('拒否')
                            .setStyle(ButtonStyle.Danger)
                            .setCustomId(buildButtonCustomId('reject', request.id))
                    ),
                ]

                const sentMessage = await adminUser.send({ embeds: [embed], components })

                if (!savedMessageId) {
                    savedMessageId = sentMessage.id
                }
            } catch (dmError) {
                console.error(`Failed to send DM to admin ${admin.id}:`, dmError)
            }
        }

        if (savedMessageId) {
            await saveAdminMessageId(request.id, savedMessageId)
        }

        await interaction.update({
            content: '✅ 権限リクエストを送信しました。管理者からの回答をお待ちください。',
            embeds: [],
            components: [],
        })

        return true
    }

    return false
}
