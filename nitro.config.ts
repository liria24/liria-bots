export default defineNitroConfig({
    compatibilityDate: '2025-09-29',

    preset: 'node-server',

    // 開発モードの設定
    dev: import.meta.env.NODE_ENV !== 'production',

    // TypeScript設定
    typescript: {
        generateTsConfig: true,
    },

    runtimeConfig: {
        database: {
            url: import.meta.env.DATABASE_URL || '',
        },
        discord: {
            token: import.meta.env.DISCORD_TOKEN || '',
            clientId: import.meta.env.DISCORD_CLIENT_ID || '',
            guildId: import.meta.env.DISCORD_GUILD_ID || '',
            installLink: import.meta.env.DISCORD_INSTALL_LINK || '',
        },
        public: {
            appName: 'Discord Bot',
        },
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
    },
})
