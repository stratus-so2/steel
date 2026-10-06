import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  sdAgents,
  sdConfigDTO,
  sdConfigItemDTO,
  sdContactDTO,
  sdCustomerDTO,
  sdMessageDTO,
  sdPreview,
  sdTicketDTO,
} from '@/src/__tests__/factories/steel-ai-sd.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  databaseError,
  sdApprovalRequired,
  sdNotAgent,
  sdTicketNotFound,
} from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdTicketDTO } from '@/types/sd-ticket'

vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/services/sd-config.service')
vi.mock('@/src/services/sd-ticket.service')
vi.mock('@/src/services/sd-ticket-message.service')
vi.mock('@/src/services/sd-customer.service')
vi.mock('@/src/services/sd-contact.service')
vi.mock('@/src/services/sd-config-item.service')

import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { SdConfigService } from '@/src/services/sd-config.service'
import { SdConfigItemService } from '@/src/services/sd-config-item.service'
import { SdContactService } from '@/src/services/sd-contact.service'
import { SdCustomerService } from '@/src/services/sd-customer.service'
import { SdTicketService } from '@/src/services/sd-ticket.service'
import { SdTicketMessageService } from '@/src/services/sd-ticket-message.service'
import {
  sdAddInternalNoteTool,
  sdAssignTicketTool,
  sdCancelTicketTool,
  sdCreateTicketTool,
  sdMoveTicketPhaseTool,
  sdReplyToRequesterTool,
  sdUpdateTicketTool,
} from '../ai/tools/servicedesk/tickets-write'

const ctx = {
  workspaceId: 'ws1',
  actorId: 'user-me',
  source: 'assistant' as const,
}
const tickets = vi.mocked(SdTicketService)
const config = vi.mocked(SdConfigService)

function page<T>(items: T[]) {
  return ok({ items, total: items.length, page: 1, pageSize: 10 })
}

function inProgress(overrides: Partial<SdTicketDTO> = {}) {
  return sdTicketDTO({
    phaseId: 'ph-inc-prog',
    phase: {
      ...sdTicketDTO().phase,
      id: 'ph-inc-prog',
      name: 'Em andamento',
      category: 'IN_PROGRESS',
    },
    ...overrides,
  })
}

beforeEach(() => {
  vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
    ok({ slug: 'acme' } as never),
  )
  config.bootstrap.mockResolvedValue(ok(sdConfigDTO()))
  config.agents.mockResolvedValue(ok(sdAgents()))
  tickets.get.mockResolvedValue(ok(sdTicketDTO()))
})

/* --------------------------------- create -------------------------------- */

