import { eq } from 'drizzle-orm'

import type { PermissionRequestStatus } from '../../db/schema'

export const getPermissionRequestById = async (id: string) =>
    db.query.permissionRequests.findFirst({
        where: { id },
        with: {
            requester: true,
            resolver: true,
        },
    })

export const createPermissionRequest = async (requesterId: string) => {
    const [request] = await db
        .insert(schema.permissionRequests)
        .values({
            requesterId,
            status: 'pending',
        })
        .returning()

    return request
}

export const findPendingRequestByRequester = async (requesterId: string) =>
    db.query.permissionRequests.findFirst({
        where: {
            requesterId,
            status: 'pending',
        },
    })

export const updatePermissionRequestStatus = async (
    id: string,
    status: PermissionRequestStatus,
    resolverId?: string
) => {
    const [updated] = await db
        .update(schema.permissionRequests)
        .set({
            status,
            resolvedBy: resolverId,
            resolvedAt: status === 'pending' ? null : new Date(),
        })
        .where(eq(schema.permissionRequests.id, id))
        .returning()

    return updated ?? null
}

export const saveAdminMessageId = async (id: string, messageId: string) => {
    const [updated] = await db
        .update(schema.permissionRequests)
        .set({ adminMessageId: messageId })
        .where(eq(schema.permissionRequests.id, id))
        .returning()

    return updated ?? null
}
