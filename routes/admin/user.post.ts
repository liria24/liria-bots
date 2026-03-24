import { nanoid } from 'nanoid'
import { z } from 'zod'

import { getDb } from '../../utils/db'
import { users } from '../../utils/db/schema'
import { adminHandler } from '../../utils/eventHandler'
import { validateBody } from '../../utils/validateRequest'

const body = z.object({
    id: z.string().optional(),
    username: z.string().min(1),
    adminDmOptOut: z.boolean().optional().default(false),
})

export default adminHandler(async () => {
    const { id, username, adminDmOptOut } = await validateBody(body)
    const db = await getDb()

    const result = await db
        .insert(users)
        .values({
            id: id || nanoid(6),
            username,
            adminDmOptOut,
            permissionLevel: 'admin',
        })
        .onConflictDoUpdate({
            target: users.id,
            set: {
                username,
                adminDmOptOut,
                permissionLevel: 'admin',
                updatedAt: new Date(),
            },
        })
        .returning()

    return result
})
