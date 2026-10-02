import type { Job } from 'bullmq'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdReportRun,
  SD_REPORT_PERIOD_END,
  SD_REPORT_PERIOD_START,
} from '@/src/__tests__/factories/sd-report.factory'
import { sdReportGenerationFailed } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { toSdReportRunDTO } from '@/src/mappers/sd-report.mapper'

vi.mock('@/src/services/sd-report-runner', () => ({
  SdReportRunner: { runTick: vi.fn(), generateFromJob: vi.fn() },
}))

import { processServicedeskReports } from '@/src/lib/queue/processors/servicedesk-reports'
import { SdReportRunner } from '@/src/services/sd-report-runner'

const runner = vi.mocked(SdReportRunner)

function job(name: string, data: Record<string, unknown> = {}): Job {
  return { id: 'job-1', name, data } as Job
}

beforeEach(() => {
  runner.runTick.mockResolvedValue({ due: 2, enqueued: 2, errors: 0 })
  runner.generateFromJob.mockResolvedValue(
    ok(toSdReportRunDTO(createFakeSdReportRun({ status: 'SENT' }))),
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('processServicedeskReports()', () => {
  it('delegates run-tick to the runner', async () => {
    const result = await processServicedeskReports(job('run-tick'))

    expect(runner.runTick).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ due: 2, enqueued: 2, errors: 0 })
  })

  it('generates the report of the payload', async () => {
    const payload = {
      workspaceId: 'ws1',
      reportId: 'rep1',
      periodStart: SD_REPORT_PERIOD_START.toISOString(),
      periodEnd: SD_REPORT_PERIOD_END.toISOString(),
    }

    const result = await processServicedeskReports(
      job('generate-report', payload),
    )

    expect(runner.generateFromJob).toHaveBeenCalledWith(payload)
    expect(result).toMatchObject({ status: 'SENT' })
  })

  it('logs an on-demand job with no schedule id', async () => {
    const result = await processServicedeskReports(
      job('generate-report', { workspaceId: 'ws1', requestedById: 'u1' }),
    )

    expect(result).toMatchObject({ status: 'SENT' })
  })

  it('throws when the generation fails (BullMQ retries)', async () => {
    runner.generateFromJob.mockResolvedValue(
      err(sdReportGenerationFailed('MinIO fora do ar')),
    )

    await expect(
      processServicedeskReports(job('generate-report', { workspaceId: 'ws1' })),
    ).rejects.toThrow('SD_REPORT_GENERATION_FAILED')
  })

  it('throws on an unknown job name', async () => {
    await expect(processServicedeskReports(job('nope'))).rejects.toThrow(
      'Unknown servicedesk-reports job: nope',
    )
  })

  it('names an unknown job without an id', async () => {
    await expect(
      processServicedeskReports({ name: 'nope', data: {} } as Job),
    ).rejects.toThrow('id=unknown')
  })
})
