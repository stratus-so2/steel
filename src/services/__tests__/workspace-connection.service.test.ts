import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWorkspaceConnection } from '@/src/__tests__/factories/workspace-connection.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/workspace-connection.repository')
vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(async (plain: string) => `enc:${plain}`),
  decryptConnectionSecret: vi.fn(async (envelope: string) =>
    envelope.replace(/^enc:/, ''),
  ),
}))
vi.mock('@/src/lib/module-db/resolver', () => ({
  evictModuleConnection: vi.fn(),
}))

const { queryRaw, disconnect } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  disconnect: vi.fn(),
}))
vi.mock('@/src/lib/prisma', () => ({
  createPrismaClient: vi.fn(() => ({
    $queryRaw: queryRaw,
    $disconnect: disconnect,
  })),
}))

import { auditMutation } from '@/lib/axiom/audit'
import { evictModuleConnection } from '@/src/lib/module-db/resolver'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceConnectionRepository } from '@/src/repositories/workspace-connection.repository'
import { WorkspaceConnectionService } from '@/src/services/workspace-connection.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedConnectionRepo = vi.mocked(WorkspaceConnectionRepository)
const mockedEvict = vi.mocked(evictModuleConnection)

const CONNECTION_INPUT = {
  host: 'db.example.com',
  port: 5432,
  username: 'app_user',
  password: 'super-secret',
  database: 'crm_db',
  sslEnabled: true,
}

describe('WorkspaceConnectionService', () => {
  describe('list()', () => {
    it('should return connections for a privileged member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      const connection = createFakeWorkspaceConnection({ workspaceId: 'ws1' })
      mockedConnectionRepo.listByWorkspace.mockResolvedValue(ok([connection]))

      const result = await WorkspaceConnectionService.list('u1', 'ws1')

      const dtos = expectOk(result)
      expect(dtos).toHaveLength(1)
      expect(dtos[0]).not.toHaveProperty('encryptedPassword')
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      const result = await WorkspaceConnectionService.list('u1', 'ws1')

      expectErr(result, 'FORBIDDEN')
    })

    it('should return CONNECTION_FORBIDDEN for a plain MEMBER role', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )

      const result = await WorkspaceConnectionService.list('u1', 'ws1')

      expectErr(result, 'CONNECTION_FORBIDDEN')
    })
  })

  describe('save()', () => {
    it('should encrypt the password and upsert for OWNER/ADMIN', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedConnectionRepo.findByWorkspaceAndModule.mockResolvedValue(ok(null))
      const created = createFakeWorkspaceConnection({
        workspaceId: 'ws1',
        module: 'CRM',
      })
      mockedConnectionRepo.upsert.mockResolvedValue(ok(created))

      const result = await WorkspaceConnectionService.save(
        'u1',
        'ws1',
        'CRM',
        CONNECTION_INPUT,
      )

      expectOk(result)
      expect(mockedConnectionRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws1',
          module: 'CRM',
          encryptedPassword: 'enc:super-secret',
          createdById: 'u1',
        }),
      )
      expect(mockedEvict).toHaveBeenCalledWith('ws1', 'CRM')
    })

    it('should return CONNECTION_FORBIDDEN for a plain MEMBER and not touch the repo', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )

      const result = await WorkspaceConnectionService.save(
        'u1',
        'ws1',
        'CRM',
        CONNECTION_INPUT,
      )

      expectErr(result, 'CONNECTION_FORBIDDEN')
      expect(mockedConnectionRepo.upsert).not.toHaveBeenCalled()
    })

    it('should propagate repo error', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedConnectionRepo.findByWorkspaceAndModule.mockResolvedValue(ok(null))
      mockedConnectionRepo.upsert.mockResolvedValue(err(databaseError()))

      const result = await WorkspaceConnectionService.save(
        'u1',
        'ws1',
        'CRM',
        CONNECTION_INPUT,
      )

      expectErr(result, 'DATABASE_ERROR')
    })
  })

  describe('remove()', () => {
    it('should delete an existing connection for OWNER/ADMIN', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      const existing = createFakeWorkspaceConnection({
        id: 'wmc1',
        workspaceId: 'ws1',
        module: 'CRM',
      })
      mockedConnectionRepo.findByWorkspaceAndModule.mockResolvedValue(
        ok(existing),
      )
      mockedConnectionRepo.delete.mockResolvedValue(ok(undefined))

      const result = await WorkspaceConnectionService.remove('u1', 'ws1', 'CRM')

      expectOk(result)
      expect(mockedConnectionRepo.delete).toHaveBeenCalledWith('wmc1')
      expect(mockedEvict).toHaveBeenCalledWith('ws1', 'CRM')
    })

    it('should return CONNECTION_NOT_FOUND when nothing is configured', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedConnectionRepo.findByWorkspaceAndModule.mockResolvedValue(ok(null))

      const result = await WorkspaceConnectionService.remove('u1', 'ws1', 'CRM')

      expectErr(result, 'CONNECTION_NOT_FOUND')
    })
  })

  describe('testConnection()', () => {
    it('should return ok when the ping succeeds', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const result = await WorkspaceConnectionService.testConnection(
        'u1',
        'ws1',
        {
          ...CONNECTION_INPUT,
          module: 'SERVICE_DESK',
        },
      )

      expectOk(result)
      expect(disconnect).toHaveBeenCalled()
    })

    it('should return CONNECTION_TEST_FAILED when the ping throws', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      queryRaw.mockRejectedValue(new Error('connection refused'))

      const result = await WorkspaceConnectionService.testConnection(
        'u1',
        'ws1',
        {
          ...CONNECTION_INPUT,
          module: 'SERVICE_DESK',
        },
      )

      expectErr(result, 'CONNECTION_TEST_FAILED')
      expect(disconnect).toHaveBeenCalled()
    })

    it('should return CONNECTION_FORBIDDEN for a plain MEMBER without ever pinging', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )

      const result = await WorkspaceConnectionService.testConnection(
        'u1',
        'ws1',
        {
          ...CONNECTION_INPUT,
          module: 'SERVICE_DESK',
        },
      )

      expectErr(result, 'CONNECTION_FORBIDDEN')
      expect(queryRaw).not.toHaveBeenCalled()
    })
  })
})

