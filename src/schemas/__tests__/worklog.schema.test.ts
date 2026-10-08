import { describe, expect, it } from 'vitest'
import {
  ProductivityQuerySchema,
  WorklogExportQuerySchema,
  WorklogListQuerySchema,
} from '../worklog.schema'
import { CreateWorkspaceExportSchema } from '../workspace-export.schema'

describe('WorklogListQuerySchema', () => {
  it('defaults to the last 30 days, first page of 50', () => {
    expect(WorklogListQuerySchema.parse({})).toEqual({
      period: 'last_30_days',
      page: 1,
      pageSize: 50,
    })
  })

  it('accepts filters and coerces paging', () => {
    expect(
      WorklogListQuerySchema.parse({
        period: 'custom',
        from: '2026-10-01',
        to: '2026-10-07',
        userId: 'u1',
        ticket: ' INC-000042 ',
        billable: 'true',
        source: 'TIMER',
        page: '3',
        pageSize: '25',
      }),
    ).toMatchObject({ ticket: 'INC-000042', page: 3, pageSize: 25 })
  })

  it('rejects bad values', () => {
    for (const input of [
      { period: 'forever' },
      { billable: 'yes' },
      { source: 'AI' },
      { pageSize: '500' },
      { from: '2026-13-45' },
      { from: '01/10/2026' },
    ]) {
      expect(
        WorklogListQuerySchema.safeParse(input).success,
        JSON.stringify(input),
      ).toBe(false)
    }
  })

  it('validates the custom range', () => {
    const issue = (input: Record<string, string>) =>
      WorklogExportQuerySchema.safeParse({ period: 'custom', ...input }).error
        ?.issues[0]
    expect(issue({})?.path).toEqual(['from'])
    expect(issue({ from: '2026-10-01' })?.path).toEqual(['to'])
    expect(issue({ from: '2026-10-05', to: '2026-10-01' })?.message).toBe(
      'O fim do período precisa ser depois do início',
    )
    expect(issue({ from: '2026-01-01', to: '2026-06-01' })?.message).toBe(
      'O período pode ter no máximo 92 dias',
    )
    expect(issue({ from: '2026-10-01', to: '2026-10-01' })).toBeUndefined()
  })
})

describe('ProductivityQuerySchema', () => {
  it('takes a period and an optional person', () => {
    expect(
      ProductivityQuerySchema.parse({ period: 'this_month', userId: 'u1' }),
    ).toEqual({ period: 'this_month', userId: 'u1' })
  })
})

describe('CreateWorkspaceExportSchema', () => {
  it('accepts the two kinds and defaults the logs window to 7 days', () => {
    expect(CreateWorkspaceExportSchema.parse({ kind: 'DATA' })).toEqual({
      kind: 'DATA',
    })
    expect(CreateWorkspaceExportSchema.parse({ kind: 'LOGS' })).toEqual({
      kind: 'LOGS',
      periodDays: 7,
    })
    expect(
      CreateWorkspaceExportSchema.parse({ kind: 'LOGS', periodDays: 30 }),
    ).toEqual({ kind: 'LOGS', periodDays: 30 })
  })

  it('caps the logs window at 1, 7 or 30 days', () => {
    expect(
      CreateWorkspaceExportSchema.safeParse({ kind: 'LOGS', periodDays: 90 })
        .success,
    ).toBe(false)
    expect(CreateWorkspaceExportSchema.safeParse({ kind: 'ALL' }).success).toBe(
      false,
    )
  })
})
