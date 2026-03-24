import { createHash } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { getDb } from '../db'
import { apiKeys } from '../db/schema'

const KEY_PREFIX = 'liria_sk'
const KEY_SEPARATOR = '.'

interface ParsedApiKey {
    id: string
    secret: string
}

const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex')

const parseApiKey = (rawKey: string): ParsedApiKey | null => {
    if (!rawKey || typeof rawKey !== 'string') return null

    const prefixMatch = `${KEY_PREFIX}_`

    if (!rawKey.startsWith(prefixMatch)) return null

    const payload = rawKey.slice(prefixMatch.length)
    const [id, secret] = payload.split(KEY_SEPARATOR)

    if (!id || !secret) return null

    return { id, secret }
}

export const generateApiKeySecret = () => {
    const id = nanoid()
    const secret = nanoid(64) // Using nanoid for secret generation as well
    const rawKey = `${KEY_PREFIX}_${id}${KEY_SEPARATOR}${secret}`
    const keyHash = hashSecret(secret)

    return {
        id,
        secret,
        rawKey,
        keyHash,
        lastFour: secret.slice(-4),
    }
}

export const createApiKey = async (userId: string, name?: string) => {
    const db = await getDb()
    const now = new Date()
    const { id, rawKey, keyHash, lastFour } = generateApiKeySecret()

    // Generate default name with nanoid if not provided
    const finalName = name || nanoid(10)

    await db.insert(apiKeys).values({
        id,
        userId,
        name: finalName,
        keyHash,
        lastFour,
        createdAt: now,
    })

    return { id, rawKey, lastFour, name: finalName }
}

export const verifyApiKey = async (rawKey: string) => {
    const db = await getDb()
    const parsed = parseApiKey(rawKey)
    if (!parsed) return null

    const keyRecord = await db.query.apiKeys.findFirst({
        where: {
            id: parsed.id,
            revokedAt: { isNull: true },
        },
        with: {
            user: true,
        },
    })

    if (!keyRecord) return null

    if (keyRecord.keyHash !== hashSecret(parsed.secret)) return null

    return keyRecord
}

export const markApiKeyUsed = async (id: string) => {
    const db = await getDb()
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id))
}

export const revokeApiKey = async (id: string) => {
    const db = await getDb()
    await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id))
}

export const listApiKeysForUser = async (userId: string) => {
    const db = await getDb()
    return db.query.apiKeys.findMany({
        where: {
            userId,
            revokedAt: { isNull: true },
        },
        orderBy: { createdAt: 'desc' },
    })
}
