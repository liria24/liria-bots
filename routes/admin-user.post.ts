const body = z.object({
    id: z.string().optional(),
    username: z.string().min(1),
    adminDmOptOut: z.boolean().optional().default(false),
})

export default defineEventHandler(async () => {
    const config = useRuntimeConfig()

    const authorization = getRequestHeader(useEvent(), 'authorization')
    if (authorization !== `Bearer ${config.key}`)
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

    const { id, username, adminDmOptOut } = await validateBody(body)
    const db = await getDb()

    const result = await db
        .insert(users)
        .values({
            id,
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
