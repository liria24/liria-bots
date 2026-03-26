import { readdirSync } from 'node:fs'
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
    }
