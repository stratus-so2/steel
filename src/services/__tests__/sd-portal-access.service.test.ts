import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdPortalAccess,
  createFakeSdPortalAccessWithContact,
  createFakeSdPortalContact,
} from '@/src/__tests__/factories/sd-portal.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import {
  hashSdPortalToken,
  newSdPortalToken,
} from '@/src/lib/servicedesk/portal-session'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-portal.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/lib/mail/servicedesk/send-sd-portal-access', () => ({
  sendSdPortalAccessEmail: vi.fn(async () => ({ id: 'dry-run' })),
}))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { auditMutation } from '@/lib/axiom/audit'
import { sendSdPortalAccessEmail } from '@/src/lib/mail/servicedesk/send-sd-portal-access'
import { SdPortalRepository } from '@/src/repositories/sd-portal.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdPortalAccessService } from '../sd-portal-access.service'

const repo = vi.mocked(SdPortalRepository)
const context = vi.mocked(SdTicketContextRepository)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const mail = vi.mocked(sendSdPortalAccessEmail)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'
const WORKSPACE = { id: WS, name: 'Stratus Telecom', slug: 'stratus' }

beforeEach(() => {
  vi.clearAllMocks()
  moduleAccess.isEnabled.mockResolvedValue(ok(true))
  context.ensureSettings.mockResolvedValue(ok(createFakeSdSettings()))
  context.findWorkspace.mockResolvedValue(ok(WORKSPACE))
  context.findUserNames.mockResolvedValue(
    ok(
      new Map([
        ['u1', { id: 'u1', name: 'Carlos Agente', email: 'carlos@x.com' }],
      ]),
    ),
  )
  repo.findContact.mockResolvedValue(ok(createFakeSdPortalContact()))
  repo.revokePending.mockResolvedValue(ok(0))
  repo.createAccess.mockResolvedValue(ok(createFakeSdPortalAccess()))
  repo.consume.mockResolvedValue(ok(true))
  repo.closeSession.mockResolvedValue(ok(undefined))
  repo.listByContact.mockResolvedValue(ok([createFakeSdPortalAccess()]))
})

describe('SdPortalAccessService.issue', () => {
  it('sends the link to the contact e-mail and audits the emission', async () => {
    actAs('agent')

    const dto = expectOk(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
    )

    expect(dto.status).toBe('pending')
    expect(repo.revokePending).toHaveBeenCalledWith('contact1', expect.any(Date))
    const created = repo.createAccess.mock.calls[0][0]
    expect(created.email).toBe('ana@acme.com.br')
    expect(created.requestedById).toBe('u1')
    expect(created.tokenHash).toHaveLength(64)
    expect(mail).toHaveBeenCalledTimes(1)
    // O token em claro vai só para o e-mail, nunca para o banco.
    const sent = mail.mock.calls[0][0]
    expect(sent.accessUrl).toContain('/suporte/entrar/')
    expect(created.tokenHash).not.toContain(
      sent.accessUrl.split('/suporte/entrar/')[1],
    )
    expect(sent.sentByName).toBe('Carlos Agente')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_portal_access',
        action: 'create',
        actorId: 'u1',
      }),
    )
  })

  it('accepts an override e-mail', async () => {
    actAs('agent')
    await SdPortalAccessService.issue('u1', WS, {
      contactId: 'contact1',
      email: 'chefe@acme.com.br',
    })
    expect(repo.createAccess.mock.calls[0][0].email).toBe('chefe@acme.com.br')
  })

  it('refuses a requester (no department)', async () => {
    actAs('requester')
    expectErr(
      await SdPortalAccessService.issue('u2', WS, { contactId: 'contact1' }),
      'SD_NOT_AGENT',
    )
    expect(repo.createAccess).not.toHaveBeenCalled()
  })

  it('refuses a non-member', async () => {
    actAs('non-member')
    expectErr(
      await SdPortalAccessService.issue('u9', WS, { contactId: 'contact1' }),
      'FORBIDDEN',
    )
  })

  it('refuses when the ServiceDesk module is disabled', async () => {
    actAs('agent')
    moduleAccess.isEnabled.mockResolvedValue(ok(false))
    expectErr(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
      'MODULE_DISABLED',
    )
  })

  it('refuses when the portal is switched off', async () => {
    actAs('agent')
    context.ensureSettings.mockResolvedValue(
      ok(createFakeSdSettings({ portalEnabled: false })),
    )
    expectErr(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
      'SD_PORTAL_DISABLED',
    )
  })

  it('refuses an inactive or deleted contact', async () => {
    actAs('agent')
    repo.findContact.mockResolvedValue(
      ok(createFakeSdPortalContact({ active: false })),
    )
    expectErr(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
      'SD_PORTAL_CONTACT_INACTIVE',
    )

    repo.findContact.mockResolvedValue(
      ok(createFakeSdPortalContact({ deletedAt: new Date() })),
    )
    expectErr(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
      'SD_PORTAL_CONTACT_INACTIVE',
    )
  })

  it('refuses a contact with no e-mail at all', async () => {
    actAs('agent')
    repo.findContact.mockResolvedValue(
      ok(createFakeSdPortalContact({ email: null })),
    )
    expectErr(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
      'VALIDATION_ERROR',
    )
  })

  it('propagates a missing contact and a missing workspace', async () => {
    actAs('agent')
    repo.findContact.mockResolvedValue(err(databaseError('boom')))
    expectErr(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
      'DATABASE_ERROR',
    )

    repo.findContact.mockResolvedValue(ok(createFakeSdPortalContact()))
    context.findWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('audits the failure when the insert breaks', async () => {
    actAs('agent')
    repo.createAccess.mockResolvedValue(err(databaseError('nope')))
    expectErr(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
      'DATABASE_ERROR',
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    )
    expect(mail).not.toHaveBeenCalled()
  })

  it('still issues the link when the e-mail provider fails', async () => {
    actAs('agent')
    mail.mockRejectedValueOnce(new Error('resend down'))
    expectOk(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
    )
    expect(repo.createAccess).toHaveBeenCalled()
  })

  it('falls back to no sender name when the actor cannot be read', async () => {
    actAs('agent')
    context.findUserNames.mockResolvedValue(err(databaseError('x')))
    expectOk(
      await SdPortalAccessService.issue('u1', WS, { contactId: 'contact1' }),
    )
    expect(mail.mock.calls[0][0].sentByName).toBeNull()
  })
})

