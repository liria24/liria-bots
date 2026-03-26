import { createDiscordCommandsModule } from '@liria/nitro-discord/nitro-module'
import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
    compatibilityDate: 'latest',

    serverDir: './server',

    buildDir: './.nitro',

    preset: 'node-server',

    runtimeConfig: {
        key: import.meta.env.KEY || '',
        sqlite: {
            dbPath: import.meta.env.SQLITE_DB_PATH || './data/sqlite.db',
        },
        discord: {
            token: import.meta.env.DISCORD_TOKEN || '',
            clientId: import.meta.env.DISCORD_CLIENT_ID || '',
            guildId: import.meta.env.DISCORD_GUILD_ID || '',
            installLink: import.meta.env.DISCORD_INSTALL_LINK || '',
        },
        emailMonitor: {
            enabled: import.meta.env.EMAIL_MONITOR === 'true',
        },
        storagePath: {
            emailMonitor: import.meta.env.EMAIL_STORAGE_PATH || './data/email-monitor.db',
            discordStatus: import.meta.env.DISCORD_STATUS_PATH || './data/discord-status.db',
        },
        public: {
            appName: 'Liria Bot',
        },
    },

    modules: [createDiscordCommandsModule()],

    routeRules: {
        '/': { redirect: import.meta.env.DISCORD_INSTALL_LINK },
    },

    imports: {},

    typescript: {
        strict: true,
        generateTsConfig: true,
    },

    experimental: {
        asyncContext: true,
        openAPI: true,
    },

    rolldownConfig: {
        external: ['zlib-sync'],
    },
})
