import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  sendChangelogEmail: vi.fn(),
  findRecipientById: vi.fn(),
  updateRecipientStatus: vi.fn(),
  countPendingRecipients: vi.fn(),
  updateStatus: vi.fn(),
}))

vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.loggerMock }))
vi.mock('@/src/lib/mail/admin/send-changelog', () => ({
  sendChangelogEmail: mocks.sendChangelogEmail,
}))
vi.mock('@/src/repositories/changelog.repository', () => ({
  ChangelogRepository: {
    findRecipientById: mocks.findRecipientById,
    updateRecipientStatus: mocks.updateRecipientStatus,
    countPendingRecipients: mocks.countPendingRecipients,
    updateStatus: mocks.updateStatus,
  },
}))

import { ChangelogJob } from '@/src/lib/queue/jobs'
import { processChangelog } from '@/src/lib/queue/processors/changelog'

function sendJob(name: string = ChangelogJob.SendChangelogEmail): Job {
  return {
    id: 'job-1',
    name,
    data: { changelogId: 'cl-1', recipientId: 'rcp-1' },
  } as unknown as Job
}

function recipient(status = 'PENDING') {
  return {
    id: 'rcp-1',
    email: 'user@example.com',
    status,
    changelog: {
      subject: 'Novidades de setembro',
      items: [
        { title: 'CRM', body: 'Novo funil', imageUrl: 'https://x/img.png' },
      ],
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.updateRecipientStatus.mockResolvedValue({ ok: true, value: {} })
  mocks.updateStatus.mockResolvedValue({ ok: true, value: {} })
})

describe('processChangelog', () => {
  it('sends the e-mail, marks the recipient SENT and closes the changelog when none is pending', async () => {
    mocks.findRecipientById.mockResolvedValue({ ok: true, value: recipient() })
    mocks.sendChangelogEmail.mockResolvedValue(undefined)
    mocks.countPendingRecipients.mockResolvedValue({ ok: true, value: 0 })

    await processChangelog(sendJob())

    expect(mocks.sendChangelogEmail).toHaveBeenCalledWith({
      email: 'user@example.com',
      subject: 'Novidades de setembro',
      items: [
        { title: 'CRM', body: 'Novo funil', imageUrl: 'https://x/img.png' },
      ],
    })
    expect(mocks.updateRecipientStatus).toHaveBeenCalledWith('rcp-1', {
      status: 'SENT',
      sentAt: expect.any(Date),
    })
    expect(mocks.updateStatus).toHaveBeenCalledWith('cl-1', 'DONE')
    expect(mocks.loggerMock.info).toHaveBeenCalledWith(
      'queue.changelog.processed',
      expect.objectContaining({ recipientId: 'rcp-1' }),
    )
  })

  it('keeps the changelog open while other recipients are pending', async () => {
    mocks.findRecipientById.mockResolvedValue({ ok: true, value: recipient() })
    mocks.sendChangelogEmail.mockResolvedValue(undefined)
    mocks.countPendingRecipients.mockResolvedValue({ ok: true, value: 3 })

    await processChangelog(sendJob())

    expect(mocks.updateStatus).not.toHaveBeenCalled()
  })

  it('does not close the changelog when counting pending recipients fails', async () => {
    mocks.findRecipientById.mockResolvedValue({ ok: true, value: recipient() })
    mocks.sendChangelogEmail.mockResolvedValue(undefined)
    mocks.countPendingRecipients.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'down' },
    })

    await processChangelog(sendJob())

    expect(mocks.updateStatus).not.toHaveBeenCalled()
  })

  it('marks the recipient FAILED with the error message when sending throws', async () => {
    mocks.findRecipientById.mockResolvedValue({ ok: true, value: recipient() })
    mocks.sendChangelogEmail.mockRejectedValue(new Error('resend down'))
    mocks.countPendingRecipients.mockResolvedValue({ ok: true, value: 0 })

    await processChangelog(sendJob())

    expect(mocks.updateRecipientStatus).toHaveBeenCalledWith('rcp-1', {
      status: 'FAILED',
      errorMessage: 'resend down',
    })
    expect(mocks.updateStatus).toHaveBeenCalledWith('cl-1', 'DONE')
  })

  it('stringifies non-Error rejections', async () => {
    mocks.findRecipientById.mockResolvedValue({ ok: true, value: recipient() })
    mocks.sendChangelogEmail.mockRejectedValue('quota')
    mocks.countPendingRecipients.mockResolvedValue({ ok: true, value: 1 })

    await processChangelog(sendJob())

    expect(mocks.updateRecipientStatus).toHaveBeenCalledWith('rcp-1', {
      status: 'FAILED',
      errorMessage: 'quota',
    })
  })

  it('warns and stops when the recipient is missing or the lookup fails', async () => {
    mocks.findRecipientById
      .mockResolvedValueOnce({ ok: true, value: null })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'DATABASE_ERROR', message: 'down' },
      })

    await processChangelog(sendJob())
    await processChangelog(sendJob())

    expect(mocks.loggerMock.warn).toHaveBeenCalledTimes(2)
    expect(mocks.loggerMock.warn).toHaveBeenCalledWith(
      'queue.changelog.recipient_missing',
      expect.objectContaining({ recipientId: 'rcp-1' }),
    )
    expect(mocks.sendChangelogEmail).not.toHaveBeenCalled()
  })

  it('skips recipients that were already processed (idempotent retry)', async () => {
    mocks.findRecipientById.mockResolvedValue({
      ok: true,
      value: recipient('SENT'),
    })

    await processChangelog(sendJob())

    expect(mocks.sendChangelogEmail).not.toHaveBeenCalled()
    expect(mocks.updateRecipientStatus).not.toHaveBeenCalled()
    expect(mocks.countPendingRecipients).not.toHaveBeenCalled()
  })

  it('throws on an unknown job name', async () => {
    await expect(processChangelog(sendJob('nope'))).rejects.toThrow(
      'Unknown changelog job: nope (id=job-1)',
    )
  })
})
