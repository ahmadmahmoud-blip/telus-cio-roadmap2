# Integration Specs — Org Roadmap Tool

## Table of Contents
1. [Jira Integration](#1-jira-integration)
2. [Google Sheets Integration](#2-google-sheets-integration)
3. [Shared Job Infrastructure (BullMQ)](#3-shared-job-infrastructure-bullmq)
4. [Credential Storage & Security](#4-credential-storage--security)

---

## 1. Jira Integration

### 1.1 Overview

The Jira integration allows roadmap items to be linked to Jira epics or issues. Status and metadata are pulled from Jira on a configurable schedule and surfaced as a secondary indicator on each roadmap item. The roadmap's own status field remains the source of truth — Jira sync never overwrites it.

**Supported environments**
- Jira Cloud (OAuth 2.0 3LO)
- Jira Data Center / Server (API token + base URL)

---

### 1.2 Jira Cloud: OAuth 2.0 Flow

```
Admin                  Roadmap App             Jira Cloud
  │                        │                       │
  │── Click "Connect" ────►│                       │
  │                        │── Build OAuth URL ────►│
  │                        │   scope: read:jira-work│
  │                        │   read:jira-user       │
  │◄── Redirect to Jira ───│                       │
  │                        │                       │
  │── Grant consent ───────────────────────────────►│
  │◄── Redirect to /api/integrations/jira/callback ─│
  │                        │                        │
  │                        │◄── code param ─────────│
  │                        │── POST /oauth/token ───►│
  │                        │◄── access_token ────────│
  │                        │    refresh_token        │
  │                        │                        │
  │                        │── Store encrypted ─────►DB
  │◄── Connected! ─────────│
```

**OAuth scopes required**
```
read:jira-work          # Read issues, epics, statuses
read:jira-user          # Read Jira user info for display
offline_access          # Get refresh token for background sync
```

**Callback handler** (`POST /api/integrations/jira/connect`)
1. Validate `state` param (CSRF check — store random state in session before redirect)
2. Exchange `code` for tokens via Jira token endpoint
3. Fetch Jira user info (`GET /rest/api/3/myself`)
4. Encrypt tokens (AES-256-GCM, key from `ENCRYPTION_KEY` env)
5. Upsert `JiraIntegration` record
6. Redirect to `/settings/integrations?jira=connected`

**Token refresh**
- Check `tokenExpiresAt` before each API call
- If expired (or within 5 min), call `POST /oauth/token` with `grant_type=refresh_token`
- Update stored tokens on success
- If refresh fails: mark integration as errored, notify admin via in-app notification

---

### 1.3 Jira Data Center: API Token

Admin provides:
- Jira base URL (e.g. `https://jira.company.com`)
- User email + API token (generated in Jira profile)

App stores these encrypted in `JiraIntegration` and uses HTTP Basic auth for all requests.

---

### 1.4 Linking a Roadmap Item to Jira

Editors add Jira keys (e.g. `PROJ-123`, `PLATFORM-456`) via the item form or detail page.

**On save**, the app:
1. Validates each key matches regex `/^[A-Z][A-Z0-9_]+-\d+$/`
2. Calls Jira API to verify issue exists and fetch initial data
3. Creates `JiraLink` record with summary, status, url, type
4. Returns enriched data to client immediately

**Jira API call** (per key)
```
GET {jiraBaseUrl}/rest/api/3/issue/{issueKey}
   ?fields=summary,status,issuetype,parent
```

**Type detection**
- `issuetype.name === "Epic"` → type = "epic"
- Otherwise → type = "issue"
- Parent epic (if exists) → also create a JiraLink for the parent

---

### 1.5 Sync Strategy

#### Scheduled sync (BullMQ repeatable job)

```
Job: "jira-sync-all"
Schedule: configurable (15min | 1hr | 4hr)
Payload: none (syncs all items with jira_links)
```

**Job logic**
```
1. Fetch all JiraLinks where item.archivedAt IS NULL
2. Batch into groups of 50 (Jira API bulk endpoint)
3. For each batch:
   a. POST /rest/api/3/search with jql: "key in (PROJ-1, PROJ-2, ...)"
   b. Map results back to JiraLink records
   c. Update: summary, jiraStatus, lastSyncedAt
   d. On 404: mark link as stale (don't delete — user must remove manually)
   e. On error: set syncError field, continue to next batch
4. Emit "jira_sync_complete" event → create notifications for errored items
5. Update JiraIntegration.lastSyncAt
```

#### Manual sync (per item)

`POST /api/integrations/jira/sync/:itemId`

1. Enqueue a high-priority BullMQ job `"jira-sync-item"` with `{ itemId }`
2. Return `{ jobId, status: "queued" }` immediately
3. Client polls `GET /api/integrations/jira/sync/:itemId/status` or uses SSE
4. Job fetches linked Jira issues, updates JiraLink records
5. Returns updated `JiraLink[]` to client

---

### 1.6 Data Mapping

| Jira Field | Roadmap Field | Notes |
|---|---|---|
| `summary` | `JiraLink.summary` | Display only |
| `status.name` | `JiraLink.jiraStatus` | Display only — does NOT map to `RoadmapItem.status` |
| `issuetype.name` | `JiraLink.type` | "epic" or "issue" |
| `self` | `JiraLink.jiraUrl` | Constructed link to Jira issue |

**Explicit non-mapping**: Jira status → Roadmap status. The roadmap status is owned by the PM; Jira status is informational only. Surfaced as a secondary badge with a "Jira" label in the UI.

---

### 1.7 Error Handling

| Error | Behavior |
|---|---|
| 401 / token expired | Attempt refresh; if fails, mark integration as errored, notify admin |
| 403 | Log error; skip issue; set `syncError` on JiraLink |
| 404 | Mark JiraLink as stale with `syncError: "Issue not found in Jira"` |
| 429 (rate limit) | Exponential backoff (1s, 2s, 4s, 8s); max 3 retries; then fail job |
| Network error | Retry up to 3x with backoff; fail job on exhaustion |

---

### 1.8 Jira API Rate Limits

Jira Cloud: 10 requests/second per OAuth client (token-based).

Mitigation strategy:
- Use bulk `search` endpoint instead of per-issue calls
- Add 100ms delay between batches during full sync
- Cache issue data in Redis for 10 minutes (key: `jira:issue:{key}`)
- On 429: respect `Retry-After` header

---

## 2. Google Sheets Integration

### 2.1 Overview

Two-way data flow:
- **Export**: Push current roadmap data to a Google Sheet (one-click or scheduled)
- **Import**: Pull items from a standardized template Sheet into the roadmap

Auth uses Google OAuth 2.0 with offline access for scheduled exports.

---

### 2.2 OAuth Flow

```
Admin                  Roadmap App             Google
  │                        │                     │
  │── Click "Connect" ────►│                     │
  │                        │── Build OAuth URL ──►│
  │                        │   scope: sheets      │
  │                        │   drive.file         │
  │◄── Redirect to Google ─│                     │
  │── Grant consent ────────────────────────────►│
  │◄── Redirect to callback ────────────────────-│
  │                        │◄── code ────────────-│
  │                        │── POST /token ───────►│
  │                        │◄── access_token ──────│
  │                        │    refresh_token       │
  │                        │── Store encrypted ────►DB
  │◄── Connected! ─────────│
```

**Scopes**
```
https://www.googleapis.com/auth/spreadsheets          # Read/write sheets
https://www.googleapis.com/auth/drive.file            # Access files created by app
```

`drive.file` is narrower than `drive` — only accesses sheets the user explicitly selects or that the app creates. Preferred for minimal permission footprint.

---

### 2.3 Export: Data Flow

**Trigger**: `POST /api/integrations/google/export`

```
Roadmap API                BullMQ Worker           Google Sheets API
     │                          │                         │
     │── Enqueue job ──────────►│                         │
     │◄── { jobId } ────────────│                         │
     │                          │                         │
     │                   Fetch all items                  │
     │                   (no archived)                    │
     │                          │                         │
     │                   Transform to rows                │
     │                          │                         │
     │                          │── GET spreadsheet ─────►│
     │                          │   (verify access)       │
     │                          │                         │
     │                          │── batchUpdate ─────────►│
     │                          │   (clear + write rows)  │
     │                          │◄── 200 OK ──────────────│
     │                          │                         │
     │                   Update job status                │
     │                   Update lastExportAt              │
     │                   Create notification              │
```

**Exported columns (in order)**

| Column | Source Field | Format |
|---|---|---|
| ID | `id` | raw |
| Title | `title` | raw |
| Squad | `squad.name` | raw |
| Product Area | `productArea.name` | raw |
| Status | `status` | raw |
| Priority | `priority` | raw |
| Quarter Start | `targetQuarterStart` | "2025-Q1" |
| Quarter End | `targetQuarterEnd` | "2025-Q3" |
| Confidence | `confidence` | raw |
| Labels | `labels` | comma-separated |
| Jira Links | `jiraLinks[].key` | comma-separated |
| Description | `description` | plain text (strip markdown) |
| Last Updated | `updatedAt` | ISO date |
| Updated By | `updatedBy.name` | raw |

**Sheet formatting**
- Row 1: Bold header row with background color `#1e293b` (dark blue), white text
- Freeze row 1
- Column widths set via `updateDimensionProperties`
- Status column: conditional formatting (color per status value)
- Auto-filter on header row

---

### 2.4 Export: Scheduled Jobs

When `schedule !== 'disabled'`, a BullMQ repeatable job runs:
- `daily` → `cron: "0 7 * * *"` (7am UTC)
- `weekly` → `cron: "0 7 * * 1"` (Monday 7am UTC)

On schedule change: remove old repeatable job, register new one.
On integration disconnect: remove all repeatable jobs for that org.

---

### 2.5 Import: Template Design

**Download template**: `GET /api/integrations/google/template`

Returns a pre-formatted `.xlsx` with:
- Header row matching export columns
- Data validation dropdowns for: Status, Priority, Squad, Product Area, Confidence
- Instruction row (italic, gray) below headers
- Sample row in row 3 (pre-filled example, clearly marked)

**Required import columns**
```
Title           (required)
Squad           (required — must match existing squad name exactly)
Product Area    (required — must match existing area name)
Status          (required — must be valid enum value)
Priority        (required — must be valid enum value)
Quarter Start   (required — format: YYYY-QN)
Quarter End     (required — format: YYYY-QN, >= start)
```

**Optional import columns**
```
Description     (markdown supported)
Confidence      (High | Medium | Low | TBD — default TBD)
Labels          (comma-separated)
Jira Links      (comma-separated Jira keys)
```

---

### 2.6 Import: Processing Flow

**Trigger**: `POST /api/integrations/google/import`
Body: `{ spreadsheetId, sheetTabName? }`

```
BullMQ Worker logic:

1. Fetch sheet data via sheets.spreadsheets.values.get
2. Parse header row → map column positions
3. Validate headers (required columns present?)
   └── If missing required headers → fail job immediately with error list
4. For each data row:
   a. Parse fields
   b. Validate (schema check per field)
   c. Resolve squad name → squadId (case-insensitive match)
   d. Resolve area name → productAreaId
   e. Validate quarter format (/^\d{4}-Q[1-4]$/)
   f. Validate quarter end >= start
   g. Collect errors with row numbers (don't abort on first error)
5. If validation errors > 20% of rows → fail job (likely wrong sheet)
6. Otherwise: bulk insert valid rows via Prisma createMany
7. For errored rows: include in job result (row number + message)
8. Update job status with counts: imported, skipped, errors[]
9. Create "import complete" notification for triggering user
```

**Duplicate handling**
- On import, check for existing items with same title + squadId
- If duplicate: skip row, count in `skippedCount`
- Do NOT update existing items (import is additive only)

---

### 2.7 Error Handling

| Scenario | Behavior |
|---|---|
| Sheet not found / no access | Fail job: "Could not access spreadsheet. Ensure the sheet is shared with {google_email}" |
| Token expired | Attempt refresh; if fails, fail job with "Google connection expired. Please reconnect." |
| Row validation error | Collect and include in job result; continue processing other rows |
| Sheets API quota exceeded | Retry with exponential backoff; respect `Retry-After` |
| Import: >20% invalid rows | Fail job with summary; user must fix template |

---

### 2.8 Google Sheets API Quotas

- Read requests: 300/min per project, 60/min per user
- Write requests: 300/min per project, 60/min per user
- Cells per request: 10M cells max

Mitigation:
- Export writes all data in a single `batchUpdate` call
- Import reads all data in a single `values.get` call
- No polling the Sheets API; all operations are batch

---

## 3. Shared Job Infrastructure (BullMQ)

### 3.1 Queue Design

```
Redis (BullMQ)
├── Queue: "jira-sync"
│   ├── Job: jira-sync-all         (repeatable, scheduled)
│   └── Job: jira-sync-item        (on-demand, high priority)
│
└── Queue: "google-sheets"
    ├── Job: sheets-export         (on-demand or repeatable)
    └── Job: sheets-import         (on-demand)
```

### 3.2 Worker Configuration

```ts
// jira-sync worker
new Worker('jira-sync', jiraSyncProcessor, {
  connection: redisConnection,
  concurrency: 3,
  limiter: { max: 10, duration: 1000 }  // 10 jobs/sec max
})

// google-sheets worker
new Worker('google-sheets', sheetsProcessor, {
  connection: redisConnection,
  concurrency: 2
})
```

### 3.3 Job Lifecycle

```
queued → running → completed
                └→ failed (retries exhausted)
```

- Max retries: 3 (Jira sync item), 1 (scheduled full sync), 2 (Sheets)
- Backoff: exponential, starting 2 seconds
- Failed jobs retained for 7 days (for debugging)
- Completed jobs retained for 24 hours

### 3.4 Job Status Polling (Client)

For user-triggered jobs (manual sync, import, export):

1. Client receives `{ jobId }` from trigger endpoint
2. Polls `GET /api/integrations/*/job/:jobId` every 2 seconds
3. Server reads job state from BullMQ (not DB — faster)
4. When status is `completed` or `failed`: stop polling, show result toast
5. Timeout: if not completed after 5 minutes → show "taking longer than expected" message

Alternative: Server-Sent Events (SSE) for real-time status — implement as v2 optimization.

---

## 4. Credential Storage & Security

### 4.1 Encryption

All OAuth tokens stored encrypted at rest.

**Algorithm**: AES-256-GCM
**Key**: 32-byte random key stored in `ENCRYPTION_KEY` env var (never in code or DB)
**IV**: Random 12-byte IV, stored alongside ciphertext (safe to store — unpredictable without key)

```ts
// Pseudocode
function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map(b => b.toString('hex')).join(':')
}

function decrypt(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8')
}
```

### 4.2 Token Access Pattern

- Tokens are **never** returned to the frontend (not in any API response)
- Workers retrieve tokens from DB → decrypt in-memory → use → discard
- Token fields in `JiraIntegration` and `GoogleIntegration` are excluded from all Prisma `select` statements in API handlers
- Only the worker service (running server-side) has the `ENCRYPTION_KEY`

### 4.3 Scope of Access

| Integration | Access scope | What it can do |
|---|---|---|
| Jira Cloud | `read:jira-work`, `read:jira-user` | Read issues/epics only. Cannot create, update, or delete Jira data. |
| Jira Data Center | API token scoped by Jira admin | Same read-only intent; admin sets appropriate permissions in Jira |
| Google | `spreadsheets`, `drive.file` | Read/write only sheets the user owns or explicitly shares. Cannot access other Drive files. |

### 4.4 Revoking Access

On disconnect:
1. Call Jira/Google token revocation endpoint
2. Delete `JiraIntegration` / `GoogleIntegration` record from DB
3. Cancel any BullMQ repeatable jobs tied to the integration
4. Notify admin via in-app notification
