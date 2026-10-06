import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  sdAgents,
  sdApprovalDTO,
  sdConfigItemDTO,
  sdKbArticleDTO,
  sdKbSearchDTO,
  sdPreview,
  sdTaskDTO,
  sdTicketDTO,
} from '@/src/__tests__/factories/steel-ai-sd.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, sdNotAgent, sdTicketNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/services/sd-config.service')
vi.mock('@/src/services/sd-ticket.service')
vi.mock('@/src/services/sd-ticket-task.service')
vi.mock('@/src/services/sd-ticket-approval.service')
vi.mock('@/src/services/sd-kb-ticket-link.service')
vi.mock('@/src/services/sd-kb-article.service')
vi.mock('@/src/services/sd-config-item.service')

import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { SdConfigService } from '@/src/services/sd-config.service'
import { SdConfigItemService } from '@/src/services/sd-config-item.service'
import { SdKbArticleService } from '@/src/services/sd-kb-article.service'
import { SdKbTicketLinkService } from '@/src/services/sd-kb-ticket-link.service'
import { SdTicketService } from '@/src/services/sd-ticket.service'
import { SdTicketApprovalService } from '@/src/services/sd-ticket-approval.service'
import { SdTicketTaskService } from '@/src/services/sd-ticket-task.service'
import {
  sdCompleteTicketTaskTool,
  sdCreateTicketTaskTool,
  sdDeleteTicketTaskTool,
  sdLinkConfigItemTool,
  sdLinkKbArticleTool,
  sdRequestApprovalTool,
} from '../ai/tools/servicedesk/ticket-work'

const ctx = {
  workspaceId: 'ws1',
  actorId: 'user-me',
  source: 'assistant' as const,
}
const tickets = vi.mocked(SdTicketService)
const tasks = vi.mocked(SdTicketTaskService)

function taskList(items = [sdTaskDTO()]) {
  return ok({ items, progress: { done: 0, total: items.length, percent: 0 } })
}

function link(articleId = 'kb-1') {
  return {
    ticketId: 'ticket-1',
    article: sdKbArticleDTO({ id: articleId }),
    linkedById: null,
    resolvedTicket: false,
    createdAt: '2026-10-01T12:00:00.000Z',
  }
}

beforeEach(() => {
  vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
    ok({ slug: 'acme' } as never),
  )
  vi.mocked(SdConfigService.agents).mockResolvedValue(ok(sdAgents()))
  tickets.get.mockResolvedValue(ok(sdTicketDTO()))
})