describe('SdPortalAccessService.requestByEmail', () => {
  it('issues one link per matching workspace, without an actor', async () => {
    repo.findActiveContactsByEmail.mockResolvedValue(
      ok([
        createFakeSdPortalContact(),
        createFakeSdPortalContact({ id: 'contact2', workspaceId: 'ws2' }),
      ]),
    )

    const result = expectOk(
      await SdPortalAccessService.requestByEmail({ email: 'ana@acme.com.br' }),
    )

    expect(result.sent).toBe(2)
    expect(repo.createAccess).toHaveBeenCalledTimes(2)
    expect(repo.createAccess.mock.calls[0][0].requestedById).toBeNull()
    expect(mail.mock.calls[0][0].sentByName).toBeNull()
  })

  it('answers the same way when no contact matches (no enumeration)', async () => {
    repo.findActiveContactsByEmail.mockResolvedValue(ok([]))
    const result = expectOk(
      await SdPortalAccessService.requestByEmail({ email: 'nobody@x.com' }),
    )
    expect(result.sent).toBe(0)
    expect(mail).not.toHaveBeenCalled()
  })

  it('answers the same way when the lookup breaks', async () => {
    repo.findActiveContactsByEmail.mockResolvedValue(err(databaseError('x')))
    const result = expectOk(
      await SdPortalAccessService.requestByEmail({ email: 'ana@acme.com.br' }),
    )
    expect(result.sent).toBe(0)
  })

  it('skips a workspace with the portal off or without settings', async () => {
    repo.findActiveContactsByEmail.mockResolvedValue(
      ok([createFakeSdPortalContact()]),
    )
    context.ensureSettings.mockResolvedValue(
      ok(createFakeSdSettings({ portalEnabled: false })),
    )
    expect(
      expectOk(
        await SdPortalAccessService.requestByEmail({
          email: 'ana@acme.com.br',
        }),
      ).sent,
    ).toBe(0)

    context.ensureSettings.mockResolvedValue(err(databaseError('x')))
    expect(
      expectOk(
        await SdPortalAccessService.requestByEmail({
          email: 'ana@acme.com.br',
        }),
      ).sent,
    ).toBe(0)
  })

  it('skips a workspace that cannot be loaded', async () => {
    repo.findActiveContactsByEmail.mockResolvedValue(
      ok([createFakeSdPortalContact()]),
    )
    context.findWorkspace.mockResolvedValue(ok(null))
    expect(
      expectOk(
        await SdPortalAccessService.requestByEmail({
          email: 'ana@acme.com.br',
        }),
      ).sent,
    ).toBe(0)
  })

  it('does not count a workspace whose insert failed', async () => {
    repo.findActiveContactsByEmail.mockResolvedValue(
      ok([createFakeSdPortalContact()]),
    )
    repo.createAccess.mockResolvedValue(err(databaseError('x')))
    expect(
      expectOk(
        await SdPortalAccessService.requestByEmail({
          email: 'ana@acme.com.br',
        }),
      ).sent,
    ).toBe(0)
  })
})

