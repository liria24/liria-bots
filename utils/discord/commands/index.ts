import { helloCommand } from './hello'
import { issueApiKeyCommand } from './issueApiKey'
import { requestAccessCommand } from './requestAccess'
import { setStatusCommand } from './setStatus'
import { statusHistoryCommand } from './statusHistory'

export const discordCommands: DiscordCommand[] = [
    helloCommand,
    issueApiKeyCommand,
    requestAccessCommand,
    setStatusCommand,
    statusHistoryCommand,
]
