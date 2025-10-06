import { desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export interface BotStatusInput {
    message: string
    activityType: number
    setBy: string
}

export const saveBotStatus = async (input: BotStatusInput) => {
    const db = await getDb()
    const now = new Date()

    const [status] = await db
        .insert(botStatuses)
        .values({
            id: nanoid(),
            message: input.message,
            activityType: input.activityType,
            setBy: input.setBy,
            createdAt: now,
        })
        .returning()

    return status
}

export const getLatestBotStatus = async () => {
    const db = await getDb()

    const status = await db.query.botStatuses.findFirst({
        orderBy: desc(botStatuses.createdAt),
        with: {
            setByUser: true,
        },
    })

    return status
}

export const getBotStatusHistory = async (limit = 10) => {
    const db = await getDb()

    const statuses = await db.query.botStatuses.findMany({
        orderBy: [desc(botStatuses.createdAt)],
        limit,
        with: {
            setByUser: true,
        },
    })

    return statuses
}