describe('sd_create_ticket_task', () => {
  it('should preview title, description, assignee and due date', async () => {
    const args = expectOk(
      sdCreateTicketTaskTool.parse({
        ticket: '42',
        title: 'Trocar disco',
        description: 'Disco 2',
        assignee: 'Bruno Lima',
        dueDate: '2026-10-10T12:00:00.000Z',
      }),
    )
    const preview = expectOk(await sdPreview(sdCreateTicketTaskTool, ctx, args))
    expect(preview.fields).toEqual([
      { label: 'Tarefa', after: 'Trocar disco' },
      { label: 'Descrição', after: 'Disco 2' },
      { label: 'Responsável', after: 'Bruno Lima' },
      { label: 'Prazo', after: '2026-10-10T12:00:00.000Z' },
    ])
    expect(SdConfigService.agents).toHaveBeenCalledWith('user-me', 'ws1', {
      includeRequesters: false,
    })
  })

  it('should create the task with the resolved assignee', async () => {
    tasks.create.mockResolvedValue(ok(sdTaskDTO({ title: 'Trocar disco' })))
    const out = expectOk(
      await sdCreateTicketTaskTool.execute(
        ctx,
        expectOk(
          sdCreateTicketTaskTool.parse({
            ticket: '42',
            title: 'Trocar disco',
            assignee: 'me',
          }),
        ),
      ),
    )
    expect(out.summary).toBe('Tarefa “Trocar disco” criada em INC-000042')
    expect(tasks.create).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      'ticket-1',
      expect.objectContaining({
        title: 'Trocar disco',
        assigneeId: 'user-me',
        status: 'TODO',
      }),
    )
    const minimal = expectOk(
      await sdPreview(sdCreateTicketTaskTool, ctx, {
        ticket: '42',
        title: 'X',
      }),
    )
    expect(minimal.fields).toEqual([{ label: 'Tarefa', after: 'X' }])
  })

  it('should surface ticket, member and service errors', async () => {
    const args = { ticket: '42', title: 'X', assignee: 'brun' }
    expectErr(
      await sdPreview(sdCreateTicketTaskTool, ctx, args),
      'VALIDATION_ERROR',
    )
    vi.mocked(SdConfigService.agents).mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(await sdCreateTicketTaskTool.execute(ctx, args), 'SD_NOT_AGENT')
    tasks.create.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await sdCreateTicketTaskTool.execute(ctx, { ticket: '42', title: 'X' }),
      'SD_NOT_AGENT',
    )
    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({ phase: { ...sdTicketDTO().phase, category: 'CLOSED' } }),
      ),
    )
    expectErr(
      await sdCreateTicketTaskTool.execute(ctx, { ticket: '42', title: 'X' }),
      'SD_TICKET_CLOSED',
    )
    expectErr(
      await sdPreview(sdCreateTicketTaskTool, ctx, {
        ticket: '42',
        title: 'X',
      }),
      'SD_TICKET_CLOSED',
    )
  })
})

describe('sd_complete_ticket_task / sd_delete_ticket_task', () => {
  it('should resolve the task by title and preview completion', async () => {
    tasks.list.mockResolvedValue(taskList())
    const preview = expectOk(
      await sdPreview(sdCompleteTicketTaskTool, ctx, {
        ticket: '42',
        task: 'reiniciar o serviço',
      }),
    )
    expect(preview.fields).toEqual([
      { label: 'Situação', before: 'A fazer', after: 'Concluída' },
    ])
  })

  it('should refuse completing a done task and ambiguous titles', async () => {
    tasks.list.mockResolvedValue(taskList([sdTaskDTO({ status: 'DONE' })]))
    expectErr(
      await sdPreview(sdCompleteTicketTaskTool, ctx, {
        ticket: '42',
        task: 'task-1',
      }),
      'VALIDATION_ERROR',
    )
    tasks.list.mockResolvedValue(
      taskList([
        sdTaskDTO({ title: 'Backup A' }),
        sdTaskDTO({ id: 'task-2', title: 'Backup B' }),
      ]),
    )
    const error = expectErr(
      await sdPreview(sdCompleteTicketTaskTool, ctx, {
        ticket: '42',
        task: 'backup',
      }),
    )
    expect(error.message).toContain('ambíguo para a tarefa')
    tasks.list.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await sdPreview(sdCompleteTicketTaskTool, ctx, {
        ticket: '42',
        task: 'x',
      }),
      'SD_NOT_AGENT',
    )
    tickets.get.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await sdPreview(sdCompleteTicketTaskTool, ctx, {
        ticket: '42',
        task: 'x',
      }),
      'SD_TICKET_NOT_FOUND',
    )
  })

  it('should complete the task through the service', async () => {
    tasks.list.mockResolvedValue(taskList())
    tasks.update.mockResolvedValue(ok(sdTaskDTO({ status: 'DONE' })))
    const out = expectOk(
      await sdCompleteTicketTaskTool.execute(ctx, {
        ticket: '42',
        task: 'task-1',
      }),
    )
    expect(out.summary).toBe('Tarefa “Reiniciar o serviço” concluída')
    expect(tasks.update).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      'ticket-1',
      'task-1',
      { status: 'DONE' },
    )
    tasks.update.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await sdCompleteTicketTaskTool.execute(ctx, {
        ticket: '42',
        task: 'task-1',
      }),
      'DATABASE_ERROR',
    )
    tasks.list.mockResolvedValue(taskList([]))
    expectErr(
      await sdCompleteTicketTaskTool.execute(ctx, {
        ticket: '42',
        task: 'task-1',
      }),
      'VALIDATION_ERROR',
    )
  })

  it('should preview and delete a task', async () => {
    tasks.list.mockResolvedValue(taskList())
    const preview = expectOk(
      await sdPreview(sdDeleteTicketTaskTool, ctx, {
        ticket: '42',
        task: 'task-1',
      }),
    )
    expect(preview.title).toBe(
      'Excluir a tarefa “Reiniciar o serviço” — INC-000042',
    )
    expect(preview.fields).toEqual([
      { label: 'Tarefa', before: 'Reiniciar o serviço', after: null },
      { label: 'Situação', before: 'A fazer' },
    ])
    tasks.remove.mockResolvedValue(ok(undefined))
    const out = expectOk(
      await sdDeleteTicketTaskTool.execute(ctx, {
        ticket: '42',
        task: 'task-1',
      }),
    )
    expect(out.data).toEqual({ taskId: 'task-1', deleted: true })
    expect(tasks.remove).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      'ticket-1',
      'task-1',
    )
    tasks.remove.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await sdDeleteTicketTaskTool.execute(ctx, {
        ticket: '42',
        task: 'task-1',
      }),
      'SD_NOT_AGENT',
    )
    tasks.list.mockResolvedValue(taskList([]))
    expectErr(
      await sdPreview(sdDeleteTicketTaskTool, ctx, { ticket: '42', task: 'x' }),
      'VALIDATION_ERROR',
    )
    expectErr(
      await sdDeleteTicketTaskTool.execute(ctx, { ticket: '42', task: 'x' }),
      'VALIDATION_ERROR',
    )
  })
})

