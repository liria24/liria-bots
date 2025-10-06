import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
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
            subcommand
                .setName('add')
                .setDescription('新しいメールアカウントを追加します')
                .addStringOption((option) =>
                    option
                        .setName('name')
                        .setDescription('アカウント名 (例: 会社メール)')
                        .setRequired(true)
                        .setMaxLength(100)
                )
                .addStringOption((option) =>
                    option.setName('email').setDescription('メールアドレス').setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('host')
                        .setDescription(
                            'IMAPホスト (例: imap.example.com または imap.example.com:993)'
                        )
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName('password').setDescription('IMAPパスワード').setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('user')
                        .setDescription('IMAPユーザー名 (省略時はメールアドレスと同じ)')
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('toggle')
                .setDescription('メールアカウントの有効/無効を切り替えます')
                .addStringOption((option) =>
                    option.setName('email').setDescription('メールアドレス').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('delete')
                .setDescription('メールアカウントを削除します')
                .addStringOption((option) =>
                    option.setName('email').setDescription('メールアドレス').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('check').setDescription('すぐに新着メールをチェックします')
        ) as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand()

        // 権限チェックのために一旦deferReplyを呼ぶ
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        // 権限チェック - admin権限がない場合はプロンプトを表示
        const lacksPermission = await showPermissionPromptIfNeeded(interaction, 'admin')
        if (lacksPermission) {
            return
        }

        // addサブコマンドの場合は、権限チェック後にモーダルを表示
        if (subcommand === 'list') {
            await handleListEmails(interaction)
        } else if (subcommand === 'add') {
            await handleAddEmail(interaction)
        } else if (subcommand === 'toggle') {
            await handleToggleEmail(interaction)
        } else if (subcommand === 'delete') {
            await handleDeleteEmail(interaction)
        } else if (subcommand === 'check') {
            await handleCheckNow(interaction)
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
            const lastChecked = account.lastCheckedAt
                ? account.lastCheckedAt.toLocaleString('ja-JP')
                : '未チェック'

            embed.addFields({
                name: account.enabled ? `${account.name}` : `${account.name} ❌ 無効`,
                value: `Email: ${account.email}\n` + `最終チェック: ${lastChecked}`,
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
    const name = interaction.options.getString('name', true)
    const email = interaction.options.getString('email', true)
    const hostInput = interaction.options.getString('host', true)
    const password = interaction.options.getString('password', true)
    const userInput = interaction.options.getString('user')

    // ホストとポートをパース（host:port形式に対応）
    let imapHost = hostInput
    let imapPort: number | undefined

    if (hostInput.includes(':')) {
        const [host, port] = hostInput.split(':')
        imapHost = host
        const parsedPort = Number.parseInt(port, 10)
        if (!Number.isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
            imapPort = parsedPort
        }
    }

    // ユーザー名が未入力の場合はメールアドレスを使用
    const imapUser = userInput?.trim() || email

    try {
        const account = await createEmailAccount({
            name,
            email,
            imapHost,
            imapPort,
            imapUser,
            imapPassword: password,
        })

        await interaction.editReply(
            `✅ メールアカウント「${account.name}」(${account.email})を追加しました。`
        )
    } catch (error) {
        console.error('Failed to create email account', error)
        await interaction.editReply(
            'メールアカウントの追加に失敗しました。入力内容を確認してください。'
        )
    }
}

async function handleToggleEmail(interaction: ChatInputCommandInteraction) {
    const email = interaction.options.getString('email', true)

    try {
        const account = await getEmailAccountByAddress(email)

        if (!account) {
            await interaction.editReply(
                '指定されたメールアドレスのアカウントが見つかりませんでした。'
            )
            return
        }

        const newStatus = !account.enabled
        await updateEmailAccountEnabled(account.id, newStatus)

        await interaction.editReply(
            `✅ メールアカウント「${account.name}」を${newStatus ? '有効' : '無効'}にしました。`
        )
    } catch (error) {
        console.error('Failed to toggle email account', error)
        await interaction.editReply('メールアカウントの切り替えに失敗しました。')
    }
}

async function handleDeleteEmail(interaction: ChatInputCommandInteraction) {
    const email = interaction.options.getString('email', true)

    try {
        const account = await getEmailAccountByAddress(email)

        if (!account) {
            await interaction.editReply(
                '指定されたメールアドレスのアカウントが見つかりませんでした。'
            )
            return
        }

        await deleteEmailAccount(account.id)

        await interaction.editReply(`✅ メールアカウント「${account.name}」を削除しました。`)
    } catch (error) {
        console.error('Failed to delete email account', error)
        await interaction.editReply('メールアカウントの削除に失敗しました。')
    }
}

async function handleCheckNow(interaction: ChatInputCommandInteraction) {
    await interaction.editReply('📧 メールチェックを開始しています...')

    try {
        const result = await checkEmailsNow()

        if (result.total === 0) {
            await interaction.editReply('❌ 有効なメールアカウントがありません。')
            return
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ メールチェック完了')
            .setColor(0x2ecc71)
            .addFields(
                {
                    name: '対象アカウント',
                    value: `${result.total}件`,
                    inline: true,
                },
                {
                    name: 'チェック成功',
                    value: `${result.checked}件`,
                    inline: true,
                }
            )
            .setTimestamp()

        if (result.checked < result.total) {
            embed.setDescription(
                `⚠️ ${result.total - result.checked}件のアカウントでエラーが発生しました。`
            )
        }

        await interaction.editReply({ content: '', embeds: [embed] })
    } catch (error) {
        console.error('Failed to check emails now', error)
        await interaction.editReply('❌ メールチェック中にエラーが発生しました。')
    }
}

export type EmailCommand = typeof emailCommand
