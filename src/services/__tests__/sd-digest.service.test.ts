import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdDigestCounts } from '@/src/repositories/sd-notification.repository'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/env/env', () => ({ NEXT_PUBLIC_URL: 'https://steel.test' }))
vi.mock('@/src/lib/mail/servicedesk/send-sd-daily-digest', () => ({
  sendSdDailyDigestEmail: vi.fn(),
}))
vi.mock('@/src/repositories/sd-notification.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/services/notification.service')

import { logger } from '@/lib/axiom/logger'
import { sendSdDailyDigestEmail } from '@/src/lib/mail/servicedesk/send-sd-daily-digest'
import { SdNotificationRepository } from '@/src/repositories/sd-notification.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { NotificationService } from '../notification.service'
import { SdDigestService, sdDigestBody } from '../sd-digest.service'

const repo = vi.mocked(SdNotificationRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const notifications = vi.mocked(NotificationService)
const sendEmail = vi.mocked(sendSdDailyDigestEmail)

/** 08:00 em São Paulo (UTC−3) = 11:00 UTC. */
const DUE = new Date('2026-10-01T11:00:00.000Z')
const NOT_DUE = new Date('2026-10-01T15:00:00.000Z')

function counts(overrides: Partial<SdDigestCounts> = {}): SdDigestCounts {
  return {
    queue: 5,
    atRisk: 2,
    waiting: 1,
    highlights: [
      {
        id: 't1',
        number: 42,
        type: 'INCIDENT',
        title: 'Servidor fora do ar',
        resolutionDueAt: new Date('2026-10-01T18:00:00.000Z'),
      },
    ],
    ...overrides,
  }
}

function calendar(timezone = 'America/Sao_Paulo') {
  return ok({ timezone } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  ctxRepo.listEnabledWorkspaceIds.mockResolvedValue(ok(['ws1']))
  ctxRepo.findDefaultCalendar.mockResolvedValue(calendar())
  ctxRepo.findWorkspace.mockResolvedValue(
    ok({ id: 'ws1', name: 'Stratus', slug: 'stratus' }),
  )
  ctxRepo.ensureSettings.mockResolvedValue(ok(createFakeSdSettings()))
  repo.listDigestUserIds.mockResolvedValue(ok([]))
  repo.digestCounts.mockResolvedValue(ok(counts()))
  repo.findRecipients.mockResolvedValue(
    ok([{ id: 'u1', name: 'Ana Agente', email: 'ana@example.com' }]),
  )
  notifications.notifyUsers.mockResolvedValue(ok(1))
  sendEmail.mockResolvedValue({ id: 'mail' } as never)
})

describe('sdDigestBody', () => {
  it('monta a frase só com o que existe', () => {
    expect(sdDigestBody(counts())).toBe(
      'Sua fila hoje: 5 em aberto, 2 com prazo apertado, 1 aguardando resposta.',
    )
    expect(sdDigestBody(counts({ atRisk: 0, waiting: 0 }))).toBe(
      'Sua fila hoje: 5 em aberto.',
    )
  })
})

describe('SdDigestService.runTick — janela do dia', () => {
  it('não faz nada fora da hora local do workspace', async () => {
    repo.listDigestUserIds.mockResolvedValue(ok(['u1']))
    const result = await SdDigestService.runTick(NOT_DUE)
    expect(result).toMatchObject({ workspaces: 1, due: 0, sent: 0 })
    expect(repo.listDigestUserIds).not.toHaveBeenCalled()
  })

  it('usa o fuso do calendário padrão do workspace', async () => {
    ctxRepo.findDefaultCalendar.mockResolvedValue(calendar('Europe/Lisbon'))
    // 11:00 UTC é 12:00 em Lisboa — fora da janela.
    expect((await SdDigestService.runTick(DUE)).due).toBe(0)
    // 07:00 UTC é 08:00 em Lisboa.
    expect(
      (await SdDigestService.runTick(new Date('2026-10-01T07:00:00.000Z'))).due,
    ).toBe(1)
  })

  it('cai no fuso padrão sem calendário ou com leitura falhando', async () => {
    ctxRepo.findDefaultCalendar.mockResolvedValue(ok(null))
    expect((await SdDigestService.runTick(DUE)).due).toBe(1)

    ctxRepo.findDefaultCalendar.mockResolvedValue(err(databaseError()))
    expect((await SdDigestService.runTick(DUE)).due).toBe(1)
  })

  it('conta erro quando a lista de workspaces falha', async () => {
    ctxRepo.listEnabledWorkspaceIds.mockResolvedValue(err(databaseError()))
    const result = await SdDigestService.runTick(DUE)
    expect(result).toMatchObject({ workspaces: 0, errors: 1 })
    expect(logger.error).toHaveBeenCalledWith(
      'servicedesk.digest.workspaces_failed',
      expect.objectContaining({ reason: 'DATABASE_ERROR' }),
    )
  })

  it('conta erro quando falta workspace, preferências ou configuração', async () => {
    ctxRepo.findWorkspace.mockResolvedValue(ok(null))
    expect((await SdDigestService.runTick(DUE)).errors).toBe(1)

    ctxRepo.findWorkspace.mockResolvedValue(err(databaseError()))
    expect((await SdDigestService.runTick(DUE)).errors).toBe(1)

    ctxRepo.findWorkspace.mockResolvedValue(
      ok({ id: 'ws1', name: 'Stratus', slug: 'stratus' }),
    )
    ctxRepo.ensureSettings.mockResolvedValue(err(databaseError()))
    expect((await SdDigestService.runTick(DUE)).errors).toBe(1)

    ctxRepo.ensureSettings.mockResolvedValue(ok(createFakeSdSettings()))
    repo.listDigestUserIds.mockResolvedValue(err(databaseError()))
    expect((await SdDigestService.runTick(DUE)).errors).toBe(1)
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.digest.workspace_failed',
      { workspaceId: 'ws1' },
    )
  })
})

