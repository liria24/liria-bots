import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
    users: {
        apiKeys: r.many.apiKeys({
            from: r.users.id,
            to: r.apiKeys.userId,
        }),
        requests: r.many.permissionRequests({
            from: r.users.id,
            to: r.permissionRequests.requesterId,
        }),
    },
    apiKeys: {
        user: r.one.users({
            from: r.apiKeys.userId,
            to: r.users.id,
        }),
    },
    permissionRequests: {
        requester: r.one.users({
            from: r.permissionRequests.requesterId,
            to: r.users.id,
        }),
        resolver: r.one.users({
            from: r.permissionRequests.resolvedBy,
            to: r.users.id,
            optional: true,
        }),
    },
    botStatuses: {
        setByUser: r.one.users({
            from: r.botStatuses.setBy,
            to: r.users.id,
        }),
    },
}))