describe('sd_request_approval', () => {
  const parse = (args: Record<string, unknown>) =>
    expectOk(sdRequestApprovalTool.parse(args))

  it('should validate approvers and expiry', () => {
    expectErr(
      sdRequestApprovalTool.parse({ ticket: '42', approvers: [] }),
      'VALIDATION_ERROR',
    )
    expectErr(
      sdRequestApprovalTool.parse({
        ticket: '42',
        approvers: ['a'],
        expiresInDays: 90,
      }),
      'VALIDATION_ERROR',
    )
    expect(parse({ ticket: '42', approvers: ['a'] }).expiresInDays).toBe(7)
  })

  it('should mix members and external e-mails in the preview', async () => {
    const preview = expectOk(
      await sdPreview(
        sdRequestApprovalTool,
        ctx,
        parse({
          ticket: '42',
          approvers: ['Bruno Lima', 'Diretor@Externo.com'],
          message: 'Aprovar a troca',
          expiresInDays: 3,
        }),
      ),
    )
    expect(preview.summary).toContain('e-mail com link de aprovação')
    expect(preview.fields).toEqual([
      {
        label: 'Aprovadores',
        after: 'Bruno Lima <bruno@acme.com>; diretor@externo.com (externo)',
      },
      { label: 'Validade', after: '3 dia(s)' },
      { label: 'Mensagem', after: 'Aprovar a troca' },
    ])
  })

  it('should refuse ambiguous names and unknown non-e-mails', async () => {
    expectErr(
      await sdPreview(
        sdRequestApprovalTool,
        ctx,
        parse({ ticket: '42', approvers: ['brun'] }),
      ),
      'VALIDATION_ERROR',
    )
    expectErr(
      await sdPreview(
        sdRequestApprovalTool,
        ctx,
        parse({ ticket: '42', approvers: ['Diretoria'] }),
      ),
      'VALIDATION_ERROR',
    )
    vi.mocked(SdConfigService.agents).mockResolvedValueOnce(
      err(databaseError('x')),
    )
    expectErr(
      await sdPreview(
        sdRequestApprovalTool,
        ctx,
        parse({ ticket: '42', approvers: ['me'] }),
      ),
      'DATABASE_ERROR',
    )
    tickets.get.mockResolvedValueOnce(err(sdTicketNotFound()))
    expectErr(
      await sdPreview(
        sdRequestApprovalTool,
        ctx,
        parse({ ticket: '42', approvers: ['me'] }),
      ),
      'SD_TICKET_NOT_FOUND',
    )
  })

  it('should report invalid e-mails via the approval schema', async () => {
    expectErr(
      await sdPreview(
        sdRequestApprovalTool,
        ctx,
        parse({ ticket: '42', approvers: ['a@b.c'] }),
      ),
      'VALIDATION_ERROR',
    )
  })

  it('should request the approval and count sent e-mails', async () => {
    vi.mocked(SdTicketApprovalService.request).mockResolvedValue(
      ok([
        sdApprovalDTO(),
        sdApprovalDTO({
          id: 'a2',
          approverName: null,
          approverEmail: 'x@y.com',
          sentAt: null,
        }),
      ]),
    )
    const args = parse({ ticket: '42', approvers: ['me', 'x@y.com'] })
    const out = expectOk(await sdRequestApprovalTool.execute(ctx, args))
    expect(out.summary).toBe(
      'Aprovação pedida a 2 aprovador(es) (1 e-mail(s) enviado(s))',
    )
    expect(SdTicketApprovalService.request).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      'ticket-1',
      {
        approvers: [{ userId: 'user-me' }, { email: 'x@y.com' }],
        message: null,
        expiresInDays: 7,
      },
    )
    vi.mocked(SdTicketApprovalService.request).mockResolvedValue(
      err(sdNotAgent()),
    )
    expectErr(await sdRequestApprovalTool.execute(ctx, args), 'SD_NOT_AGENT')
    expectErr(
      await sdRequestApprovalTool.execute(
        ctx,
        parse({ ticket: '42', approvers: ['brun'] }),
      ),
      'VALIDATION_ERROR',
    )
  })
})

