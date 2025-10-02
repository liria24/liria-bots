import { describe, expect, test } from 'bun:test'
import { discordCommands } from '../utils/discord/commands'

describe('discordCommands', () => {
    test('includes hello command', () => {
        const hello = discordCommands.find((command) => command.data.name === 'hello')

        expect(hello).toBeDefined()
        expect(hello?.data.description).toBe('Replies with a friendly greeting.')
    })

    test('includes issue-apikey command', () => {
        const command = discordCommands.find((item) => item.data.name === 'issue-apikey')

        expect(command).toBeDefined()
        expect(command?.data.description).toContain('APIキー')
    })

    test('includes request-access command', () => {
        const command = discordCommands.find((item) => item.data.name === 'request-access')

        expect(command).toBeDefined()
        expect(command?.data.description).toContain('権限')
    })
})