describe('sd_create_ticket', () => {
  const parse = (args: Record<string, unknown>) =>
    expectOk(sdCreateTicketTool.parse(args))

  it('should require practice and title', () => {
    expectErr(sdCreateTicketTool.parse({ title: 'x' }), 'VALIDATION_ERROR')
    expectErr(
      sdCreateTicketTool.parse({ practice: 'incident' }),
      'VALIDATION_ERROR',
    )
  })

  it('should preview every resolved field without creating anything', async () => {
    vi.mocked(SdContactService.list).mockResolvedValue(page([sdContactDTO()]))
    vi.mocked(SdCustomerService.list).mockResolvedValue(page([sdCustomerDTO()]))
    vi.mocked(SdConfigItemService.list).mockResolvedValue(
      page([sdConfigItemDTO()]),
    )
    const args = parse({
      practice: 'incident',
      title: 'Wi-Fi sem acesso',
      description: 'Ninguém conecta.\n\nDesde as 9h.',
      service: 'Rede > Wi-Fi > Liberar acesso',
      impact: 'Alto',
      urgency: 'Alta',
      severity: 'Sev 1',
      requester: 'carlos@cliente.com',
      contact: 'Joana Contato',
      customer: 'Acme Ltda',
      company: 'Acme Ltda',
      department: 'Redes',
      assignee: 'me',
      configItem: 'srv-mail-01',
      tags: ['wifi', 'urgente'],
      customFields: { asset_tag: 'PAT-9' },
    })
    const preview = expectOk(await sdPreview(sdCreateTicketTool, ctx, args))
    expect(preview.title).toBe('Abrir incidente “Wi-Fi sem acesso”')
    expect(preview.fields).toEqual([
      { label: 'Prática', after: 'Incidente' },
      { label: 'Título', after: 'Wi-Fi sem acesso' },
      { label: 'Descrição', after: 'Ninguém conecta.\n\nDesde as 9h.' },
      { label: 'Catálogo', after: 'Rede > Wi-Fi > Liberar acesso' },
      { label: 'Impacto', after: 'Alto' },
      { label: 'Urgência', after: 'Alta' },
      { label: 'Prioridade', after: 'Crítica (matriz impacto × urgência)' },
      { label: 'Severidade', after: 'Sev 1' },
      { label: 'Solicitante', after: 'Carlos Cliente <carlos@cliente.com>' },
      { label: 'Contato', after: 'Joana Contato' },
      { label: 'Cliente', after: 'Acme Ltda' },
      { label: 'Empresa', after: 'Acme Ltda' },
      { label: 'Departamento', after: 'Redes' },
      { label: 'Responsável', after: 'Ana Agente' },
      { label: 'Item de configuração', after: 'srv-mail-01' },
      { label: 'Tags', after: 'wifi, urgente' },
      { label: 'Patrimônio', after: 'PAT-9' },
    ])
    expect(tickets.create).not.toHaveBeenCalled()
  })

  it('should create through the ticket service with resolved ids', async () => {
    tickets.create.mockResolvedValue(ok(sdTicketDTO()))
    const args = parse({
      practice: 'incident',
      title: 'Wi-Fi sem acesso',
      description: 'Linha 1',
      service: 'svc-wifi-access',
      impact: 'imp-high',
      urgency: 'urg-high',
    })
    const out = expectOk(await sdCreateTicketTool.execute(ctx, args))
    expect(out.summary).toBe('Chamado INC-000042 aberto')
    expect(out.target).toEqual({
      type: 'sd_ticket',
      id: 'ticket-1',
      label: 'INC-000042',
      href: '/acme/servicedesk/tickets/42',
    })
    expect(tickets.create).toHaveBeenCalledWith('user-me', 'ws1', {
      type: 'INCIDENT',
      title: 'Wi-Fi sem acesso',
      description: '<p>Linha 1</p>',
      impactId: 'imp-high',
      urgencyId: 'urg-high',
      categoryId: 'cat-net',
      subcategoryId: 'sub-wifi',
      serviceId: 'svc-wifi-access',
    })
  })

  it('should default to automatic routing in the preview', async () => {
    const preview = expectOk(
      await sdPreview(
        sdCreateTicketTool,
        ctx,
        parse({ practice: 'problem', title: 'Quedas recorrentes' }),
      ),
    )
    expect(preview.fields).toContainEqual({
      label: 'Departamento',
      after: 'Roteamento automático (catálogo ou padrão)',
    })
  })

  it('should surface every resolution error', async () => {
    const base = { practice: 'incident', title: 'X' }
    config.bootstrap.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await sdCreateTicketTool.execute(ctx, parse(base)),
      'DATABASE_ERROR',
    )
    expectErr(
      await sdCreateTicketTool.execute(
        ctx,
        parse({ ...base, impact: 'Médio' }),
      ),
      'VALIDATION_ERROR',
    )
    expectErr(
      await sdCreateTicketTool.execute(
        ctx,
        parse({ ...base, department: 'sup' }),
      ),
      'VALIDATION_ERROR',
    )
    expectErr(
      await sdCreateTicketTool.execute(
        ctx,
        parse({ ...base, requester: 'brun' }),
      ),
      'VALIDATION_ERROR',
    )
    // Requesters cannot be assignees.
    expectErr(
      await sdCreateTicketTool.execute(
        ctx,
        parse({ ...base, assignee: 'carlos@cliente.com' }),
      ),
      'VALIDATION_ERROR',
    )
    config.agents.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(
      await sdCreateTicketTool.execute(ctx, parse({ ...base, assignee: 'me' })),
      'SD_NOT_AGENT',
    )
    vi.mocked(SdContactService.list).mockResolvedValue(page([]))
    expectErr(
      await sdCreateTicketTool.execute(
        ctx,
        parse({ ...base, contact: 'Ninguém' }),
      ),
      'VALIDATION_ERROR',
    )
    expectErr(
      await sdCreateTicketTool.execute(
        ctx,
        parse({ ...base, customFields: { nope: 1 } }),
      ),
      'VALIDATION_ERROR',
    )
    expect(tickets.create).not.toHaveBeenCalled()
  })

  it('should reject what the ticket schema refuses', async () => {
    const huge = parse({
      practice: 'incident',
      title: 'X',
      description: '&'.repeat(20_000),
    })
    expectErr(
      await sdPreview(sdCreateTicketTool, ctx, huge),
      'VALIDATION_ERROR',
    )
  })

  it('should return domain and slug errors from execute', async () => {
    const args = parse({ practice: 'incident', title: 'X' })
    tickets.create.mockResolvedValue(err(sdNotAgent()))
    expectErr(await sdCreateTicketTool.execute(ctx, args), 'SD_NOT_AGENT')
    config.bootstrap.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await sdPreview(sdCreateTicketTool, ctx, args), 'DATABASE_ERROR')
    tickets.create.mockResolvedValue(ok(sdTicketDTO()))
    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await sdCreateTicketTool.execute(ctx, args), 'DATABASE_ERROR')
  })
})

