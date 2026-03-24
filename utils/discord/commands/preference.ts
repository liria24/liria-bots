import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js'

import { getCheckInterval, setCheckInterval } from '../../services/emailService'
import {
    ensureUser,
    getAdminDmOptOut,
    getUserPermissionLevel,
    setAdminDmOptOut,
} from '../../services/userService'
import type { DiscordCommand } from '../../types'
import { showPermissionPromptIfNeeded } from '../permissionPrompt'

export const preferenceCommand = {
    data: new SlashCommandBuilder()
        .setName('preference')
        .setDescription('個人設定を管理します')
        .addSubcommand((subcommand) =>
            subcommand.setName('show').setDescription('現在の設定を表示します')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('set')
                .setDescription('設定を変更します')
                .addStringOption((option) =>
                    option
                        .setName('key')
                        .setDescription('設定項目')
                        .setRequired(true)
                        .addChoices(
                            { name: 'admin-dm (Admin通知DM)', value: 'admin-dm' },
                            { name: 'email-interval (メールチェック間隔)', value: 'email-interval' }
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName('value')
                        .setDescription('設定値 (admin-dm: on/off, email-interval: 数値(分))')
                        .setRequired(true)
                )
        ) as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        await ensureUser(interaction.user.id, interaction.user.tag)
        const permission = (await getUserPermissionLevel(interaction.user.id)) ?? 'none'
        const isAdmin = permission === 'admin'

        const subcommand = interaction.options.getSubcommand()

        if (subcommand === 'show') {
            return await handleShow(interaction, permission, isAdmin)
        } else if (subcommand === 'set') {
            return await handleSet(interaction, isAdmin)
        }

        await interaction.editReply({
            content: '無効なサブコマンドです。',
        })
    },
} satisfies DiscordCommand

async function handleShow(
    interaction: ChatInputCommandInteraction,
    permission: string,
    isAdmin: boolean
) {
    const hasPermission = permission === 'granted' || isAdmin

    // 現在の設定を取得
    const dmOptOut = isAdmin ? await getAdminDmOptOut(interaction.user.id) : false
    const emailCheckInterval = await getCheckInterval()

    const embed = new EmbedBuilder()
        .setTitle('⚙️ 個人設定')
        .setDescription('現在の設定内容を表示しています。')
        .setColor(0x5865f2)
        .addFields({
            name: '🔐 権限レベル',
            value: hasPermission
                ? `**${permission}** - APIキーの管理が可能です`
                : '**なし** - APIキーを管理するには権限が必要です',
            inline: false,
        })
        .setTimestamp()

    // admin権限がある場合、DM設定とメールチェック間隔を表示
    if (isAdmin) {
        embed.addFields(
            {
                name: '📬 Admin通知DM',
                value: dmOptOut
                    ? '❌ **無効** - admin-messageからのDMを受け取りません'
                    : '✅ **有効** - admin-messageからのDMを受け取ります',
                inline: false,
            },
            {
                name: '📧 メールチェック間隔',
                value: `**${emailCheckInterval}分**ごとにチェック`,
                inline: false,
            }
        )
    }

    await interaction.editReply({
        embeds: [embed],
    })
}

async function handleSet(interaction: ChatInputCommandInteraction, isAdmin: boolean) {
    // 権限チェック - admin権限がない場合はプロンプトを表示
    if (!isAdmin) {
        const lacksPermission = await showPermissionPromptIfNeeded(interaction, 'admin')
        if (lacksPermission) {
            return
        }
    }

    const key = interaction.options.getString('key', true)
    const value = interaction.options.getString('value', true)

    if (key === 'admin-dm') {
        const enableDm = value.toLowerCase() === 'on'
        const disableDm = value.toLowerCase() === 'off'

        if (!enableDm && !disableDm) {
            await interaction.editReply({
                content: '❌ admin-dm の値は `on` または `off` を指定してください。',
            })
            return
        }

        // disableDm が true なら optOut を true に
        await setAdminDmOptOut(interaction.user.id, disableDm)

        await interaction.editReply({
            content: `✅ Admin通知DMを **${enableDm ? '有効' : '無効'}** に設定しました。`,
        })
    } else if (key === 'email-interval') {
        const minutes = Number.parseInt(value, 10)

        if (Number.isNaN(minutes) || minutes < 5 || minutes > 1440) {
            await interaction.editReply({
                content: '❌ email-interval の値は 5〜1440 の数値(分)を指定してください。',
            })
            return
        }

        await setCheckInterval(minutes)

        await interaction.editReply({
            content: `✅ メールチェック間隔を **${minutes}分** に設定しました。`,
        })
    } else {
        await interaction.editReply({
            content: '❌ 無効な設定項目です。',
        })
    }
}

export type PreferenceCommand = typeof preferenceCommand
