import type { Storage } from 'unstorage'

export interface BotStatusEntry {
    id: string
    message: string
    activityType: number
    setBy?: string
    createdAt: string
}

const MAX_HISTORY = 100
const HISTORY_KEY = 'history'

export class BotStatusStorage {
    private storage: Storage

    constructor(storage: Storage) {
        this.storage = storage
    }

    async save(entry: Omit<BotStatusEntry, 'id' | 'createdAt'>): Promise<BotStatusEntry> {
        const newEntry: BotStatusEntry = {
            id: crypto.randomUUID(),
            ...entry,
            createdAt: new Date().toISOString(),
        }
        const existing = (await this.storage.getItem<BotStatusEntry[]>(HISTORY_KEY)) ?? []
        const updated = [newEntry, ...existing].slice(0, MAX_HISTORY)
        await this.storage.setItem(HISTORY_KEY, updated)
        return newEntry
    }

    async getLatest(): Promise<BotStatusEntry | null> {
        const history = await this.storage.getItem<BotStatusEntry[]>(HISTORY_KEY)
        return history?.[0] ?? null
    }

    async getHistory(limit = 10): Promise<BotStatusEntry[]> {
        const history = (await this.storage.getItem<BotStatusEntry[]>(HISTORY_KEY)) ?? []
        return history.slice(0, limit)
    }
}

let botStatusStorage: BotStatusStorage | undefined

export const getBotStatusStorage = (): BotStatusStorage | undefined => botStatusStorage
export const setBotStatusStorage = (storage: BotStatusStorage): void => {
    botStatusStorage = storage
}
export const clearBotStatusStorage = (): void => {
    botStatusStorage = undefined
}
