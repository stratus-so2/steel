import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { AdminBackupDTO, AdminOperationDTO } from '@/types/admin-workspace'
import { AdminBackupsPanel } from '../backups/admin-backups-panel'
import { AdminOperationsList } from '../backups/admin-operations-list'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

function backup(overrides: Partial<AdminBackupDTO> = {}): AdminBackupDTO {
  return {
    id: 'b_1',
    scope: 'WORKSPACE',
    status: 'COMPLETED',
    workspaceId: 'ws_1',
    workspaceSlug: 'acme',
    workspaceExists: true,
    sizeBytes: 2048,
    errorMessage: null,
    locations: { local: true, offsite: false },
    offsiteCopiedAt: null,
    triggeredBy: 'admin',
    startedAt: '2026-09-18T12:00:00.000Z',
    completedAt: '2026-09-18T12:00:05.000Z',
    expiresAt: null,
    ...overrides,
  }
}

describe('<AdminBackupsPanel />', () => {
  it('shows a skeleton, then the list with size, locations and a deleted-workspace flag', async () => {
    mockFetch([
      {
        match: '/api/admin/backups',
        data: {
          offsiteConfigured: true,
          backups: [
            backup(),
            backup({
              id: 'b_2',
              workspaceId: 'gone',
              workspaceSlug: 'antigo',
              workspaceExists: false,
            }),
            backup({
              id: 'b_3',
              scope: 'FULL',
              workspaceId: null,
              workspaceSlug: null,
              locations: { local: true, offsite: true },
            }),
          ],
        },
      },
    ])
    renderWithQuery(<AdminBackupsPanel workspaces={[]} />)

    expect(screen.getByRole('status', { name: 'Carregando' })).toBeTruthy()
    await screen.findByText('antigo')
    expect(screen.getByText('excluído')).toBeTruthy()
    expect(screen.getByText('Banco inteiro')).toBeTruthy()
    expect(screen.getAllByText('2 KB')).toHaveLength(3)
    expect(screen.getByText('offsite ativo')).toBeTruthy()
    // Backup completo não tem botão de restaurar.
    expect(screen.queryByLabelText('Restaurar backup b_3')).toBeNull()
  })

  it('warns when there is no offsite copy and shows the empty state', async () => {
    mockFetch([
      {
        match: '/api/admin/backups',
        data: { offsiteConfigured: false, backups: [] },
      },
    ])
    renderWithQuery(<AdminBackupsPanel workspaces={[]} />)

    await screen.findByText('Nenhum backup')
    expect(screen.getByText(/não configurada/)).toBeTruthy()
  })

  it('shows an error state with retry', async () => {
    mockFetch([{ match: '/api/admin/backups', status: 500, error: 'boom' }])
    renderWithQuery(<AdminBackupsPanel workspaces={[]} />)

    await screen.findByText('Não foi possível carregar os backups.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('restores a workspace backup only after typing the slug', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: '/api/admin/backups/b_1/restore',
        data: { id: 'op_1' },
      },
      {
        match: '/api/admin/backups',
        data: { offsiteConfigured: true, backups: [backup()] },
      },
    ])
    renderWithQuery(<AdminBackupsPanel workspaces={[]} />)

    fireEvent.click(await screen.findByLabelText('Restaurar backup b_1'))
    fireEvent.change(await screen.findByLabelText('Motivo'), {
      target: { value: 'dados apagados por engano' },
    })
    fireEvent.change(screen.getByLabelText(/para confirmar/), {
      target: { value: 'acme' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Restauração enfileirada'),
    )
    expect(fetchBody(spy, '/api/admin/backups/b_1/restore')).toEqual({
      reason: 'dados apagados por engano',
      confirmSlug: 'acme',
    })
  })
})

function operation(
  overrides: Partial<AdminOperationDTO> = {},
): AdminOperationDTO {
  return {
    id: 'op_1',
    kind: 'WORKSPACE_DELETE',
    status: 'COMPLETED',
    step: 'done',
    workspaceId: 'ws_1',
    workspaceSlug: 'acme',
    workspaceName: 'Acme',
    backupId: 'b_1',
    requestedByEmail: 'admin@stratustelecom.com.br',
    reason: 'encerramento',
    error: null,
    subscriptionsCancelled: [],
    subscriptionsToCancel: [],
    filesDeleted: 4,
    filesError: null,
    safetyBackupId: null,
    createdAt: '2026-09-18T12:00:00.000Z',
    updatedAt: '2026-09-18T12:00:00.000Z',
    completedAt: '2026-09-18T12:01:00.000Z',
    ...overrides,
  }
}

describe('<AdminOperationsList />', () => {
  it('shows progress, errors and subscriptions to cancel manually', async () => {
    mockFetch([
      {
        match: '/api/admin/operations',
        data: [
          operation({
            subscriptionsToCancel: [{ billId: 'bill_9', plan: 'PRO' }],
          }),
          operation({
            id: 'op_2',
            kind: 'WORKSPACE_RESTORE',
            status: 'FAILED',
            step: 'restore',
            error: 'Não foi possível restaurar: membership',
          }),
        ],
      },
    ])
    renderWithQuery(<AdminOperationsList />)

    await screen.findByText(/bill_9/)
    expect(screen.getAllByText('Concluída').length).toBeGreaterThan(0)
    expect(screen.getByText('Falhou')).toBeTruthy()
    expect(
      screen.getByText('Não foi possível restaurar: membership'),
    ).toBeTruthy()
  })

  it('renders nothing when empty and hideWhenEmpty is set', async () => {
    const spy = mockFetch([{ match: '/api/admin/operations', data: [] }])
    const { container } = renderWithQuery(
      <AdminOperationsList workspaceId='ws_1' hideWhenEmpty />,
    )
    await waitFor(() => expect(spy).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).toBe(''))
  })
})
