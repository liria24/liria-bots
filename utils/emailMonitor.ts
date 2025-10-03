import { EmbedBuilder } from 'discord.js'
import type { ImapMessage } from 'imap'
import Imap from 'imap'
import type { ParsedMail } from 'mailparser'
import { simpleParser } from 'mailparser'

const logger = console

interface EmailAccount {
    id: string
    name: string
    email: string
    imapHost: string
    imapPort: number
    imapUser: string
    imapPassword: string
}

const checkEmailAccount = async (account: EmailAccount): Promise<number> => {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: account.imapUser,
            password: account.imapPassword,
            host: account.imapHost,
            port: account.imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
        })

        let messageCount = 0

        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err) => {
                if (err) {
                    reject(err)
                    return
                }

                // 未読メールを検索
                imap.search(['UNSEEN'], async (err, results) => {
                    if (err) {
                        reject(err)
                        return
                    }

                    if (!results || results.length === 0) {
                        logger.info(`No new emails for ${account.email}`)
                        imap.end()
                        resolve(0)
                        return
                    }

                    logger.info(`Found ${results.length} new email(s) for ${account.email}`)
                    messageCount = results.length

                    const fetch = imap.fetch(results, {
                        bodies: '',
                        markSeen: true,
                    })

                    fetch.on('message', (msg: ImapMessage) => {
                        msg.on('body', (stream) => {
                            // streamを適切な型にキャストして使用
                            simpleParser(stream as never)
                                .then(async (parsed: ParsedMail) => {
                                    try {
                                        await forwardEmailToAdmins(account, parsed)
                                    } catch (error) {
                                        logger.error(`Failed to forward email to admins:`, error)
                                    }
                                })
                                .catch((err) => {
                                    logger.error(`Failed to parse email:`, err)
                                })
                        })
                    })

                    fetch.once('error', (err) => {
                        logger.error(`Fetch error:`, err)
                        reject(err)
                    })

                    fetch.once('end', () => {
                        logger.info(`Finished processing emails for ${account.email}`)
                        imap.end()
                    })
                })
            })
        })

        imap.once('error', (err) => {
            logger.error(`IMAP connection error for ${account.email}:`, err)
            reject(err)
        })

        imap.once('end', () => {
            resolve(messageCount)
        })

        imap.connect()
    })
}

const forwardEmailToAdmins = async (account: EmailAccount, email: ParsedMail) => {
    const controller = getDiscordBotController()

    if (!controller || !controller.isReady()) {
        logger.warn('Discord bot is not ready')
        return
    }

    const client = controller.client

    // admin権限を持つユーザーを取得（DM受信をオプトアウトしていないユーザーのみ）
    const allAdminUsers = await listUsersByPermission('admin')
    const adminUsers = allAdminUsers.filter((user) => !user.adminDmOptOut)

    if (!adminUsers || adminUsers.length === 0) {
        logger.warn('No admin users available to receive email')
        return
    }

    const embed = new EmbedBuilder()
        .setTitle(`📧 新着メール: ${account.name}`)
        .setDescription(account.email)
        .setColor(0x3498db)
        .addFields(
            { name: '差出人', value: email.from?.text ?? 'Unknown', inline: true },
            { name: '件名', value: email.subject ?? '(件名なし)', inline: true }
        )
        .setFooter({
            text: email.date ? `${email.date?.toLocaleString('ja-JP')} UTC+0000` : 'Unknown Time',
        })
        .setTimestamp()

    // メール本文（プレーンテキスト）を追加
    if (email.text) {
        const textContent =
            email.text.length > 1024 ? `${email.text.slice(0, 1021)}...` : email.text
        embed.addFields({ name: '本文', value: textContent, inline: false })
    }

    // 添付ファイルの情報
    if (email.attachments && email.attachments.length > 0) {
        const attachmentList = email.attachments
            .map((att) => `• ${att.filename} (${(att.size / 1024).toFixed(1)} KB)`)
            .join('\n')
        embed.addFields({ name: '添付ファイル', value: attachmentList, inline: false })
    }

    // 各adminユーザーにDMを送信
    for (const admin of adminUsers) {
        try {
            const user = await client.users.fetch(admin.id)
            await user.send({ embeds: [embed] })
            logger.info(`Sent email notification to admin ${admin.username}`)
        } catch (error) {
            logger.error(`Failed to send email notification to admin ${admin.id}:`, error)
        }
    }
}

let emailCheckInterval: NodeJS.Timeout | null = null

export const startEmailMonitoring = async () => {
    logger.info('Starting email monitoring service')

    const checkEmails = async () => {
        try {
            const accounts = await listEnabledEmailAccounts()

            if (accounts.length === 0) {
                logger.info('No enabled email accounts to check')
                return
            }

            logger.info(`Checking ${accounts.length} email account(s)`)

            for (const account of accounts) {
                try {
                    await checkEmailAccount(account)
                    await updateEmailAccountLastChecked(account.id)
                } catch (error) {
                    logger.error(`Failed to check email account ${account.email}:`, error)
                }
            }
        } catch (error) {
            logger.error('Failed to check emails:', error)
        }
    }

    // 即座に一度実行
    await checkEmails()

    // 定期実行を設定
    const updateInterval = async () => {
        if (emailCheckInterval) {
            clearInterval(emailCheckInterval)
        }

        const intervalMinutes = await getCheckInterval()
        logger.info(`Setting email check interval to ${intervalMinutes} minutes`)

        emailCheckInterval = setInterval(checkEmails, intervalMinutes * 60 * 1000)
    }

    await updateInterval()

    // 定期的にインターバルを更新（設定が変更された場合に対応）
    setInterval(updateInterval, 5 * 60 * 1000) // 5分ごとにインターバル設定をチェック
}

export const stopEmailMonitoring = () => {
    if (emailCheckInterval) {
        clearInterval(emailCheckInterval)
        emailCheckInterval = null
        logger.info('Stopped email monitoring service')
    }
}

export const checkEmailsNow = async (): Promise<{ total: number; checked: number }> => {
    const accounts = await listEnabledEmailAccounts()
    let checked = 0

    logger.info(`Manually checking ${accounts.length} email account(s)`)

    for (const account of accounts) {
        try {
            await checkEmailAccount(account)
            await updateEmailAccountLastChecked(account.id)
            checked++
        } catch (error) {
            logger.error(`Failed to check email account ${account.email}:`, error)
        }
    }

    return { total: accounts.length, checked }
}
