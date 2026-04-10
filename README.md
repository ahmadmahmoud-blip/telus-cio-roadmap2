# TELUS CIO Product Roadmap Tool

An internal web app for managing and visualizing the TELUS CIO product roadmap across squads, domains, and product areas.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Prisma 5 + SQLite
- **Auth**: Auth.js v5 (next-auth beta) — JWT strategy, credentials provider
- **AI**: Anthropic SDK (AI chatbot assistant)

## Features

- **Dashboard** — portfolio health overview, charts, domain status grid
- **Gantt View** — interactive timeline across quarters with grouping and filters
- **List View** — paginated, searchable, filterable table of roadmap items
- **Item Management** — create, edit, archive roadmap items with audit trail
- **Hierarchy Management** — manage Domains → Product Groups → Product Areas
- **User Management** — admin can manage users and roles
- **AI Chatbot** — in-app assistant powered by Claude
- **CSV Import/Export** — bulk import and export roadmap items
- **Role-based Access** — admin / editor / viewer permissions

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/sujesh14mandal/telus-cio-roadmap.git
cd telus-cio-roadmap
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3002
ANTHROPIC_API_KEY=your-anthropic-key-here
```

Generate a secret with:
```bash
openssl rand -base64 32
```

### Database Setup

```bash
npm run db:push    # create the SQLite schema
npm run db:seed    # seed with sample TELUS CIO data (56 items, 3 squads)
```

### Run

```bash
npm run dev        # starts on http://localhost:3002
```

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@telus.com | admin123 | Admin |
| pm.capacity@telus.com | editor123 | Editor |
| vp.product@telus.com | viewer123 | Viewer |

## Project Structure

```
src/
├── app/
│   ├── (app)/          # authenticated routes
│   │   ├── dashboard/
│   │   ├── roadmap/
│   │   │   ├── gantt/
│   │   │   └── list/
│   │   ├── items/
│   │   ├── domains/
│   │   ├── groups/
│   │   ├── areas/
│   │   ├── squads/
│   │   └── users/
│   ├── (auth)/         # login page
│   └── api/            # REST API routes
├── components/
│   ├── dashboard/
│   ├── gantt/
│   ├── items/
│   ├── filters/
│   ├── layout/
│   └── ui/             # shadcn/ui components
├── lib/
│   ├── auth.ts         # Auth.js config
│   ├── prisma.ts       # Prisma client
│   └── utils.ts
├── proxy.ts            # Auth middleware (Next.js 16)
└── types/
prisma/
├── schema.prisma
└── seed.ts
specs/                  # API and component specs
```

## Useful Commands

```bash
npm run db:studio   # open Prisma Studio (DB browser)
npm run db:reset    # drop and re-seed the database
npm run build       # production build
```
