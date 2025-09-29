import { describe, expect, test } from 'bun:test'
import { nanoid } from 'nanoid'
import { generateApiKeySecret } from '../utils/services/apiKeyService'

describe('API Key Service', () => {
    test('generateApiKeySecret uses nanoid', () => {
        const result = generateApiKeySecret()
        
        expect(result.id).toBeDefined()
        expect(result.secret).toBeDefined()
        expect(result.rawKey).toBeDefined()
        expect(result.keyHash).toBeDefined()
        expect(result.lastFour).toBeDefined()
        
        // Check that the rawKey has the correct format
        expect(result.rawKey).toMatch(/^liria_sk_[\w-]+\.[\w-]+$/)
        
        // Check that lastFour is indeed the last 4 characters
        expect(result.lastFour).toBe(result.secret.slice(-4))
    })

    test('generateApiKeySecret produces unique results', () => {
        const result1 = generateApiKeySecret()
        const result2 = generateApiKeySecret()
        
        expect(result1.id).not.toBe(result2.id)
        expect(result1.secret).not.toBe(result2.secret)
        expect(result1.rawKey).not.toBe(result2.rawKey)
    })

    test('nanoid generates 10 character default names', () => {
        const defaultName = nanoid(10)
        expect(defaultName).toHaveLength(10)
    })
})