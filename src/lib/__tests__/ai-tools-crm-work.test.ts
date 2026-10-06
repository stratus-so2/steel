import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crmAssignOwnerTool } from '@/src/lib/ai/tools/crm/assign'
import {
  crmCreateNoteTool,
  crmCreateTaskTool,
  crmDeleteNoteTool,
  crmDeleteTaskTool,
  crmListTasksTool,
  crmUpdateNoteTool,
  crmUpdateTaskTool,
} from '@/src/lib/ai/tools/crm/work'
import { err, ok } from '@/src/lib/result'
import { CrmNoteRepository } from '@/src/repositories/crm-note.repository'
import { CrmTaskRepository } from '@/src/repositories/crm-task.repository'
import { assertModuleMember } from '@/src/services/authz'
import { CrmCompanyService } from '@/src/services/crm-company.service'
import { CrmLeadService } from '@/src/services/crm-lead.service'
import { CrmMemberService } from '@/src/services/crm-member.service'
import { CrmNoteService } from '@/src/services/crm-note.service'
import { CrmOpportunityService } from '@/src/services/crm-opportunity.service'
import { CrmTaskService } from '@/src/services/crm-task.service'
import {
  company,
  dbErr,
  expectErr,
  expectOk,
  forbiddenErr,
  lead,
  ME,
  noteRow,
  opportunity,
  previewOf,
  run,
  taskDto,
  taskRow,
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
vi.mock('@/src/services/authz', () => ({ assertModuleMember: vi.fn() }))
vi.mock('@/src/repositories/crm-task.repository', () => ({
  CrmTaskRepository: { findById: vi.fn() },
}))
vi.mock('@/src/repositories/crm-note.repository', () => ({
  CrmNoteRepository: { findById: vi.fn() },
}))
vi.mock('@/src/services/crm-task.service', () => ({
  CrmTaskService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))
vi.mock('@/src/services/crm-note.service', () => ({
  CrmNoteService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))
vi.mock('@/src/services/crm-lead.service', () => ({
  CrmLeadService: { getById: vi.fn(), update: vi.fn() },
}))
vi.mock('@/src/services/crm-opportunity.service', () => ({
  CrmOpportunityService: { getById: vi.fn(), update: vi.fn() },
}))
vi.mock('@/src/services/crm-company.service', () => ({
  CrmCompanyService: { list: vi.fn(), getById: vi.fn(), update: vi.fn() },
}))
vi.mock('@/src/services/crm-person.service', () => ({
  CrmPersonService: { list: vi.fn(), getById: vi.fn() },
}))

const tasks = vi.mocked(CrmTaskService)
const notes = vi.mocked(CrmNoteService)

type Page = { total: number; items: Array<Record<string, unknown>> }

beforeEach(() => {
  wireDefaults()
  vi.mocked(assertModuleMember).mockResolvedValue(ok({} as never))
  vi.mocked(CrmTaskRepository.findById).mockResolvedValue(ok(taskRow()))
  vi.mocked(CrmNoteRepository.findById).mockResolvedValue(ok(noteRow()))
})

describe('crm_list_tasks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-06T15:00:00.000Z'))
    tasks.list.mockResolvedValue(
      ok([
        taskDto({ id: 't_none', dueDate: null }),
        taskDto({
          id: 't_overdue',
          dueDate: '2026-10-01T00:00:00.000Z',
          body: 'x'.repeat(300),
        }),
        taskDto({
          id: 't_done_old',
          status: 'DONE',
          dueDate: '2026-09-01T00:00:00.000Z',
          assigneeId: 'user_bruno',
        }),
        taskDto({ id: 't_today', dueDate: '2026-10-06T20:00:00.000Z' }),
        taskDto({
          id: 't_week',
          dueDate: '2026-10-10T00:00:00.000Z',
          assigneeId: null,
        }),
      ]),
    )
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const ids = (out: { data: unknown }) =>
    (out.data as Page).items.map((i) => i.id)

  it('sorts by due date (no date last) and flags overdue tasks', async () => {
    const out = expectOk(await run(crmListTasksTool, {}))
    expect(ids(out)).toEqual([
      't_done_old',
      't_overdue',
      't_today',
      't_week',
      't_none',
    ])
    const overdue = (out.data as Page).items[1]
    expect(overdue).toMatchObject({
      overdue: true,
      statusLabel: 'A fazer',
      assigneeName: 'Ana Souza',
      href: '/acme/crm/tasks?record=t_overdue',
    })
    expect(String(overdue.body)).toHaveLength(200)
    expect((out.data as Page).items[0]).toMatchObject({ overdue: false })
  })

  it('filters by due window', async () => {
    expect(
      ids(expectOk(await run(crmListTasksTool, { due: 'overdue' }))),
    ).toEqual(['t_overdue'])
    expect(
      ids(expectOk(await run(crmListTasksTool, { due: 'today' }))),
    ).toEqual(['t_today'])
    expect(
      ids(expectOk(await run(crmListTasksTool, { due: 'next_7_days' }))),
    ).toEqual(['t_today', 't_week'])
    expect(
      ids(expectOk(await run(crmListTasksTool, { due: 'no_date' }))),
    ).toEqual(['t_none'])
  })

  it('filters "my tasks" and passes link filters to the service', async () => {
    const mine = expectOk(
      await run(crmListTasksTool, {
        assignee: 'me',
        status: 'TODO',
        opportunityId: 'opp_1',
        query: 'ligar',
      }),
    )
    expect(ids(mine)).not.toContain('t_done_old')
    expect(ids(mine)).not.toContain('t_week')
    expect(tasks.list).toHaveBeenCalledWith(ME, WS, {
      status: 'TODO',
      companyId: undefined,
      personId: undefined,
      opportunityId: 'opp_1',
    })
  })

  it('maps assignee and service errors', async () => {
    expectErr(
      await run(crmListTasksTool, { assignee: 'lima' }),
      'VALIDATION_ERROR',
    )
    tasks.list.mockResolvedValue(err(forbiddenErr))
    expectErr(await run(crmListTasksTool, {}), 'FORBIDDEN')
    expectErr(crmListTasksTool.parse({ due: 'yesterday' }), 'VALIDATION_ERROR')
  })
})

