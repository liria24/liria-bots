import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { type PermissionLevel, users } from '../db/schema'

export const ensureUser = async (id: string, username?: string | null) => {
    const db = await getDb()
    const now = new Date()

    const inserted = await db
        .insert(users)
        .values({ id, username: username ?? undefined, updatedAt: now })
        .onConflictDoUpdate({
            target: users.id,
            set: {
                username: username ?? undefined,
                updatedAt: now,
            },
        })
        .returning()

    return inserted[0]
}

export const getUserById = async (id: string) => {
    const db = await getDb()
    return db.query.users.findFirst({ where: { id } })
}

export const getUserPermissionLevel = async (id: string): Promise<PermissionLevel | null> => {
    const record = await getUserById(id)
    return record?.permissionLevel ?? null
}

export const setUserPermission = async (id: string, permission: PermissionLevel | null) => {
    const db = await getDb()
    const now = new Date()

    const [updated] = await db
        .update(users)
        .set({ permissionLevel: permission ?? null, updatedAt: now })
        .where(eq(users.id, id))
        .returning()

    return updated ?? null
}

export const listUsersByPermission = async (permission: PermissionLevel) => {
    const db = await getDb()

    return db.query.users.findMany({
        where: { permissionLevel: permission },
    })
}

export const setAdminDmOptOut = async (id: string, optOut: boolean) => {
    const db = await getDb()
    const now = new Date()

    const [updated] = await db
        .update(users)
        .set({ adminDmOptOut: optOut, updatedAt: now })
        .where(eq(users.id, id))
        .returning()

    return updated ?? null
}

export const getAdminDmOptOut = async (id: string): Promise<boolean> => {
    const record = await getUserById(id)
    return record?.adminDmOptOut ?? false
}
