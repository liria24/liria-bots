import { foreignKey, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// SQLite doesn't have native enum types, so we use text with type constraints
export const permissionLevelValues = ['granted', 'admin'] as const
export const permissionRequestStatusValues = ['pending', 'approved', 'rejected'] as const

export const users = sqliteTable(
    'users',
    {
        id: text().primaryKey(),
        username: text(),
        permissionLevel: text('permission_level').$type<(typeof permissionLevelValues)[number]>(),
        adminDmOptOut: integer('admin_dm_opt_out', { mode: 'boolean' }).default(false).notNull(),
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .$defaultFn(() => new Date()),
        updatedAt: integer('updated_at', { mode: 'timestamp' })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => [index('users_permission_level_idx').on(table.permissionLevel)]
)

export const apiKeys = sqliteTable(
    'api_keys',
    {
        id: text().primaryKey(),
        userId: text('user_id').notNull(),
        name: text().notNull(),
        keyHash: text('key_hash').notNull(),
        lastFour: text('last_four').notNull(),
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .$defaultFn(() => new Date()),
        lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
        revokedAt: integer('revoked_at', { mode: 'timestamp' }),
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

export const permissionRequests = sqliteTable(
    'permission_requests',
    {
        id: text().primaryKey(),
        requesterId: text('requester_id').notNull(),
        status: text()
            .$type<(typeof permissionRequestStatusValues)[number]>()
            .default('pending')
            .notNull(),
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .$defaultFn(() => new Date()),
        updatedAt: integer('updated_at', { mode: 'timestamp' })
            .notNull()
            .$defaultFn(() => new Date()),
        resolvedBy: text('resolved_by').references(() => users.id),
        resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
        adminMessageId: text('admin_message_id'),
    },
    (table) => [
        index('permission_requests_requester_status_idx').on(table.requesterId, table.status),
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

export const botStatuses = sqliteTable(
    'bot_statuses',
    {
        id: text().primaryKey(),
        message: text().notNull(),
        activityType: integer('activity_type').notNull(),
        setBy: text('set_by').notNull(),
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .$defaultFn(() => new Date()),
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

export const emailAccounts = sqliteTable(
    'email_accounts',
    {
        id: text().primaryKey(),
        name: text().notNull(),
        email: text().notNull(),
        imapHost: text('imap_host').notNull(),
        imapPort: integer('imap_port').notNull().default(993),
        imapUser: text('imap_user').notNull(),
        imapPassword: text('imap_password').notNull(),
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
        lastCheckedAt: integer('last_checked_at', { mode: 'timestamp' }),
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .$defaultFn(() => new Date()),
        updatedAt: integer('updated_at', { mode: 'timestamp' })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => [
        index('email_accounts_enabled_idx').on(table.enabled),
        index('email_accounts_last_checked_idx').on(table.lastCheckedAt),
    ]
)

export const emailCheckSettings = sqliteTable('email_check_settings', {
    id: text().primaryKey().default('singleton'),
    checkIntervalMinutes: integer('check_interval_minutes').notNull().default(30),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date()),
})

export type PermissionLevel = (typeof permissionLevelValues)[number]
export type PermissionRequestStatus = (typeof permissionRequestStatusValues)[number]
