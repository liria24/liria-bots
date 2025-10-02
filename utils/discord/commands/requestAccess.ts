import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js'

const buildButtonCustomId = (action: 'approve' | 'reject', id: string) =>
    `perm-request:${action}:${id}`

export const requestAccessCommand = {
    data: new SlashCommandBuilder()
        .setName('request-access')
        .setDescription('APIキー発行権限 (granted) を管理者に申請します')
        .addStringOption((option) =>
            option.setName('reason').setDescription('申請理由 (任意)').setMaxLength(200)
        ) as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true })

        await ensureUser(interaction.user.id, interaction.user.tag)
        const permission = await getUserPermissionLevel(interaction.user.id)

        if (permission === 'admin' || permission === 'granted') {
            await interaction.editReply('すでに API キー発行権限を所持しています。')
            return
        }

        const existingRequest = await findPendingRequestByRequester(interaction.user.id)

        if (existingRequest) {
            await interaction.editReply(
                '申請は既に受け付け済みです。管理者からの回答をお待ちください。'
            )
            return
        }

        const admins = await listUsersByPermission('admin')

        if (!admins.length) {
            await interaction.editReply('現在この申請を処理できる管理者が登録されていません。')
            return
        }

        const request = await createPermissionRequest(interaction.user.id)
        const reason = interaction.options.getString('reason')?.trim() || '未入力'

        const embed = new EmbedBuilder()
            .setTitle('API権限リクエスト')
            .setDescription(
                `${interaction.user.tag} (${interaction.user.id}) が granted 権限をリクエストしました。`
            )
            .addFields({ name: '理由', value: reason }, { name: 'リクエストID', value: request.id })
            .setColor(0xf1c40f)
            .setTimestamp()

        let savedMessageId: string | undefined

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

                const message = await adminUser.send({
                    content: '新しい API 権限リクエストがあります。',
                    embeds: [embed],
                    components,
                })

                if (!savedMessageId) {
                    savedMessageId = message.id
                }
            } catch (error) {
                console.error('Failed to notify admin about access request', {
                    adminId: admin.id,
                    error,
                })
            }
        }

        if (savedMessageId) {
            await saveAdminMessageId(request.id, savedMessageId)
        }

        await interaction.editReply('申請を管理者に送信しました。結果が届くまでお待ちください。')
    },
} satisfies DiscordCommand

export type RequestAccessCommand = typeof requestAccessCommand
