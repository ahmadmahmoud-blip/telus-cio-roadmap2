/**
 * API Contract — Org Roadmap Tool
 *
 * Canonical TypeScript types for all request/response shapes.
 * These are the source of truth for both the Fastify API and the Next.js client.
 * Generate a shared `packages/types` package from this file.
 */

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export type ItemStatus =
  | 'Discovery'
  | 'Planned'
  | 'In Progress'
  | 'Shipped'
  | 'Blocked'
  | 'Cancelled'

export type ItemPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type ConfidenceLevel = 'High' | 'Medium' | 'Low' | 'TBD'

export type UserRole = 'admin' | 'editor' | 'viewer'

export type AuditAction = 'created' | 'updated' | 'archived'

export type ZoomLevel = 'year' | 'quarter' | 'month'

export type ExportSchedule = 'disabled' | 'daily' | 'weekly'

export type SyncInterval = '15min' | '1hr' | '4hr' | 'manual'

// ─────────────────────────────────────────────
// Core Domain Types
// ─────────────────────────────────────────────

export interface Squad {
  id: string
  name: string
  color: string
  productAreaId: string | null
  leadUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface ProductArea {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: UserRole
  squadIds: string[]
  lastLoginAt: string | null
  createdAt: string
}

export interface AuthUser extends User {
  sessionId: string
}

export interface JiraLink {
  key: string           // e.g. "PROJ-123"
  summary: string
  jiraStatus: string
  url: string
  type: 'epic' | 'issue'
  lastSyncedAt: string | null
}

export interface RoadmapItem {
  id: string
  title: string
  description: string | null
  squadId: string
  squad: Pick<Squad, 'id' | 'name' | 'color'>
  productAreaId: string
  productArea: Pick<ProductArea, 'id' | 'name' | 'color'>
  status: ItemStatus
  priority: ItemPriority
  targetQuarterStart: string       // "2025-Q1"
  targetQuarterEnd: string         // "2025-Q3"
  confidence: ConfidenceLevel
  jiraLinks: JiraLink[]
  labels: string[]
  createdById: string
  createdBy: Pick<User, 'id' | 'name' | 'avatarUrl'>
  updatedById: string
  updatedBy: Pick<User, 'id' | 'name' | 'avatarUrl'>
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface AuditLogEntry {
  id: string
  entityType: string
  entityId: string
  entityTitle: string | null      // denormalized for display
  action: AuditAction
  changedBy: Pick<User, 'id' | 'name' | 'avatarUrl'>
  diff: Record<string, { before: unknown; after: unknown }>
  timestamp: string
}

export interface Notification {
  id: string
  type: 'item_updated' | 'item_assigned' | 'jira_sync_error' | 'sheets_export_complete'
  message: string
  entityId: string | null
  entityType: string | null
  readAt: string | null
  createdAt: string
}

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginationParams {
  page?: number           // default 1
  pageSize?: number       // default 25, max 100
}

// ─────────────────────────────────────────────
// API: Roadmap Items
// ─────────────────────────────────────────────

/** GET /api/items */
export interface ListItemsParams extends PaginationParams {
  squads?: string[]
  areas?: string[]
  statuses?: ItemStatus[]
  priorities?: ItemPriority[]
  quarterStart?: string        // filter: items overlapping after this quarter
  quarterEnd?: string          // filter: items overlapping before this quarter
  labels?: string[]
  search?: string
  sortBy?: 'title' | 'status' | 'priority' | 'targetQuarterStart' | 'targetQuarterEnd' | 'updatedAt'
  sortDir?: 'asc' | 'desc'
  archived?: boolean           // default false
  summary?: boolean            // if true, returns summary stats only
}

export type ListItemsResponse = PaginatedResponse<RoadmapItem>

/** GET /api/items — summary mode */
export interface ItemsSummary {
  total: number
  byStatus: Record<ItemStatus, number>
  byArea: Array<{ areaId: string; areaName: string; byStatus: Record<ItemStatus, number> }>
  bySquad: Array<{ squadId: string; squadName: string; count: number }>
  atRiskCount: number
}

/** POST /api/items */
export interface CreateItemBody {
  title: string
  description?: string
  squadId: string
  productAreaId: string
  status?: ItemStatus              // default "Discovery"
  priority?: ItemPriority          // default "P2"
  targetQuarterStart: string
  targetQuarterEnd: string
  confidence?: ConfidenceLevel     // default "TBD"
  labels?: string[]
  jiraLinks?: string[]             // array of Jira keys; resolved server-side
}

export type CreateItemResponse = RoadmapItem

/** GET /api/items/:id */
export interface GetItemResponse extends RoadmapItem {
  history: AuditLogEntry[]
}

/** PUT /api/items/:id */
export type UpdateItemBody = Partial<Omit<CreateItemBody, 'squadId' | 'productAreaId'>> & {
  squadId?: string
  productAreaId?: string
}

export type UpdateItemResponse = RoadmapItem

/** DELETE /api/items/:id (soft archive) */
export interface ArchiveItemResponse {
  id: string
  archivedAt: string
}

// ─────────────────────────────────────────────
// API: Squads
// ─────────────────────────────────────────────

/** GET /api/squads */
export type ListSquadsResponse = Squad[]

/** POST /api/squads */
export interface CreateSquadBody {
  name: string
  color: string
  productAreaId?: string
  leadUserId?: string
}

export type CreateSquadResponse = Squad

/** PUT /api/squads/:id */
export type UpdateSquadBody = Partial<CreateSquadBody>
export type UpdateSquadResponse = Squad

/** DELETE /api/squads/:id */
export interface DeleteSquadResponse {
  id: string
  deleted: true
}

// ─────────────────────────────────────────────
// API: Product Areas
// ─────────────────────────────────────────────

/** GET /api/product-areas */
export type ListAreasResponse = ProductArea[]

/** POST /api/product-areas */
export interface CreateAreaBody {
  name: string
  color: string
}

export type CreateAreaResponse = ProductArea

/** PUT /api/product-areas/:id */
export type UpdateAreaBody = Partial<CreateAreaBody>
export type UpdateAreaResponse = ProductArea

/** DELETE /api/product-areas/:id */
export interface DeleteAreaResponse {
  id: string
  deleted: true
}

// ─────────────────────────────────────────────
// API: Users
// ─────────────────────────────────────────────

/** GET /api/users */
export interface ListUsersParams extends PaginationParams {
  role?: UserRole
  squadId?: string
  search?: string
}

export type ListUsersResponse = PaginatedResponse<User>

/** POST /api/users/invite */
export interface InviteUserBody {
  email: string
  role: UserRole
  squadIds?: string[]              // required if role === 'editor'
}

export interface InviteUserResponse {
  email: string
  invitedAt: string
  expiresAt: string
}

/** PUT /api/users/:id */
export interface UpdateUserBody {
  role?: UserRole
  squadIds?: string[]
  name?: string
}

export type UpdateUserResponse = User

/** DELETE /api/users/:id */
export interface RemoveUserResponse {
  id: string
  removed: true
}

/** GET /api/auth/me */
export type GetMeResponse = AuthUser

// ─────────────────────────────────────────────
// API: Audit Log
// ─────────────────────────────────────────────

/** GET /api/audit */
export interface ListAuditParams extends PaginationParams {
  entityId?: string
  entityType?: string
  userId?: string
  action?: AuditAction
  from?: string                   // ISO date string
  to?: string                     // ISO date string
}

export type ListAuditResponse = PaginatedResponse<AuditLogEntry>

// ─────────────────────────────────────────────
// API: Notifications
// ─────────────────────────────────────────────

/** GET /api/notifications */
export interface ListNotificationsParams extends PaginationParams {
  unreadOnly?: boolean
}

export type ListNotificationsResponse = PaginatedResponse<Notification>

/** POST /api/notifications/read-all */
export interface MarkAllReadResponse {
  updatedCount: number
}

/** PATCH /api/notifications/:id/read */
export interface MarkReadResponse {
  id: string
  readAt: string
}

// ─────────────────────────────────────────────
// API: Jira Integration
// ─────────────────────────────────────────────

/** GET /api/integrations/jira */
export interface JiraConnectionStatus {
  connected: boolean
  jiraUser: string | null          // Jira account display name
  jiraBaseUrl: string | null
  syncInterval: SyncInterval
  lastGlobalSyncAt: string | null
  connectUrl: string | null        // OAuth URL if not connected
}

/** POST /api/integrations/jira/connect (OAuth callback — internal) */
export interface JiraConnectBody {
  code: string
  state: string
}

/** PUT /api/integrations/jira/config */
export interface UpdateJiraConfigBody {
  syncInterval: SyncInterval
  jiraBaseUrl?: string             // required for Data Center
}

/** POST /api/integrations/jira/disconnect */
export interface JiraDisconnectResponse {
  disconnected: true
}

/** POST /api/integrations/jira/sync/:itemId */
export interface JiraSyncItemResponse {
  itemId: string
  jiraLinks: JiraLink[]
  syncedAt: string
}

/** GET /api/integrations/jira/sync-log */
export interface JiraSyncLogEntry {
  itemId: string
  itemTitle: string
  syncedAt: string
  success: boolean
  error: string | null
}

export type JiraSyncLogResponse = PaginatedResponse<JiraSyncLogEntry>

// ─────────────────────────────────────────────
// API: Google Sheets Integration
// ─────────────────────────────────────────────

/** GET /api/integrations/google */
export interface GoogleConnectionStatus {
  connected: boolean
  googleUser: string | null        // Google account email
  exportConfig: GoogleExportConfig | null
  lastExportAt: string | null
  connectUrl: string | null
}

export interface GoogleExportConfig {
  spreadsheetId: string
  spreadsheetUrl: string
  sheetTabName: string
  schedule: ExportSchedule
}

/** PUT /api/integrations/google/config */
export interface UpdateGoogleConfigBody {
  spreadsheetId?: string
  sheetTabName?: string
  schedule?: ExportSchedule
}

/** POST /api/integrations/google/export */
/** Triggers async export job. Returns job reference. */
export interface TriggerExportResponse {
  jobId: string
  status: 'queued'
  estimatedCompletionSec: number
}

/** GET /api/integrations/google/export/:jobId */
export interface ExportJobStatus {
  jobId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  spreadsheetUrl: string | null
  exportedRows: number | null
  error: string | null
  completedAt: string | null
}

/** POST /api/integrations/google/import */
export interface TriggerImportBody {
  spreadsheetId: string
  sheetTabName?: string
}

export interface TriggerImportResponse {
  jobId: string
  status: 'queued'
}

/** GET /api/integrations/google/import/:jobId */
export interface ImportJobStatus {
  jobId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  importedCount: number | null
  skippedCount: number | null
  errors: Array<{ row: number; message: string }> | null
  completedAt: string | null
}

/** GET /api/integrations/google/template */
/** Returns a download URL for the import template .xlsx */
export interface TemplateDownloadResponse {
  downloadUrl: string
  expiresAt: string
}

// ─────────────────────────────────────────────
// API: Filter Presets
// ─────────────────────────────────────────────

export interface FilterState {
  squads?: string[]
  areas?: string[]
  statuses?: ItemStatus[]
  priorities?: ItemPriority[]
  quarterStart?: string
  quarterEnd?: string
  labels?: string[]
  search?: string
}

export interface FilterPreset {
  id: string
  name: string
  filters: FilterState
  isShared: boolean
  createdById: string
  createdAt: string
}

/** GET /api/filter-presets */
export type ListFilterPresetsResponse = FilterPreset[]

/** POST /api/filter-presets */
export interface CreateFilterPresetBody {
  name: string
  filters: FilterState
  isShared: boolean
}

export type CreateFilterPresetResponse = FilterPreset

/** DELETE /api/filter-presets/:id */
export interface DeleteFilterPresetResponse {
  id: string
  deleted: true
}

// ─────────────────────────────────────────────
// Error Response (all endpoints)
// ─────────────────────────────────────────────

export interface ApiError {
  error: string              // machine-readable code: "NOT_FOUND", "FORBIDDEN", etc.
  message: string            // human-readable
  details?: unknown          // validation errors, etc.
  requestId: string
}

// ─────────────────────────────────────────────
// HTTP Status Conventions
// ─────────────────────────────────────────────
//
// 200 OK           — GET, PUT success
// 201 Created      — POST success (new resource created)
// 204 No Content   — DELETE success (no body)
// 400 Bad Request  — Validation error (body includes field-level details)
// 401 Unauthorized — No valid session
// 403 Forbidden    — Authenticated but insufficient role/squad
// 404 Not Found    — Resource doesn't exist or is archived
// 409 Conflict     — Unique constraint violation (e.g. duplicate squad name)
// 429 Too Many Requests — Rate limit hit (integration endpoints)
// 500 Internal     — Unexpected server error
