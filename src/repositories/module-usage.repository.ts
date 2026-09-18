import type { UsageRow } from '@/src/lib/metrics'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type { ModuleUsageCounter } from '@/src/lib/usage/module-usage'
import { dbError } from './db-error'

/** `YYYY-MM-DD` ↔ valor da coluna `@db.Date` (meia-noite UTC). */
const toDbDate = (day: string) => new Date(`${day}T00:00:00.000Z`)
const fromDbDate = (date: Date) => date.toISOString().slice(0, 10)

export const ModuleUsageRepository = {
  /**
   * Grava os totais de um dia com valor absoluto (não incrementa), então
   * rodar o rollup de novo para o mesmo dia é idempotente. Contadores de
   * workspaces que não existem mais são descartados (evita violar a FK).
   * Devolve quantas linhas foram gravadas.
   */
  async upsertDay(
    day: string,
    counters: readonly ModuleUsageCounter[],
  ): Promise<Result<number>> {
    if (counters.length === 0) return ok(0)
    try {
      const existing = await prisma.workspace.findMany({
        where: { id: { in: [...new Set(counters.map((c) => c.workspaceId))] } },
        select: { id: true },
      })
      const known = new Set(existing.map((w) => w.id))
      const rows = counters.filter((c) => known.has(c.workspaceId))
      const date = toDbDate(day)

      await prisma.$transaction(
        rows.map((c) =>
          prisma.moduleUsageDaily.upsert({
            where: {
              day_workspaceId_module: {
                day: date,
                workspaceId: c.workspaceId,
                module: c.module,
              },
            },
            create: {
              day: date,
              workspaceId: c.workspaceId,
              module: c.module,
              requests: c.requests,
              mutations: c.mutations,
            },
            update: { requests: c.requests, mutations: c.mutations },
          }),
        ),
      )
      return ok(rows.length)
    } catch (error) {
      return err(dbError('Failed to upsert module usage', error))
    }
  },

  /** Linhas de uso a partir de `sinceDay` (inclusive), com nome/slug do workspace. */
  async listSince(sinceDay: string): Promise<Result<UsageRow[]>> {
    try {
      const rows = await prisma.moduleUsageDaily.findMany({
        where: { day: { gte: toDbDate(sinceDay) } },
        include: { workspace: { select: { name: true, slug: true } } },
        orderBy: { day: 'asc' },
      })
      return ok(
        rows.map((r) => ({
          day: fromDbDate(r.day),
          workspaceId: r.workspaceId,
          workspaceName: r.workspace.name,
          workspaceSlug: r.workspace.slug,
          module: r.module,
          requests: r.requests,
          mutations: r.mutations,
        })),
      )
    } catch (error) {
      return err(dbError('Failed to list module usage', error))
    }
  },

  /** Primeiro dia com uso gravado (`null` se a tabela está vazia). */
  async firstDay(): Promise<Result<string | null>> {
    try {
      const first = await prisma.moduleUsageDaily.findFirst({
        orderBy: { day: 'asc' },
        select: { day: true },
      })
      return ok(first ? fromDbDate(first.day) : null)
    } catch (error) {
      return err(dbError('Failed to read first module usage day', error))
    }
  },
}