describe('SdPortalAccessService.openSession', () => {
  const { token } = newSdPortalToken()

  it('consumes the link, opens a 12h session and audits it', async () => {
    repo.findByTokenHash.mockResolvedValue(
      ok(createFakeSdPortalAccessWithContact()),
    )

    const opened = expectOk(await SdPortalAccessService.openSession(token))

    expect(repo.findByTokenHash).toHaveBeenCalledWith(hashSdPortalToken(token))
    expect(opened.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(opened.sessionToken).not.toBe(token)
    const consumed = repo.consume.mock.calls[0][0]
    expect(consumed.sessionHash).toBe(hashSdPortalToken(opened.sessionToken))
    expect(
      consumed.sessionExpiresAt.getTime() - consumed.usedAt.getTime(),
    ).toBe(12 * 60 * 60 * 1000)
    expect(opened.session.workspace.name).toBe('Stratus Telecom')
    expect(opened.session.contact.id).toBe('contact1')
    expect(opened.context.customerIds).toEqual(['cus1'])
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_portal_session',
        action: 'create',
      }),
    )
  })

  it('leaves the company scope empty when the setting is off', async () => {
    repo.findByTokenHash.mockResolvedValue(
      ok(createFakeSdPortalAccessWithContact()),
    )
    context.ensureSettings.mockResolvedValue(
      ok(createFakeSdSettings({ portalCompanyScope: false })),
    )
    const opened = expectOk(await SdPortalAccessService.openSession(token))
    expect(opened.context.customerIds).toEqual([])
    expect(opened.session.companyScope).toBe(false)
    expect(opened.session.customers).toHaveLength(1)
  })

  it('refuses an unknown or revoked token', async () => {
    repo.findByTokenHash.mockResolvedValue(ok(null))
    expectErr(
      await SdPortalAccessService.openSession(token),
      'SD_PORTAL_LINK_INVALID',
    )

    repo.findByTokenHash.mockResolvedValue(
      ok(createFakeSdPortalAccessWithContact({ revokedAt: new Date() })),
    )
    expectErr(
      await SdPortalAccessService.openSession(token),
      'SD_PORTAL_LINK_INVALID',
    )
  })

  it('refuses a token that was already used (single use)', async () => {
    repo.findByTokenHash.mockResolvedValue(
      ok(createFakeSdPortalAccessWithContact({ usedAt: new Date() })),
    )
    const error = expectErr(
      await SdPortalAccessService.openSession(token),
      'SD_PORTAL_LINK_INVALID',
    )
    expect(error.message).toContain('já foi usado')
    expect(repo.consume).not.toHaveBeenCalled()
  })

  it('refuses a link past its 7 days', async () => {
    repo.findByTokenHash.mockResolvedValue(
      ok(
        createFakeSdPortalAccessWithContact({
          expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        }),
      ),
    )
    expectErr(
      await SdPortalAccessService.openSession(token),
      'SD_PORTAL_LINK_EXPIRED',
    )
  })

  it('refuses a suspended workspace and an inactive contact', async () => {
    repo.findByTokenHash.mockResolvedValue(
      ok(
        createFakeSdPortalAccessWithContact({
          workspace: {
            id: WS,
            name: 'x',
            slug: 'x',
            status: 'SUSPENDED',
          },
        }),
      ),
    )
    expectErr(
      await SdPortalAccessService.openSession(token),
      'WORKSPACE_SUSPENDED',
    )

    repo.findByTokenHash.mockResolvedValue(
      ok(
        createFakeSdPortalAccessWithContact({
          contact: createFakeSdPortalContact({ active: false }),
        }),
      ),
    )
    expectErr(
      await SdPortalAccessService.openSession(token),
      'SD_PORTAL_CONTACT_INACTIVE',
    )
  })

  it('refuses when the portal was switched off after the link went out', async () => {
    repo.findByTokenHash.mockResolvedValue(
      ok(createFakeSdPortalAccessWithContact()),
    )
    context.ensureSettings.mockResolvedValue(
      ok(createFakeSdSettings({ portalEnabled: false })),
    )
    expectErr(
      await SdPortalAccessService.openSession(token),
      'SD_PORTAL_DISABLED',
    )
  })

  it('loses the race when two clicks arrive at once', async () => {
    repo.findByTokenHash.mockResolvedValue(
      ok(createFakeSdPortalAccessWithContact()),
    )
    repo.consume.mockResolvedValue(ok(false))
    expectErr(
      await SdPortalAccessService.openSession(token),
      'SD_PORTAL_LINK_INVALID',
    )
  })

  it('propagates database failures of the lookup and of the consume', async () => {
    repo.findByTokenHash.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalAccessService.openSession(token),
      'DATABASE_ERROR',
    )

    repo.findByTokenHash.mockResolvedValue(
      ok(createFakeSdPortalAccessWithContact()),
    )
    repo.consume.mockResolvedValue(err(databaseError('x')))
    expectErr(await SdPortalAccessService.openSession(token), 'DATABASE_ERROR')

    repo.consume.mockResolvedValue(ok(true))
    context.ensureSettings.mockResolvedValue(err(databaseError('x')))
    expectErr(await SdPortalAccessService.openSession(token), 'DATABASE_ERROR')
  })
})

