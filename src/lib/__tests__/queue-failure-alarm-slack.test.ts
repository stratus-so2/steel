import type { Job } from 'bullmq'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/axiom/logger'

// Unit tests must not reach the real Axiom transport; calls are asserted on.
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const env = vi.hoisted(() => ({ webhook: undefined as string | undefined }))
vi.mock('@/lib/env/server', () => ({
  get SLACK_ALERTS_WEBHOOK_URL() {
    return env.webhook
  },
}))

import {
  createJobFailureAlarm,
  JOB_EXHAUSTED_EVENT,
  SLACK_REPEAT_COOLDOWN_MS,
} from '@/src/lib/queue/failure-alarm'

const WEBHOOK = 'https://hooks.slack.com/services/T000/B000/secret-token'
const mockedLogger = vi.mocked(logger)
const fetchMock = vi.fn<typeof fetch>()

function deadJob(overrides: Partial<Record<string, unknown>> = {}): Job {
  return {
    id: 'job-42',
    name: 'delete-account',
    data: {
      userId: 'usr_ckx1',
      workspaceId: 'ws_9',
      email: 'ana.silva@example.com',
      token: 'tok_live_abcdef',
    },
    attemptsMade: 3,
    finishedOn: 1_700_000_000_000,
    stacktrace: ['Error: at secretFunction (/app/src/x.ts:1:1)'],
    opts: { attempts: 3 },
    ...overrides,
  } as unknown as Job
}

function sentTexts(): string[] {
  return fetchMock.mock.calls.map(
    ([, init]) => (JSON.parse(String(init?.body)) as { text: string }).text,
  )
}