/* --------------------------------- update -------------------------------- */

describe('sd_update_ticket', () => {
  const parse = (args: Record<string, unknown>) =>
    expectOk(sdUpdateTicketTool.parse(args))

  it('should require at least one field', () => {
    expectErr(sdUpdateTicketTool.parse({ ticket: '42' }), 'VALIDATION_ERROR')
  })

  it('should preview before → after for every changed field', async () => {
    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({
          impact: { id: 'imp-low', name: 'Baixo', level: 1, color: null },
          urgency: { id: 'urg-high', name: 'Alta', level: 3, color: null },
          priority: { id: 'pri-low', name: 'Baixa', level: 1, color: null },
          category: { id: 'cat-net', name: 'Rede' },
          tags: ['a'],
          customFields: { asset_tag: 'PAT-1' },
        }),
      ),
    )
    const preview = expectOk(
      await sdPreview(
        sdUpdateTicketTool,
        ctx,
        parse({
          ticket: 'INC-000042',
          title: 'Novo título',
          description: 'Nova descrição',
          impact: 'Alto',
          severity: 'Sev 1',
          category: 'Rede',
          subcategory: 'VPN',
          tags: ['a', 'b'],
          customFields: { asset_tag: 'PAT-2' },
        }),
      ),
    )
    expect(preview.title).toBe('Atualizar chamado — INC-000042')
    expect(preview.target?.href).toBe('/acme/servicedesk/tickets/42')
    expect(preview.fields).toEqual([
      {
        label: 'Título',
        before: 'Servidor de e-mail fora do ar',
        after: 'Novo título',
      },
      {
        label: 'Descrição',
        before: 'Ninguém recebe e-mail',
        after: 'Nova descrição',
      },
      { label: 'Impacto', before: 'Baixo', after: 'Alto' },
      {
        label: 'Prioridade',
        before: 'Baixa',
        after: 'Crítica (matriz impacto × urgência)',
      },
      { label: 'Severidade', before: null, after: 'Sev 1' },
      { label: 'Catálogo', before: 'Rede', after: 'Rede > VPN' },
      { label: 'Tags', before: 'a', after: 'a, b' },
      { label: 'Patrimônio', before: 'PAT-1', after: 'PAT-2' },
    ])
  })

  it('should update by ticket id with the resolved changes', async () => {
    tickets.update.mockResolvedValue(ok(sdTicketDTO({ title: 'Y' })))
    const out = expectOk(
      await sdUpdateTicketTool.execute(
        ctx,
        parse({
          ticket: '42',
          title: 'Y',
          urgency: 'Baixa',
          priority: 'Crítica',
        }),
      ),
    )
    expect(out.summary).toBe('Chamado INC-000042 atualizado')
    expect(tickets.update).toHaveBeenCalledWith('user-me', 'ws1', 'ticket-1', {
      title: 'Y',
      urgencyId: 'urg-low',
      priorityId: 'pri-crit',
    })
  })

  it('should surface lookup, config, field and domain errors', async () => {
    const args = parse({ ticket: '42', title: 'Y' })
    tickets.get.mockResolvedValueOnce(err(sdTicketNotFound()))
    expectErr(
      await sdPreview(sdUpdateTicketTool, ctx, args),
      'SD_TICKET_NOT_FOUND',
    )
    config.bootstrap.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await sdPreview(sdUpdateTicketTool, ctx, args), 'DATABASE_ERROR')
    expectErr(
      await sdPreview(
        sdUpdateTicketTool,
        ctx,
        parse({ ticket: '42', priority: 'Zzz' }),
      ),
      'VALIDATION_ERROR',
    )
    expectErr(
      await sdPreview(
        sdUpdateTicketTool,
        ctx,
        parse({ ticket: '42', customFields: { nope: 1 } }),
      ),
      'VALIDATION_ERROR',
    )
    expectErr(
      await sdPreview(
        sdUpdateTicketTool,
        ctx,
        parse({ ticket: '42', description: '&'.repeat(20_000) }),
      ),
      'VALIDATION_ERROR',
    )
    expectErr(
      await sdUpdateTicketTool.execute(
        ctx,
        parse({ ticket: '42', priority: 'Zzz' }),
      ),
      'VALIDATION_ERROR',
    )
    tickets.update.mockResolvedValue(err(sdNotAgent()))
    expectErr(await sdUpdateTicketTool.execute(ctx, args), 'SD_NOT_AGENT')
  })
})

