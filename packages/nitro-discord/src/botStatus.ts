import type { BotStatusStorage } from './botStatusStorage.js'

let botStatusStorage: BotStatusStorage | undefined

export const getBotStatusStorage = (): BotStatusStorage | undefined => botStatusStorage
export const setBotStatusStorage = (storage: BotStatusStorage): void => {
    botStatusStorage = storage
}
export const clearBotStatusStorage = (): void => {
    botStatusStorage = undefined
}
