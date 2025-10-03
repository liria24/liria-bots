import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export interface CreateEmailAccountInput {
    name: string
    email: string
    imapHost: string
    imapPort?: number
    imapUser: string
    imapPassword: string
}

export const createEmailAccount = async (input: CreateEmailAccountInput) => {
    const db = await getDb()
    const now = new Date()
    const id = nanoid()

    const [account] = await db
        .insert(emailAccounts)
        .values({
            id,
            name: input.name,
            email: input.email,
            imapHost: input.imapHost,
            imapPort: input.imapPort ?? 993,
            imapUser: input.imapUser,
            imapPassword: input.imapPassword,
            enabled: true,
            createdAt: now,
            updatedAt: now,
        })
        .returning()

    return account
}

export const listEmailAccounts = async () => {
    const db = await getDb()
    return db.query.emailAccounts.findMany({
        orderBy: (accounts, { desc }) => desc(accounts.createdAt),
    })
}

export const getEmailAccountById = async (id: string) => {
    const db = await getDb()
    return db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, id),
    })
}

export const updateEmailAccountEnabled = async (id: string, enabled: boolean) => {
    const db = await getDb()
    const now = new Date()

    const [updated] = await db
        .update(emailAccounts)
        .set({ enabled, updatedAt: now })
        .where(eq(emailAccounts.id, id))
        .returning()

    return updated
}

export const updateEmailAccountLastChecked = async (id: string) => {
    const db = await getDb()
    const now = new Date()

    await db
        .update(emailAccounts)
        .set({ lastCheckedAt: now, updatedAt: now })
        .where(eq(emailAccounts.id, id))
}

export const deleteEmailAccount = async (id: string) => {
    const db = await getDb()
    await db.delete(emailAccounts).where(eq(emailAccounts.id, id))
}

export const getCheckInterval = async (): Promise<number> => {
    const db = await getDb()
    const settings = await db.query.emailCheckSettings.findFirst({
        where: eq(emailCheckSettings.id, 'singleton'),
    })
    return settings?.checkIntervalMinutes ?? 30
}

export const setCheckInterval = async (minutes: number) => {
    const db = await getDb()
    const now = new Date()

    await db
        .insert(emailCheckSettings)
        .values({
            id: 'singleton',
            checkIntervalMinutes: minutes,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: emailCheckSettings.id,
            set: {
                checkIntervalMinutes: minutes,
                updatedAt: now,
            },
        })
}

export const listEnabledEmailAccounts = async () => {
    const db = await getDb()
    return db.query.emailAccounts.findMany({
        where: eq(emailAccounts.enabled, true),
        orderBy: (accounts, { asc }) => asc(accounts.lastCheckedAt),
    })
}
