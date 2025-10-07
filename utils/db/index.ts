import { PGlite } from '@electric-sql/pglite'
import { createConsola } from 'consola'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema'

const logger = createConsola({ defaults: { tag: 'db' } })

const config = useRuntimeConfig()

type Schema = typeof schema

let db: PgliteDatabase<Schema> | null = null

export const getDb = async (): Promise<PgliteDatabase<Schema>> => {
    if (db) return db

    if (config.pglite.dataDir === 'memory://') logger.info('Using in-memory PGlite database')

    logger.info('Initializing PGlite database...')

    db = drizzle(new PGlite(config.pglite.dataDir), { schema })

    logger.success(`PGlite database initialized at ${config.pglite.dataDir}`)

    return db
}

export { schema }