describe('crm_create_task', () => {
  it('previews with the assignee name and creates with its id', async () => {
    const args = {
      title: 'Enviar proposta',
      dueDate: '2026-10-09',
      assignee: 'bruno@acme.com',
      body: 'Detalhes',
      opportunityId: 'opp_1',
    }
    const preview = expectOk(await previewOf(crmCreateTaskTool, args))
    expect(preview.fields).toEqual(
      expect.arrayContaining([
        { label: 'Status', after: 'A fazer' },
        { label: 'Prazo', after: '09/10/2026' },
        { label: 'Responsável', after: 'Bruno Lima' },
        { label: 'Oportunidade (id)', after: 'opp_1' },
      ]),
    )
    tasks.create.mockResolvedValue(ok(taskDto({ id: 't_new' })))
    const out = expectOk(await run(crmCreateTaskTool, args))
    expect(tasks.create).toHaveBeenCalledWith(ME, WS, {
      title: 'Enviar proposta',
      body: 'Detalhes',
      status: 'TODO',
      dueDate: new Date('2026-10-09'),
      opportunityId: 'opp_1',
      assigneeId: 'user_bruno',
    })
    expect(out.target?.href).toBe('/acme/crm/tasks?record=t_new')
  })

  it('creates without assignee and maps errors', async () => {
    tasks.create.mockResolvedValue(ok(taskDto()))
    expectOk(await run(crmCreateTaskTool, { title: 'X' }))
    expect(tasks.create).toHaveBeenCalledWith(
      ME,
      WS,
      expect.objectContaining({ assigneeId: undefined }),
    )
    expectErr(
      await previewOf(crmCreateTaskTool, { title: 'X', assignee: 'Zé' }),
      'RESOURCE_NOT_FOUND',
    )
    expectErr(
      await run(crmCreateTaskTool, { title: 'X', assignee: 'Zé' }),
      'RESOURCE_NOT_FOUND',
    )
    tasks.create.mockResolvedValue(err(dbErr))
    expectErr(await run(crmCreateTaskTool, { title: 'X' }), 'DATABASE_ERROR')
  })
})

