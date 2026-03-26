import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import type { Nitro } from 'nitro/types'
import { resolve } from 'pathe'

export interface DiscordCommandsModuleOptions {
    /**
     * Path to the directory containing discord command files.
     * Defaults to `server/discord/commands` relative to the Nitro root.
     */
    commandsDir?: string
}

export const createDiscordCommandsModule = (options: DiscordCommandsModuleOptions = {}) =>
    function discordCommandsModule(nitro: Nitro) {
        const commandsDir = options.commandsDir
            ? resolve(nitro.options.rootDir, options.commandsDir)
            : resolve(nitro.options.rootDir, 'server/discord/commands')

        nitro.options.virtual['#discord-commands'] = () => {
            const files = readdirSync(commandsDir).filter(
                (f) => f.endsWith('.ts') && !f.startsWith('_')
            )
            const imports = files
                .map(
                    (f, i) =>
                        `import cmd${i} from ${JSON.stringify(pathToFileURL(resolve(commandsDir, f)).href)}`
                )
                .join('\n')
            return `${imports}\nexport const discordCommands = [${files.map((_, i) => `cmd${i}`).join(', ')}]`
        }

        nitro.hooks.hook('types:extend', (types) => {
            const typesDir =
                nitro.options.typescript.generatedTypesDir ??
                resolve(nitro.options.rootDir, 'node_modules/.nitro/types')
            mkdirSync(typesDir, { recursive: true })
            writeFileSync(
                resolve(typesDir, 'discord-commands.d.ts'),
                `declare module '#discord-commands' {\n    export const discordCommands: DiscordCommand[]\n}\n`
            )
            if (types.tsConfig) {
                types.tsConfig.include ??= []
                types.tsConfig.include.push('./discord-commands.d.ts')
            }
        })
    }
