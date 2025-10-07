import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: './utils/db/schema.ts',
    out: './drizzle',
    dialect: 'sqlite',
    dbCredentials: {
        url: `file:${process.env.SQLITE_DB_PATH ?? './data/sqlite.db'}`,
    },
})
