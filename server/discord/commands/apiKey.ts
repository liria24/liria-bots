import type { DiscordCommand } from '@liria/nitro-discord'
import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from '@liria/nitro-discord/discord.js'

export default {
    data: new SlashCommandBuilder()
        .setName('api-key')
        .setDescription('APIキーを管理します')
        .addSubcommand((subcommand) =>
            subcommand
                .setName('create')
                .setDescription('新しいAPIキーを発行します')
                .addStringOption((option) =>
                    option
                        .setName('name')
                        .setDescription('APIキーの名前 (用途識別に利用)')
                        .setRequired(false)
                        .setMaxLength(100)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('list').setDescription('自分が持つAPIキーのリストを表示します')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('delete')
                .setDescription('APIキーを削除します')
                .addStringOption((option) =>
                    option.setName('name').setDescription('削除するAPIキーの名前').setRequired(true)
                )
        ) as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        // 権限チェック - 権限がない場合はプロンプトを表示
        const lacksPermission = await showPermissionPromptIfNeeded(interaction, 'granted')
        if (lacksPermission) return

        const subcommand = interaction.options.getSubcommand()

        if (subcommand === 'create') await handleCreateApiKey(interaction)
        else if (subcommand === 'list') await handleListApiKeys(interaction)
        else if (subcommand === 'delete') await handleDeleteApiKey(interaction)
    },
    showInHelp: async (interaction) => {
        const permission = await getUserPermissionLevel(interaction.user.id)
        return permission === 'granted' || permission === 'admin'
    },
} satisfies DiscordCommand

const handleCreateApiKey = async (interaction: ChatInputCommandInteraction) => {
    const name = interaction.options.getString('name') || undefined
    const apiKey = await createApiKey(interaction.user.id, name)

    const dmEmbed = new EmbedBuilder()
        .setTitle('APIキーを発行しました')
        .setDescription('安全な場所に保管してください。')
        .addFields(
            { name: '名前', value: apiKey.name },
            { name: '末尾4桁', value: apiKey.lastFour }
        )
        .setColor(0x2ecc71)
        .setTimestamp()

    try {
        await interaction.user.send({
            embeds: [dmEmbed],
            content: `||${apiKey.rawKey}||`,
        })
    } catch (error) {
        logger('apiKey').error('Failed to DM API key', error)
        await interaction.editReply(
            'APIキーをDMで送信できませんでした。DMを有効にして再試行してください。'
        )
        return
    }

    await interaction.editReply('APIキーをDMで送信しました。DMをご確認ください。')
}

const handleListApiKeys = async (interaction: ChatInputCommandInteraction) => {
    try {
        const apiKeys = await listApiKeysForUser(interaction.user.id)

        if (!apiKeys || apiKeys.length === 0) {
            await interaction.editReply('APIキーがありません。`/api-key create`で作成できます。')
            return
        }

        const embed = new EmbedBuilder()
            .setTitle('🔑 APIキーリスト')
            .setColor(0x5865f2)
            .setDescription(`合計${apiKeys.length}個のAPIキーがあります。`)
            .setTimestamp()

        for (const key of apiKeys) {
            const createdDate = key.createdAt.toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo',
            })
            const lastUsed = key.lastUsedAt
                ? key.lastUsedAt.toLocaleString('ja-JP', {
                      timeZone: 'Asia/Tokyo',
                  })
                : '未使用'

            embed.addFields({
                name: `${key.name} (末尾: ****${key.lastFour})`,
                value: `作成日: ${createdDate}\n最終使用: ${lastUsed}`,
                inline: false,
            })
        }

        await interaction.editReply({ embeds: [embed] })
    } catch (error) {
        logger('apiKey').error('Failed to list API keys', error)
        await interaction.editReply('APIキーリストの取得に失敗しました。もう一度お試しください。')
    }
}

const handleDeleteApiKey = async (interaction: ChatInputCommandInteraction) => {
    const keyName = interaction.options.getString('name', true)

    try {
        // ユーザーが所有するAPIキーか確認
        const apiKeys = await listApiKeysForUser(interaction.user.id)
        const keyToDelete = apiKeys.find((key) => key.name === keyName)

        if (!keyToDelete) {
            await interaction.editReply(
                'その名前のAPIキーは見つかりませんでした。`/api-key list`で確認してください。'
            )
            return
        }

        await revokeApiKey(keyToDelete.id)

        await interaction.editReply(
            `✅ APIキー「${keyToDelete.name}」(****${keyToDelete.lastFour})を削除しました。`
        )
    } catch (error) {
        logger('apiKey').error('Failed to delete API key', error)
        await interaction.editReply('APIキーの削除に失敗しました。もう一度お試しください。')
    }
}
