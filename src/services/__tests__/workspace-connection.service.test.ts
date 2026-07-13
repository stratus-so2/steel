import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWorkspaceConnection } from '@/src/__tests__/factories/workspace-connection.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

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
