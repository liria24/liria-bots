import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { digest } from 'ohash'

const KEY_PREFIX = 'liria_sk'

const parseApiKey = (rawKey: string): string | null => {
    const prefix = `${KEY_PREFIX}_`
    if (!rawKey?.startsWith(prefix)) return null
    const secret = rawKey.slice(prefix.length)
    return secret || null
}

const generateApiKeySecret = () => {
    const secret = nanoid(64)
    return {
        secret,
        rawKey: `${KEY_PREFIX}_${secret}`,
        keyHash: digest(secret),
        lastFour: secret.slice(-4),
    }
}

export const createApiKey = async (userId: string, name?: string) => {
    const { rawKey, keyHash, lastFour } = generateApiKeySecret()
    const finalName = name ?? nanoid(10)

    const [record] = await db
        .insert(schema.apiKeys)
        .values({ userId, name: finalName, keyHash, lastFour })
        .returning({ id: schema.apiKeys.id })

    if (!record) throw new Error('Failed to create API key')
    return { id: record.id, rawKey, lastFour, name: finalName }
}

export const verifyApiKey = async (rawKey: string) => {
    const secret = parseApiKey(rawKey)
    if (!secret) return null

    return db.query.apiKeys.findFirst({
        where: { keyHash: digest(secret), revokedAt: { isNull: true } },
        with: { user: true },
    })
}

export const markApiKeyUsed = async (id: string) =>
    db.update(schema.apiKeys).set({ lastUsedAt: new Date() }).where(eq(schema.apiKeys.id, id))

export const revokeApiKey = async (id: string) =>
    db.update(schema.apiKeys).set({ revokedAt: new Date() }).where(eq(schema.apiKeys.id, id))

export const listApiKeysForUser = async (userId: string) =>
    db.query.apiKeys.findMany({
        where: { userId, revokedAt: { isNull: true } },
        orderBy: { createdAt: 'desc' },
    })
