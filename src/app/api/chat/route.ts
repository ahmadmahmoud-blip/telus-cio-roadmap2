import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { messages } = body as { messages: ChatMessage[] }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    // Cap conversation history to last 20 messages to keep context manageable
    const recentMessages = messages.slice(-20)

    // Build roadmap context from DB
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentQuarterNum = Math.floor(now.getMonth() / 3) + 1
    const currentQuarter = `${currentYear}-Q${currentQuarterNum}`

    const [totalItems, byStatus, domains, atRiskItems] = await Promise.all([
      prisma.roadmapItem.count({ where: { archivedAt: null } }),
      prisma.roadmapItem.groupBy({
        by: ['status'],
        where: { archivedAt: null },
        _count: { status: true },
      }),
      prisma.productDomain.findMany({
        include: {
          groups: {
            include: {
              areas: {
                include: {
                  items: {
                    where: { archivedAt: null },
                    select: { status: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.roadmapItem.findMany({
        where: {
          archivedAt: null,
          status: { notIn: ['Shipped', 'Cancelled'] },
          targetQuarterEnd: { lt: currentQuarter },
        },
        include: {
          productArea: { select: { name: true } },
        },
        orderBy: { targetQuarterEnd: 'asc' },
        take: 20,
      }),
    ])

    // Build domain summary text
    const domainSummaries = domains.map((domain) => {
      const allItems = domain.groups.flatMap((g) => g.areas.flatMap((a) => a.items))
      const counts: Record<string, number> = {}
      for (const item of allItems) counts[item.status] = (counts[item.status] ?? 0) + 1
      const total = allItems.length
      const shipped = counts['Shipped'] ?? 0
      const inProgress = counts['In Progress'] ?? 0
      const blocked = counts['Blocked'] ?? 0
      const groupNames = domain.groups.map((g) => g.name).join(', ')
      return `- ${domain.name}: ${total} items (${shipped} shipped, ${inProgress} in progress, ${blocked} blocked) | Groups: ${groupNames || 'none'}`
    }).join('\n')

    const statusSummary = byStatus
      .map((s) => `${s.status}: ${s._count.status}`)
      .join(', ')

    const atRiskText = atRiskItems.length === 0
      ? 'None'
      : atRiskItems
          .map((i) => `"${i.title}" (${i.productArea.name}, overdue since ${i.targetQuarterEnd})`)
          .join('\n  ')

    const systemPrompt = `You are a helpful product roadmap assistant for a TELUS technology team. You have access to the current state of the product roadmap and can answer questions about it.

Current date: ${now.toDateString()}
Current quarter: ${currentQuarter}

ROADMAP SUMMARY:
Total active items: ${totalItems}
Status breakdown: ${statusSummary}

DOMAIN BREAKDOWN:
${domainSummaries || 'No domains configured yet.'}

AT-RISK ITEMS (past target quarter, not yet shipped or cancelled):
  ${atRiskText}

INSTRUCTIONS:
- Answer questions about the roadmap concisely and clearly.
- Use bullet points for lists.
- When summarising a domain or group, include shipped %, in-progress count, and blocked count.
- You are read-only — you cannot create, update, or delete roadmap items.
- If asked something you don't have data for, say so honestly.
- Keep responses focused and actionable.`

    // Stream response from Claude
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: recentMessages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('[POST /api/chat]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
