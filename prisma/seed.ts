import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ─── Admin user ──────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@telus.com' },
    update: {},
    create: {
      email: 'admin@telus.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'admin',
    },
  })

  const editorPassword = await bcrypt.hash('editor123', 10)
  await prisma.user.upsert({
    where: { email: 'pm.capacity@telus.com' },
    update: {},
    create: {
      email: 'pm.capacity@telus.com',
      name: 'Sarah Chen',
      password: editorPassword,
      role: 'editor',
    },
  })
  await prisma.user.upsert({
    where: { email: 'pm.engagement@telus.com' },
    update: {},
    create: {
      email: 'pm.engagement@telus.com',
      name: 'Marcus Williams',
      password: editorPassword,
      role: 'editor',
    },
  })
  await prisma.user.upsert({
    where: { email: 'pm.tpm@telus.com' },
    update: {},
    create: {
      email: 'pm.tpm@telus.com',
      name: 'Priya Patel',
      password: editorPassword,
      role: 'editor',
    },
  })
  const viewerPassword = await bcrypt.hash('viewer123', 10)
  await prisma.user.upsert({
    where: { email: 'vp.product@telus.com' },
    update: {},
    create: {
      email: 'vp.product@telus.com',
      name: 'Jordan Lee',
      password: viewerPassword,
      role: 'viewer',
    },
  })

  // ─── Product Areas ────────────────────────────────────────
  const areaCapacity = await prisma.productArea.upsert({
    where: { name: 'Capacity Planning, Management & Reporting' },
    update: {},
    create: { name: 'Capacity Planning, Management & Reporting', color: '#3b82f6' },
  })
  const areaEngagement = await prisma.productArea.upsert({
    where: { name: 'Engagement & Outreach' },
    update: {},
    create: { name: 'Engagement & Outreach', color: '#8b5cf6' },
  })
  const areaTpm = await prisma.productArea.upsert({
    where: { name: 'Delivery Planning & Support' },
    update: {},
    create: { name: 'Delivery Planning & Support', color: '#f59e0b' },
  })

  // ─── Domain & Group ───────────────────────────────────────
  const domain = await prisma.productDomain.upsert({
    where: { name: 'Team Member Experience' },
    update: {},
    create: { name: 'Team Member Experience', color: '#6366f1' },
  })
  const group = await prisma.productGroup.upsert({
    where: { name: 'Product Platform' },
    update: {},
    create: { name: 'Product Platform', color: '#8b5cf6', domainId: domain.id },
  })
  // Link areas to group
  await prisma.productArea.update({
    where: { name: 'Capacity Planning, Management & Reporting' },
    data: { groupId: group.id },
  })
  await prisma.productArea.update({
    where: { name: 'Engagement & Outreach' },
    data: { groupId: group.id },
  })
  await prisma.productArea.update({
    where: { name: 'Delivery Planning & Support' },
    data: { groupId: group.id },
  })

  // ─── Helper ───────────────────────────────────────────────
  const createItem = (data: {
    title: string
    productAreaId: string
    status: string
    priority: string
    start: string
    end: string
    outcome: string
    description?: string
    labels?: string[]
  }) =>
    prisma.roadmapItem.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        productAreaId: data.productAreaId,
        status: data.status,
        priority: data.priority,
        targetQuarterStart: data.start,
        targetQuarterEnd: data.end,
        confidence: 'Medium',
        labels: JSON.stringify(data.labels ?? []),
        jiraLinks: JSON.stringify([]),
        outcome: data.outcome,
        createdById: admin.id,
        updatedById: admin.id,
      },
    })

  // ─── Capacity Planning Items ──────────────────────────────
  const C = { productAreaId: areaCapacity.id }

  await createItem({ title: 'Product based capacity management', ...C, status: 'In Progress', priority: 'P1', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 1: Real time CIO resource capacity data accessibility' })
  await createItem({ title: 'Employee ↔ Product Taxonomy Mapping', ...C, status: 'In Progress', priority: 'P1', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 1: Real time CIO resource capacity data accessibility' })
  await createItem({ title: 'Updated product squad capacity dashboard', ...C, status: 'Planned', priority: 'P1', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 1: Real time CIO resource capacity data accessibility' })
  await createItem({ title: 'Accessibility for all TELUS Employees', ...C, status: 'In Progress', priority: 'P1', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 1: Real time CIO resource capacity data accessibility' })
  await createItem({ title: 'Global Team Member Directory Integration', ...C, status: 'Planned', priority: 'P1', start: '2025-Q1', end: '2025-Q2', outcome: 'Outcome 1: Real time CIO resource capacity data accessibility' })
  await createItem({ title: 'Standardized usage across CIO', ...C, status: 'Planned', priority: 'P2', start: '2025-Q1', end: '2025-Q2', outcome: 'Outcome 1: Real time CIO resource capacity data accessibility' })
  await createItem({ title: 'Supporting adoption of new capacity management standards across CIO', ...C, status: 'Planned', priority: 'P2', start: '2025-Q1', end: '2025-Q2', outcome: 'Outcome 1: Real time CIO resource capacity data accessibility' })

  await createItem({ title: 'Automated Project creation workflow', ...C, status: 'In Progress', priority: 'P1', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 2: Automation and toil reduction' })
  await createItem({ title: 'CIO Connect Integration', ...C, status: 'Planned', priority: 'P2', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 2: Automation and toil reduction' })
  await createItem({ title: 'Automated Time Tracking Integration w/ SuccessFactors', ...C, status: 'Planned', priority: 'P2', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 2: Automation and toil reduction' })

  await createItem({ title: 'UI/UX Improved capacity platform', ...C, status: 'In Progress', priority: 'P2', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 3: Platform UI/UX Simplification' })
  await createItem({ title: 'RPP Lite (Resources & Projects tab)', ...C, status: 'Discovery', priority: 'P3', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 3: Platform UI/UX Simplification' })
  await createItem({ title: 'Simplified resource forecasting', ...C, status: 'In Progress', priority: 'P2', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 3: Platform UI/UX Simplification' })
  await createItem({ title: 'Scale forecasted days to multiple resources', ...C, status: 'Discovery', priority: 'P3', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 3: Platform UI/UX Simplification' })
  await createItem({ title: 'Simplified EQ report building', ...C, status: 'In Progress', priority: 'P2', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 3: Platform UI/UX Simplification' })
  await createItem({ title: 'Single screen EQ report builder', ...C, status: 'Discovery', priority: 'P3', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 3: Platform UI/UX Simplification' })

  // ─── Engagement & Outreach Items ──────────────────────────
  const E = { productAreaId: areaEngagement.id }

  await createItem({ title: 'Automated notifications and reminders (in-app, email, Slack)', ...E, status: 'In Progress', priority: 'P1', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 1: Drive completion rates to 90%' })
  await createItem({ title: 'UX Refinement of Discovery Section', ...E, status: 'Planned', priority: 'P1', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 1: Drive completion rates to 90%' })
  await createItem({ title: 'CIO Connect MCP', ...E, status: 'Discovery', priority: 'P2', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 1: Drive completion rates to 90%' })
  await createItem({ title: 'SPARC Integration and Enforcement in Engagement Workflow', ...E, status: 'Planned', priority: 'P1', start: '2025-Q1', end: '2025-Q2', outcome: 'Outcome 1: Drive completion rates to 90%' })

  await createItem({ title: 'Product Taxonomy Integration', ...E, status: 'In Progress', priority: 'P1', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 2: Reduce cycle time by 30%' })
  await createItem({ title: 'AI-based stakeholder matching', ...E, status: 'Discovery', priority: 'P2', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 2: Reduce cycle time by 30%' })
  await createItem({ title: 'Automated PRD Generation', ...E, status: 'Discovery', priority: 'P1', start: '2025-Q2', end: '2025-Q3', outcome: 'Outcome 2: Reduce cycle time by 30%' })
  await createItem({ title: 'AI-powered anomaly & redundancy detection', ...E, status: 'Discovery', priority: 'P2', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 2: Reduce cycle time by 30%' })
  await createItem({ title: 'RPP Integration', ...E, status: 'Planned', priority: 'P1', start: '2025-Q1', end: '2025-Q2', outcome: 'Outcome 2: Reduce cycle time by 30%' })
  await createItem({ title: 'Integrated Roadmapping', ...E, status: 'Discovery', priority: 'P2', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 2: Reduce cycle time by 30%' })

  await createItem({ title: 'Generate AI Evaluation reports & calibrate quality standards', ...E, status: 'Planned', priority: 'P2', start: '2025-Q1', end: '2025-Q2', outcome: 'Outcome 3: Achieve >90% accuracy on AI-generated artifacts' })
  await createItem({ title: 'Quantifiable improvements on existing AI applications (suggestions, evaluations, sizing)', ...E, status: 'Discovery', priority: 'P2', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 3: Achieve >90% accuracy on AI-generated artifacts' })

  await createItem({ title: 'Enabling data collection on clicks & feature usage', ...E, status: 'Discovery', priority: 'P2', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 4: Improve visibility on product value' })
  await createItem({ title: 'Integrated dashboarding (v2)', ...E, status: 'Discovery', priority: 'P3', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 4: Improve visibility on product value' })

  // ─── TPM AI Platform (Portfolio Pulse) Items ─────────────
  const T = { productAreaId: areaTpm.id }

  await createItem({ title: 'Integration with RPP database and APIs', ...T, status: 'In Progress', priority: 'P0', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 1: 50% reduction in toil for status reports' })
  await createItem({ title: 'Edit functionality — Editable reports and storing back to RPP', ...T, status: 'In Progress', priority: 'P0', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 1: 50% reduction in toil for status reports' })
  await createItem({ title: 'Jira-to-Pulse Auto-Sync', ...T, status: 'Planned', priority: 'P0', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 1: 50% reduction in toil for status reports' })
  await createItem({ title: 'Project view and status view with real data', ...T, status: 'In Progress', priority: 'P0', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 1: 50% reduction in toil for status reports' })
  await createItem({ title: 'Backend setup', ...T, status: 'Shipped', priority: 'P0', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 1: 50% reduction in toil for status reports' })
  await createItem({ title: 'TPM AI coach', ...T, status: 'Discovery', priority: 'P1', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 1: 50% reduction in toil for status reports' })
  await createItem({ title: 'Slack Sentiment Integration', ...T, status: 'Discovery', priority: 'P2', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 1: 50% reduction in toil for status reports' })
  await createItem({ title: 'Magic fill — Automated generation of Blockers, Recovery Plans and Decision Support', ...T, status: 'Discovery', priority: 'P1', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 1: 50% reduction in toil for status reports' })

  await createItem({ title: 'Artifact hub creation — Adding artifacts using links', ...T, status: 'In Progress', priority: 'P1', start: '2025-Q1', end: '2025-Q1', outcome: 'Outcome 2: 100% documentation requirements for AI readability' })
  await createItem({ title: 'Google Drive Artifact Integration', ...T, status: 'Planned', priority: 'P1', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 2: 100% documentation requirements for AI readability' })
  await createItem({ title: 'Standardization of minimum required artifacts across Strategic programs', ...T, status: 'Discovery', priority: 'P2', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 2: 100% documentation requirements for AI readability' })
  await createItem({ title: 'Artifact Quality score — Link Freshness & Mandatory Doc check', ...T, status: 'Planned', priority: 'P1', start: '2025-Q2', end: '2025-Q3', outcome: 'Outcome 2: 100% documentation requirements for AI readability' })

  await createItem({ title: 'Centralized RAID log — Surfacing Risks based on risk register link', ...T, status: 'Planned', priority: 'P1', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 3: Less than 5% of programs turn red (watermelon)' })
  await createItem({ title: 'Jira Blocker Validation', ...T, status: 'Discovery', priority: 'P1', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 3: Less than 5% of programs turn red (watermelon)' })
  await createItem({ title: 'Status Archiving for GTM shift', ...T, status: 'Planned', priority: 'P2', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 3: Less than 5% of programs turn red (watermelon)' })
  await createItem({ title: 'Consolidation of Jira/Github insights and centralized risk log', ...T, status: 'Discovery', priority: 'P1', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 3: Less than 5% of programs turn red (watermelon)' })
  await createItem({ title: 'Github Integration', ...T, status: 'Discovery', priority: 'P2', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 3: Less than 5% of programs turn red (watermelon)' })
  await createItem({ title: 'Risk Navigator and AI powered risk assessment', ...T, status: 'Discovery', priority: 'P1', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 3: Less than 5% of programs turn red (watermelon)' })

  await createItem({ title: 'Status report versions based on Audience', ...T, status: 'Discovery', priority: 'P1', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 4: 80% of programs use TPM AI platform' })
  await createItem({ title: 'Launch "AI Status Assistant" for leadership queries', ...T, status: 'Discovery', priority: 'P1', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 4: 80% of programs use TPM AI platform' })
  await createItem({ title: 'Export reports to Slack, Google Docs and Google Slides', ...T, status: 'Discovery', priority: 'P2', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 4: 80% of programs use TPM AI platform' })
  await createItem({ title: 'Initial feedback from 2 strategic programs', ...T, status: 'In Progress', priority: 'P1', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 4: 80% of programs use TPM AI platform' })
  await createItem({ title: 'Director Feedback', ...T, status: 'In Progress', priority: 'P2', start: '2025-Q2', end: '2025-Q2', outcome: 'Outcome 4: 80% of programs use TPM AI platform' })
  await createItem({ title: 'VP Roadshows and Feedback', ...T, status: 'Discovery', priority: 'P1', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 4: 80% of programs use TPM AI platform' })
  await createItem({ title: 'AI Analytics Playbook — Manual Edit Ratio & Acceptance Rate Analytics', ...T, status: 'Discovery', priority: 'P2', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 4: 80% of programs use TPM AI platform' })
  await createItem({ title: 'GitHub Context-Awareness', ...T, status: 'Discovery', priority: 'P2', start: '2025-Q3', end: '2025-Q4', outcome: 'Outcome 4: 80% of programs use TPM AI platform' })

  const count = await prisma.roadmapItem.count()
  console.log(`Seeded ${count} roadmap items`)
  console.log('\nTest accounts:')
  console.log('  admin@telus.com / admin123 (Admin)')
  console.log('  pm.capacity@telus.com / editor123 (Editor - Capacity Planning)')
  console.log('  pm.engagement@telus.com / editor123 (Editor - Engagement)')
  console.log('  pm.tpm@telus.com / editor123 (Editor - TPM)')
  console.log('  vp.product@telus.com / viewer123 (Viewer)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
