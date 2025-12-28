import type { DiscordCommand } from '../../types'
import { apiKeyCommand } from './apiKey'
import { emailCommand } from './email'
import { helpCommand } from './help'
import { preferenceCommand } from './preference'
import { statusCommand } from './status'

export const discordCommands: DiscordCommand[] = [
    helpCommand,
    statusCommand,
    apiKeyCommand,
    preferenceCommand,
    emailCommand,
]
