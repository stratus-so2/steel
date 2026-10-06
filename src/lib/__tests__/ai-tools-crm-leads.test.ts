import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  crmCloseLeadLostTool,
  crmCloseLeadWonTool,
  crmCreateLeadTool,
  crmDeleteLeadTool,
  crmListLeadsTool,
  crmReopenLeadTool,
  crmUpdateLeadTool,
} from '@/src/lib/ai/tools/crm/leads'
import { err, ok } from '@/src/lib/result'
import { CrmLeadService } from '@/src/services/crm-lead.service'
import { CrmMemberService } from '@/src/services/crm-member.service'
import { WorkspaceService } from '@/src/services/workspace.service'
import {
  dbErr,
  expectErr,
  expectOk,
  forbiddenErr,
  lead,
  ME,
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
vi.mock('@/src/services/crm-lead.service', () => ({
  CrmLeadService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    closeWon: vi.fn(),
    closeLost: vi.fn(),
    reopen: vi.fn(),
  },
}))

const svc = vi.mocked(CrmLeadService)

beforeEach(() => {
  wireDefaults()
})

describe('crm_list_leads', () => {
  const leads = [
    lead(),
    lead({
      id: 'lead_2',
      name: 'Joana Dias',
      company: 'Beta',
      ownerId: 'user_bruno',
      closeResult: 'WON',
      stage: 'CLOSED',
      score: 50,
      source: 'Indicação',
    }),
    lead({
      id: 'lead_3',
      name: 'João Lima',
      company: 'Gama',
      ownerId: null,
      closeResult: 'LOST',
      stage: 'CLOSED',
      score: 5,
    }),
  ]

  it('lists with compact fields, owner names and deep links', async () => {
    svc.list.mockResolvedValue(ok(leads))
    const out = expectOk(await run(crmListLeadsTool, {}))
    const data = out.data as {
      total: number
      items: Array<Record<string, unknown>>
    }
    expect(data.total).toBe(3)
    expect(data.items[0]).toMatchObject({
      id: 'lead_1',
      stageLabel: 'Lead recebido',
      ownerName: 'Ana Souza',
      href: '/acme/crm/leads?record=lead_1',
    })
    expect(data.items[2]).toMatchObject({ ownerName: null })
    expect(out.summary).toBe('3 lead(s) encontrado(s)')
    expect(svc.list).toHaveBeenCalledWith(ME, WS, { stage: undefined })
  })

  it('filters by query, status, owner, source and score', async () => {
    svc.list.mockResolvedValue(ok(leads))
    const byQuery = expectOk(await run(crmListLeadsTool, { query: 'joao' }))
    expect((byQuery.data as { total: number }).total).toBe(1)

    const open = expectOk(await run(crmListLeadsTool, { status: 'OPEN' }))
    expect(
      (open.data as { items: { id: string }[] }).items.map((i) => i.id),
    ).toEqual(['lead_1'])
    const won = expectOk(await run(crmListLeadsTool, { status: 'WON' }))
    expect((won.data as { total: number }).total).toBe(1)

    const mine = expectOk(await run(crmListLeadsTool, { owner: 'me' }))
    expect((mine.data as { items: { id: string }[] }).items[0].id).toBe(
      'lead_1',
    )

    const bySource = expectOk(
      await run(crmListLeadsTool, { source: 'indicacao', minScore: 20 }),
    )
    expect((bySource.data as { total: number }).total).toBe(1)
  })

  it('shows null contact fields for a lead without e-mail or phone', async () => {
    svc.list.mockResolvedValue(ok([lead({ emails: [], phones: [] })]))
    const out = expectOk(await run(crmListLeadsTool, {}))
    expect(
      (out.data as { items: Record<string, unknown>[] }).items[0],
    ).toMatchObject({ email: null, phone: null })
  })

  it('passes the stage filter to the service', async () => {
    svc.list.mockResolvedValue(ok([]))
    await run(crmListLeadsTool, { stage: 'PROPOSAL' })
    expect(svc.list).toHaveBeenCalledWith(ME, WS, { stage: 'PROPOSAL' })
  })

  it('caps the page size at 50 and paginates with offset', async () => {
    svc.list.mockResolvedValue(
      ok(Array.from({ length: 80 }, (_, i) => lead({ id: `l${i}` }))),
    )
    const out = expectOk(await run(crmListLeadsTool, { limit: 500 }))
    const page = out.data as {
      limit: number
      items: unknown[]
      hasMore: boolean
    }
    expect(page.limit).toBe(50)
    expect(page.items).toHaveLength(50)
    expect(page.hasMore).toBe(true)

    const last = expectOk(await run(crmListLeadsTool, { offset: 60 }))
    const lastPage = last.data as { items: unknown[]; hasMore: boolean }
    expect(lastPage.items).toHaveLength(20)
    expect(lastPage.hasMore).toBe(false)
  })

  it('returns an ambiguity error when the owner name matches several members', async () => {
    svc.list.mockResolvedValue(ok(leads))
    const error = expectErr(
      await run(crmListLeadsTool, { owner: 'lima' }),
      'VALIDATION_ERROR',
    )
    expect(error.message).toContain('Bruno Lima')
    expect(error.message).toContain('Bruna Lima')
    expect(error.details).toMatchObject({ ambiguous: true })
  })

  it('maps service errors', async () => {
    svc.list.mockResolvedValue(err(forbiddenErr))
    expectErr(await run(crmListLeadsTool, {}), 'FORBIDDEN')
  })

  it('rejects invalid arguments', () => {
    expectErr(crmListLeadsTool.parse({ stage: 'NOPE' }), 'VALIDATION_ERROR')
    expectErr(crmListLeadsTool.parse({ limit: 0 }), 'VALIDATION_ERROR')
  })

  it('omits links and owner names when workspace/members cannot be read', async () => {
    vi.mocked(WorkspaceService.getById).mockResolvedValue(err(forbiddenErr))
    vi.mocked(CrmMemberService.list).mockResolvedValue(err(forbiddenErr))
    svc.list.mockResolvedValue(ok([lead()]))
    const out = expectOk(await run(crmListLeadsTool, {}))
    expect(
      (out.data as { items: Record<string, unknown>[] }).items[0],
    ).toMatchObject({ href: undefined, ownerName: null })
  })
})

