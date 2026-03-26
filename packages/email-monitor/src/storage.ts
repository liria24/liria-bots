import type { Storage } from 'unstorage'

import type { CreateEmailAccountInput, EmailAccount } from './types.js'

const ACCOUNT_PREFIX = 'account:'
const CHECK_INTERVAL_KEY = 'settings:checkInterval'
const DEFAULT_CHECK_INTERVAL = 30

interface StoredAccount {
    id: string
    name: string
    email: string
    imapHost: string
    imapPort: number
    imapUser: string
    imapPassword: string
    enabled: boolean
    lastCheckedAt: string | null
    createdAt: string
}

function deserialize(stored: StoredAccount): EmailAccount {
    return {
        ...stored,
        lastCheckedAt: stored.lastCheckedAt ? new Date(stored.lastCheckedAt) : null,
        createdAt: new Date(stored.createdAt),
    }
}

function serialize(account: EmailAccount): StoredAccount {
    return {
        ...account,
        lastCheckedAt: account.lastCheckedAt?.toISOString() ?? null,
        createdAt: account.createdAt.toISOString(),
    }
}

export class EmailMonitorStorage {
    constructor(private storage: Storage) {}

    async addAccount(input: CreateEmailAccountInput): Promise<EmailAccount> {
        const id = crypto.randomUUID()
        const stored: StoredAccount = {
            id,
            name: input.name,
            email: input.email,
            imapHost: input.imapHost,
            imapPort: input.imapPort ?? 993,
            imapUser: input.imapUser,
            imapPassword: input.imapPassword,
            enabled: true,
            lastCheckedAt: null,
            createdAt: new Date().toISOString(),
        }
        await this.storage.setItem(`${ACCOUNT_PREFIX}${id}`, JSON.stringify(stored))
        return deserialize(stored)
    }

    async removeAccount(id: string): Promise<void> {
        await this.storage.removeItem(`${ACCOUNT_PREFIX}${id}`)
    }

    async listAccounts(): Promise<EmailAccount[]> {
        const keys = await this.storage.getKeys(ACCOUNT_PREFIX)
        const results = await Promise.all(
            keys.map(async (key) => {
                const raw = await this.storage.getItem(key)
                if (!raw) return null
                return deserialize(JSON.parse(raw as string) as StoredAccount)
            })
        )
        return results
            .filter((a): a is EmailAccount => a !== null)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    async getAccountById(id: string): Promise<EmailAccount | null> {
        const raw = await this.storage.getItem(`${ACCOUNT_PREFIX}${id}`)
        if (!raw) return null
        return deserialize(JSON.parse(raw as string) as StoredAccount)
    }

    async getAccountByEmail(email: string): Promise<EmailAccount | null> {
        const accounts = await this.listAccounts()
        return accounts.find((a) => a.email === email) ?? null
    }

    async toggleAccount(id: string, enabled: boolean): Promise<EmailAccount | null> {
        const account = await this.getAccountById(id)
        if (!account) return null
        const stored = serialize({ ...account, enabled })
        await this.storage.setItem(`${ACCOUNT_PREFIX}${id}`, JSON.stringify(stored))
        return deserialize(stored)
    }

    async updateLastChecked(id: string): Promise<void> {
        const account = await this.getAccountById(id)
        if (!account) return
        const stored = serialize({ ...account, lastCheckedAt: new Date() })
        await this.storage.setItem(`${ACCOUNT_PREFIX}${id}`, JSON.stringify(stored))
    }

    async listEnabledAccounts(): Promise<EmailAccount[]> {
        const accounts = await this.listAccounts()
        return accounts
            .filter((a) => a.enabled)
            .sort((a, b) => {
                if (!a.lastCheckedAt) return -1
                if (!b.lastCheckedAt) return 1
                return a.lastCheckedAt.getTime() - b.lastCheckedAt.getTime()
            })
    }

    async getCheckInterval(): Promise<number> {
        const raw = await this.storage.getItem(CHECK_INTERVAL_KEY)
        if (!raw) return DEFAULT_CHECK_INTERVAL
        const val = Number(raw)
        return Number.isNaN(val) ? DEFAULT_CHECK_INTERVAL : val
    }

    async setCheckInterval(minutes: number): Promise<void> {
        await this.storage.setItem(CHECK_INTERVAL_KEY, String(minutes))
    }
}