describe('SdPortalAccessService.resolveSession', () => {
  const { token: sessionToken } = newSdPortalToken()

  function live(overrides = {}) {
    return createFakeSdPortalAccessWithContact({
      usedAt: new Date('2026-10-01T12:00:00.000Z'),
      sessionHash: hashSdPortalToken(sessionToken),
      sessionExpiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    })
  }

  it('resolves the contact, workspace and company scope', async () => {
    repo.findBySessionHash.mockResolvedValue(ok(live()))

    const context_ = expectOk(
      await SdPortalAccessService.resolveSession(sessionToken),
    )

    expect(repo.findBySessionHash).toHaveBeenCalledWith(
      hashSdPortalToken(sessionToken),
    )
    expect(context_.contact.name).toBe('Ana Souza')
    expect(context_.customerIds).toEqual(['cus1'])
    expect(context_.prefixes.INCIDENT).toBe('INC')
  })

  it('refuses an unknown, revoked or expired session', async () => {
    repo.findBySessionHash.mockResolvedValue(ok(null))
    expectErr(
      await SdPortalAccessService.resolveSession(sessionToken),
      'SD_PORTAL_SESSION_EXPIRED',
    )

    repo.findBySessionHash.mockResolvedValue(ok(live({ revokedAt: new Date() })))
    expectErr(
      await SdPortalAccessService.resolveSession(sessionToken),
      'SD_PORTAL_SESSION_EXPIRED',
    )

    repo.findBySessionHash.mockResolvedValue(
      ok(live({ sessionExpiresAt: new Date(Date.now() - 1000) })),
    )
    expectErr(
      await SdPortalAccessService.resolveSession(sessionToken),
      'SD_PORTAL_SESSION_EXPIRED',
    )

    repo.findBySessionHash.mockResolvedValue(
      ok(live({ sessionExpiresAt: null })),
    )
    expectErr(
      await SdPortalAccessService.resolveSession(sessionToken),
      'SD_PORTAL_SESSION_EXPIRED',
    )
  })

  it('refuses a suspended workspace, an inactive contact and a closed portal', async () => {
    repo.findBySessionHash.mockResolvedValue(
      ok(
        live({
          workspace: { id: WS, name: 'x', slug: 'x', status: 'SUSPENDED' },
        }),
      ),
    )
    expectErr(
      await SdPortalAccessService.resolveSession(sessionToken),
      'WORKSPACE_SUSPENDED',
    )

    repo.findBySessionHash.mockResolvedValue(
      ok(live({ contact: createFakeSdPortalContact({ active: false }) })),
    )
    expectErr(
      await SdPortalAccessService.resolveSession(sessionToken),
      'SD_PORTAL_CONTACT_INACTIVE',
    )

    repo.findBySessionHash.mockResolvedValue(ok(live()))
    context.ensureSettings.mockResolvedValue(
      ok(createFakeSdSettings({ portalEnabled: false })),
    )
    expectErr(
      await SdPortalAccessService.resolveSession(sessionToken),
      'SD_PORTAL_DISABLED',
    )
  })

  it('propagates database failures', async () => {
    repo.findBySessionHash.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalAccessService.resolveSession(sessionToken),
      'DATABASE_ERROR',
    )

    repo.findBySessionHash.mockResolvedValue(ok(live()))
    context.ensureSettings.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalAccessService.resolveSession(sessionToken),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPortalAccessService.closeSession', () => {
  const { token } = newSdPortalToken()

  it('clears the session and audits it', async () => {
    repo.findBySessionHash.mockResolvedValue(
      ok(createFakeSdPortalAccessWithContact()),
    )
    expectOk(await SdPortalAccessService.closeSession(token))
    expect(repo.closeSession).toHaveBeenCalledWith('access1')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_portal_session',
        action: 'delete',
      }),
    )
  })

  it('is a no-op for an unknown session', async () => {
    repo.findBySessionHash.mockResolvedValue(ok(null))
    expectOk(await SdPortalAccessService.closeSession(token))
    expect(repo.closeSession).not.toHaveBeenCalled()
  })

  it('propagates database failures', async () => {
    repo.findBySessionHash.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalAccessService.closeSession(token),
      'DATABASE_ERROR',
    )

    repo.findBySessionHash.mockResolvedValue(
      ok(createFakeSdPortalAccessWithContact()),
    )
    repo.closeSession.mockResolvedValue(err(databaseError('x')))
    expectErr(await SdPortalAccessService.closeSession(token), 'DATABASE_ERROR')
  })
})