describe('WorkspaceConnectionService failure paths', () => {
  function asOwner() {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'OWNER' })),
    )
  }

  it('should propagate a membership lookup failure', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      err(databaseError()),
    )

    expectErr(
      await WorkspaceConnectionService.list('u1', 'ws1'),
      'DATABASE_ERROR',
    )
  })

  it('should block a suspended workspace before checking the role', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'OWNER', workspaceStatus: 'SUSPENDED' })),
    )

    expectErr(
      await WorkspaceConnectionService.list('u1', 'ws1'),
      'WORKSPACE_SUSPENDED',
    )
    expect(mockedConnectionRepo.listByWorkspace).not.toHaveBeenCalled()
  })

  it('list() should propagate a repository failure', async () => {
    asOwner()
    mockedConnectionRepo.listByWorkspace.mockResolvedValue(err(databaseError()))

    expectErr(
      await WorkspaceConnectionService.list('u1', 'ws1'),
      'DATABASE_ERROR',
    )
  })

  it('save() should propagate a lookup failure without encrypting', async () => {
    asOwner()
    mockedConnectionRepo.findByWorkspaceAndModule.mockResolvedValue(
      err(databaseError()),
    )

    expectErr(
      await WorkspaceConnectionService.save(
        'u1',
        'ws1',
        'CRM',
        CONNECTION_INPUT,
      ),
      'DATABASE_ERROR',
    )
    expect(mockedConnectionRepo.upsert).not.toHaveBeenCalled()
  })

  it('save() should default to SSL and audit an update of an existing connection', async () => {
    asOwner()
    const existing = createFakeWorkspaceConnection({ id: 'wc1' })
    mockedConnectionRepo.findByWorkspaceAndModule.mockResolvedValue(
      ok(existing),
    )
    mockedConnectionRepo.upsert.mockResolvedValue(ok(existing))
    // Chamadores internos podem omitir o SSL (o default do schema não roda).
    const { sslEnabled: _ssl, ...rest } = CONNECTION_INPUT
    const withoutSsl = rest as typeof CONNECTION_INPUT

    expectOk(
      await WorkspaceConnectionService.save('u1', 'ws1', 'CRM', withoutSsl),
    )

    expect(mockedConnectionRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ sslEnabled: true }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', targetId: 'wc1' }),
    )
  })

  it('remove() should return FORBIDDEN for a non-member', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

    expectErr(
      await WorkspaceConnectionService.remove('u1', 'ws1', 'CRM'),
      'FORBIDDEN',
    )
  })

  it('remove() should propagate a lookup failure', async () => {
    asOwner()
    mockedConnectionRepo.findByWorkspaceAndModule.mockResolvedValue(
      err(databaseError()),
    )

    expectErr(
      await WorkspaceConnectionService.remove('u1', 'ws1', 'CRM'),
      'DATABASE_ERROR',
    )
  })

  it('remove() should audit and propagate a delete failure without evicting', async () => {
    asOwner()
    mockedConnectionRepo.findByWorkspaceAndModule.mockResolvedValue(
      ok(createFakeWorkspaceConnection({ id: 'wc1' })),
    )
    mockedConnectionRepo.delete.mockResolvedValue(err(databaseError()))

    expectErr(
      await WorkspaceConnectionService.remove('u1', 'ws1', 'CRM'),
      'DATABASE_ERROR',
    )
    expect(mockedEvict).not.toHaveBeenCalled()
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        targetId: 'wc1',
        outcome: 'failure',
      }),
    )
  })

  it('testConnection() should default to SSL and report a non-Error failure generically', async () => {
    asOwner()
    queryRaw.mockRejectedValueOnce('socket hang up')
    // Chamadores internos podem omitir o SSL (o default do schema não roda).
    const { sslEnabled: _ssl, ...rest } = CONNECTION_INPUT
    const withoutSsl = rest as typeof CONNECTION_INPUT

    const error = expectErr(
      await WorkspaceConnectionService.testConnection('u1', 'ws1', {
        ...withoutSsl,
        module: 'CRM',
      }),
      'CONNECTION_TEST_FAILED',
    )

    expect(error.message).toBe('Falha ao conectar')
    expect(disconnect).toHaveBeenCalled()
  })
})
