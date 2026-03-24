import { nanoid } from 'nanoid'

import { getDb } from '../db'
import { botStatuses } from '../db/schema'

export interface BotStatusInput {
    message: string
    activityType: number
    setBy?: string
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
            createdAt: now,
            setBy: input.setBy,
        })
        .returning()

    return status
}

export const getLatestBotStatus = async () => {
    const db = await getDb()

    const status = await db.query.botStatuses.findFirst({
        orderBy: { createdAt: 'desc' },
        with: {
            setByUser: true,
        },
    })

    return status
}

export const getBotStatusHistory = async (limit = 10) => {
    const db = await getDb()

    const statuses = await db.query.botStatuses.findMany({
        orderBy: { createdAt: 'desc' },
        limit,
        with: {
            setByUser: true,
        },
    })

    return statuses
}