describe('crm_create_lead', () => {
  const args = {
    name: 'Novo Lead',
    emails: ['novo@x.com'],
    source: 'Site',
    company: 'X',
  }

  it('requires a contact and a source', () => {
    expectErr(
      crmCreateLeadTool.parse({ name: 'Sem contato', source: 'Site' }),
      'VALIDATION_ERROR',
    )
    const error = expectErr(
      crmCreateLeadTool.parse({ name: 'X', emails: ['a@b.com'] }),
      'VALIDATION_ERROR',
    )
    expect(error.message).toContain('source')
  })

  it('previews the fields without calling the service', async () => {
    const preview = expectOk(await previewOf(crmCreateLeadTool, args))
    expect(preview.title).toBe('Criar o lead “Novo Lead”')
    expect(preview.fields).toEqual(
      expect.arrayContaining([
        { label: 'Nome', after: 'Novo Lead' },
        { label: 'E-mails', after: 'novo@x.com' },
        { label: 'Origem', after: 'Site' },
      ]),
    )
    expect(preview.fields?.some((f) => f.label === 'Telefones')).toBe(false)
    expect(svc.create).not.toHaveBeenCalled()
  })

  it('creates the lead', async () => {
    svc.create.mockResolvedValue(
      ok(lead({ id: 'lead_new', name: 'Novo Lead' })),
    )
    const out = expectOk(await run(crmCreateLeadTool, args))
    expect(svc.create).toHaveBeenCalledWith(ME, WS, {
      ...args,
      phones: [],
    })
    expect(out.target).toEqual({
      type: 'crm_lead',
      id: 'lead_new',
      label: 'Novo Lead',
      href: '/acme/crm/leads?record=lead_new',
    })
  })

  it('maps service errors (duplicate)', async () => {
    svc.create.mockResolvedValue(
      err({ code: 'CRM_LEAD_DUPLICATE', message: 'Lead já existe' }),
    )
    expectErr(await run(crmCreateLeadTool, args), 'CRM_LEAD_DUPLICATE')
  })
})