/* --------------------------------- assign -------------------------------- */

describe('sd_assign_ticket', () => {
  const parse = (args: Record<string, unknown>) =>
    expectOk(sdAssignTicketTool.parse(args))

  it('should require an assignee or department', () => {
    expectErr(sdAssignTicketTool.parse({ ticket: '42' }), 'VALIDATION_ERROR')
  })

  it('should preview reassignment to an agent and a department', async () => {
    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({
          assignee: {
            id: 'user-bruno',
            name: 'Bruno Lima',
            email: 'b',
            image: null,
          },
        }),
      ),
    )
    const preview = expectOk(
      await sdPreview(
        sdAssignTicketTool,
        ctx,
        parse({ ticket: '42', assignee: 'me', department: 'Suporte N2' }),
      ),
    )
    expect(preview.fields).toEqual([
      { label: 'Departamento', before: null, after: 'Suporte N2' },
      { label: 'Responsável', before: 'Bruno Lima', after: 'Ana Agente' },
    ])
    expect(config.agents).toHaveBeenCalledWith('user-me', 'ws1', {
      includeRequesters: false,
    })
  })

  it('should clear assignee and department with "none"', async () => {
    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({
          assignee: {
            id: 'user-bruno',
            name: 'Bruno Lima',
            email: 'b',
            image: null,
          },
          department: { id: 'dep-net', name: 'Redes' },
        }),
      ),
    )
    tickets.update.mockResolvedValue(ok(sdTicketDTO()))
    const args = parse({ ticket: '42', assignee: 'none', department: 'nenhum' })
    // "nenhum" is not a clear keyword for departments → resolved by name.
    expectErr(
      await sdPreview(sdAssignTicketTool, ctx, args),
      'VALIDATION_ERROR',
    )

    const clear = parse({
      ticket: '42',
      assignee: 'ninguém',
      department: 'none',
    })
    const preview = expectOk(await sdPreview(sdAssignTicketTool, ctx, clear))
    expect(preview.fields).toEqual([
      { label: 'Departamento', before: 'Redes', after: null },
      { label: 'Responsável', before: 'Bruno Lima', after: null },
    ])
    const out = expectOk(await sdAssignTicketTool.execute(ctx, clear))
    expect(out.summary).toBe('INC-000042 sem responsável')
    expect(tickets.update).toHaveBeenCalledWith('user-me', 'ws1', 'ticket-1', {
      assigneeId: null,
      departmentId: null,
    })
  })

  it('should refuse a no-op assignment', async () => {
    tickets.get.mockResolvedValue(
      ok(sdTicketDTO({ department: { id: 'dep-net', name: 'Redes' } })),
    )
    const error = expectErr(
      await sdPreview(
        sdAssignTicketTool,
        ctx,
        parse({ ticket: '42', department: 'Redes' }),
      ),
    )
    expect(error.message).toContain('já está')
  })

  it('should execute and summarize who got the ticket', async () => {
    tickets.update.mockResolvedValue(
      ok(
        sdTicketDTO({
          assignee: {
            id: 'user-bruno',
            name: 'Bruno Lima',
            email: 'b',
            image: null,
          },
        }),
      ),
    )
    const out = expectOk(
      await sdAssignTicketTool.execute(
        ctx,
        parse({ ticket: '42', assignee: 'Bruno Lima' }),
      ),
    )
    expect(out.summary).toBe('INC-000042 atribuído a Bruno Lima')
    tickets.update.mockResolvedValue(
      ok(sdTicketDTO({ department: { id: 'dep-net', name: 'Redes' } })),
    )
    const dep = expectOk(
      await sdAssignTicketTool.execute(
        ctx,
        parse({ ticket: '42', department: 'Redes' }),
      ),
    )
    expect(dep.summary).toBe('INC-000042 atribuído a Redes')
  })

  it('should surface lookup and domain errors', async () => {
    tickets.get.mockResolvedValueOnce(err(sdTicketNotFound()))
    expectErr(
      await sdAssignTicketTool.execute(
        ctx,
        parse({ ticket: '1', assignee: 'me' }),
      ),
      'SD_TICKET_NOT_FOUND',
    )
    config.bootstrap.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await sdAssignTicketTool.execute(
        ctx,
        parse({ ticket: '1', department: 'Redes' }),
      ),
      'DATABASE_ERROR',
    )
    expectErr(
      await sdAssignTicketTool.execute(
        ctx,
        parse({ ticket: '1', department: 'X' }),
      ),
      'VALIDATION_ERROR',
    )
    config.agents.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(
      await sdAssignTicketTool.execute(
        ctx,
        parse({ ticket: '1', assignee: 'me' }),
      ),
      'SD_NOT_AGENT',
    )
    expectErr(
      await sdAssignTicketTool.execute(
        ctx,
        parse({ ticket: '1', assignee: 'brun' }),
      ),
      'VALIDATION_ERROR',
    )
    tickets.update.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await sdAssignTicketTool.execute(
        ctx,
        parse({ ticket: '1', assignee: 'me' }),
      ),
      'SD_NOT_AGENT',
    )
  })
})

