import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js'

export const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Botの使い方とコマンド一覧を表示します') as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        await ensureUser(interaction.user.id, interaction.user.tag)
        const permission = await getUserPermissionLevel(interaction.user.id)
        const isAdmin = permission === 'admin'
        const hasPermission = permission === 'granted' || isAdmin

        const embed = new EmbedBuilder()
            .setTitle('📚 Liria Discord Bot Help')
            .setDescription(
                hasPermission
                    ? 'このBotで利用可能なコマンドと情報です。'
                    : 'このBotで利用可能なコマンドと情報です。\n一部の機能には権限が必要です。'
            )
            .setColor(0x5865f2)

        // 全ユーザーが使用できるコマンド
        embed.addFields({
            name: '❓ `/help`',
            value: 'このヘルプメッセージを表示します。',
            inline: false,
        })

        if (isAdmin)
            embed.addFields({
                name: '⚙️ `/preference`',
                value:
                    '個人設定を管理します。\n\n' +
                    '・`/preference show` - 現在の設定を表示\n' +
                    '・`/preference set <key> <value>` - 設定を変更\n' +
                    '  - `admin-dm`: Admin通知DM設定 (on/off)\n' +
                    '  - `email-interval`: メールチェック間隔 (5-1440分)',
                inline: false,
            })

        // granted または admin 権限が必要なコマンド
        if (hasPermission)
            embed.addFields({
                name: '🔑 `/api-key`',
                value:
                    'APIキーを管理します。\n\n' +
                    '・`/api-key create [name]` - 新しいAPIキーを発行\n' +
                    '・`/api-key list` - 所有するAPIキーをリスト表示\n' +
                    '・`/api-key delete <name>` - 指定した名前のAPIキーを削除',
                inline: false,
            })

        // admin 権限が必要なコマンド
        if (isAdmin)
            embed.addFields(
                {
                    name: '📊 `/status`',
                    value:
                        'Botのステータスを管理します。\n\n' +
                        '・`/status set` - Botのステータスメッセージを変更\n' +
                        '・`/status history` - ステータス変更履歴を表示',
                    inline: false,
                },
                {
                    name: '📧 `/email`',
                    value:
                        'メールアカウントの監視を管理します。\n\n' +
                        '・`/email list` - 監視中のメールアカウントをリスト表示\n' +
                        '・`/email add` - 新しいメールアカウントを追加\n' +
                        '・`/email toggle <email>` - メールアカウントの有効/無効を切り替え\n' +
                        '・`/email delete <email>` - メールアカウントを削除\n' +
                        '・`/email check-now` - すぐに新着メールをチェック',
                    inline: false,
                }
            )

        embed.addFields({
            name: '\u200b',
            value: '━━━━━━━━━━━━━━━━━━━━━━',
            inline: false,
        })

        // 権限情報
        if (hasPermission)
            embed.addFields({
                name: '🔐 あなたの権限',
                value: `**${permission}** - APIキーの管理${isAdmin ? 'とBot管理' : ''}が可能です`,
                inline: false,
            })
        else
            embed.addFields({
                name: '🔐 権限について',
                value:
                    'APIキーの作成や管理者機能を使用するには権限が必要です。\n' +
                    '権限が必要なコマンドを実行すると、自動的に権限リクエストの確認が表示されます。',
                inline: false,
            })

        embed.addFields({
            name: '🌐 サービス情報',
            value:
                '・**エンドポイント**: https://discord.liria.me\n' +
                '・**ホスティング**: [railway.com](https://railway.com)',
            inline: false,
        })

        embed.setFooter({
            text: 'ご不明な点があれば管理者にお問い合わせください',
        })

        embed.setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    },
} satisfies DiscordCommand

export type HelpCommand = typeof helpCommand