describe('crm_update_lead', () => {
  it('requires at least one field besides the id', () => {
    expectErr(crmUpdateLeadTool.parse({ leadId: 'lead_1' }), 'VALIDATION_ERROR')
  })

  it('previews before → after only for the changed fields', async () => {
    svc.getById.mockResolvedValue(ok(lead()))
    const preview = expectOk(
      await previewOf(crmUpdateLeadTool, {
        leadId: 'lead_1',
        company: 'Nova SA',
        city: 'Rio',
      }),
    )
    expect(preview.fields).toEqual([
      { label: 'Empresa', before: 'Cliente SA', after: 'Nova SA' },
      { label: 'Cidade', before: 'São Paulo', after: 'Rio' },
    ])
    expect(preview.target?.href).toBe('/acme/crm/leads?record=lead_1')
  })

  it('refuses a preview that changes nothing', async () => {
    svc.getById.mockResolvedValue(ok(lead()))
    expectErr(
      await previewOf(crmUpdateLeadTool, {
        leadId: 'lead_1',
        city: 'São Paulo',
      }),
      'VALIDATION_ERROR',
    )
  })

  it('preview fails when the lead is not found', async () => {
    svc.getById.mockResolvedValue(
      err({ code: 'RESOURCE_NOT_FOUND', message: 'x' }),
    )
    expectErr(
      await previewOf(crmUpdateLeadTool, { leadId: 'nope', city: 'Rio' }),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('executes the update without the id in the dto', async () => {
    svc.update.mockResolvedValue(ok(lead({ city: 'Rio' })))
    const out = expectOk(
      await run(crmUpdateLeadTool, { leadId: 'lead_1', city: 'Rio' }),
    )
    expect(svc.update).toHaveBeenCalledWith(ME, WS, 'lead_1', { city: 'Rio' })
    expect(out.summary).toBe('Lead “Carlos Pereira” atualizado')
  })

  it('maps update errors', async () => {
    svc.update.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmUpdateLeadTool, { leadId: 'lead_1', city: 'Rio' }),
      'DATABASE_ERROR',
    )
  })
})

describe('crm_delete_lead', () => {
  it('previews the deletion', async () => {
    svc.getById.mockResolvedValue(ok(lead()))
    const preview = expectOk(
      await previewOf(crmDeleteLeadTool, { leadId: 'lead_1' }),
    )
    expect(preview.title).toBe('Excluir o lead “Carlos Pereira”')
    expect(preview.fields).toEqual([
      { label: 'Etapa', before: 'Lead recebido', after: 'Excluído' },
    ])
    expect(svc.remove).not.toHaveBeenCalled()
  })

  it('preview maps lookup errors', async () => {
    svc.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmDeleteLeadTool, { leadId: 'lead_1' }),
      'FORBIDDEN',
    )
  })

  it('deletes', async () => {
    svc.getById.mockResolvedValue(ok(lead()))
    svc.remove.mockResolvedValue(ok(undefined))
    const out = expectOk(await run(crmDeleteLeadTool, { leadId: 'lead_1' }))
    expect(out.data).toEqual({ id: 'lead_1', deleted: true })
    expect(svc.remove).toHaveBeenCalledWith(ME, WS, 'lead_1')
  })

  it('maps lookup and removal errors', async () => {
    svc.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(await run(crmDeleteLeadTool, { leadId: 'lead_1' }), 'FORBIDDEN')
    svc.getById.mockResolvedValue(ok(lead()))
    svc.remove.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmDeleteLeadTool, { leadId: 'lead_1' }),
      'DATABASE_ERROR',
    )
  })
})

describe('crm_close_lead_won', () => {
  const args = {
    leadId: 'lead_1',
    closedAmount: 1500.5,
    billingType: 'MONTHLY',
    contractSignedAt: '2026-10-05',
  }

  it('previews the close with formatted values', async () => {
    svc.getById.mockResolvedValue(ok(lead({ stage: 'PROPOSAL' })))
    const preview = expectOk(await previewOf(crmCloseLeadWonTool, args))
    expect(preview.fields).toEqual(
      expect.arrayContaining([
        { label: 'Etapa', before: 'Proposta', after: 'Fechado/Encerrado' },
        { label: 'Resultado', before: null, after: 'Ganho' },
        { label: 'Cobrança', after: 'Mensal' },
        { label: 'Contrato assinado em', after: '05/10/2026' },
      ]),
    )
    const amount = preview.fields?.find((f) => f.label === 'Valor fechado')
    expect(amount?.after).toContain('1.500,50')
  })

  it('refuses leads already closed or outside the proposal stage', async () => {
    svc.getById.mockResolvedValue(ok(lead({ stage: 'CLOSED' })))
    expectErr(
      await previewOf(crmCloseLeadWonTool, args),
      'CRM_LEAD_ALREADY_CLOSED',
    )
    svc.getById.mockResolvedValue(ok(lead({ stage: 'QUALIFIED' })))
    expectErr(
      await previewOf(crmCloseLeadWonTool, args),
      'CRM_LEAD_STAGE_TRANSITION_INVALID',
    )
    svc.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(await previewOf(crmCloseLeadWonTool, args), 'FORBIDDEN')
  })

  it('closes with the human confirmation standing for the signed contract', async () => {
    svc.closeWon.mockResolvedValue(
      ok(person({ id: 'person_9', name: 'Carlos' })),
    )
    const out = expectOk(await run(crmCloseLeadWonTool, args))
    expect(svc.closeWon).toHaveBeenCalledWith(ME, WS, 'lead_1', {
      closedAmount: 1500.5,
      billingType: 'MONTHLY',
      contractSignedAt: new Date('2026-10-05'),
      contractSignedConfirmed: true,
    })
    expect(out.data).toMatchObject({
      closeResult: 'WON',
      person: { id: 'person_9', href: '/acme/crm/people?record=person_9' },
    })
  })

  it('maps service errors and validates arguments', async () => {
    svc.closeWon.mockResolvedValue(
      err({ code: 'CRM_LEAD_STAGE_REQUIREMENTS_NOT_MET', message: 'x' }),
    )
    expectErr(
      await run(crmCloseLeadWonTool, args),
      'CRM_LEAD_STAGE_REQUIREMENTS_NOT_MET',
    )
    expectErr(
      crmCloseLeadWonTool.parse({ ...args, billingType: 'WEEKLY' }),
      'VALIDATION_ERROR',
    )
  })
})