describe('SdPortalAccessService.listForContact', () => {
  it('lists the links for an agent', async () => {
    actAs('agent')
    const list = expectOk(
      await SdPortalAccessService.listForContact('u1', WS, 'contact1'),
    )
    expect(list).toHaveLength(1)
    expect(list[0]).not.toHaveProperty('tokenHash')
    expect(repo.listByContact).toHaveBeenCalledWith(WS, 'contact1', 20)
  })

  it('refuses a requester and an unknown contact', async () => {
    actAs('requester')
    expectErr(
      await SdPortalAccessService.listForContact('u2', WS, 'contact1'),
      'SD_NOT_AGENT',
    )

    actAs('agent')
    repo.findContact.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalAccessService.listForContact('u1', WS, 'contact1'),
      'DATABASE_ERROR',
    )
  })

  it('propagates a listing failure', async () => {
    actAs('agent')
    repo.listByContact.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalAccessService.listForContact('u1', WS, 'contact1'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPortalAccessService.revoke', () => {
  it('revokes the link and audits it', async () => {
    actAs('agent')
    repo.revoke.mockResolvedValue(
      ok(createFakeSdPortalAccess({ revokedAt: new Date() })),
    )

    const dto = expectOk(
      await SdPortalAccessService.revoke('u1', WS, 'access1'),
    )

    expect(dto.status).toBe('revoked')
    expect(repo.revoke).toHaveBeenCalledWith('access1', WS, expect.any(Date))
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_portal_access',
        action: 'revoke',
        actorId: 'u1',
      }),
    )
  })

  it('404s for an access of another workspace or already revoked', async () => {
    actAs('agent')
    repo.revoke.mockResolvedValue(ok(null))
    expectErr(
      await SdPortalAccessService.revoke('u1', WS, 'access-other'),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('refuses a requester and propagates database failures', async () => {
    actAs('requester')
    expectErr(
      await SdPortalAccessService.revoke('u2', WS, 'access1'),
      'SD_NOT_AGENT',
    )

    actAs('agent')
    repo.revoke.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalAccessService.revoke('u1', WS, 'access1'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPortalAccessService.toSessionDTO', () => {
  const { token } = newSdPortalToken()

  it('exposes only the contact, workspace, companies and allowed types', async () => {
    repo.findByTokenHash.mockResolvedValue(
      ok(createFakeSdPortalAccessWithContact()),
    )
    const opened = expectOk(await SdPortalAccessService.openSession(token))
    const dto = SdPortalAccessService.toSessionDTO(opened.context)

    expect(Object.keys(dto).sort()).toEqual([
      'companyScope',
      'contact',
      'customers',
      'expiresAt',
      'ticketTypes',
      'workspace',
    ])
    expect(dto.ticketTypes).toEqual(['INCIDENT', 'SERVICE_REQUEST'])
    expect(JSON.stringify(dto)).not.toContain('tokenHash')
  })
})