/* ------------------------------- move phase ------------------------------ */

describe('sd_move_ticket_phase', () => {
  const parse = (args: Record<string, unknown>) =>
    expectOk(sdMoveTicketPhaseTool.parse(args))

  it('should preview an allowed transition with the comment', async () => {
    const preview = expectOk(
      await sdPreview(
        sdMoveTicketPhaseTool,
        ctx,
        parse({ ticket: '42', phase: 'em andamento', comment: 'Assumindo' }),
      ),
    )
    expect(preview.title).toBe('Mover para "Em andamento" — INC-000042')
    expect(preview.fields).toEqual([
      { label: 'Fase', before: 'Novo', after: 'Em andamento' },
      { label: 'Comentário', after: 'Assumindo' },
    ])
  })

  it('should describe phase requirements in a free flow', async () => {
    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({
          type: 'SERVICE_REQUEST',
          phaseId: 'ph-req-new',
          phase: { ...sdTicketDTO().phase, id: 'ph-req-new' },
        }),
      ),
    )
    const preview = expectOk(
      await sdPreview(
        sdMoveTicketPhaseTool,
        ctx,
        parse({ ticket: '42', phase: 'Em andamento' }),
      ),
    )
    expect(preview.summary).toContain('exige aprovação concedida')
    expect(preview.summary).toContain('pausa o SLA')
    expect(preview.summary).toContain('categoryId')
  })

  it('should surface the flow error with the allowed phases', async () => {
    const error = expectErr(
      await sdPreview(
        sdMoveTicketPhaseTool,
        ctx,
        parse({ ticket: '42', phase: 'Resolvido' }),
      ),
      'SD_PHASE_TRANSITION_NOT_ALLOWED',
    )
    expect(error.message).toContain('Fases permitidas: Em andamento, Cancelado')

    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({
          phaseId: 'ph-inc-res',
          phase: {
            ...sdTicketDTO().phase,
            id: 'ph-inc-res',
            name: 'Resolvido',
          },
        }),
      ),
    )
    const none = expectErr(
      await sdPreview(
        sdMoveTicketPhaseTool,
        ctx,
        parse({ ticket: '42', phase: 'Novo' }),
      ),
    )
    expect(none.message).toContain('Fases permitidas: nenhuma')
  })

  it('should refuse the current phase and unknown phases', async () => {
    expectErr(
      await sdPreview(
        sdMoveTicketPhaseTool,
        ctx,
        parse({ ticket: '42', phase: 'Novo' }),
      ),
      'VALIDATION_ERROR',
    )
    expectErr(
      await sdPreview(
        sdMoveTicketPhaseTool,
        ctx,
        parse({ ticket: '42', phase: 'Fechado' }),
      ),
      'VALIDATION_ERROR',
    )
  })

  it('should demand a solution before resolving', async () => {
    tickets.get.mockResolvedValue(ok(inProgress()))
    expectErr(
      await sdPreview(
        sdMoveTicketPhaseTool,
        ctx,
        parse({ ticket: '42', phase: 'Resolvido' }),
      ),
      'SD_PHASE_REQUIREMENTS_UNMET',
    )
    tickets.get.mockResolvedValue(ok(inProgress({ solution: 'Já resolvido' })))
    expectOk(
      await sdPreview(
        sdMoveTicketPhaseTool,
        ctx,
        parse({ ticket: '42', phase: 'Resolvido' }),
      ),
    )
    config.bootstrap.mockResolvedValue(
      ok(
        sdConfigDTO({
          settings: {
            ...sdConfigDTO().settings,
            requireSolutionOnResolve: false,
          },
        }),
      ),
    )
    tickets.get.mockResolvedValue(ok(inProgress()))
    expectOk(
      await sdPreview(
        sdMoveTicketPhaseTool,
        ctx,
        parse({ ticket: '42', phase: 'Resolvido' }),
      ),
    )
  })

  it('should resolve the solution classification and move', async () => {
    tickets.get.mockResolvedValue(ok(inProgress()))
    const args = parse({
      ticket: '42',
      phase: 'Resolvido',
      solution: 'Reiniciado',
      solutionClassification: 'correção aplicada',
    })
    const preview = expectOk(await sdPreview(sdMoveTicketPhaseTool, ctx, args))
    expect(preview.fields).toEqual([
      { label: 'Fase', before: 'Em andamento', after: 'Resolvido' },
      { label: 'Classificação da solução', after: 'Correção aplicada' },
      { label: 'Solução', after: 'Reiniciado' },
    ])
    tickets.movePhase.mockResolvedValue(
      ok(inProgress({ phase: { ...inProgress().phase, name: 'Resolvido' } })),
    )
    const out = expectOk(await sdMoveTicketPhaseTool.execute(ctx, args))
    expect(out.summary).toBe('INC-000042 movido para "Resolvido"')
    expect(tickets.movePhase).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      'ticket-1',
      {
        phaseId: 'ph-inc-res',
        solution: 'Reiniciado',
        solutionClassificationId: 'cls-fix',
        comment: undefined,
      },
    )
    expectErr(
      await sdPreview(
        sdMoveTicketPhaseTool,
        ctx,
        parse({ ...args, solutionClassification: 'Outra' }),
      ),
      'VALIDATION_ERROR',
    )
  })

  it('should surface engine errors and lookup errors', async () => {
    const args = parse({ ticket: '42', phase: 'Em andamento' })
    tickets.movePhase.mockResolvedValue(err(sdApprovalRequired()))
    expectErr(
      await sdMoveTicketPhaseTool.execute(ctx, args),
      'SD_APPROVAL_REQUIRED',
    )
    config.bootstrap.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await sdMoveTicketPhaseTool.execute(ctx, args), 'DATABASE_ERROR')
    tickets.get.mockResolvedValueOnce(err(sdTicketNotFound()))
    expectErr(
      await sdMoveTicketPhaseTool.execute(ctx, args),
      'SD_TICKET_NOT_FOUND',
    )
  })
})