describe('crm_close_lead_lost', () => {
  const args = { leadId: 'lead_1', lostReason: 'Preço', retryAt: '2027-01-10' }

  it('requires a reason', () => {
    expectErr(
      crmCloseLeadLostTool.parse({ leadId: 'lead_1', lostReason: ' ' }),
      'VALIDATION_ERROR',
    )
  })

  it('previews and refuses a closed lead', async () => {
    svc.getById.mockResolvedValue(ok(lead({ stage: 'IN_CONTACT' })))
    const preview = expectOk(await previewOf(crmCloseLeadLostTool, args))
    expect(preview.summary).toBe('Motivo: Preço')
    expect(preview.fields).toEqual(
      expect.arrayContaining([
        { label: 'Etapa', before: 'Em contato', after: 'Fechado/Encerrado' },
        { label: 'Tentar de novo em', after: '10/01/2027' },
      ]),
    )
    svc.getById.mockResolvedValue(ok(lead({ stage: 'CLOSED' })))
    expectErr(
      await previewOf(crmCloseLeadLostTool, args),
      'CRM_LEAD_ALREADY_CLOSED',
    )
    svc.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(await previewOf(crmCloseLeadLostTool, args), 'FORBIDDEN')
  })

  it('closes as lost and maps errors', async () => {
    svc.closeLost.mockResolvedValue(
      ok(lead({ stage: 'CLOSED', closeResult: 'LOST' })),
    )
    const out = expectOk(await run(crmCloseLeadLostTool, args))
    expect(svc.closeLost).toHaveBeenCalledWith(ME, WS, 'lead_1', {
      lostReason: 'Preço',
      retryAt: new Date('2027-01-10'),
    })
    expect(out.summary).toContain('perdido')
    svc.closeLost.mockResolvedValue(err(dbErr))
    expectErr(await run(crmCloseLeadLostTool, args), 'DATABASE_ERROR')
  })
})

describe('crm_reopen_lead', () => {
  const args = { leadId: 'lead_1', reason: 'Cliente voltou' }

  it('previews a lost lead and refuses others', async () => {
    svc.getById.mockResolvedValue(
      ok(lead({ stage: 'CLOSED', closeResult: 'LOST', lostReason: 'Preço' })),
    )
    const preview = expectOk(await previewOf(crmReopenLeadTool, args))
    expect(preview.fields).toEqual([
      { label: 'Resultado', before: 'Perdido', after: 'Em aberto' },
      { label: 'Motivo da perda', before: 'Preço', after: null },
    ])

    svc.getById.mockResolvedValue(ok(lead({ closeResult: 'WON' })))
    const won = expectErr(
      await previewOf(crmReopenLeadTool, args),
      'CRM_LEAD_REOPEN_NOT_ALLOWED',
    )
    expect(won.message).toContain('ganhos')

    svc.getById.mockResolvedValue(ok(lead()))
    expectErr(
      await previewOf(crmReopenLeadTool, args),
      'CRM_LEAD_REOPEN_NOT_ALLOWED',
    )
    svc.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(await previewOf(crmReopenLeadTool, args), 'FORBIDDEN')
  })

  it('reopens and reports the stage', async () => {
    svc.reopen.mockResolvedValue(ok(lead({ stage: 'IN_CONTACT' })))
    const out = expectOk(await run(crmReopenLeadTool, args))
    expect(svc.reopen).toHaveBeenCalledWith(ME, WS, 'lead_1', {
      reason: 'Cliente voltou',
    })
    expect(out.summary).toContain('Em contato')
    svc.reopen.mockResolvedValue(err(dbErr))
    expectErr(await run(crmReopenLeadTool, args), 'DATABASE_ERROR')
  })
})