describe('sd_link_kb_article', () => {
  beforeEach(() => {
    vi.mocked(SdKbArticleService.search).mockResolvedValue(
      ok([sdKbSearchDTO()]),
    )
    vi.mocked(SdKbTicketLinkService.listForTicket).mockResolvedValue(ok([]))
  })

  it('should preview and link an article found by title', async () => {
    const args = { ticket: '42', article: 'Como reiniciar' }
    const preview = expectOk(await sdPreview(sdLinkKbArticleTool, ctx, args))
    expect(preview.fields).toEqual([
      { label: 'Artigo', after: 'Como reiniciar o servidor de e-mail' },
    ])
    vi.mocked(SdKbTicketLinkService.link).mockResolvedValue(ok(link()))
    const out = expectOk(await sdLinkKbArticleTool.execute(ctx, args))
    expect(out.data).toMatchObject({
      articleHref: '/acme/servicedesk/knowledge/kb-1',
    })
    expect(SdKbTicketLinkService.link).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      'ticket-1',
      'kb-1',
    )
  })

  it('should refuse already linked articles and surface errors', async () => {
    const args = { ticket: '42', article: 'Como reiniciar' }
    vi.mocked(SdKbTicketLinkService.listForTicket).mockResolvedValue(
      ok([link()]),
    )
    expectErr(
      await sdPreview(sdLinkKbArticleTool, ctx, args),
      'VALIDATION_ERROR',
    )
    vi.mocked(SdKbTicketLinkService.listForTicket).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await sdPreview(sdLinkKbArticleTool, ctx, args), 'DATABASE_ERROR')
    vi.mocked(SdKbArticleService.search).mockResolvedValue(ok([]))
    expectErr(
      await sdPreview(sdLinkKbArticleTool, ctx, args),
      'VALIDATION_ERROR',
    )
    tickets.get.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await sdLinkKbArticleTool.execute(ctx, args),
      'SD_TICKET_NOT_FOUND',
    )
  })

  it('should surface link and slug errors on execute', async () => {
    const args = { ticket: '42', article: 'Como reiniciar' }
    vi.mocked(SdKbTicketLinkService.link).mockResolvedValue(err(sdNotAgent()))
    expectErr(await sdLinkKbArticleTool.execute(ctx, args), 'SD_NOT_AGENT')
    vi.mocked(SdKbTicketLinkService.link).mockResolvedValue(ok(link()))
    vi.mocked(WorkspaceRepository.findById)
      .mockResolvedValueOnce(ok({ slug: 'acme' } as never))
      .mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await sdLinkKbArticleTool.execute(ctx, args), 'DATABASE_ERROR')
  })
})