/* --------------------------------- cancel -------------------------------- */

describe('sd_cancel_ticket', () => {
  const args = { ticket: '42', reason: 'Duplicado' }

  it('should require a reason', () => {
    expectErr(sdCancelTicketTool.parse({ ticket: '42' }), 'VALIDATION_ERROR')
  })

  it('should respect department-restricted transitions', async () => {
    const error = expectErr(
      await sdPreview(sdCancelTicketTool, ctx, args),
      'SD_PHASE_TRANSITION_NOT_ALLOWED',
    )
    expect(error.message).toContain('Seu departamento')
  })

  it('should preview and cancel for admins with the reason as comment', async () => {
    config.bootstrap.mockResolvedValue(
      ok(sdConfigDTO({ me: { ...sdConfigDTO().me, isAdmin: true } })),
    )
    const preview = expectOk(await sdPreview(sdCancelTicketTool, ctx, args))
    expect(preview.fields).toEqual([
      { label: 'Fase', before: 'Novo', after: 'Cancelado' },
      { label: 'Motivo', after: 'Duplicado' },
    ])
    tickets.movePhase.mockResolvedValue(
      ok(sdTicketDTO({ phase: { ...sdTicketDTO().phase, name: 'Cancelado' } })),
    )
    const out = expectOk(await sdCancelTicketTool.execute(ctx, args))
    expect(out.summary).toBe('INC-000042 movido para "Cancelado"')
    expect(tickets.movePhase).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      'ticket-1',
      expect.objectContaining({
        phaseId: 'ph-inc-cancel',
        comment: 'Duplicado',
      }),
    )
  })

  it('should allow members of the permitted department', async () => {
    config.bootstrap.mockResolvedValue(
      ok(
        sdConfigDTO({
          me: { ...sdConfigDTO().me, departmentIds: ['dep-net'] },
        }),
      ),
    )
    expectOk(await sdPreview(sdCancelTicketTool, ctx, args))
  })

  it('should explain flows without a canceled phase', async () => {
    tickets.get.mockResolvedValue(
      ok(sdTicketDTO({ type: 'SERVICE_REQUEST', phaseId: 'ph-req-new' })),
    )
    const error = expectErr(await sdPreview(sdCancelTicketTool, ctx, args))
    expect(error.message).toBe(
      'O fluxo de requisição não tem fase de cancelamento',
    )
    expectErr(await sdCancelTicketTool.execute(ctx, args), 'VALIDATION_ERROR')
  })
})