describe('crm_update_task', () => {
  it('previews completion with before → after', async () => {
    const preview = expectOk(
      await previewOf(crmUpdateTaskTool, {
        taskId: 'task_1',
        status: 'DONE',
        dueDate: '2026-10-07',
        body: 'Feito',
      }),
    )
    expect(preview.title).toBe('Concluir a tarefa “Ligar para o cliente”')
    expect(preview.fields).toEqual([
      { label: 'Descrição', before: null, after: 'Feito' },
      { label: 'Status', before: 'A fazer', after: 'Concluída' },
      { label: 'Prazo', before: null, after: '07/10/2026' },
    ])
  })

  it('checks permission before reading the task', async () => {
    vi.mocked(assertModuleMember).mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmUpdateTaskTool, { taskId: 'task_1', title: 'Y' }),
      'FORBIDDEN',
    )
    expect(CrmTaskRepository.findById).not.toHaveBeenCalled()
  })

  it('refuses a no-op and a missing task', async () => {
    const preview = expectOk(
      await previewOf(crmUpdateTaskTool, { taskId: 'task_1', title: 'Outro' }),
    )
    expect(preview.title).toBe('Atualizar a tarefa “Ligar para o cliente”')
    expectErr(
      await previewOf(crmUpdateTaskTool, { taskId: 'task_1', status: 'TODO' }),
      'VALIDATION_ERROR',
    )
    vi.mocked(CrmTaskRepository.findById).mockResolvedValue(
      err({ code: 'RESOURCE_NOT_FOUND', message: 'x' }),
    )
    expectErr(
      await previewOf(crmUpdateTaskTool, { taskId: 'nope', title: 'Y' }),
      'RESOURCE_NOT_FOUND',
    )
    expectErr(crmUpdateTaskTool.parse({ taskId: 'task_1' }), 'VALIDATION_ERROR')
  })

  it('executes and maps errors', async () => {
    tasks.update.mockResolvedValue(ok(taskDto({ status: 'DONE' })))
    const out = expectOk(
      await run(crmUpdateTaskTool, { taskId: 'task_1', status: 'DONE' }),
    )
    expect(tasks.update).toHaveBeenCalledWith(ME, WS, 'task_1', {
      status: 'DONE',
    })
    expect(out.data).toMatchObject({ statusLabel: 'Concluída' })
    tasks.update.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmUpdateTaskTool, { taskId: 'task_1', status: 'DONE' }),
      'DATABASE_ERROR',
    )
  })
})

describe('crm_delete_task', () => {
  it('previews, deletes and maps errors', async () => {
    const preview = expectOk(
      await previewOf(crmDeleteTaskTool, { taskId: 'task_1' }),
    )
    expect(preview.fields).toEqual([{ label: 'Status', after: 'A fazer' }])
    tasks.remove.mockResolvedValue(ok(undefined))
    expect(
      expectOk(await run(crmDeleteTaskTool, { taskId: 'task_1' })).data,
    ).toEqual({ id: 'task_1', deleted: true })
    tasks.remove.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmDeleteTaskTool, { taskId: 'task_1' }),
      'DATABASE_ERROR',
    )
    vi.mocked(CrmTaskRepository.findById).mockResolvedValue(err(dbErr))
    expectErr(
      await previewOf(crmDeleteTaskTool, { taskId: 'task_1' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await run(crmDeleteTaskTool, { taskId: 'task_1' }),
      'DATABASE_ERROR',
    )
  })
})

