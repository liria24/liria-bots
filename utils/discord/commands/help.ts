import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js'

export const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Botの使い方とコマンド一覧を表示します') as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true })

        const embed = new EmbedBuilder()
            .setTitle('📚 Liria Discord Bot Help')
            .setDescription('このBotで利用可能なコマンドと情報です。')
            .setColor(0x5865f2)
            .addFields(
                {
                    name: '❓ `/help`',
                    value: 'このヘルプメッセージを表示します。\n**権限不要** - 誰でも使用可能',
                    inline: false,
                },
                {
                    name: '📊 `/status`',
                    value:
                        'Botのステータスを管理します。\n' +
                        '**権限必要: `admin` のみ**\n\n' +
                        '・`/status set` - Botのステータスメッセージを変更\n' +
                        '・`/status history` - ステータス変更履歴を表示',
                    inline: false,
                },
                {
                    name: '🔑 `/api-key`',
                    value:
                        'APIキーを管理します。\n' +
                        '**権限必要: `granted` または `admin`**\n\n' +
                        '・`/api-key create` - 新しいAPIキーを発行\n' +
                        '・`/api-key list` - 所有するAPIキーをリスト表示\n' +
                        '・`/api-key delete` - APIキーを削除',
                    inline: false,
                },
                {
                    name: '📝 `/request-access`',
                    value: 'APIキー発行権限を管理者に申請します。\n**権限不要** - 誰でも使用可能',
                    inline: false,
                },
                {
                    name: '\u200b',
                    value: '━━━━━━━━━━━━━━━━━━━━━━',
                    inline: false,
                },
                {
                    name: '🔐 権限',
                    value: 'APIキーの作成権限が必要な場合は `/request-access` で申請してください。',
                    inline: false,
                },
                {
                    name: '🌐 サービス情報',
                    value:
                        '・**エンドポイント**: https://discord.liria.me\n' +
                        '・**ホスティング**: [railway.com](https://railway.com)',
                    inline: false,
                }
            )
            .setFooter({
                text: 'ご不明な点があれば管理者にお問い合わせください',
            })
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    },
} satisfies DiscordCommand

export type HelpCommand = typeof helpCommand
