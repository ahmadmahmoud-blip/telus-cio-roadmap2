# Component Specs — Org Roadmap Tool

All components are built with Next.js 15 (App Router), TypeScript, Tailwind CSS, and shadcn/ui primitives. Accessibility target: WCAG 2.1 AA.

---

## Table of Contents

1. [Layout Shell](#1-layout-shell)
2. [Dashboard](#2-dashboard)
3. [Gantt View](#3-gantt-view)
4. [List / Table View](#4-list--table-view)
5. [Item Detail & Edit](#5-item-detail--edit)
6. [Item Create Form](#6-item-create-form)
7. [Filter Bar](#7-filter-bar)
8. [Squads & Areas Management](#8-squads--areas-management)
9. [User Management](#9-user-management)
10. [Integration Settings](#10-integration-settings)
11. [Notifications Panel](#11-notifications-panel)
12. [Shared / Atomic Components](#12-shared--atomic-components)

---

## 1. Layout Shell

### `AppShell`
Top-level authenticated layout wrapping all app routes.

**Structure**
```
AppShell
├── Sidebar (collapsible, persistent on desktop)
├── TopBar (breadcrumb, user menu, notifications bell)
└── PageContent (scrollable main area)
```

**Sidebar nav items**
| Label | Icon | Route | Role |
|---|---|---|---|
| Dashboard | LayoutDashboard | /dashboard | all |
| Roadmap — Gantt | BarChart2 | /roadmap/gantt | all |
| Roadmap — List | List | /roadmap/list | all |
| Squads | Users | /squads | admin |
| Product Areas | Layers | /areas | admin |
| Users | UserCog | /users | admin |
| Settings | Settings | /settings | admin |

**Props**
```ts
interface AppShellProps {
  children: React.ReactNode
  user: AuthUser
}
```

**States**
- `sidebarCollapsed: boolean` — persisted to localStorage
- Active nav item highlighted via `usePathname()`

**Behavior**
- Sidebar collapses to icon-only on mobile (< 768px), hidden by default
- Keyboard: `Ctrl+B` / `Cmd+B` toggles sidebar
- TopBar shows breadcrumb derived from route segments

---

### `TopBar`
```ts
interface TopBarProps {
  breadcrumb: BreadcrumbItem[]
  user: AuthUser
  notificationCount: number
}

interface BreadcrumbItem {
  label: string
  href?: string
}
```

**Elements**
- Left: breadcrumb trail (clickable segments)
- Right: notification bell (badge with count), user avatar dropdown
- User dropdown: Profile, Sign out

---

## 2. Dashboard

### `DashboardPage`
Org-level overview. Data fetched via `GET /api/items?summary=true`.

**Layout**
```
DashboardPage
├── StatsRow (4 stat cards)
├── ChartsRow
│   ├── StatusDonutChart
│   └── AreaBarChart
├── AtRiskTable
└── RecentActivityFeed
```

---

### `StatCard`
```ts
interface StatCardProps {
  label: string         // "Total Items", "Shipped", "In Progress", "Blocked"
  value: number
  delta?: number        // change vs previous quarter, optional
  icon: LucideIcon
  color: 'default' | 'green' | 'yellow' | 'red'
}
```
- Renders as a card with large number, label, optional delta pill
- Skeleton loader while data fetches

---

### `StatusDonutChart`
- Library: `recharts` `PieChart` with `innerRadius`
- Shows item counts by status (Discovery, Planned, In Progress, Shipped, Blocked, Cancelled)
- Clickable segments — navigates to List view pre-filtered by that status
- Legend below chart with color dot + label + count

---

### `AreaBarChart`
- Library: `recharts` `BarChart`
- X-axis: Product Areas
- Stacked bars: one bar per status color
- Clicking a bar navigates to List view filtered by area + status

---

### `AtRiskTable`
Items where `target_quarter_end` is in the past and status is not Shipped/Cancelled.

```ts
interface AtRiskRow {
  id: string
  title: string
  squad: string
  targetQuarter: string
  status: ItemStatus
  daysOverdue: number
}
```
- Max 10 rows; "View all" link to List view with at-risk filter
- Each row links to item detail

---

### `RecentActivityFeed`
- Last 20 audit log events
- Each entry: avatar + "{User} {action} {item title}" + relative timestamp
- "View full audit log" link

---

## 3. Gantt View

### `GanttPage`
Route: `/roadmap/gantt`

**Layout**
```
GanttPage
├── ViewControls (year selector, zoom, group-by, color-by, FilterBar)
├── GanttChart
│   ├── GanttHeader (timeline columns: months/quarters)
│   ├── GanttRows (virtualized)
│   │   ├── SwimlaneHeader (group label, item count)
│   │   └── GanttRow[] (one per item)
│   └── TodayMarker
└── GanttItemPopover (shown on bar hover/click)
```

---

### `GanttChart`
Core Gantt rendering component. Custom implementation using CSS Grid + `@tanstack/react-virtual` for row virtualization.

```ts
interface GanttChartProps {
  items: RoadmapItem[]
  year: number
  zoom: 'year' | 'quarter' | 'month'
  groupBy: 'squad' | 'area' | 'status' | 'priority' | 'none'
  colorBy: 'status' | 'priority' | 'area' | 'squad'
  onItemClick: (item: RoadmapItem) => void
  onItemUpdate?: (id: string, patch: Partial<RoadmapItem>) => void  // editor only
}
```

**Timeline grid**
- Columns represent time units based on `zoom`:
  - `year`: 4 columns (Q1–Q4), each 25% width
  - `quarter`: 12 columns (months Jan–Dec)
  - `month`: shows weeks (current quarter)
- Column widths are fixed px (not %). Grid scrolls horizontally for month zoom.

**Swimlane groups**
- When `groupBy !== 'none'`, items are grouped under collapsible `SwimlaneHeader` rows
- Groups sorted alphabetically; empty groups hidden
- Group header: collapse chevron, group name, item count badge

**Row rendering**
- Each `GanttRow` has: left label column (fixed, sticky) + bar column (scrollable)
- Label: item title (truncated), squad badge (if not grouped by squad)
- Bar: colored `GanttBar` positioned via CSS `left` / `width` calculated from quarter range

---

### `GanttBar`
```ts
interface GanttBarProps {
  item: RoadmapItem
  left: number      // % from timeline start
  width: number     // % of timeline
  color: string     // hex
  onClick: () => void
}
```
- `border-radius: 4px`, height `24px`, min-width `8px`
- Tooltip on hover: title, squad, status, quarter range
- If editor role: drag handles on left/right edges to resize quarter range
- Drag updates optimistically, commits on `mouseup` via `PUT /api/items/:id`
- ARIA: `role="button"`, `aria-label="{title} — {startQ} to {endQ}"`

---

### `GanttItemPopover`
Shown on bar click. Positioned relative to bar, dismissible.

**Content**
- Item title (link to detail page)
- Status badge, priority badge
- Squad, Product Area
- Quarter range
- Jira link(s) if present
- "Edit" button (editor+ only)
- "View details" link

---

### `ViewControls` (Gantt)
```ts
interface ViewControlsProps {
  year: number
  onYearChange: (y: number) => void
  zoom: ZoomLevel
  onZoomChange: (z: ZoomLevel) => void
  groupBy: GroupByOption
  onGroupByChange: (g: GroupByOption) => void
  colorBy: ColorByOption
  onColorByChange: (c: ColorByOption) => void
}
```
- Year: `< 2024 | 2025 | 2026 >` stepper
- Zoom: segmented control `Year | Quarter | Month`
- Group by: dropdown
- Color by: dropdown
- `FilterBar` component (see §7)

---

## 4. List / Table View

### `ListPage`
Route: `/roadmap/list`

```
ListPage
├── ListControls (FilterBar, column toggle, export button, Add Item button)
├── RoadmapTable
│   ├── TableHeader (sortable column headers)
│   └── TableBody (virtualized rows with inline edit)
└── Pagination (page size selector + prev/next)
```

---

### `RoadmapTable`
Built on `@tanstack/react-table` v8.

**Default visible columns**

| Column | Sortable | Filterable | Editable inline |
|---|---|---|---|
| Title | yes | no | yes (editor+) |
| Squad | yes | yes | yes (editor+) |
| Product Area | yes | yes | yes (editor+) |
| Status | yes | yes | yes (editor+) |
| Priority | yes | yes | yes (editor+) |
| Quarter Start | yes | yes | no |
| Quarter End | yes | yes | no |
| Updated | yes | no | no |

```ts
interface RoadmapTableProps {
  items: RoadmapItem[]
  totalCount: number
  page: number
  pageSize: number
  sortBy: string
  sortDir: 'asc' | 'desc'
  onSortChange: (col: string, dir: 'asc' | 'desc') => void
  onPageChange: (page: number) => void
  onItemUpdate?: (id: string, patch: Partial<RoadmapItem>) => void
  visibleColumns: string[]
}
```

**Inline editing**
- Clicking an editable cell activates `InlineCellEditor`
- Text fields: `<input>` with auto-width
- Enum fields (status, priority): dropdown popover
- FK fields (squad, area): searchable combobox
- `Enter` / blur commits; `Escape` cancels
- Optimistic update; revert on API error with toast

**Row click**
- Clicking non-editable area navigates to `/items/:id`

**Accessibility**
- Table is `role="grid"` with `aria-rowcount` and `aria-colcount`
- Column headers: `aria-sort="ascending|descending|none"`
- Keyboard navigation: arrow keys within grid, `Enter` to activate cell editor

---

### `ColumnToggle`
Dropdown with checkbox list of all columns. Persisted to localStorage per user.

---

## 5. Item Detail & Edit

### `ItemDetailPage`
Route: `/items/:id`

**Layout**
```
ItemDetailPage
├── ItemHeader (title, status badge, priority badge, edit button)
├── ItemBody
│   ├── MetaPanel (sidebar: squad, area, quarters, labels, Jira links, timestamps)
│   └── DescriptionPanel (rich text display)
├── JiraStatusPanel (if linked)
└── AuditHistoryPanel (expandable)
```

---

### `ItemHeader`
```ts
interface ItemHeaderProps {
  item: RoadmapItem
  canEdit: boolean
  onEdit: () => void
  onArchive: () => void
}
```
- Title: `<h1>`, editable inline (editor+)
- Status: `StatusBadge` component
- Priority: `PriorityBadge` component
- Actions: Edit button (opens edit mode), Archive (admin only, confirmation dialog)

---

### `MetaPanel`
Grid of labeled fields. In view mode: plain text. In edit mode: form inputs.

Fields:
- Squad (combobox)
- Product Area (combobox)
- Target Quarter Start (QuarterPicker)
- Target Quarter End (QuarterPicker)
- Confidence (select: High / Medium / Low / TBD)
- Labels (tag input, freeform)
- Jira Links (add/remove Jira keys with link-out icon)
- Created by / Updated by / Timestamps (read-only)

---

### `QuarterPicker`
```ts
interface QuarterPickerProps {
  value: string | null   // "2025-Q2"
  onChange: (val: string) => void
  minQuarter?: string
  maxQuarter?: string
}
```
- Dropdown grid: rows = years, columns = Q1 Q2 Q3 Q4
- Shows current year ± 2 years
- Selected quarter highlighted; range selection if used as pair

---

### `DescriptionPanel`
- View mode: renders markdown via `react-markdown` + `remark-gfm`
- Edit mode: `@uiw/react-md-editor` (markdown editor with preview toggle)
- Max height with scroll in view mode

---

### `JiraStatusPanel`
Shown only if item has `jira_links` populated.

```ts
interface JiraStatusPanelProps {
  jiraLinks: JiraLinkStatus[]
  onSync: () => void
  syncing: boolean
  lastSyncedAt: Date | null
}

interface JiraLinkStatus {
  key: string       // e.g. "PROJ-123"
  summary: string
  status: string    // Jira status name
  url: string
  type: 'epic' | 'issue'
}
```
- Card per Jira link: key + summary + Jira status pill + external link icon
- "Sync now" button triggers `POST /api/integrations/jira/sync/:itemId`
- Shows "Last synced: X minutes ago"

---

### `AuditHistoryPanel`
Expandable accordion at bottom of item detail.

- Fetches `GET /api/audit?entityId={id}&entityType=RoadmapItem`
- Each entry: avatar + name + action + relative time + "View diff" expand
- Diff view: two-column before/after for changed fields

---

## 6. Item Create Form

### `ItemCreatePage`
Route: `/items/new` (also used as modal from Gantt/List)

```ts
// Form state shape
interface ItemFormValues {
  title: string                    // required
  description: string
  squad_id: string                 // required
  product_area_id: string          // required
  status: ItemStatus               // default: "Discovery"
  priority: ItemPriority           // default: "P2"
  target_quarter_start: string     // required
  target_quarter_end: string       // required, >= start
  confidence: ConfidenceLevel      // default: "TBD"
  labels: string[]
  jira_links: string[]
}
```

**Validation**
| Field | Rule |
|---|---|
| title | Required, max 200 chars |
| squad_id | Required |
| product_area_id | Required |
| target_quarter_start | Required |
| target_quarter_end | Required; must be ≥ start |
| jira_links | Each entry must match regex `/^[A-Z][A-Z0-9]+-\d+$/` |

**Form sections**
1. Core (title, squad, area, status, priority)
2. Timeline (quarter start/end, confidence)
3. Details (description, labels)
4. Integrations (Jira link input — optional)

**Behavior**
- `react-hook-form` + `zod` schema validation
- Editors: squad pre-selected to their first assigned squad
- On submit: `POST /api/items`, redirect to `/items/:id` on success
- "Save & add another" button resets form keeping squad/area

---

## 7. Filter Bar

### `FilterBar`
Shared between Gantt and List views. Renders as a horizontal row of filter chips.

```ts
interface FilterBarProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  savedPresets: FilterPreset[]
  onSavePreset: (name: string, filters: FilterState) => void
  onLoadPreset: (preset: FilterPreset) => void
}

interface FilterState {
  squads: string[]
  areas: string[]
  statuses: ItemStatus[]
  priorities: ItemPriority[]
  quarterStart?: string
  quarterEnd?: string
  labels: string[]
  search?: string
}

interface FilterPreset {
  id: string
  name: string
  filters: FilterState
  isShared: boolean   // admin can create shared presets
}
```

**Filter chips**
- Each active filter renders as a dismissible chip: `{label}: {value}` ×
- "Add filter" button opens a dropdown to select dimension, then value(s)
- Chips stack to new line if overflow

**Saved presets**
- "Save view" button: opens dialog to name preset + toggle shared/personal
- Preset dropdown: list of personal + shared presets
- Active preset name shown in toolbar

**Search**
- Debounced text search (300ms) against item title + description

---

## 8. Squads & Areas Management

### `SquadsPage` / `AreasPage`
Admin-only. Route: `/squads`, `/areas`

**Layout per page**
```
ManagementPage
├── PageHeader (title, "Add {Squad|Area}" button)
├── ManagementTable
│   ├── Name (editable inline)
│   ├── Color (color swatch picker)
│   ├── Item count (read-only)
│   └── Actions (edit, delete — disabled if items exist)
└── AddEntityDialog
```

---

### `AddEntityDialog`
```ts
// For both Squad and ProductArea
interface AddEntityDialogProps {
  type: 'squad' | 'area'
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; color: string; product_area_id?: string }) => void
}
```
- Fields: Name (text), Color (color picker — 12 preset palette + custom hex)
- Squad only: Product Area (optional combobox)
- Validation: name required, unique within org

---

### `ColorPicker`
```ts
interface ColorPickerProps {
  value: string    // hex
  onChange: (hex: string) => void
  presets: string[]
}
```
- Grid of 12 preset swatches + "Custom" option
- Custom: hex input with live preview

---

## 9. User Management

### `UsersPage`
Admin-only. Route: `/users`

**Layout**
```
UsersPage
├── PageHeader (title, "Invite User" button)
├── UserFilters (role filter, squad filter, search)
├── UsersTable
│   ├── Name + Avatar
│   ├── Email
│   ├── Role (editable dropdown — admin only)
│   ├── Squads (editable multi-select — editors only)
│   ├── Last Login
│   └── Actions (remove user)
└── InviteUserDialog
```

---

### `InviteUserDialog`
```ts
interface InviteUserDialogProps {
  open: boolean
  onClose: () => void
  squads: Squad[]
}
```
- Fields: Email (required), Role (select), Squads (multi-select, shown if role = editor)
- Sends `POST /api/users/invite`
- Success: toast "Invitation sent to {email}"

---

### `RoleSelect`
```ts
interface RoleSelectProps {
  value: UserRole
  onChange: (role: UserRole) => void
  disabled?: boolean
}
```
- Dropdown: Admin | Editor | Viewer
- Changing own role disabled (prevent self-demotion)
- Changing another admin's role requires confirmation dialog

---

## 10. Integration Settings

### `IntegrationsPage`
Route: `/settings/integrations`

**Layout**
```
IntegrationsPage
├── JiraSection
└── GoogleSheetsSection
```

---

### `JiraSection`
```
JiraSection
├── ConnectionStatus (connected/disconnected badge)
├── ConnectButton (OAuth flow) or DisconnectButton
├── [if connected]:
│   ├── JiraConfig
│   │   ├── Jira base URL (for Data Center)
│   │   └── Sync interval (15min | 1hr | 4hr | manual only)
│   └── SyncStatusTable (last sync per item, errors)
```

**Connection flow**
1. Click "Connect Jira" → redirect to Jira OAuth consent
2. Callback stores token in DB (`IntegrationCredential` table)
3. Status shows: "Connected as {jira-user}" + last sync timestamp

---

### `GoogleSheetsSection`
```
GoogleSheetsSection
├── ConnectionStatus
├── ConnectButton or DisconnectButton
├── [if connected]:
│   ├── ExportConfig
│   │   ├── Target spreadsheet (input Google Sheet URL or picker)
│   │   ├── Sheet tab name
│   │   └── Auto-export schedule (disabled | daily | weekly)
│   ├── ExportNowButton
│   └── ImportSection
│       ├── Download template link
│       ├── Import from Sheet URL input
│       └── ImportButton (triggers job, shows progress)
```

---

## 11. Notifications Panel

### `NotificationsBell`
TopBar component. Shows unread count badge (max "99+").

Click opens `NotificationsPanel` drawer from the right.

---

### `NotificationsPanel`
```ts
interface NotificationsPanelProps {
  open: boolean
  onClose: () => void
}
```

**Notification types**
| Type | Message template |
|---|---|
| item_updated | "{User} updated {item title}" |
| item_assigned | "You were assigned to {item title}" |
| jira_sync_error | "Jira sync failed for {item title}: {error}" |
| sheets_export_complete | "Google Sheets export completed" |

- "Mark all read" button
- Each item: avatar, message, relative timestamp, link to relevant item
- Pagination: load more on scroll

---

## 12. Shared / Atomic Components

### `StatusBadge`
```ts
type ItemStatus = 'Discovery' | 'Planned' | 'In Progress' | 'Shipped' | 'Blocked' | 'Cancelled'

interface StatusBadgeProps {
  status: ItemStatus
  size?: 'sm' | 'md'
}
```

| Status | Color |
|---|---|
| Discovery | Blue |
| Planned | Purple |
| In Progress | Yellow |
| Shipped | Green |
| Blocked | Red |
| Cancelled | Gray |

---

### `PriorityBadge`
```ts
type ItemPriority = 'P0' | 'P1' | 'P2' | 'P3'

interface PriorityBadgeProps {
  priority: ItemPriority
  size?: 'sm' | 'md'
}
```

| Priority | Color | Label |
|---|---|---|
| P0 | Red | Critical |
| P1 | Orange | High |
| P2 | Yellow | Medium |
| P3 | Gray | Low |

---

### `ConfirmDialog`
Reusable confirmation dialog for destructive actions.

```ts
interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string      // default "Confirm"
  confirmVariant?: 'default' | 'destructive'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}
```

---

### `SquadBadge`
```ts
interface SquadBadgeProps {
  squad: { name: string; color: string }
  size?: 'sm' | 'md'
}
```
- Colored dot + squad name
- Color from squad.color hex

---

### `EmptyState`
```ts
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}
```

---

### `ErrorBoundary`
- Wraps each major page section
- Shows friendly error card with "Retry" button
- Reports to error tracking (Sentry integration — v2)

---

### `SkeletonTable` / `SkeletonGantt`
Placeholder loading states matching the shape of real content.
- Table: 8 rows of `animate-pulse` gray bars
- Gantt: 6 swimlane rows with randomized-width bars

---

## Component Dependency Map

```
AppShell
└── TopBar
    ├── NotificationsBell → NotificationsPanel
    └── UserMenu

DashboardPage
├── StatCard
├── StatusDonutChart
├── AreaBarChart
├── AtRiskTable
└── RecentActivityFeed

GanttPage
├── ViewControls → FilterBar
└── GanttChart
    ├── GanttHeader
    ├── GanttRow → GanttBar → GanttItemPopover
    └── SwimlaneHeader

ListPage
├── ListControls → FilterBar, ColumnToggle
└── RoadmapTable → InlineCellEditor, StatusBadge, PriorityBadge, SquadBadge

ItemDetailPage
├── ItemHeader → StatusBadge, PriorityBadge
├── MetaPanel → QuarterPicker, ColorPicker
├── DescriptionPanel
├── JiraStatusPanel
└── AuditHistoryPanel

ItemCreatePage (form)
└── QuarterPicker, StatusBadge, PriorityBadge

Shared
├── StatusBadge
├── PriorityBadge
├── SquadBadge
├── ConfirmDialog
├── EmptyState
├── SkeletonTable / SkeletonGantt
└── ErrorBoundary
```