describe('notes', () => {
  it('create requires a title or body, previews and creates', async () => {
    expectErr(crmCreateNoteTool.parse({ companyId: 'c' }), 'VALIDATION_ERROR')
    const preview = expectOk(
      await previewOf(crmCreateNoteTool, {
        body: 'Ligação feita',
        companyId: 'c1',
      }),
    )
    expect(preview.title).toBe('Criar a nota “Ligação feita”')
    expect(preview.target).toEqual({ type: 'crm_note', label: 'Nota' })

    notes.create.mockResolvedValue(ok({ ...noteDto(), title: null }))
    const out = expectOk(
      await run(crmCreateNoteTool, { body: 'Ligação feita', companyId: 'c1' }),
    )
    expect(notes.create).toHaveBeenCalledWith(ME, WS, {
      body: 'Ligação feita',
      companyId: 'c1',
    })
    expect(out.summary).toBe('Nota “Cliente pediu desconto” criada')
    notes.create.mockResolvedValue(err(dbErr))
    expectErr(await run(crmCreateNoteTool, { title: 'X' }), 'DATABASE_ERROR')
  })

  it('update previews the text change and executes', async () => {
    const preview = expectOk(
      await previewOf(crmUpdateNoteTool, {
        noteId: 'note_1',
        body: 'Novo texto',
      }),
    )
    expect(preview.fields).toEqual([
      { label: 'Texto', before: 'Cliente pediu desconto', after: 'Novo texto' },
    ])
    expectErr(
      await previewOf(crmUpdateNoteTool, {
        noteId: 'note_1',
        title: 'Reunião',
      }),
      'VALIDATION_ERROR',
    )
    expectErr(crmUpdateNoteTool.parse({ noteId: 'note_1' }), 'VALIDATION_ERROR')

    notes.update.mockResolvedValue(ok(noteDto()))
    expectOk(await run(crmUpdateNoteTool, { noteId: 'note_1', title: null }))
    expect(notes.update).toHaveBeenCalledWith(ME, WS, 'note_1', { title: null })
    notes.update.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmUpdateNoteTool, { noteId: 'note_1', title: null }),
      'DATABASE_ERROR',
    )
    vi.mocked(assertModuleMember).mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmUpdateNoteTool, { noteId: 'note_1', title: 'X' }),
      'FORBIDDEN',
    )
  })

  it('delete previews, deletes and maps errors', async () => {
    vi.mocked(CrmNoteRepository.findById).mockResolvedValue(
      ok(noteRow({ title: null, body: null })),
    )
    const preview = expectOk(
      await previewOf(crmDeleteNoteTool, { noteId: 'note_1' }),
    )
    expect(preview.title).toBe('Excluir a nota “Nota sem título”')
    notes.remove.mockResolvedValue(ok(undefined))
    expect(
      expectOk(await run(crmDeleteNoteTool, { noteId: 'note_1' })).data,
    ).toEqual({ id: 'note_1', deleted: true })
    notes.remove.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmDeleteNoteTool, { noteId: 'note_1' }),
      'DATABASE_ERROR',
    )
    vi.mocked(CrmNoteRepository.findById).mockResolvedValue(err(dbErr))
    expectErr(
      await previewOf(crmDeleteNoteTool, { noteId: 'note_1' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await run(crmDeleteNoteTool, { noteId: 'note_1' }),
      'DATABASE_ERROR',
    )
  })
})

function noteDto() {
  return {
    id: 'note_1',
    title: 'Reunião',
    body: 'Cliente pediu desconto',
    companyId: null,
    personId: null,
    opportunityId: null,
    leadId: null,
    workspaceId: WS,
    createdById: ME,
    updatedById: null,
    position: 0,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
  }
}

