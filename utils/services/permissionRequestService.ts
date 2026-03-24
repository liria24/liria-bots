import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { getDb } from '../db'
import { type PermissionRequestStatus, permissionRequests } from '../db/schema'

export const getPermissionRequestById = async (id: string) => {
    const db = await getDb()

    return db.query.permissionRequests.findFirst({
        where: { id },
        with: {
            requester: true,
            resolver: true,
        },
    })
}

export const createPermissionRequest = async (requesterId: string) => {
    const db = await getDb()
    const now = new Date()

    const [request] = await db
        .insert(permissionRequests)
        .values({
            id: nanoid(),
            requesterId,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
        })
        .returning()

    return request
}

export const findPendingRequestByRequester = async (requesterId: string) => {
    const db = await getDb()

    return db.query.permissionRequests.findFirst({
        where: {
            requesterId,
            status: 'pending',
        },
    })
}

export const updatePermissionRequestStatus = async (
    id: string,
    status: PermissionRequestStatus,
    resolverId?: string
) => {
    const db = await getDb()
    const now = new Date()

    const [updated] = await db
        .update(permissionRequests)
        .set({
            status,
            resolvedBy: resolverId,
            resolvedAt: status === 'pending' ? null : now,
            updatedAt: now,
        })
        .where(eq(permissionRequests.id, id))
        .returning()

    return updated ?? null
}

export const saveAdminMessageId = async (id: string, messageId: string) => {
    const db = await getDb()
    const [updated] = await db
        .update(permissionRequests)
        .set({ adminMessageId: messageId, updatedAt: new Date() })
        .where(eq(permissionRequests.id, id))
        .returning()

    return updated ?? null
}
