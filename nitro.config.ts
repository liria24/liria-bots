export default defineNitroConfig({
    compatibilityDate: '2025-09-29',

    preset: 'node-server',

    runtimeConfig: {
        key: import.meta.env.KEY,
        pglite: {
            dataDir: import.meta.env.PGLITE_DATA_DIR || './postgres/data',
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

    imports: {
        imports: [
            {
                name: 'z',
                from: 'zod',
            },
        ],
    },

    experimental: {
        asyncContext: true,
        openAPI: true,
        wasm: true,
    },
})
