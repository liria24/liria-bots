const CONTROLLER_SYMBOL = Symbol.for('discord-bot:controller')

type GlobalWithDiscordBot = typeof globalThis & {
    [CONTROLLER_SYMBOL]?: DiscordBotController
}

export const getDiscordBotController = (): DiscordBotController | undefined => {
    const globalRef = globalThis as GlobalWithDiscordBot
    return globalRef[CONTROLLER_SYMBOL]
}

export const setDiscordBotController = (controller: DiscordBotController): void => {
    const globalRef = globalThis as GlobalWithDiscordBot
    globalRef[CONTROLLER_SYMBOL] = controller
}

export const clearDiscordBotController = (): void => {
    const globalRef = globalThis as GlobalWithDiscordBot
    delete globalRef[CONTROLLER_SYMBOL]
}
