import { describe, expect, it, vi } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmEmailOptOutRepository } from '../crm-email-opt-out.repository'

describe('CrmEmailOptOutRepository', () => {
  describe('upsert()', () => {
    it('should store the address lower-cased and keep the first opt-out', async () => {
      const workspace = await seedWorkspace()

      const first = expectOk(
        await CrmEmailOptOutRepository.upsert({
          workspaceId: workspace.id,
          email: '  Jane@Acme.COM ',
          personId: 'p1',
          campaignId: 'c1',
          source: 'LINK',
        }),
      )
      expect(first.created).toBe(true)
      expect(first.optOut.email).toBe('jane@acme.com')

      const second = expectOk(
        await CrmEmailOptOutRepository.upsert({
          workspaceId: workspace.id,
          email: 'jane@acme.com',
          campaignId: 'c2',
          source: 'ONE_CLICK',
        }),
      )
      expect(second.created).toBe(false)
      expect(second.optOut.id).toBe(first.optOut.id)
      expect(second.optOut.source).toBe('LINK')
      expect(second.optOut.campaignId).toBe('c1')
    })
  })

  describe('indexByWorkspace()', () => {
    it('should index emails and person ids scoped to the workspace', async () => {
      const [workspace, other] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
      ])
      await CrmEmailOptOutRepository.upsert({
        workspaceId: workspace.id,
        email: 'jane@acme.com',
        personId: 'p1',
        source: 'LINK',
      })
      await CrmEmailOptOutRepository.upsert({
        workspaceId: workspace.id,
        email: 'avulso@acme.com',
        source: 'ONE_CLICK',
      })
      await CrmEmailOptOutRepository.upsert({
        workspaceId: other.id,
        email: 'outro@acme.com',
        personId: 'p9',
        source: 'LINK',
      })

      const index = expectOk(
        await CrmEmailOptOutRepository.indexByWorkspace(workspace.id),
      )
      expect([...index.emails].sort()).toEqual([
        'avulso@acme.com',
        'jane@acme.com',
      ])
      expect([...index.personIds]).toEqual(['p1'])
    })
  })

  describe('listByWorkspace()', () => {
    it('should list the workspace opt-outs newest first', async () => {
      const [workspace, other] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
      ])
      const first = expectOk(
        await CrmEmailOptOutRepository.upsert({
          workspaceId: workspace.id,
          email: 'antigo@acme.com',
          source: 'LINK',
        }),
      )
      await prisma.crmEmailOptOut.update({
        where: { id: first.optOut.id },
        data: { createdAt: new Date('2020-01-01') },
      })
      const second = expectOk(
        await CrmEmailOptOutRepository.upsert({
          workspaceId: workspace.id,
          email: 'novo@acme.com',
          source: 'ONE_CLICK',
        }),
      )
      await CrmEmailOptOutRepository.upsert({
        workspaceId: other.id,
        email: 'outro@acme.com',
        source: 'LINK',
      })

      const list = expectOk(
        await CrmEmailOptOutRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((o) => o.id)).toEqual([second.optOut.id, first.optOut.id])
    })
  })

  describe('database failures', () => {
    it('should return DATABASE_ERROR when queries throw or the workspace is missing', async () => {
      vi.spyOn(prisma.crmEmailOptOut, 'findMany')
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))

      expectErr(
        await CrmEmailOptOutRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmEmailOptOutRepository.indexByWorkspace('w'),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmEmailOptOutRepository.upsert({
          workspaceId: 'missing',
          email: 'x@x.com',
          source: 'LINK',
        }),
        'DATABASE_ERROR',
      )
    })
  })
})
