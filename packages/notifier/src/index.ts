import { ofetch } from 'ofetch'

export interface NotifierOptions {
    /** Base URL of the server. */
    baseUrl?: string
    /** API key. */
    apiKey?: string
}

export interface EmbedField {
    name: string
    value: string
    inline?: boolean
}

export interface EmbedImage {
    url: string
}

export interface EmbedAuthor {
    name: string
    url?: string
    icon_url?: string
}

export interface EmbedFooter {
    text: string
    icon_url?: string
}

export interface Embed {
    title?: string
    description?: string
    color?: number
    url?: string
    timestamp?: string
    thumbnail?: EmbedImage
    image?: EmbedImage
    author?: EmbedAuthor
    fields?: EmbedField[]
    footer?: EmbedFooter
}

export interface MessageBody {
    content?: string
    embeds?: Embed[]
}

const resolveOptions = (options?: NotifierOptions) => {
    const baseUrl = options?.baseUrl
    const apiKey = options?.apiKey

    if (!baseUrl) throw new Error('baseUrl is required. Pass baseUrl option.')
    if (!apiKey) throw new Error('apiKey is required. Pass apiKey option.')

    return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

/**
 * POST to /admin/message to send a message.
 */
export const sendMessage = async (body: MessageBody, options?: NotifierOptions) => {
    const { baseUrl, apiKey } = resolveOptions(options)

    return ofetch(`${baseUrl}/admin/message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body,
    })
}

/**
 * GET /admin/check to verify connectivity and authentication.
 */
export const checkConnection = async (options?: NotifierOptions) => {
    const { baseUrl, apiKey } = resolveOptions(options)

    return ofetch<{ status: string }>(`${baseUrl}/admin/check`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
    })
}
