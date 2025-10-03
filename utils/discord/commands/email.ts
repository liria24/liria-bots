import {
    ActionRowBuilder,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'

export const emailCommand = {
    data: new SlashCommandBuilder()
        .setName('email')
        .setDescription('メール監視アカウントを管理します (管理者のみ)')
        .addSubcommand((subcommand) =>
            subcommand
                .setName('list')
                .setDescription('登録されているメールアカウントのリストを表示します')
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('add').setDescription('新しいメールアカウントを追加します')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('toggle')
                .setDescription('メールアカウントの有効/無効を切り替えます')
                .addStringOption((option) =>
                    option.setName('id').setDescription('メールアカウントのID').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('delete')
                .setDescription('メールアカウントを削除します')
                .addStringOption((option) =>
                    option.setName('id').setDescription('メールアカウントのID').setRequired(true)
                )
        ) as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        // addサブコマンドはモーダル表示のため、deferReplyしない
        const subcommand = interaction.options.getSubcommand()
        const needsDefer = subcommand !== 'add'

        if (needsDefer) {
            await interaction.deferReply({ ephemeral: true })
        }

        // 権限チェック - admin権限がない場合はプロンプトを表示
        const lacksPermission = await showPermissionPromptIfNeeded(interaction, 'admin')
        if (lacksPermission) {
            return
        }

        if (subcommand === 'list') {
            await handleListEmails(interaction)
        } else if (subcommand === 'add') {
            await handleAddEmail(interaction)
        } else if (subcommand === 'toggle') {
            await handleToggleEmail(interaction)
        } else if (subcommand === 'delete') {
            await handleDeleteEmail(interaction)
        }
    },
} satisfies DiscordCommand

async function handleListEmails(interaction: ChatInputCommandInteraction) {
    try {
        const accounts = await listEmailAccounts()

        if (!accounts || accounts.length === 0) {
            await interaction.editReply('登録されているメールアカウントがありません。')
            return
        }

        const interval = await getCheckInterval()

        const embed = new EmbedBuilder()
            .setTitle('📧 メールアカウント一覧')
            .setColor(0x3498db)
            .setDescription(`チェック間隔: **${interval}分ごと**\n合計 ${accounts.length} 件`)
            .setTimestamp()

        for (const account of accounts) {
            const status = account.enabled ? '✅ 有効' : '❌ 無効'
            const lastChecked = account.lastCheckedAt
                ? account.lastCheckedAt.toLocaleString('ja-JP')
                : '未チェック'

            embed.addFields({
                name: `${account.name} ${status}`,
                value:
                    `ID: \`${account.id}\`\n` +
                    `Email: ${account.email}\n` +
                    `最終チェック: ${lastChecked}`,
                inline: false,
            })
        }

        await interaction.editReply({ embeds: [embed] })
    } catch (error) {
        console.error('Failed to list email accounts', error)
        await interaction.editReply('メールアカウントリストの取得に失敗しました。')
    }
}

async function handleAddEmail(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('email:add-modal')
        .setTitle('メールアカウントを追加')

    const nameInput = new TextInputBuilder()
        .setCustomId('name')
        .setLabel('アカウント名')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('例: 会社メール')
        .setRequired(true)
        .setMaxLength(100)

    const emailInput = new TextInputBuilder()
        .setCustomId('email')
        .setLabel('メールアドレス')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('example@example.com')
        .setRequired(true)

    const hostInput = new TextInputBuilder()
        .setCustomId('host')
        .setLabel('IMAPホスト')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('imap.example.com')
        .setRequired(true)

    const userInput = new TextInputBuilder()
        .setCustomId('user')
        .setLabel('IMAPユーザー名')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('通常はメールアドレスと同じ')
        .setRequired(true)

    const passwordInput = new TextInputBuilder()
        .setCustomId('password')
        .setLabel('IMAPパスワード')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(emailInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(hostInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(userInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(passwordInput)
    )

    await interaction.showModal(modal)
}

async function handleToggleEmail(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true })

    const id = interaction.options.getString('id', true)

    try {
        const account = await getEmailAccountById(id)

        if (!account) {
            await interaction.editReply('指定されたIDのメールアカウントが見つかりませんでした。')
            return
        }

        const newStatus = !account.enabled
        await updateEmailAccountEnabled(id, newStatus)

        await interaction.editReply(
            `✅ メールアカウント「${account.name}」を${newStatus ? '有効' : '無効'}にしました。`
        )
    } catch (error) {
        console.error('Failed to toggle email account', error)
        await interaction.editReply('メールアカウントの切り替えに失敗しました。')
    }
}

async function handleDeleteEmail(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true })

    const id = interaction.options.getString('id', true)

    try {
        const account = await getEmailAccountById(id)

        if (!account) {
            await interaction.editReply('指定されたIDのメールアカウントが見つかりませんでした。')
            return
        }

        await deleteEmailAccount(id)

        await interaction.editReply(`✅ メールアカウント「${account.name}」を削除しました。`)
    } catch (error) {
        console.error('Failed to delete email account', error)
        await interaction.editReply('メールアカウントの削除に失敗しました。')
    }
}

export type EmailCommand = typeof emailCommand
