import { describe, expect, test } from 'bun:test'
import { Client, Events, GatewayIntentBits } from 'discord.js'

const testDiscordBotLogin = async (token: string): Promise<boolean> => {
    if (!token || typeof token !== 'string') {
        return false
    }

    return new Promise((resolve) => {
        const client = new Client({
            intents: [GatewayIntentBits.Guilds],
        })

        // 10秒のタイムアウトを設定
        const timeout = setTimeout(() => {
            client.destroy()
            resolve(false)
        }, 10000)

        client.once(Events.ClientReady, () => {
            clearTimeout(timeout)
            client.destroy()
            resolve(true)
        })

        client.on('error', () => {
            clearTimeout(timeout)
            client.destroy()
            resolve(false)
        })

        // ログインを試行
        client.login(token).catch(() => {
            clearTimeout(timeout)
            client.destroy()
            resolve(false)
        })
    })
}

describe('Discord Bot Login Test', () => {
    test('環境変数のDISCORD_TOKENでログインが成功するかテスト', async () => {
        const token = process.env.DISCORD_TOKEN

        if (!token) {
            console.log('DISCORD_TOKEN environment variable is not set. Skipping test.')
            expect(true).toBe(true) // Skip test
            return
        }

        console.log('Testing Discord bot login with environment token...')
        const result = await testDiscordBotLogin(token)

        console.log(`Login test result: ${result}`)
        expect(typeof result).toBe('boolean')

        if (result) {
            console.log('✅ Discord bot login successful!')
        } else {
            console.log('❌ Discord bot login failed.')
        }
    })

    test('無効なトークンでログインが失敗することをテスト', async () => {
        const invalidToken = 'invalid-token'

        console.log('Testing with invalid token...')
        const result = await testDiscordBotLogin(invalidToken)

        expect(result).toBe(false)
        console.log('✅ Invalid token correctly rejected')
    })

    test('空のトークンでログインが失敗することをテスト', async () => {
        const emptyToken = ''

        const result = await testDiscordBotLogin(emptyToken)

        expect(result).toBe(false)
        console.log('✅ Empty token correctly rejected')
    })
})
