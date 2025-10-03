import { describe, expect, test } from 'bun:test'
import { discordCommands } from '../utils/discord/commands'

describe('discordCommands', () => {
    test('includes help command', () => {
        const command = discordCommands.find((item) => item.data.name === 'help')

        expect(command).toBeDefined()
        expect(command?.data.description).toContain('ヘルプ')
    })

    test('includes api-key command', () => {
        const command = discordCommands.find((item) => item.data.name === 'api-key')

        expect(command).toBeDefined()
        expect(command?.data.description).toContain('APIキー')
    })

    test('includes request-access command', () => {
        const command = discordCommands.find((item) => item.data.name === 'request-access')

        expect(command).toBeDefined()
        expect(command?.data.description).toContain('権限')
    })

    test('includes status command', () => {
        const command = discordCommands.find((item) => item.data.name === 'status')

        expect(command).toBeDefined()
        expect(command?.data.description).toContain('ステータス')
    })
})
