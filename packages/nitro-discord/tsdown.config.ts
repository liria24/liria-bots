import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: ['src/index.ts', 'src/discord.ts', 'src/nitro-module.ts'],
    format: 'esm',
    dts: true,
    clean: true,
    deps: {
        neverBundle: ['unstorage', '@liria/email-monitor', '#discord-commands'],
    },
})