describe('SdDigestService.runTick — entrega', () => {
  it('manda in-app e e-mail a quem optou pelos dois', async () => {
    repo.listDigestUserIds.mockResolvedValue(ok(['u1']))
    const result = await SdDigestService.runTick(DUE)
    expect(result).toMatchObject({
      due: 1,
      sent: 1,
      inApp: 1,
      email: 1,
      errors: 0,
    })
    expect(notifications.notifyUsers).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      userIds: ['u1'],
      kind: 'SD_DIGEST',
      title: 'Resumo do ServiceDesk',
      body: 'Sua fila hoje: 5 em aberto, 2 com prazo apertado, 1 aguardando resposta.',
      href: '/stratus/servicedesk',
    })
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@example.com',
        workspaceName: 'Stratus',
        queue: 5,
        atRisk: 2,
        waiting: 1,
        highlights: [
          {
            code: 'INC-000042',
            title: 'Servidor fora do ar',
            url: 'https://steel.test/stratus/servicedesk/tickets/42',
          },
        ],
        redirectUrl: 'https://steel.test/stratus/servicedesk',
      }),
    )
  })

  it('manda só o canal escolhido por cada um', async () => {
    repo.listDigestUserIds.mockImplementation(async (_ws, _event, channel) =>
      ok(channel === 'IN_APP' ? ['app'] : ['mail']),
    )
    const result = await SdDigestService.runTick(DUE)
    expect(result).toMatchObject({ sent: 2, inApp: 1, email: 1 })
    expect(notifications.notifyUsers).toHaveBeenCalledTimes(1)
    expect(notifications.notifyUsers.mock.calls[0]?.[0].userIds).toEqual([
      'app',
    ])
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('não manda nada quando ninguém optou', async () => {
    const result = await SdDigestService.runTick(DUE)
    expect(result).toMatchObject({ due: 1, sent: 0 })
    expect(repo.digestCounts).not.toHaveBeenCalled()
  })

  it('pula quem está com a fila vazia', async () => {
    repo.listDigestUserIds.mockResolvedValue(ok(['u1']))
    repo.digestCounts.mockResolvedValue(ok(counts({ queue: 0 })))
    const result = await SdDigestService.runTick(DUE)
    expect(result).toMatchObject({ sent: 0, skipped: 1 })
    expect(notifications.notifyUsers).not.toHaveBeenCalled()
  })

  it('conta e loga a falha da contagem', async () => {
    repo.listDigestUserIds.mockResolvedValue(ok(['u1']))
    repo.digestCounts.mockResolvedValue(err(databaseError()))
    const result = await SdDigestService.runTick(DUE)
    expect(result).toMatchObject({ sent: 0, errors: 1 })
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.digest.counts_failed',
      expect.objectContaining({ workspaceId: 'ws1' }),
    )
  })

  it('conta e loga a falha de cada canal', async () => {
    repo.listDigestUserIds.mockResolvedValue(ok(['u1']))
    notifications.notifyUsers.mockResolvedValue(err(databaseError()))
    sendEmail.mockRejectedValue(new Error('smtp'))
    const result = await SdDigestService.runTick(DUE)
    expect(result).toMatchObject({ sent: 0, inApp: 0, email: 0, errors: 2 })
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.digest.in_app_failed',
      expect.objectContaining({ reason: 'DATABASE_ERROR' }),
    )
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.digest.email_failed',
      expect.objectContaining({ reason: 'smtp' }),
    )

    sendEmail.mockRejectedValue('oops')
    await SdDigestService.runTick(DUE)
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.digest.email_failed',
      expect.objectContaining({ reason: 'unknown' }),
    )
  })

  it('conta erro quando o destinatário do e-mail não é lido', async () => {
    repo.listDigestUserIds.mockImplementation(async (_ws, _event, channel) =>
      ok(channel === 'EMAIL' ? ['u1'] : []),
    )
    repo.findRecipients.mockResolvedValue(ok([]))
    expect((await SdDigestService.runTick(DUE)).errors).toBe(1)

    repo.findRecipients.mockResolvedValue(err(databaseError()))
    expect((await SdDigestService.runTick(DUE)).errors).toBe(1)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
