import { relations } from 'drizzle-orm'
import {
    foreignKey,
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
} from 'drizzle-orm/pg-core'

export const permissionEnum = pgEnum('permission_level', ['granted', 'admin'])
export const permissionRequestStatusEnum = pgEnum('permission_request_status', [
    'pending',
    'approved',
    'rejected',
])

export const users = pgTable(
    'users',
    {
        id: text('id').primaryKey(),
        username: text('username'),
        permissionLevel: permissionEnum('permission_level'),
        createdAt: timestamp('created_at', { mode: 'date' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .defaultNow()
            .notNull(),
    },
    (table) => [index('users_permission_level_idx').on(table.permissionLevel)]
)

export const apiKeys = pgTable(
    'api_keys',
    {
        id: text('id').primaryKey(),
        userId: text('user_id').notNull(),
        name: text('name').notNull(),
        keyHash: text('key_hash').notNull(),
        lastFour: text('last_four').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' })
            .defaultNow()
            .notNull(),
        lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
        revokedAt: timestamp('revoked_at', { mode: 'date' }),
    },
    (table) => [
        index('api_keys_user_active_idx').on(table.userId, table.revokedAt),
        index('api_keys_verify_idx').on(table.id, table.revokedAt),
        index('api_keys_hash_idx').on(table.keyHash),
        foreignKey({
            name: 'api_keys_user_id_fkey',
            columns: [table.userId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const permissionRequests = pgTable(
    'permission_requests',
    {
        id: text('id').primaryKey(),
        requesterId: text('requester_id').notNull(),
        status: permissionRequestStatusEnum('status')
            .default('pending')
            .notNull(),
        createdAt: timestamp('created_at', { mode: 'date' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .defaultNow()
            .notNull(),
        resolvedBy: text('resolved_by').references(() => users.id),
        resolvedAt: timestamp('resolved_at', { mode: 'date' }),
        adminMessageId: text('admin_message_id'),
    },
    (table) => [
        index('permission_requests_requester_status_idx').on(
            table.requesterId,
            table.status
        ),
        index('permission_requests_status_idx').on(table.status),
        foreignKey({
            name: 'permission_requests_requester_id_fkey',
            columns: [table.requesterId],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const usersRelations = relations(users, ({ many }) => ({
    apiKeys: many(apiKeys),
    requests: many(permissionRequests),
}))

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
    user: one(users, {
        fields: [apiKeys.userId],
        references: [users.id],
    }),
}))

export const permissionRequestsRelations = relations(
    permissionRequests,
    ({ one }) => ({
        requester: one(users, {
            fields: [permissionRequests.requesterId],
            references: [users.id],
        }),
        resolver: one(users, {
            fields: [permissionRequests.resolvedBy],
            references: [users.id],
        }),
    })
)

export const botStatuses = pgTable(
    'bot_statuses',
    {
        id: text('id').primaryKey(),
        message: text('message').notNull(),
        activityType: integer('activity_type').notNull(),
        setBy: text('set_by').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('bot_statuses_created_at_idx').on(table.createdAt),
        foreignKey({
            name: 'bot_statuses_set_by_fkey',
            columns: [table.setBy],
            foreignColumns: [users.id],
        })
            .onDelete('cascade')
            .onUpdate('cascade'),
    ]
)

export const botStatusesRelations = relations(botStatuses, ({ one }) => ({
    setByUser: one(users, {
        fields: [botStatuses.setBy],
        references: [users.id],
    }),
}))

export type PermissionLevel = (typeof permissionEnum.enumValues)[number]
export type PermissionRequestStatus =
    (typeof permissionRequestStatusEnum.enumValues)[number]
