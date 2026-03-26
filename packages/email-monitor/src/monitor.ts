import type { Readable } from 'node:stream'

import consola from 'consola'
import type { ImapMessage } from 'imap'
import Imap from 'imap'
import type { ParsedMail } from 'mailparser'
import { simpleParser } from 'mailparser'
import type { Driver } from 'unstorage'
import { createStorage } from 'unstorage'

import { EmailMonitorStorage } from './storage.js'
import type { EmailAccount, EmailMonitorDeps } from './types.js'

const log = consola.withTag('emailMonitor')

const checkEmailAccount = async (account: EmailAccount, deps: EmailMonitorDeps): Promise<number> =>
    new Promise((resolve, reject) => {
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

                imap.search(['UNSEEN'], async (err, results) => {
                    if (err) {
                        reject(err)
                        return
                    }

                    if (!results || results.length === 0) {
                        log.info(`No new emails for ${account.email}`)
                        imap.end()
                        resolve(0)
                        return
                    }

                    log.info(`Found ${results.length} new email(s) for ${account.email}`)
                    messageCount = results.length

                    const fetch = imap.fetch(results, {
                        bodies: '',
                        markSeen: true,
                    })

                    fetch.on('message', (msg: ImapMessage) => {
                        msg.on('body', (stream) => {
                            simpleParser(stream as unknown as Readable)
                                .then(async (parsed: ParsedMail) => {
                                    try {
                                        await deps.onNewEmail(account, parsed)
                                    } catch (error) {
                                        log.error(`Failed to handle new email:`, error)
                                    }
                                })
                                .catch((err) => {
                                    log.error(`Failed to parse email:`, err)
                                })
                        })
                    })

                    fetch.once('error', (err) => {
                        log.error(`Fetch error:`, err)
                        reject(err)
                    })

                    fetch.once('end', () => {
                        log.info(`Finished processing emails for ${account.email}`)
                        imap.end()
                    })
                })
            })
        })

        imap.once('error', (err) => {
            log.error(`IMAP connection error for ${account.email}:`, err)
            reject(err)
        })

        imap.once('end', () => {
            resolve(messageCount)
        })

        imap.connect()
    })

export const createEmailMonitor = (driver: Driver, deps: EmailMonitorDeps) => {
    const emailStorage = new EmailMonitorStorage(createStorage({ driver }))
    let emailCheckInterval: ReturnType<typeof setInterval> | null = null

    const checkEmails = async () => {
        try {
            const accounts = await emailStorage.listEnabledAccounts()

            if (accounts.length === 0) {
                log.info('No enabled email accounts to check')
                return
            }

            log.info(`Checking ${accounts.length} email account(s)`)

            for (const account of accounts)
                try {
                    await checkEmailAccount(account, deps)
                    await emailStorage.updateLastChecked(account.id)
                } catch (error) {
                    log.error(`Failed to check email account ${account.email}:`, error)
                }
        } catch (error) {
            log.error('Failed to check emails:', error)
        }
    }

    return {
        async start() {
            log.info('Starting email monitoring service')

            await checkEmails()

            const updateInterval = async () => {
                if (emailCheckInterval) clearInterval(emailCheckInterval)

                const intervalMinutes = await emailStorage.getCheckInterval()
                log.info(`Setting email check interval to ${intervalMinutes} minutes`)

                emailCheckInterval = setInterval(checkEmails, intervalMinutes * 60 * 1000)
            }

            await updateInterval()

            // Periodically update the interval (to handle configuration changes)
            setInterval(updateInterval, 5 * 60 * 1000)
        },

        stop() {
            if (emailCheckInterval) {
                clearInterval(emailCheckInterval)
                emailCheckInterval = null
                log.info('Stopped email monitoring service')
            }
        },

        async checkNow(): Promise<{ total: number; checked: number }> {
            const accounts = await emailStorage.listEnabledAccounts()
            let checked = 0

            log.info(`Manually checking ${accounts.length} email account(s)`)

            for (const account of accounts)
                try {
                    await checkEmailAccount(account, deps)
                    await emailStorage.updateLastChecked(account.id)
                    checked++
                } catch (error) {
                    log.error(`Failed to check email account ${account.email}:`, error)
                }

            return { total: accounts.length, checked }
        },

        // Account CRUD
        addAccount: emailStorage.addAccount.bind(emailStorage),
        removeAccount: emailStorage.removeAccount.bind(emailStorage),
        listAccounts: emailStorage.listAccounts.bind(emailStorage),
        getAccountById: emailStorage.getAccountById.bind(emailStorage),
        getAccountByEmail: emailStorage.getAccountByEmail.bind(emailStorage),
        toggleAccount: emailStorage.toggleAccount.bind(emailStorage),

        // Settings
        getCheckInterval: emailStorage.getCheckInterval.bind(emailStorage),
        setCheckInterval: emailStorage.setCheckInterval.bind(emailStorage),
    }
}