describe('sd_link_config_item', () => {
  beforeEach(() => {
    vi.mocked(SdConfigItemService.list).mockResolvedValue(
      ok({ items: [sdConfigItemDTO()], total: 1, page: 1, pageSize: 10 }),
    )
  })

  it('should preview and link a CI found by code', async () => {
    const args = { ticket: '42', configItem: 'CI-001' }
    const preview = expectOk(await sdPreview(sdLinkConfigItemTool, ctx, args))
    expect(preview.title).toBe('Vincular item de configuração — INC-000042')
    expect(preview.fields).toEqual([
      { label: 'Item de configuração', before: null, after: 'srv-mail-01' },
    ])
    tickets.update.mockResolvedValue(
      ok(
        sdTicketDTO({
          configItem: { id: 'ci-1', name: 'srv-mail-01', code: null },
        }),
      ),
    )
    const out = expectOk(await sdLinkConfigItemTool.execute(ctx, args))
    expect(out.summary).toBe('srv-mail-01 vinculado a INC-000042')
    expect(tickets.update).toHaveBeenCalledWith('user-me', 'ws1', 'ticket-1', {
      configItemId: 'ci-1',
    })
  })

  it('should unlink with "none" and refuse no-ops', async () => {
    const args = { ticket: '42', configItem: 'none' }
    expectErr(
      await sdPreview(sdLinkConfigItemTool, ctx, args),
      'VALIDATION_ERROR',
    )
    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({
          configItem: { id: 'ci-1', name: 'srv-mail-01', code: null },
        }),
      ),
    )
    const preview = expectOk(await sdPreview(sdLinkConfigItemTool, ctx, args))
    expect(preview.title).toBe('Remover item de configuração — INC-000042')
    tickets.update.mockResolvedValue(ok(sdTicketDTO()))
    const out = expectOk(await sdLinkConfigItemTool.execute(ctx, args))
    expect(out.summary).toBe('Item de configuração removido de INC-000042')
    expect(tickets.update).toHaveBeenCalledWith('user-me', 'ws1', 'ticket-1', {
      configItemId: null,
    })
    expectErr(
      await sdPreview(sdLinkConfigItemTool, ctx, {
        ticket: '42',
        configItem: 'srv-mail-01',
      }),
      'VALIDATION_ERROR',
    )
  })

  it('should surface lookup and update errors', async () => {
    vi.mocked(SdConfigItemService.list).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(
      await sdPreview(sdLinkConfigItemTool, ctx, {
        ticket: '42',
        configItem: 'srv',
      }),
      'DATABASE_ERROR',
    )
    tickets.get.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await sdLinkConfigItemTool.execute(ctx, {
        ticket: '42',
        configItem: 'srv',
      }),
      'SD_TICKET_NOT_FOUND',
    )
    tickets.get.mockResolvedValue(ok(sdTicketDTO()))
    vi.mocked(SdConfigItemService.list).mockResolvedValue(
      ok({ items: [sdConfigItemDTO()], total: 1, page: 1, pageSize: 10 }),
    )
    tickets.update.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await sdLinkConfigItemTool.execute(ctx, {
        ticket: '42',
        configItem: 'srv',
      }),
      'SD_NOT_AGENT',
    )
  })
})
