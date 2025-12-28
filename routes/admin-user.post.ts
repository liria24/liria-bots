import { nanoid } from 'nanoid'
import { defineHandler, HTTPError } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { z } from 'zod'
import { getDb } from '../utils/db'
import { users } from '../utils/db/schema'
import { validateBody } from '../utils/validateRequest'

const body = z.object({
    id: z.string().optional(),
    username: z.string().min(1),
    adminDmOptOut: z.boolean().optional().default(false),
})

export default defineHandler(async (event) => {
    const config = useRuntimeConfig()

    const authorization = event.req.headers.get('authorization')
    if (authorization !== `Bearer ${config.key}`)
        throw new HTTPError({ statusCode: 401, statusMessage: 'Unauthorized' })

    const { id, username, adminDmOptOut } = await validateBody(event, body)
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
