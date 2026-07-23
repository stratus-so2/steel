import { prisma } from '@/src/lib/prisma'

const SOURCE_MODEL = {
  company: prisma.crmCompany,
  person: prisma.crmPerson,
  opportunity: prisma.crmOpportunity,
  lead: prisma.crmLead,
} as const

export type CrmReportSource = keyof typeof SOURCE_MODEL

export function isCrmReportSource(value: string): value is CrmReportSource {
  return value in SOURCE_MODEL
}

interface RunCrmReportInput {
  source: CrmReportSource
  workspaceId: string
  columns: string[]
  filters: Record<string, unknown>
  groupBy?: string | null
  sort?: { field: string; direction: 'asc' | 'desc' } | null
}

export async function runCrmReport(
  input: RunCrmReportInput,
): Promise<Record<string, unknown>[]> {
  const model = SOURCE_MODEL[input.source]
  const where = {
    workspaceId: input.workspaceId,
    deletedAt: null,
    ...input.filters,
  }

  if (input.groupBy) {
    const rows = await (
      model as unknown as {
        groupBy: (
          args: unknown,
        ) => Promise<{ [key: string]: unknown; _count: { _all: number } }[]>
      }
    ).groupBy({
      by: [input.groupBy],
      where,
      _count: { _all: true },
    })

    return rows.map((row) => ({
      [input.groupBy as string]: row[input.groupBy as string],
      count: row._count._all,
    }))
  }

  const rows = await (
    model as unknown as {
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>
    }
  ).findMany({
    where,
    orderBy: input.sort
      ? { [input.sort.field]: input.sort.direction }
      : undefined,
    take: 500,
  })

  return rows.map((row) =>
    Object.fromEntries(input.columns.map((column) => [column, row[column]])),
  )
}
