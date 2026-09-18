import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmDashboardDTO } from '@/src/__tests__/factories/crm-dashboard.factory'
import { createFakeCrmLeadDTO } from '@/src/__tests__/factories/crm-lead.factory'
import { forbidden, moduleDisabled, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/crm-lead.service')
vi.mock('@/src/services/crm-dashboard.service')
vi.mock('@/src/services/crm-competitor.service')
vi.mock('@/src/services/crm-pipeline.service')
vi.mock('@/src/services/crm-opportunity.service')
vi.mock('@/src/services/crm-proposal.service')
vi.mock('@/src/services/crm-proposal-template.service')
vi.mock('@/src/services/crm-social-trending.service')
vi.mock('@/src/services/crm-form.service')

import { CrmCompetitorService } from '@/src/services/crm-competitor.service'
import { CrmDashboardService } from '@/src/services/crm-dashboard.service'
import { CrmFormService } from '@/src/services/crm-form.service'
import { CrmLeadService } from '@/src/services/crm-lead.service'
import { CrmOpportunityService } from '@/src/services/crm-opportunity.service'
import {
  CrmPipelineService,
  CrmPipelineStageService,
} from '@/src/services/crm-pipeline.service'
import { CrmProposalService } from '@/src/services/crm-proposal.service'
import { CrmProposalTemplateService } from '@/src/services/crm-proposal-template.service'
import { CrmSocialTrendingService } from '@/src/services/crm-social-trending.service'
import { CRM_AI_TOOLS, executeAiTool } from '../crm-ai-tools'

const mockedLeadService = vi.mocked(CrmLeadService)
const mockedDashboardService = vi.mocked(CrmDashboardService)
const mockedCompetitorService = vi.mocked(CrmCompetitorService)
const mockedPipelineService = vi.mocked(CrmPipelineService)
const mockedStageService = vi.mocked(CrmPipelineStageService)
const mockedOpportunityService = vi.mocked(CrmOpportunityService)
const mockedProposalService = vi.mocked(CrmProposalService)
const mockedTemplateService = vi.mocked(CrmProposalTemplateService)
const mockedTrendingService = vi.mocked(CrmSocialTrendingService)
const mockedFormService = vi.mocked(CrmFormService)

const ctx = { actorId: 'u1', workspaceId: 'ws1' }

async function run(name: string, args: Record<string, unknown> = {}) {
  return JSON.parse(await executeAiTool(name, args, ctx))
}

describe('CRM_AI_TOOLS', () => {
  it('should expose every tool with a closed object schema', () => {
    expect(CRM_AI_TOOLS.map((t) => t.name)).toEqual([
      'list_pipelines_and_stages',
      'list_opportunities',
      'list_leads',
      'list_proposals',
      'list_competitors',
      'get_competitor_growth',
      'get_trending_posts',
      'create_lead',
      'create_dashboard',
      'create_form',
      'create_proposal_template',
    ])
    for (const tool of CRM_AI_TOOLS) {
      expect(tool.parameters).toEqual(
        expect.objectContaining({
          type: 'object',
          additionalProperties: false,
        }),
      )
    }
  })

  it('should require userConfirmed on every write tool only', () => {
    for (const tool of CRM_AI_TOOLS) {
      const required = (tool.parameters as { required: string[] }).required
      if (tool.name.startsWith('create_')) {
        expect(required).toContain('userConfirmed')
        expect(tool.description).toMatch(/SÓ chame esta função/)
      } else {
        expect(required).not.toContain('userConfirmed')
      }
    }
  })
})

describe('executeAiTool()', () => {
  it('should return an error for an unknown tool name', async () => {
    const result = await executeAiTool('does_not_exist', {}, ctx)
    expect(JSON.parse(result)).toEqual({ error: 'UNKNOWN_TOOL' })
  })

  it('should turn a thrown Error into its message', async () => {
    mockedLeadService.list.mockRejectedValue(new Error('db exploded'))
    expect(await run('list_leads')).toEqual({ error: 'db exploded' })
  })

  it('should turn a thrown non-Error into TOOL_EXECUTION_FAILED', async () => {
    mockedLeadService.list.mockRejectedValue('nope')
    expect(await run('list_leads')).toEqual({
      error: 'TOOL_EXECUTION_FAILED',
    })
  })

  describe('list_pipelines_and_stages', () => {
    it('should return pipelines with their stages', async () => {
      mockedPipelineService.list.mockResolvedValue(
        ok([
          { id: 'p1', name: 'Vendas', isDefault: true },
          { id: 'p2', name: 'Parceiros', isDefault: false },
        ] as never),
      )
      mockedStageService.list.mockImplementation(async (_a, _w, pipelineId) =>
        pipelineId === 'p1'
          ? ok([
              {
                id: 's1',
                name: 'Novo',
                category: 'OPEN',
                probability: 10,
                position: 0,
              },
            ] as never)
          : err(forbidden()),
      )

      expect(await run('list_pipelines_and_stages')).toEqual([
        {
          id: 'p1',
          name: 'Vendas',
          isDefault: true,
          stages: [
            { id: 's1', name: 'Novo', category: 'OPEN', probability: 10 },
          ],
        },
        { id: 'p2', name: 'Parceiros', isDefault: false, stages: [] },
      ])
      expect(mockedStageService.list).toHaveBeenCalledWith('u1', 'ws1', 'p1')
    })

    it('should return the error code when pipelines cannot be listed', async () => {
      mockedPipelineService.list.mockResolvedValue(err(moduleDisabled()))
      expect(await run('list_pipelines_and_stages')).toEqual({
        error: 'MODULE_DISABLED',
      })
    })
  })

  describe('list_opportunities', () => {
    it('should project the opportunity fields', async () => {
      mockedOpportunityService.list.mockResolvedValue(
        ok([
          {
            id: 'o1',
            name: 'Deal',
            amount: 1000,
            stageId: 's1',
            pipelineId: 'p1',
            closeDate: '2026-10-01',
            ownerId: 'secret',
          },
        ] as never),
      )
      expect(await run('list_opportunities')).toEqual([
        {
          id: 'o1',
          name: 'Deal',
          amount: 1000,
          stageId: 's1',
          pipelineId: 'p1',
          closeDate: '2026-10-01',
        },
      ])
      expect(mockedOpportunityService.list).toHaveBeenCalledWith(
        'u1',
        'ws1',
        {},
      )
    })

    it('should return the error code on failure', async () => {
      mockedOpportunityService.list.mockResolvedValue(err(forbidden()))
      expect(await run('list_opportunities')).toEqual({ error: 'FORBIDDEN' })
    })
  })

  describe('list_leads', () => {
    it('should project the lead fields', async () => {
      const lead = createFakeCrmLeadDTO({ id: 'l1', name: 'Ana' })
      mockedLeadService.list.mockResolvedValue(ok([lead]))
      expect(await run('list_leads')).toEqual([
        {
          id: 'l1',
          name: 'Ana',
          company: lead.company,
          source: lead.source,
          stage: lead.stage,
          score: lead.score,
        },
      ])
    })

    it('should return the error code on failure', async () => {
      mockedLeadService.list.mockResolvedValue(err(forbidden()))
      expect(await run('list_leads')).toEqual({ error: 'FORBIDDEN' })
    })
  })

  describe('list_proposals', () => {
    it('should project the proposal fields', async () => {
      mockedProposalService.list.mockResolvedValue(
        ok([
          {
            id: 'pr1',
            name: 'Proposta',
            status: 'SENT',
            viewsCount: 3,
            validUntil: null,
            content: 'big',
          },
        ] as never),
      )
      expect(await run('list_proposals')).toEqual([
        {
          id: 'pr1',
          name: 'Proposta',
          status: 'SENT',
          viewsCount: 3,
          validUntil: null,
        },
      ])
    })

    it('should return the error code on failure', async () => {
      mockedProposalService.list.mockResolvedValue(err(forbidden()))
      expect(await run('list_proposals')).toEqual({ error: 'FORBIDDEN' })
    })
  })

  describe('list_competitors', () => {
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

      expect(await run('list_competitors')).toEqual([
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

    it('should return the error code on failure', async () => {
      mockedCompetitorService.list.mockResolvedValue(err(forbidden()))
      expect(await run('list_competitors')).toEqual({ error: 'FORBIDDEN' })
    })
  })

  describe('get_competitor_growth', () => {
    it('should default the range to 30d', async () => {
      mockedCompetitorService.getMetrics.mockResolvedValue(
        ok({ growth: 12 } as never),
      )
      expect(
        await run('get_competitor_growth', { competitorId: 'c1' }),
      ).toEqual({ growth: 12 })
      expect(mockedCompetitorService.getMetrics).toHaveBeenCalledWith(
        'u1',
        'ws1',
        'c1',
        '30d',
      )
    })

    it('should forward an explicit range', async () => {
      mockedCompetitorService.getMetrics.mockResolvedValue(
        ok({ growth: 1 } as never),
      )
      await run('get_competitor_growth', { competitorId: 'c1', range: '7d' })
      expect(mockedCompetitorService.getMetrics).toHaveBeenCalledWith(
        'u1',
        'ws1',
        'c1',
        '7d',
      )
    })

    it('should return the error code when the competitor is unknown', async () => {
      mockedCompetitorService.getMetrics.mockResolvedValue(
        err(notFound('Concorrente')),
      )
      expect(await run('get_competitor_growth', { competitorId: 'x' })).toEqual(
        { error: 'RESOURCE_NOT_FOUND' },
      )
    })
  })

  describe('get_trending_posts', () => {
    it('should return the ranking', async () => {
      mockedTrendingService.getTodayRanking.mockResolvedValue(
        ok([{ id: 'post1', velocity: 9 }] as never),
      )
      expect(await run('get_trending_posts')).toEqual([
        { id: 'post1', velocity: 9 },
      ])
    })

    it('should return the error code on failure', async () => {
      mockedTrendingService.getTodayRanking.mockResolvedValue(err(forbidden()))
      expect(await run('get_trending_posts')).toEqual({ error: 'FORBIDDEN' })
    })
  })

  describe('write tools', () => {
    beforeEach(() => {
      mockedLeadService.create.mockReset()
    })

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
      const result = await run('create_lead', { userConfirmed: true })
      expect(result.error).toBe('VALIDATION_ERROR')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(mockedLeadService.create).not.toHaveBeenCalled()
    })

    it('should call the service once confirmed with valid args', async () => {
      mockedLeadService.create.mockResolvedValue(
        ok(createFakeCrmLeadDTO({ id: 'lead-1', name: 'Rival Co' })),
      )

      expect(
        await run('create_lead', {
          name: 'Rival Co',
          emails: ['contact@rival.co'],
          source: 'ads',
          userConfirmed: true,
        }),
      ).toEqual({ created: true, id: 'lead-1' })
      expect(mockedLeadService.create).toHaveBeenCalledWith(
        'u1',
        'ws1',
        expect.objectContaining({ name: 'Rival Co' }),
      )
    })

    it('should propagate a lead service error as JSON', async () => {
      mockedLeadService.create.mockResolvedValue(err(forbidden()))
      expect(
        await run('create_lead', {
          name: 'Rival Co',
          emails: ['contact@rival.co'],
          source: 'ads',
          userConfirmed: true,
        }),
      ).toEqual({ error: 'FORBIDDEN' })
    })

    it('should create a dashboard', async () => {
      mockedDashboardService.create.mockResolvedValue(
        ok(createFakeCrmDashboardDTO({ id: 'd1', title: 'Vendas' })),
      )
      expect(
        await run('create_dashboard', { title: 'Vendas', userConfirmed: true }),
      ).toEqual({ created: true, id: 'd1' })
      expect(mockedDashboardService.create).toHaveBeenCalledWith(
        'u1',
        'ws1',
        expect.objectContaining({ title: 'Vendas' }),
      )
    })

    it('should reject an invalid dashboard', async () => {
      expect(
        (await run('create_dashboard', { title: '', userConfirmed: true }))
          .error,
      ).toBe('VALIDATION_ERROR')
      expect(mockedDashboardService.create).not.toHaveBeenCalled()
    })

    it('should propagate a dashboard service error', async () => {
      mockedDashboardService.create.mockResolvedValue(err(forbidden()))
      expect(
        await run('create_dashboard', { title: 'X', userConfirmed: true }),
      ).toEqual({ error: 'FORBIDDEN' })
    })

    it('should create a form', async () => {
      mockedFormService.create.mockResolvedValue(ok({ id: 'f1' } as never))
      expect(
        await run('create_form', {
          name: 'Contato',
          action: 'LEAD',
          fields: [],
          userConfirmed: true,
        }),
      ).toEqual({ created: true, id: 'f1' })
      expect(mockedFormService.create).toHaveBeenCalledWith(
        'u1',
        'ws1',
        expect.objectContaining({ name: 'Contato', action: 'LEAD' }),
      )
    })

    it('should reject an invalid form', async () => {
      expect(
        (
          await run('create_form', {
            name: '',
            action: 'LEAD',
            fields: [],
            userConfirmed: true,
          })
        ).error,
      ).toBe('VALIDATION_ERROR')
      expect(mockedFormService.create).not.toHaveBeenCalled()
    })

    it('should propagate a form service error', async () => {
      mockedFormService.create.mockResolvedValue(err(forbidden()))
      expect(
        await run('create_form', {
          name: 'Contato',
          action: 'LEAD',
          fields: [],
          userConfirmed: true,
        }),
      ).toEqual({ error: 'FORBIDDEN' })
    })

    it('should create a proposal template', async () => {
      mockedTemplateService.create.mockResolvedValue(ok({ id: 't1' } as never))
      expect(
        await run('create_proposal_template', {
          name: 'Padrão',
          sections: [{ type: 'COVER', order: 0 }],
          userConfirmed: true,
        }),
      ).toEqual({ created: true, id: 't1' })
      expect(mockedTemplateService.create).toHaveBeenCalledWith(
        'u1',
        'ws1',
        expect.objectContaining({ name: 'Padrão' }),
      )
    })

    it('should reject an invalid proposal template', async () => {
      expect(
        (
          await run('create_proposal_template', {
            name: '',
            sections: [],
            userConfirmed: true,
          })
        ).error,
      ).toBe('VALIDATION_ERROR')
      expect(mockedTemplateService.create).not.toHaveBeenCalled()
    })

    it('should propagate a proposal template service error', async () => {
      mockedTemplateService.create.mockResolvedValue(err(forbidden()))
      expect(
        await run('create_proposal_template', {
          name: 'Padrão',
          sections: [],
          userConfirmed: true,
        }),
      ).toEqual({ error: 'FORBIDDEN' })
    })
  })
})
