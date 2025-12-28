import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
    compatibilityDate: 'latest',

    serverDir: './',

    preset: 'node-server',

    runtimeConfig: {
        key: import.meta.env.KEY,
        sqlite: {
            dbPath: import.meta.env.SQLITE_DB_PATH || './data/sqlite.db',
        },
        discord: {
            token: import.meta.env.DISCORD_TOKEN || '',
            clientId: import.meta.env.DISCORD_CLIENT_ID || '',
            guildId: import.meta.env.DISCORD_GUILD_ID || '',
            installLink: import.meta.env.DISCORD_INSTALL_LINK || '',
        },
        email: {
            monitor: import.meta.env.EMAIL_MONITOR === 'true',
        },
        memoryMonitor: import.meta.env.MEMORY_MONITOR === 'true',
        public: {
            appName: 'Discord Bot',
        },
    },

    routeRules: {
        '/': { redirect: import.meta.env.DISCORD_INSTALL_LINK },
    },

    experimental: {
        asyncContext: true,
        openAPI: true,
        wasm: true,
    },
})
