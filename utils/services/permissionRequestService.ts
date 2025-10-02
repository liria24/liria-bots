import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

export const getPermissionRequestById = async (id: string) => {
    const db = await getDb()

    return db.query.permissionRequests.findFirst({
        where: eq(permissionRequests.id, id),
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
            id: randomUUID(),
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
        where: and(
            eq(permissionRequests.requesterId, requesterId),
            eq(permissionRequests.status, 'pending')
        ),
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
