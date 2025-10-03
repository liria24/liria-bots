import { apiKeyCommand } from './apiKey'
import { helpCommand } from './help'
import { requestAccessCommand } from './requestAccess'
import { statusCommand } from './status'

export const discordCommands: DiscordCommand[] = [
    helpCommand,
    statusCommand,
    apiKeyCommand,
    requestAccessCommand,
]
