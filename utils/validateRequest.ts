import {
    getValidatedQuery,
    getValidatedRouterParams,
    type H3Event,
    readValidatedBody,
} from 'nitro/deps/h3'
import type { z } from 'zod'
import sanitizeObject from './sanitizeObject'

export const validateBody = async <T extends z.ZodTypeAny>(
    event: H3Event,
    schema: T,
    options?: { sanitize?: boolean }
): Promise<z.infer<T>> => {
    const result = await readValidatedBody(event, (body) => {
        if (options?.sanitize) body = sanitizeObject(body)

        return schema.safeParse(body)
    })

    if (!result.success) {
        console.error('Validation failed:', result.error)
        throw result.error
    }

    return result.data
}

export const validateFormData = async <T extends z.ZodTypeAny>(
    event: H3Event,
    schema: T,
    transformer?: (formData: FormData) => Record<string, unknown>
): Promise<z.infer<T>> => {
    const formData = await event.req.formData()

    // デフォルトはFormDataをオブジェクトに変換
    const dataToValidate = transformer
        ? transformer(formData)
        : Object.fromEntries(formData.entries())

    const result = schema.safeParse(dataToValidate)

    if (!result.success) throw result.error

    return result.data
}

export const validateParams = async <T extends z.ZodTypeAny>(
    event: H3Event,
    schema: T
): Promise<z.infer<T>> => {
    const result = await getValidatedRouterParams(event, (body) => schema.safeParse(body))

    if (!result.success) throw result.error

    return result.data
}

export const validateQuery = async <T extends z.ZodTypeAny>(
    event: H3Event,
    schema: T
): Promise<z.infer<T>> => {
    const result = await getValidatedQuery(event, (query) => schema.safeParse(query))

    if (!result.success) throw result.error

    return result.data
}