describe('crm_assign_owner', () => {
  beforeEach(() => {
    vi.mocked(CrmLeadService.getById).mockResolvedValue(ok(lead()))
    vi.mocked(CrmOpportunityService.getById).mockResolvedValue(
      ok(opportunity({ ownerId: null })),
    )
    vi.mocked(CrmCompanyService.getById).mockResolvedValue(
      ok(company({ accountOwnerId: 'user_bruno' })),
    )
  })

  it('requires the owner key (null to unassign)', () => {
    expectErr(
      crmAssignOwnerTool.parse({ recordType: 'lead', recordId: 'lead_1' }),
      'VALIDATION_ERROR',
    )
    expectOk(
      crmAssignOwnerTool.parse({
        recordType: 'lead',
        recordId: 'lead_1',
        owner: null,
      }),
    )
  })

  it('previews a reassignment of a lead', async () => {
    const preview = expectOk(
      await previewOf(crmAssignOwnerTool, {
        recordType: 'lead',
        recordId: 'lead_1',
        owner: 'Bruno Lima',
      }),
    )
    expect(preview.title).toBe('Atribuir o lead “Carlos Pereira” a Bruno Lima')
    expect(preview.fields).toEqual([
      { label: 'Responsável', before: 'Ana Souza', after: 'Bruno Lima' },
    ])
    expect(preview.target?.href).toBe('/acme/crm/leads?record=lead_1')
  })

  it('previews unassigning a company and an unknown current owner', async () => {
    const preview = expectOk(
      await previewOf(crmAssignOwnerTool, {
        recordType: 'company',
        recordId: 'company_1',
        owner: null,
      }),
    )
    expect(preview.title).toBe('Remover o responsável da empresa “Acme Ltda”')
    vi.mocked(CrmMemberService.list).mockResolvedValueOnce(ok([]))
    const unknown = expectOk(
      await previewOf(crmAssignOwnerTool, {
        recordType: 'company',
        recordId: 'company_1',
        owner: null,
      }),
    )
    expect(unknown.fields?.[0].before).toBe('user_bruno')
  })

  it('refuses a no-op assignment', async () => {
    expectErr(
      await previewOf(crmAssignOwnerTool, {
        recordType: 'lead',
        recordId: 'lead_1',
        owner: 'me',
      }),
      'VALIDATION_ERROR',
    )
    const error = expectErr(
      await previewOf(crmAssignOwnerTool, {
        recordType: 'opportunity',
        recordId: 'opp_1',
        owner: null,
      }),
      'VALIDATION_ERROR',
    )
    expect(error.message).toContain('sem responsável')
  })

  it('assigns each record type through its own service', async () => {
    vi.mocked(CrmLeadService.update).mockResolvedValue(ok(lead()))
    vi.mocked(CrmOpportunityService.update).mockResolvedValue(ok(opportunity()))
    vi.mocked(CrmCompanyService.update).mockResolvedValue(ok(company()))
    tasks.update.mockResolvedValue(ok(taskDto()))

    const out = expectOk(
      await run(crmAssignOwnerTool, {
        recordType: 'lead',
        recordId: 'lead_1',
        owner: 'bruno@acme.com',
      }),
    )
    expect(CrmLeadService.update).toHaveBeenCalledWith(ME, WS, 'lead_1', {
      ownerId: 'user_bruno',
    })
    expect(out.summary).toBe('“Carlos Pereira” atribuído a Bruno Lima')

    await run(crmAssignOwnerTool, {
      recordType: 'opportunity',
      recordId: 'opp_1',
      owner: 'me',
    })
    expect(CrmOpportunityService.update).toHaveBeenCalledWith(ME, WS, 'opp_1', {
      ownerId: ME,
    })

    const removed = expectOk(
      await run(crmAssignOwnerTool, {
        recordType: 'company',
        recordId: 'company_1',
        owner: null,
      }),
    )
    expect(CrmCompanyService.update).toHaveBeenCalledWith(ME, WS, 'company_1', {
      accountOwnerId: null,
      address: undefined,
    })
    expect(removed.summary).toBe('Responsável removido de “Acme Ltda”')

    await run(crmAssignOwnerTool, {
      recordType: 'task',
      recordId: 'task_1',
      owner: 'Bruno Lima',
    })
    expect(tasks.update).toHaveBeenCalledWith(ME, WS, 'task_1', {
      assigneeId: 'user_bruno',
    })
  })

  it('maps lookup, member and update errors', async () => {
    vi.mocked(CrmLeadService.getById).mockResolvedValue(err(forbiddenErr))
    vi.mocked(CrmOpportunityService.getById).mockResolvedValue(
      err(forbiddenErr),
    )
    vi.mocked(CrmCompanyService.getById).mockResolvedValue(err(forbiddenErr))
    vi.mocked(assertModuleMember).mockResolvedValueOnce(err(forbiddenErr))
    for (const recordType of ['lead', 'opportunity', 'company', 'task']) {
      expectErr(
        await previewOf(crmAssignOwnerTool, {
          recordType,
          recordId: 'x',
          owner: 'me',
        }),
        'FORBIDDEN',
      )
    }
    vi.mocked(CrmTaskRepository.findById).mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmAssignOwnerTool, {
        recordType: 'task',
        recordId: 'x',
        owner: 'me',
      }),
      'DATABASE_ERROR',
    )

    vi.mocked(CrmLeadService.getById).mockResolvedValue(ok(lead()))
    expectErr(
      await run(crmAssignOwnerTool, {
        recordType: 'lead',
        recordId: 'lead_1',
        owner: 'lima',
      }),
      'VALIDATION_ERROR',
    )
    vi.mocked(CrmLeadService.update).mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmAssignOwnerTool, {
        recordType: 'lead',
        recordId: 'lead_1',
        owner: 'Bruno Lima',
      }),
      'DATABASE_ERROR',
    )
    vi.mocked(CrmMemberService.list).mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmAssignOwnerTool, {
        recordType: 'lead',
        recordId: 'lead_1',
        owner: 'me',
      }),
      'FORBIDDEN',
    )
  })
})
