import type { createEmailMonitor } from '@liria/email-monitor'

type EmailMonitor = ReturnType<typeof createEmailMonitor>

let emailMonitor: EmailMonitor | undefined

export const getEmailMonitor = (): EmailMonitor | undefined => emailMonitor

export const setEmailMonitor = (monitor: EmailMonitor): void => {
    emailMonitor = monitor
}

export const clearEmailMonitor = (): void => {
    emailMonitor = undefined
}
