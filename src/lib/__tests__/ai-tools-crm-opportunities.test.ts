import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  crmCreateOpportunityTool,
  crmDeleteOpportunityTool,
  crmListOpportunitiesTool,
  crmMoveOpportunityStageTool,
  crmUpdateOpportunityTool,
} from '@/src/lib/ai/tools/crm/opportunities'
import { err, ok } from '@/src/lib/result'
import { CrmCompanyService } from '@/src/services/crm-company.service'
import { CrmOpportunityService } from '@/src/services/crm-opportunity.service'
import { CrmPersonService } from '@/src/services/crm-person.service'
import { CrmPipelineService } from '@/src/services/crm-pipeline.service'
import {
  company,
  dbErr,
  expectErr,
  expectOk,
  forbiddenErr,
  ME,
  opportunity,
  person,
  previewOf,
  run,
  WS,
  wireDefaults,
} from './ai-tools-crm.fixtures'

vi.mock('@/src/services/workspace.service', () => ({
  WorkspaceService: { getById: vi.fn() },
}))
vi.mock('@/src/services/crm-member.service', () => ({
  CrmMemberService: { list: vi.fn() },
}))
vi.mock('@/src/services/crm-pipeline.service', () => ({
  CrmPipelineService: { list: vi.fn() },
  CrmPipelineStageService: { list: vi.fn() },
}))
vi.mock('@/src/services/crm-company.service', () => ({
  CrmCompanyService: { list: vi.fn(), getById: vi.fn() },
}))
vi.mock('@/src/services/crm-person.service', () => ({
  CrmPersonService: { list: vi.fn(), getById: vi.fn() },
}))
vi.mock('@/src/services/crm-opportunity.service', () => ({
  CrmOpportunityService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const svc = vi.mocked(CrmOpportunityService)

beforeEach(() => {
  wireDefaults()
  vi.mocked(CrmCompanyService.list).mockResolvedValue(
    ok([
      company(),
      company({ id: 'company_2', name: 'Acme Brasil', domain: 'acme.com.br' }),
    ]),
  )
  vi.mocked(CrmCompanyService.getById).mockResolvedValue(ok(company()))
  vi.mocked(CrmPersonService.list).mockResolvedValue(ok([person()]))
  vi.mocked(CrmPersonService.getById).mockResolvedValue(ok(person()))
})

type Page = {
  total: number
  totalAmount: number
  items: Array<Record<string, unknown>>
}

describe('crm_list_opportunities', () => {
  const opps = [
    opportunity(),
    opportunity({
      id: 'opp_2',
      name: 'Renovação Beta',
      amount: 5000,
      stageId: 'stage_won',
      ownerId: 'user_bruno',
      companyId: 'company_1',
      closeDate: '2026-11-15T00:00:00.000Z',
    }),
    opportunity({
      id: 'opp_3',
      name: 'Gama sem data',
      amount: null,
      stageId: 'stage_lost',
      closeDate: null,
    }),
  ]

  it('lists with stage names, status, total amount and links', async () => {
    svc.list.mockResolvedValue(ok(opps))
    const out = expectOk(await run(crmListOpportunitiesTool, {}))
    const data = out.data as Page
    expect(data.total).toBe(3)
    expect(data.totalAmount).toBe(6000)
    expect(data.items[0]).toMatchObject({
      pipeline: 'Vendas',
      stage: 'Novo',
      status: 'OPEN',
      probability: 10,
      ownerName: 'Ana Souza',
      href: '/acme/crm/opportunities?record=opp_1',
    })
    expect(out.summary).toContain('3 oportunidade(s)')
    expect(out.summary).toContain('6.000,00')
  })

  it('filters by status, owner, company, amount and close date', async () => {
    svc.list.mockResolvedValue(ok(opps))
    const won = expectOk(await run(crmListOpportunitiesTool, { status: 'WON' }))
      .data as Page
    expect(won.items.map((i) => i.id)).toEqual(['opp_2'])

    const bruno = expectOk(
      await run(crmListOpportunitiesTool, { owner: 'bruno@acme.com' }),
    ).data as Page
    expect(bruno.items.map((i) => i.id)).toEqual(['opp_2'])

    const byCompany = expectOk(
      await run(crmListOpportunitiesTool, { companyId: 'company_1' }),
    ).data as Page
    expect(byCompany.total).toBe(1)

    const range = expectOk(
      await run(crmListOpportunitiesTool, { minAmount: 2000, maxAmount: 6000 }),
    ).data as Page
    expect(range.items.map((i) => i.id)).toEqual(['opp_2'])

    const dates = expectOk(
      await run(crmListOpportunitiesTool, {
        closeDateFrom: '2026-11-01',
        closeDateTo: '2026-11-30',
        query: 'beta',
      }),
    ).data as Page
    expect(dates.items.map((i) => i.id)).toEqual(['opp_2'])
  })

  it('resolves stage and pipeline names into service filters', async () => {
    svc.list.mockResolvedValue(ok([]))
    expectOk(
      await run(crmListOpportunitiesTool, {
        stage: 'negociacao',
        pipeline: 'Vendas',
      }),
    )
    expect(svc.list).toHaveBeenLastCalledWith(ME, WS, {
      stageId: 'stage_neg',
      pipelineId: 'pipe_sales',
    })

    expectOk(await run(crmListOpportunitiesTool, { pipeline: 'renovação' }))
    expect(svc.list).toHaveBeenLastCalledWith(ME, WS, {
      pipelineId: 'pipe_renew',
    })
  })

  it('lists the candidates when a stage name exists in several pipelines', async () => {
    const error = expectErr(
      await run(crmListOpportunitiesTool, { stage: 'Negociação' }),
      'VALIDATION_ERROR',
    )
    expect(error.message).toContain('Negociação — pipeline Vendas')
    expect(error.message).toContain('Negociação — pipeline Renovação')
    expect(svc.list).not.toHaveBeenCalled()
  })

  it('reports unknown pipelines with the options', async () => {
    const error = expectErr(
      await run(crmListOpportunitiesTool, { pipeline: 'Inexistente' }),
      'RESOURCE_NOT_FOUND',
    )
    expect(error.message).toContain('Vendas')
  })

  it('needs the pipelines only when filtering by them', async () => {
    vi.mocked(CrmPipelineService.list).mockResolvedValue(err(forbiddenErr))
    svc.list.mockResolvedValue(ok(opps))
    const out = expectOk(await run(crmListOpportunitiesTool, {}))
    expect((out.data as Page).items[0]).toMatchObject({
      stage: null,
      status: null,
    })
    expectErr(
      await run(crmListOpportunitiesTool, { status: 'OPEN' }),
      'FORBIDDEN',
    )
  })

  it('maps owner and service errors', async () => {
    expectErr(
      await run(crmListOpportunitiesTool, { owner: 'Ninguém' }),
      'RESOURCE_NOT_FOUND',
    )
    svc.list.mockResolvedValue(err(dbErr))
    expectErr(await run(crmListOpportunitiesTool, {}), 'DATABASE_ERROR')
  })
})

describe('crm_create_opportunity', () => {
  it('previews with resolved references and no write', async () => {
    const preview = expectOk(
      await previewOf(crmCreateOpportunityTool, {
        name: 'Projeto X',
        amount: 2500,
        probability: 40,
        closeDate: '2026-12-01',
        stage: 'Ganho',
        company: 'acme.com',
        pointOfContact: 'daniela@acme.com',
        owner: 'me',
        source: 'Evento',
      }),
    )
    expect(preview.summary).toBe('Entra em Ganho (Vendas).')
    expect(preview.fields).toEqual(
      expect.arrayContaining([
        { label: 'Probabilidade', after: '40%' },
        { label: 'Previsão de fechamento', after: '01/12/2026' },
        { label: 'Etapa', after: 'Ganho (Vendas)' },
        { label: 'Empresa', after: 'Acme Ltda' },
        { label: 'Contato', after: 'Daniela Rocha' },
        { label: 'Responsável', after: 'Ana Souza' },
      ]),
    )
    expect(svc.create).not.toHaveBeenCalled()
  })

  it('defaults to the default pipeline when nothing is given', async () => {
    const preview = expectOk(
      await previewOf(crmCreateOpportunityTool, { name: 'Simples' }),
    )
    expect(preview.summary).toContain('pipeline padrão')
  })

  it('uses the first open stage when only the pipeline is given', async () => {
    svc.create.mockResolvedValue(ok(opportunity({ stageId: 'stage_r_neg' })))
    expectOk(
      await run(crmCreateOpportunityTool, {
        name: 'Renovar',
        pipeline: 'Renovação',
      }),
    )
    expect(svc.create).toHaveBeenCalledWith(
      ME,
      WS,
      expect.objectContaining({
        pipelineId: 'pipe_renew',
        stageId: 'stage_r_neg',
      }),
    )
  })

  it('fails on an ambiguous company name, listing the candidates', async () => {
    const error = expectErr(
      await previewOf(crmCreateOpportunityTool, { name: 'X', company: 'acme' }),
      'VALIDATION_ERROR',
    )
    expect(error.details).toMatchObject({
      candidates: [
        { id: 'company_1', name: 'Acme Ltda' },
        { id: 'company_2', name: 'Acme Brasil' },
      ],
    })
  })

  it('creates with resolved ids', async () => {
    svc.create.mockResolvedValue(ok(opportunity({ id: 'opp_new' })))
    const out = expectOk(
      await run(crmCreateOpportunityTool, {
        name: 'Projeto X',
        stage: 'stage_neg',
        pipeline: 'pipe_sales',
        company: 'company_1',
        pointOfContact: 'person_1',
        owner: 'Bruno Lima',
      }),
    )
    expect(svc.create).toHaveBeenCalledWith(ME, WS, {
      name: 'Projeto X',
      amount: undefined,
      probability: undefined,
      closeDate: undefined,
      pipelineId: 'pipe_sales',
      stageId: 'stage_neg',
      companyId: 'company_1',
      pointOfContactId: 'person_1',
      ownerId: 'user_bruno',
      source: undefined,
    })
    expect(out.target?.href).toBe('/acme/crm/opportunities?record=opp_new')
  })

  it('maps reference and service errors', async () => {
    vi.mocked(CrmPersonService.list).mockResolvedValue(err(forbiddenErr))
    expectErr(
      await run(crmCreateOpportunityTool, {
        name: 'X',
        pointOfContact: 'Dani',
      }),
      'FORBIDDEN',
    )
    expectErr(
      await run(crmCreateOpportunityTool, { name: 'X', owner: 'lima' }),
      'VALIDATION_ERROR',
    )
    vi.mocked(CrmCompanyService.list).mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmCreateOpportunityTool, { name: 'X', company: 'Acme' }),
      'FORBIDDEN',
    )
    vi.mocked(CrmPipelineService.list).mockResolvedValue(err(dbErr))
    expectErr(
      await previewOf(crmCreateOpportunityTool, { name: 'X', stage: 'Novo' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await previewOf(crmCreateOpportunityTool, {
        name: 'X',
        pipeline: 'Vendas',
      }),
      'DATABASE_ERROR',
    )
  })

  it('maps a pipeline that is not found and service errors', async () => {
    expectErr(
      await run(crmCreateOpportunityTool, { name: 'X', pipeline: 'Nada' }),
      'RESOURCE_NOT_FOUND',
    )
    expectErr(
      await run(crmCreateOpportunityTool, { name: 'X', stage: 'Nada' }),
      'RESOURCE_NOT_FOUND',
    )
    svc.create.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmCreateOpportunityTool, { name: 'X' }),
      'DATABASE_ERROR',
    )
  })

  it('rejects invalid arguments', () => {
    expectErr(crmCreateOpportunityTool.parse({}), 'VALIDATION_ERROR')
    expectErr(
      crmCreateOpportunityTool.parse({ name: 'X', probability: 150 }),
      'VALIDATION_ERROR',
    )
  })
})

describe('crm_update_opportunity', () => {
  it('requires a change', () => {
    expectErr(
      crmUpdateOpportunityTool.parse({ opportunityId: 'opp_1' }),
      'VALIDATION_ERROR',
    )
  })

  it('previews before → after with names of linked records', async () => {
    svc.getById.mockResolvedValue(
      ok(opportunity({ companyId: 'company_1', probability: 20 })),
    )
    const preview = expectOk(
      await previewOf(crmUpdateOpportunityTool, {
        opportunityId: 'opp_1',
        amount: 2000,
        probability: null,
        closeDate: '2026-12-20',
        company: 'Acme Brasil',
        pointOfContact: null,
      }),
    )
    expect(preview.fields).toEqual([
      {
        label: 'Valor',
        before: expect.stringContaining('1.000,00'),
        after: expect.stringContaining('2.000,00'),
      },
      { label: 'Probabilidade', before: '20%', after: null },
      {
        label: 'Previsão de fechamento',
        before: '31/10/2026',
        after: '20/12/2026',
      },
      { label: 'Empresa', before: 'Acme Ltda', after: 'Acme Brasil' },
    ])
  })

  it('shows the id of a linked record that cannot be read', async () => {
    svc.getById.mockResolvedValue(
      ok(opportunity({ pointOfContactId: 'person_x', probability: null })),
    )
    vi.mocked(CrmPersonService.getById).mockResolvedValue(err(forbiddenErr))
    const preview = expectOk(
      await previewOf(crmUpdateOpportunityTool, {
        opportunityId: 'opp_1',
        pointOfContact: 'Daniela',
        probability: 50,
        amount: null,
      }),
    )
    expect(preview.fields).toEqual(
      expect.arrayContaining([
        { label: 'Contato', before: 'person_x', after: 'Daniela Rocha' },
        { label: 'Probabilidade', before: null, after: '50%' },
      ]),
    )
  })

  it('refuses a no-op and maps lookup errors', async () => {
    svc.getById.mockResolvedValue(ok(opportunity()))
    expectErr(
      await previewOf(crmUpdateOpportunityTool, {
        opportunityId: 'opp_1',
        name: 'Contrato Acme',
      }),
      'VALIDATION_ERROR',
    )
    expectErr(
      await previewOf(crmUpdateOpportunityTool, {
        opportunityId: 'opp_1',
        company: 'acme',
      }),
      'VALIDATION_ERROR',
    )
    svc.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmUpdateOpportunityTool, {
        opportunityId: 'opp_1',
        name: 'Y',
      }),
      'FORBIDDEN',
    )
  })

  it('executes with cleared and resolved references', async () => {
    svc.update.mockResolvedValue(ok(opportunity({ name: 'Novo nome' })))
    const out = expectOk(
      await run(crmUpdateOpportunityTool, {
        opportunityId: 'opp_1',
        name: 'Novo nome',
        company: null,
        pointOfContact: 'Daniela',
      }),
    )
    expect(svc.update).toHaveBeenCalledWith(ME, WS, 'opp_1', {
      name: 'Novo nome',
      amount: undefined,
      probability: undefined,
      closeDate: undefined,
      companyId: null,
      pointOfContactId: 'person_1',
      source: undefined,
    })
    expect(out.summary).toBe('Oportunidade “Novo nome” atualizada')
  })

  it('maps execute errors', async () => {
    expectErr(
      await run(crmUpdateOpportunityTool, {
        opportunityId: 'opp_1',
        company: 'acme',
      }),
      'VALIDATION_ERROR',
    )
    svc.update.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmUpdateOpportunityTool, {
        opportunityId: 'opp_1',
        name: 'Y',
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('crm_move_opportunity_stage', () => {
  beforeEach(() => {
    svc.getById.mockResolvedValue(ok(opportunity()))
  })

  it('resolves the stage inside the current pipeline by default', async () => {
    const preview = expectOk(
      await previewOf(crmMoveOpportunityStageTool, {
        opportunityId: 'opp_1',
        stage: 'Negociação',
      }),
    )
    expect(preview.title).toBe('Mover “Contrato Acme” para “Negociação”')
    expect(preview.fields).toEqual([
      {
        label: 'Etapa',
        before: 'Novo (Vendas)',
        after: 'Negociação (Vendas)',
      },
    ])
    expect(preview.summary).toBe('A oportunidade segue em aberto.')
  })

  it('shows the status change when moving to a won stage', async () => {
    const preview = expectOk(
      await previewOf(crmMoveOpportunityStageTool, {
        opportunityId: 'opp_1',
        stage: 'ganho',
      }),
    )
    expect(preview.summary).toBe('A oportunidade fica como ganha.')
    expect(preview.fields).toContainEqual({
      label: 'Status',
      before: 'Em aberto',
      after: 'Ganha',
    })
  })

  it('moves across pipelines', async () => {
    svc.update.mockResolvedValue(
      ok(opportunity({ pipelineId: 'pipe_renew', stageId: 'stage_r_open' })),
    )
    const out = expectOk(
      await run(crmMoveOpportunityStageTool, {
        opportunityId: 'opp_1',
        stage: 'Aberto',
        pipeline: 'Renovação',
      }),
    )
    expect(svc.update).toHaveBeenCalledWith(ME, WS, 'opp_1', {
      pipelineId: 'pipe_renew',
      stageId: 'stage_r_open',
    })
    expect(out.data).toMatchObject({ stage: 'Aberto', pipeline: 'Renovação' })
  })

  it('errors on unknown stage, lookup and update failures', async () => {
    expectErr(
      await previewOf(crmMoveOpportunityStageTool, {
        opportunityId: 'opp_1',
        stage: 'Aberto',
      }),
      'RESOURCE_NOT_FOUND',
    )
    expectErr(
      await run(crmMoveOpportunityStageTool, {
        opportunityId: 'opp_1',
        stage: 'Aberto',
      }),
      'RESOURCE_NOT_FOUND',
    )
    svc.update.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmMoveOpportunityStageTool, {
        opportunityId: 'opp_1',
        stage: 'Novo',
      }),
      'DATABASE_ERROR',
    )
    vi.mocked(CrmPipelineService.list).mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmMoveOpportunityStageTool, {
        opportunityId: 'opp_1',
        stage: 'Novo',
      }),
      'FORBIDDEN',
    )
    svc.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmMoveOpportunityStageTool, {
        opportunityId: 'opp_1',
        stage: 'Novo',
      }),
      'FORBIDDEN',
    )
  })
})

describe('crm_delete_opportunity', () => {
  it('previews, deletes and maps errors', async () => {
    svc.getById.mockResolvedValue(ok(opportunity()))
    const preview = expectOk(
      await previewOf(crmDeleteOpportunityTool, { opportunityId: 'opp_1' }),
    )
    expect(preview.title).toBe('Excluir a oportunidade “Contrato Acme”')
    expect(preview.fields?.[0].label).toBe('Valor')

    svc.remove.mockResolvedValue(ok(undefined))
    const out = expectOk(
      await run(crmDeleteOpportunityTool, { opportunityId: 'opp_1' }),
    )
    expect(out.data).toEqual({ id: 'opp_1', deleted: true })

    svc.remove.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmDeleteOpportunityTool, { opportunityId: 'opp_1' }),
      'DATABASE_ERROR',
    )
    svc.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmDeleteOpportunityTool, { opportunityId: 'opp_1' }),
      'FORBIDDEN',
    )
    expectErr(
      await run(crmDeleteOpportunityTool, { opportunityId: 'opp_1' }),
      'FORBIDDEN',
    )
  })
})
