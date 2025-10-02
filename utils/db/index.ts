import { createConsola } from 'consola'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, type PoolClient, type QueryResult } from 'pg'
import {
    DEFAULT_RETRYABLE_ERRORS,
    isRetryableError,
    type RetryOptions,
    retryWithBackoff,
} from '../retry'
import * as schema from './schema'

const logger = createConsola({ defaults: { tag: 'db' } })

type Schema = typeof schema

const DB_SYMBOL = Symbol.for('discord-bot:db')
const DB_INIT_SYMBOL = Symbol.for('discord-bot:db-init')
const POOL_RETRY_SYMBOL = Symbol.for('discord-bot:db-pool-retry')
const POOL_SHUTDOWN_SYMBOL = Symbol.for('discord-bot:db-pool-shutdown')

const POOL_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 5,
    minTimeout: 1000,
    maxTimeout: 30000,
    factor: 2,
    retryableErrors: DEFAULT_RETRYABLE_ERRORS,
}

type GlobalWithDb = typeof globalThis & {
    [DB_SYMBOL]?: {
        pool: Pool
        db: NodePgDatabase<Schema>
    }
    [DB_INIT_SYMBOL]?: Promise<{
        pool: Pool
        db: NodePgDatabase<Schema>
    }>
}

const getConnectionString = (): string => {
    const url = process.env.DATABASE_URL
    if (!url) {
        throw new Error('DATABASE_URL is not configured')
    }
    return url
}

const invalidateDbClient = async (pool?: Pool): Promise<void> => {
    const globalRef = globalThis as GlobalWithDb
    const currentClient = globalRef[DB_SYMBOL]

    if (pool) {
        const poolState = pool as unknown as Record<symbol, unknown>
        if (!poolState[POOL_SHUTDOWN_SYMBOL]) {
            poolState[POOL_SHUTDOWN_SYMBOL] = true
            try {
                await pool.end()
            } catch (error) {
                logger.warn(
                    {
                        error: error instanceof Error ? error.message : String(error),
                    },
                    'Failed to close database pool while resetting'
                )
            } finally {
                delete poolState[POOL_SHUTDOWN_SYMBOL]
            }
        }
    }

    if (currentClient?.pool === pool) {
        globalRef[DB_SYMBOL] = undefined
    }

    globalRef[DB_INIT_SYMBOL] = undefined
}

const runPoolOperationWithRetry = async <T>(
    pool: Pool,
    operation: () => Promise<T>
): Promise<T> => {
    try {
        return await retryWithBackoff(operation, POOL_RETRY_OPTIONS)
    } catch (error) {
        if (isRetryableError(error, POOL_RETRY_OPTIONS.retryableErrors)) {
            logger.warn(
                {
                    error: error instanceof Error ? error.message : String(error),
                },
                'Database operation failed after retry attempts; resetting pool'
            )
            await invalidateDbClient(pool)
        }
        throw error
    }
}

const attachPoolRetry = (pool: Pool): void => {
    const poolState = pool as unknown as Record<symbol, unknown>
    if (poolState[POOL_RETRY_SYMBOL]) {
        return
    }

    const originalConnect = pool.connect.bind(pool)
    const connectWithRetry: Pool['connect'] = ((
        callback?: (err: Error, client: PoolClient, done: (release?) => void) => void
    ) => {
        if (callback) {
            return originalConnect(callback)
        }
        return runPoolOperationWithRetry(pool, () => originalConnect())
    }) as Pool['connect']

    pool.connect = connectWithRetry

    const originalQuery = pool.query.bind(pool)
    const queryWithRetry: Pool['query'] = ((...args: unknown[]) => {
        const maybeCallback = args[args.length - 1]
        if (typeof maybeCallback === 'function') {
            return (originalQuery as (...args: unknown[]) => unknown)(...args)
        }

        return runPoolOperationWithRetry(pool, () =>
            (originalQuery as (...queryArgs: unknown[]) => Promise<QueryResult<unknown>>)(...args)
        )
    }) as Pool['query']

    pool.query = queryWithRetry

    Object.defineProperty(poolState, POOL_RETRY_SYMBOL, {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false,
    })
}

const createDbClient = async () => {
    const pool = new Pool({
        connectionString: getConnectionString(),
        // Railway Postgres Serverless 向けの設定
        connectionTimeoutMillis: 30000, // 30秒
        idleTimeoutMillis: 30000,
        max: 10, // 最大接続数
        // コールドスタート時の接続待機時間を確保
        query_timeout: 30000,
    })

    // コールドスタート時の初回接続をリトライ
    logger.info('Attempting to connect to database...')
    await retryWithBackoff(
        async () => {
            const client = await pool.connect()
            await client.query('SELECT 1')
            client.release()
            logger.success('Database connection established successfully')
        },
        {
            maxRetries: 5,
            minTimeout: 1000,
            maxTimeout: 30000,
            factor: 2,
        }
    )

    attachPoolRetry(pool)

    const db = drizzle(pool, { schema })
    return { pool, db }
}

const initializeDb = async (): Promise<void> => {
    const globalRef = globalThis as GlobalWithDb

    if (globalRef[DB_SYMBOL]) {
        return
    }

    if (!globalRef[DB_INIT_SYMBOL]) {
        globalRef[DB_INIT_SYMBOL] = createDbClient()
    }

    try {
        const client = await globalRef[DB_INIT_SYMBOL]
        globalRef[DB_SYMBOL] = client
        globalRef[DB_INIT_SYMBOL] = undefined
    } catch (error) {
        globalRef[DB_INIT_SYMBOL] = undefined
        throw error
    }
}

export const getDb = async (): Promise<NodePgDatabase<Schema>> => {
    await initializeDb()
    const globalRef = globalThis as GlobalWithDb
    const dbClient = globalRef[DB_SYMBOL]
    if (!dbClient) throw new Error('Database client is not initialized')

    return dbClient.db
}

export const getDbPool = async (): Promise<Pool> => {
    await initializeDb()
    const globalRef = globalThis as GlobalWithDb
    const dbClient = globalRef[DB_SYMBOL]
    if (!dbClient) throw new Error('Database client is not initialized')

    return dbClient.pool
}

export { schema }