/* -------------------------------- messages ------------------------------- */

describe('sd_add_internal_note / sd_reply_to_requester', () => {
  it('should refuse empty bodies and closed tickets', async () => {
    expectErr(
      sdAddInternalNoteTool.parse({ ticket: '42', body: ' ' }),
      'VALIDATION_ERROR',
    )
    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({ phase: { ...sdTicketDTO().phase, category: 'CLOSED' } }),
      ),
    )
    expectErr(
      await sdPreview(sdAddInternalNoteTool, ctx, { ticket: '42', body: 'x' }),
      'SD_TICKET_CLOSED',
    )
    expectErr(
      await sdPreview(sdReplyToRequesterTool, ctx, { ticket: '42', body: 'x' }),
      'SD_TICKET_CLOSED',
    )
    expectErr(
      await sdReplyToRequesterTool.execute(ctx, { ticket: '42', body: 'x' }),
      'SD_TICKET_CLOSED',
    )
    expect(SdTicketMessageService.create).not.toHaveBeenCalled()
  })

  it('should preview an internal note as agent-only', async () => {
    const preview = expectOk(
      await sdPreview(sdAddInternalNoteTool, ctx, {
        ticket: '42',
        body: 'Verificar logs',
      }),
    )
    expect(preview.summary).toContain('só para agentes')
    expect(preview.fields).toEqual([{ label: 'Nota', after: 'Verificar logs' }])
  })

  it('should post an internal note', async () => {
    vi.mocked(SdTicketMessageService.create).mockResolvedValue(
      ok(sdMessageDTO({ visibility: 'INTERNAL' })),
    )
    const out = expectOk(
      await sdAddInternalNoteTool.execute(ctx, {
        ticket: '42',
        body: 'Logs ok',
      }),
    )
    expect(out.summary).toBe('Nota interna registrada em INC-000042')
    expect(SdTicketMessageService.create).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      'ticket-1',
      { body: 'Logs ok', visibility: 'INTERNAL', attachmentIds: [] },
    )
  })

  it('should warn the reply notifies the requester (user, contact or unknown)', async () => {
    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({
          requester: {
            id: 'r',
            name: 'Carlos',
            email: 'carlos@x.com',
            image: null,
          },
        }),
      ),
    )
    const preview = expectOk(
      await sdPreview(sdReplyToRequesterTool, ctx, {
        ticket: '42',
        body: 'Resolvido!',
      }),
    )
    expect(preview.summary).toContain('Carlos — carlos@x.com será notificado')
    expect(preview.fields?.[0]).toEqual({
      label: 'Para',
      after: 'Carlos — carlos@x.com',
    })

    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({
          contact: {
            id: 'c',
            name: 'Joana',
            email: null,
            phone: null,
            userId: null,
          },
        }),
      ),
    )
    const contact = expectOk(
      await sdPreview(sdReplyToRequesterTool, ctx, {
        ticket: '42',
        body: 'Oi',
      }),
    )
    expect(contact.fields?.[0]).toEqual({ label: 'Para', after: 'Joana' })

    tickets.get.mockResolvedValue(ok(sdTicketDTO()))
    const unknown = expectOk(
      await sdPreview(sdReplyToRequesterTool, ctx, {
        ticket: '42',
        body: 'Oi',
      }),
    )
    expect(unknown.fields?.[0]).toEqual({
      label: 'Para',
      after: 'o solicitante do chamado',
    })
  })

  it('should post a public reply and surface service errors', async () => {
    vi.mocked(SdTicketMessageService.create).mockResolvedValue(
      ok(sdMessageDTO()),
    )
    const out = expectOk(
      await sdReplyToRequesterTool.execute(ctx, { ticket: '42', body: 'Oi' }),
    )
    expect(out.summary).toBe('Resposta enviada ao solicitante de INC-000042')
    expect(out.data).toMatchObject({ visibility: 'PUBLIC', messageId: 'msg-1' })
    vi.mocked(SdTicketMessageService.create).mockResolvedValue(
      err(sdNotAgent()),
    )
    expectErr(
      await sdReplyToRequesterTool.execute(ctx, { ticket: '42', body: 'Oi' }),
      'SD_NOT_AGENT',
    )
    tickets.get.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await sdPreview(sdAddInternalNoteTool, ctx, { ticket: '42', body: 'Oi' }),
      'SD_TICKET_NOT_FOUND',
    )
  })
})
