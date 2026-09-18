import { describe, expect, it } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
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
})
