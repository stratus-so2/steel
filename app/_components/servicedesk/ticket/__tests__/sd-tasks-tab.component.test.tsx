import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdTicketTaskDTO } from '@/types/sd-ticket-task'
import { SdTicketTasksTab } from '../tabs/tasks-tab'
import {
  AGENTS,
  stubEventSource,
  TAB_URL,
  TICKET_ID,
  tabProps,
  user,
} from './sd-ticket-tab-fixtures'

function task(overrides: Partial<SdTicketTaskDTO> = {}): SdTicketTaskDTO {
  return {
    id: 'k1',
    ticketId: TICKET_ID,
    title: 'Trocar cabo',
    description: null,
    status: 'TODO',
    assignee: null,
    dueDate: null,
    completedAt: null,
    position: 0,
    overdue: false,
    createdBy: null,
    createdAt: '2026-09-21T12:00:00.000Z',
    updatedAt: '2026-09-21T12:00:00.000Z',
    ...overrides,
  }
}

const LIST = {
  items: [
    task(),
    task({
      id: 'k2',
      title: 'Atualizar firmware',
      status: 'DONE',
      completedAt: '2026-09-21T15:00:00.000Z',
      assignee: user('u-agent', 'Ana Agente'),
    }),
    task({
      id: 'k3',
      title: 'Ligar para o cliente',
      dueDate: '2026-09-01T12:00:00.000Z',
      overdue: true,
      description: 'Confirmar horário',
    }),
  ],
  progress: { done: 1, total: 3, percent: 33 },
}

function routes() {
  return mockFetch([
    { match: `${TAB_URL}/tasks`, data: LIST },
    { match: '/servicedesk/agents', data: AGENTS },
    { method: 'POST', match: `${TAB_URL}/tasks`, data: task({ id: 'new' }) },
    { method: 'PATCH', match: `${TAB_URL}/tasks/`, data: task() },
    { method: 'DELETE', match: `${TAB_URL}/tasks/`, data: null },
  ])
}

beforeEach(() => {
  stubEventSource()
})

describe('SdTicketTasksTab', () => {
  it('renders progress, overdue and completed tasks', async () => {
    routes()
    renderWithQuery(<SdTicketTasksTab {...tabProps('agent')} />)
    expect(await screen.findByText('Trocar cabo')).toBeTruthy()
    expect(screen.getByText('1/3 concluídas · 33%')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '33',
    )
    expect(screen.getByText(/atrasada/)).toBeTruthy()
    expect(screen.getByText(/Concluída em/)).toBeTruthy()
    expect(screen.getByText('Confirmar horário')).toBeTruthy()
  })

  it('quick-adds a task', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketTasksTab {...tabProps('agent')} />)
    await screen.findByText('Trocar cabo')
    fireEvent.change(screen.getByLabelText('Nova tarefa'), {
      target: { value: 'Testar link' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/tasks`)).toEqual({
        title: 'Testar link',
      }),
    )
  })

  it('creates a detailed task from the dialog', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketTasksTab {...tabProps('agent')} />)
    await screen.findByText('Trocar cabo')
    fireEvent.click(screen.getByRole('button', { name: 'Detalhada' }))
    fireEvent.change(await screen.findByLabelText('Título da tarefa'), {
      target: { value: 'Visita' },
    })
    fireEvent.change(screen.getByLabelText('Prazo da tarefa'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('Descrição da tarefa'), {
      target: { value: 'Levar notebook' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/tasks`)).toEqual({
        title: 'Visita',
        description: 'Levar notebook',
        assigneeId: null,
        dueDate: '2026-10-01T12:00:00.000Z',
      }),
    )
  })

  it('completes a task and changes status', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketTasksTab {...tabProps('agent')} />)
    await screen.findByText('Trocar cabo')
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Concluir Trocar cabo' }),
    )
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/tasks/k1`, 'PATCH')).toEqual({
        status: 'DONE',
      }),
    )
    fireEvent.change(screen.getByLabelText('Status de Atualizar firmware'), {
      target: { value: 'CANCELED' },
    })
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/tasks/k2`, 'PATCH')).toEqual({
        status: 'CANCELED',
      }),
    )
  })

  it('edits a task', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketTasksTab {...tabProps('agent')} />)
    await screen.findByText('Trocar cabo')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Trocar cabo' }))
    const title = (await screen.findByLabelText(
      'Título da tarefa',
    )) as HTMLInputElement
    expect(title.value).toBe('Trocar cabo')
    fireEvent.change(title, { target: { value: 'Trocar cabo CAT6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/tasks/k1`, 'PATCH')).toMatchObject({
        title: 'Trocar cabo CAT6',
      }),
    )
  })

  it('is agent-only', () => {
    const spy = routes()
    renderWithQuery(<SdTicketTasksTab {...tabProps('requester')} />)
    expect(screen.getByText(/restrita aos agentes/)).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })
})