beforeEach(() => {
  env.webhook = WEBHOOK
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response('ok', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('job failure alarm -- Slack', () => {
  it('posts one message per death with queue, job, reason, attempts and the error', async () => {
    const alarm = createJobFailureAlarm()
    const error = new Error('Foreign key constraint violated on sessions')
    error.stack = 'Error: Foreign key...\n    at secretFunction (/app/x.ts:1:1)'

    alarm.workerFailed('account-lifecycle', deadJob(), error)
    await alarm.flush()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(WEBHOOK)
    const [text] = sentTexts()
    expect(text).toContain('account-lifecycle')
    expect(text).toContain('delete-account')
    expect(text).toContain('job-42')
    expect(text).toContain('tentativas esgotadas')
    expect(text).toContain('3/3')
    expect(text).toContain('Foreign key constraint violated on sessions')
  })

  it('carries only the allowlisted ids from the payload, never other data or the stack', async () => {
    const alarm = createJobFailureAlarm()

    alarm.workerFailed(
      'account-lifecycle',
      deadJob(),
      new Error('failed for ana.silva@example.com'),
    )
    await alarm.flush()

    const [text] = sentTexts()
    expect(text).toContain('usr_ckx1')
    expect(text).toContain('ws_9')
    expect(text).not.toContain('ana.silva@example.com')
    expect(text).not.toContain('tok_live_abcdef')
    expect(text).not.toContain('secretFunction')
  })

  it('posts once when the Worker and the QueueEvents backstop both report the same death', async () => {
    const alarm = createJobFailureAlarm()
    const job = deadJob()

    alarm.workerFailed('account-lifecycle', job, new Error('boom'))
    alarm.queueEventFailed('account-lifecycle', 'job-42', 'boom', job)
    await alarm.flush()

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('posts once for the backstop path alone (a death the Worker never saw)', async () => {
    const alarm = createJobFailureAlarm()

    alarm.queueEventFailed(
      'data-export',
      'job-7',
      'job stalled more than allowable limit',
      undefined,
    )
    await alarm.flush()

    expect(sentTexts()).toHaveLength(1)
    expect(sentTexts()[0]).toContain('data-export')
    expect(sentTexts()[0]).toContain('travou')
  })

  it('posts nothing for a failure BullMQ will retry', async () => {
    const alarm = createJobFailureAlarm()

    alarm.workerFailed(
      'account-lifecycle',
      deadJob({ attemptsMade: 1 }),
      new Error('transient'),
    )
    await alarm.flush()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not call fetch at all when the webhook is unset', async () => {
    env.webhook = undefined
    const alarm = createJobFailureAlarm()

    alarm.workerFailed('account-lifecycle', deadJob(), new Error('boom'))
    await alarm.flush()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'queue.job.exhausted',
      expect.anything(),
    )
  })

  it('still logs the death and never throws when Slack answers 500', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }))
    const alarm = createJobFailureAlarm()

    expect(() =>
      alarm.workerFailed('account-lifecycle', deadJob(), new Error('boom')),
    ).not.toThrow()
    await expect(alarm.flush()).resolves.toBeUndefined()

    expect(mockedLogger.error).toHaveBeenCalledWith(
      'queue.job.exhausted',
      expect.objectContaining({ jobId: 'job-42' }),
    )
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'alerts.slack.failed',
      expect.objectContaining({ status: 500 }),
    )
  })

  it('flush waits for a send still in flight, and is bounded when Slack hangs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
      const alarm = createJobFailureAlarm()
      alarm.workerFailed('account-lifecycle', deadJob(), new Error('boom'))

      let flushed = false
      const flushing = alarm.flush().then(() => {
        flushed = true
      })
      await vi.advanceTimersByTimeAsync(100)
      expect(flushed).toBe(false)

      await vi.advanceTimersByTimeAsync(5_000)
      await flushing
      expect(flushed).toBe(true)
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'alerts.slack.failed',
        expect.objectContaining({ reason: 'timeout' }),
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('job failure alarm -- Slack cooldown for repeated deaths', () => {
  // A minute-level tick with one attempt dies every run while it is broken.
  function tickDeath(id: string, finishedOn: number): Job {
    return deadJob({
      id,
      name: 'collect-core',
      finishedOn,
      attemptsMade: 1,
      opts: { attempts: 1 },
    })
  }

  function exhaustedLogs(): number {
    return mockedLogger.error.mock.calls.filter(
      ([event]) => event === JOB_EXHAUSTED_EVENT,
    ).length
  }

  it('posts the first death of a queue/job and only logs the repeats inside the cooldown', async () => {
    let clock = Date.UTC(2026, 9, 6, 15, 0)
    const alarm = createJobFailureAlarm({ now: () => clock })

    for (let i = 0; i < 5; i++) {
      alarm.workerFailed(
        'status-collect',
        tickDeath(`j${i}`, clock),
        new Error('db down'),
      )
      clock += 60_000
    }
    await alarm.flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(exhaustedLogs()).toBe(5)
    expect(mockedLogger.info).toHaveBeenCalledWith(
      'alerts.slack.throttled',
      expect.objectContaining({
        queue: 'status-collect',
        jobName: 'collect-core',
      }),
    )
  })

  it('after the cooldown posts again and says how many deaths were held back', async () => {
    let clock = Date.UTC(2026, 9, 6, 15, 0)
    const alarm = createJobFailureAlarm({ now: () => clock })

    alarm.workerFailed(
      'status-collect',
      tickDeath('a', clock),
      new Error('db down'),
    )
    clock += 60_000
    alarm.workerFailed(
      'status-collect',
      tickDeath('b', clock),
      new Error('db down'),
    )
    clock += 60_000
    alarm.workerFailed(
      'status-collect',
      tickDeath('c', clock),
      new Error('db down'),
    )
    clock += SLACK_REPEAT_COOLDOWN_MS
    alarm.workerFailed(
      'status-collect',
      tickDeath('d', clock),
      new Error('db down'),
    )
    await alarm.flush()

    const texts = sentTexts()
    expect(texts).toHaveLength(2)
    expect(texts[0]).not.toContain('Mais ')
    expect(texts[1]).toContain('Mais 2 mortes iguais desde 06/10 12:01')
  })

  it('uses the singular when a single death was held back', async () => {
    let clock = Date.UTC(2026, 9, 6, 15, 0)
    const alarm = createJobFailureAlarm({ now: () => clock })

    alarm.workerFailed('status-collect', tickDeath('a', clock), new Error('x'))
    clock += 60_000
    alarm.workerFailed('status-collect', tickDeath('b', clock), new Error('x'))
    clock += SLACK_REPEAT_COOLDOWN_MS
    alarm.workerFailed('status-collect', tickDeath('c', clock), new Error('x'))
    await alarm.flush()

    expect(sentTexts()[1]).toContain('Mais 1 morte igual desde')
    expect(sentTexts()[1]).toContain('não foi avisada')
  })

  it('keeps separate cooldowns per queue and per job name', async () => {
    const clock = Date.UTC(2026, 9, 6, 15, 0)
    const alarm = createJobFailureAlarm({ now: () => clock })

    alarm.workerFailed('status-collect', tickDeath('a', clock), new Error('x'))
    alarm.workerFailed(
      'status-collect',
      deadJob({
        id: 'b',
        name: 'collect-peripheral',
        attemptsMade: 1,
        opts: { attempts: 1 },
      }),
      new Error('x'),
    )
    alarm.workerFailed('servicedesk-sla', tickDeath('c', clock), new Error('x'))
    await alarm.flush()

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
