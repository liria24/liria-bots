import type { ParsedMail } from 'mailparser'

export interface EmailAccount {
    id: string
    name: string
    email: string
    imapHost: string
    imapPort: number
    imapUser: string
    imapPassword: string
    enabled: boolean
    lastCheckedAt: Date | null
    createdAt: Date
}

export interface CreateEmailAccountInput {
    name: string
    email: string
    imapHost: string
    imapPort?: number
    imapUser: string
    imapPassword: string
}

export interface EmailMonitorDeps {
    onNewEmail(account: EmailAccount, email: ParsedMail): Promise<void>
}
