import { eq } from 'drizzle-orm'

import type { PermissionLevel } from '../../db/schema'

export const ensureUser = async (id: string, username?: string | null) => {
    const [inserted] = await db
        .insert(schema.users)
        .values({ id, username: username ?? undefined })
        .onConflictDoUpdate({ target: schema.users.id, set: { username: username ?? undefined } })
        .returning()

    return inserted
}

export const getUserById = async (id: string) => db.query.users.findFirst({ where: { id } })

export const getUserPermissionLevel = async (id: string) =>
    (await getUserById(id))?.permissionLevel ?? null

export const setUserPermission = async (id: string, permission: PermissionLevel | null) => {
    const [updated] = await db
        .update(schema.users)
        .set({ permissionLevel: permission ?? null })
        .where(eq(schema.users.id, id))
        .returning()

    return updated ?? null
}

export const listUsersByPermission = async (permission: PermissionLevel) =>
    db.query.users.findMany({ where: { permissionLevel: permission } })

export const setAdminDmOptOut = async (id: string, optOut: boolean) => {
    const [updated] = await db
        .update(schema.users)
        .set({ adminDmOptOut: optOut })
        .where(eq(schema.users.id, id))
        .returning()

    return updated ?? null
}

export const getAdminDmOptOut = async (id: string) =>
    (await getUserById(id))?.adminDmOptOut ?? false
