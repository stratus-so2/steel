import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  seedAiUsage,
  seedWorkspaceAiSettings,
} from '@/src/__tests__/factories/ai-settings.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { prisma } from '@/src/lib/prisma'

/**
 * The data migration that re-prices the current UTC month (ADR 0019) runs
 * once on deploy; here it runs against seeded rows to pin its behavior.
 */
const SQL = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20261007150000_ai_usage_recost_current_month/migration.sql',
  ),
  'utf8',
)

async function runMigration(): Promise<void> {
  await prisma.$executeRawUnsafe(SQL)
}

async function costOf(id: string): Promise<number> {
  const row = await prisma.aiUsage.findUniqueOrThrow({ where: { id } })
  return row.costUsd.toNumber()
}

const DAY = 24 * 60 * 60 * 1000

describe('migration ai_usage_recost_current_month', () => {
  it('re-prices legacy rows of the current month with the model price', async () => {
    const workspace = await seedWorkspace()
    // 1500 tokens under the old rule = US$ 6.00.
    const legacy = await seedAiUsage(workspace.id, {
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 6,
    })
    const opus = await seedAiUsage(workspace.id, {
      provider: 'anthropic',
      model: 'claude-opus-5',
      inputTokens: 2000,
      outputTokens: 1000,
      costUsd: 12,
    })

    await runMigration()

    // (1000 × 0.15 + 500 × 0.6) / 1M
    expect(await costOf(legacy.id)).toBeCloseTo(0.00045, 6)
    // (2000 × 5 + 1000 × 25) / 1M
    expect(await costOf(opus.id)).toBeCloseTo(0.035, 6)
  })

  it('uses the workspace legacy rate to detect rows and the platform margin to price them', async () => {
    const workspace = await seedWorkspace()
    await seedWorkspaceAiSettings(workspace.id, { usdPer1kTokens: 2 })
    await prisma.platformAiSettings.create({
      data: { id: 'default', costMargin: 2 },
    })
    const legacy = await seedAiUsage(workspace.id, {
      provider: 'openai',
      model: 'gpt-5',
      inputTokens: 1000,
      outputTokens: 1000,
      costUsd: 4, // 2000 tokens × US$ 2 / 1k
    })

    try {
      await runMigration()
    } finally {
      // Not part of the per-test truncation: never leak the margin.
      await prisma.platformAiSettings.delete({ where: { id: 'default' } })
    }

    // (1000 × 1.25 + 1000 × 10) / 1M × 2
    expect(await costOf(legacy.id)).toBeCloseTo(0.0225, 6)
  })

  it('prices a model outside the catalog with the most expensive price', async () => {
    const workspace = await seedWorkspace()
    const legacy = await seedAiUsage(workspace.id, {
      provider: 'openai',
      model: 'gpt-retired',
      inputTokens: 1000,
      outputTokens: 1000,
      costUsd: 8,
    })

    await runMigration()

    expect(await costOf(legacy.id)).toBeCloseTo(0.03, 6)
  })

  it('never touches earlier months, real-cost rows or empty rows, and is idempotent', async () => {
    const workspace = await seedWorkspace()
    const now = new Date()
    const lastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 5 * DAY,
    )
    const old = await seedAiUsage(workspace.id, {
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 6,
      createdAt: lastMonth,
    })
    const real = await seedAiUsage(workspace.id, {
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.00045,
    })
    const empty = await seedAiUsage(workspace.id, {
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    })
    const legacy = await seedAiUsage(workspace.id, {
      inputTokens: 2000,
      outputTokens: 0,
      costUsd: 8,
    })

    await runMigration()
    const first = await costOf(legacy.id)
    await runMigration()

    expect(await costOf(old.id)).toBe(6)
    expect(await costOf(real.id)).toBe(0.00045)
    expect(await costOf(empty.id)).toBe(0)
    expect(first).toBeCloseTo(0.0003, 6)
    expect(await costOf(legacy.id)).toBe(first)
  })
})
