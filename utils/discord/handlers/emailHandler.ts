import type { ModalSubmitInteraction } from 'discord.js'

const COMPONENT_PREFIX = 'email'

export const handleEmailModal = async (interaction: ModalSubmitInteraction): Promise<boolean> => {
    if (!interaction.customId.startsWith(`${COMPONENT_PREFIX}:`)) {
        return false
    }

    const [, action] = interaction.customId.split(':')

    if (action === 'add-modal') {
        return await handleAddEmailModal(interaction)
    }

    return false
}

async function handleAddEmailModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    await interaction.deferReply({ ephemeral: true })

    const name = interaction.fields.getTextInputValue('name')
    const email = interaction.fields.getTextInputValue('email')
    const host = interaction.fields.getTextInputValue('host')
    const user = interaction.fields.getTextInputValue('user')
    const password = interaction.fields.getTextInputValue('password')

    try {
        const account = await createEmailAccount({
            name,
            email,
            imapHost: host,
            imapUser: user,
            imapPassword: password,
        })

        await interaction.editReply(
            `✅ メールアカウント「${account.name}」(${account.email})を追加しました。\nID: \`${account.id}\``
        )
    } catch (error) {
        console.error('Failed to create email account', error)
        await interaction.editReply(
            'メールアカウントの追加に失敗しました。入力内容を確認してください。'
        )
    }

    return true
}
