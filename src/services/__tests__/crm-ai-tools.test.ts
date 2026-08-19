import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmDashboardDTO } from '@/src/__tests__/factories/crm-dashboard.factory'
import { createFakeCrmLeadDTO } from '@/src/__tests__/factories/crm-lead.factory'
import { ok } from '@/src/lib/result'

vi.mock('@/src/services/crm-lead.service')
vi.mock('@/src/services/crm-dashboard.service')
vi.mock('@/src/services/crm-competitor.service')

import { CrmCompetitorService } from '@/src/services/crm-competitor.service'
import { CrmDashboardService } from '@/src/services/crm-dashboard.service'
import { CrmLeadService } from '@/src/services/crm-lead.service'
import { executeAiTool } from '../crm-ai-tools'

const mockedLeadService = vi.mocked(CrmLeadService)
const mockedDashboardService = vi.mocked(CrmDashboardService)
const mockedCompetitorService = vi.mocked(CrmCompetitorService)

const ctx = { actorId: 'u1', workspaceId: 'ws1' }

describe('executeAiTool()', () => {
  it('should return an error for an unknown tool name', async () => {
    const result = await executeAiTool('does_not_exist', {}, ctx)
    expect(JSON.parse(result)).toEqual({ error: 'UNKNOWN_TOOL' })
  })

  it('should dispatch a read tool to the underlying service', async () => {
    mockedCompetitorService.list.mockResolvedValue(
      ok([
        {
          id: 'c1',
          platform: 'INSTAGRAM',
          handle: '@rival',
          profileUrl: null,
          followersCount: 5000,
          avatarUrl: null,
          displayName: null,
          bio: null,
          syncStatus: 'SYNCED',
          lastSyncedAt: null,
          notes: null,
          workspaceId: 'ws1',
          createdById: 'u1',
          updatedById: null,
          position: 0,
          createdAt: '',
          updatedAt: '',
        },
      ]),
    )

    const result = await executeAiTool('list_competitors', {}, ctx)
    const parsed = JSON.parse(result)
    expect(parsed).toEqual([
      {
        id: 'c1',
        platform: 'INSTAGRAM',
        handle: '@rival',
        followersCount: 5000,
        syncStatus: 'SYNCED',
      },
    ])
    expect(mockedCompetitorService.list).toHaveBeenCalledWith('u1', 'ws1')
  })

  describe('write tools', () => {
    it('should NOT call the service when userConfirmed is missing', async () => {
      const result = await executeAiTool(
        'create_lead',
        { name: 'Rival Co' },
        ctx,
      )
      expect(result).toContain('Ainda não confirmado')
      expect(mockedLeadService.create).not.toHaveBeenCalled()
    })

    it('should NOT call the service when userConfirmed is not literally true', async () => {
      const result = await executeAiTool(
        'create_lead',
        { name: 'Rival Co', userConfirmed: 'yes' },
        ctx,
      )
      expect(result).toContain('Ainda não confirmado')
      expect(mockedLeadService.create).not.toHaveBeenCalled()
    })

    it('should return a validation error without calling the service for invalid args', async () => {
      const result = await executeAiTool(
        'create_lead',
        { userConfirmed: true },
        ctx,
      )
      expect(JSON.parse(result).error).toBe('VALIDATION_ERROR')
      expect(mockedLeadService.create).not.toHaveBeenCalled()
    })

    it('should call the service once confirmed with valid args', async () => {
      mockedLeadService.create.mockResolvedValue(
        ok(createFakeCrmLeadDTO({ id: 'lead-1', name: 'Rival Co' })),
      )

      const result = await executeAiTool(
        'create_lead',
        { name: 'Rival Co', userConfirmed: true },
        ctx,
      )
      expect(JSON.parse(result)).toEqual({ created: true, id: 'lead-1' })
      expect(mockedLeadService.create).toHaveBeenCalledWith(
        'u1',
        'ws1',
        expect.objectContaining({ name: 'Rival Co' }),
      )
    })

    it('should propagate a service error as JSON', async () => {
      mockedDashboardService.create.mockResolvedValue(
        ok(createFakeCrmDashboardDTO({ id: 'd1', title: 'Vendas' })),
      )

      const result = await executeAiTool(
        'create_dashboard',
        { title: 'Vendas', userConfirmed: true },
        ctx,
      )
      expect(JSON.parse(result)).toEqual({ created: true, id: 'd1' })
    })
  })
})
