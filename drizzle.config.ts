import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: './utils/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    driver: 'pglite',
    dbCredentials: {
        url: process.env.PGLITE_DATA_DIR ?? './postgres/data',
    },
})
