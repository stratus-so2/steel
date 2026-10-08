import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { isExportInFlight } from '@/src/hooks/use-workspace-exports'
import type {
  WorkspaceExportDTO,
  WorkspaceExportOverviewDTO,
} from '@/types/workspace-export'
import { WorkspaceExportsPanel } from '../workspace-exports-panel'

vi.setConfig({ testTimeout: 20_000 })

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'

function item(overrides: Partial<WorkspaceExportDTO> = {}): WorkspaceExportDTO {
  return {
    id: 'ex1',
    kind: 'DATA',
    status: 'COMPLETED',
    requestedBy: { id: 'u1', name: 'Ana Admin', email: 'ana@x.com' },
    periodFrom: null,
    periodTo: null,
    fileName: 'steel-acme-dados-2026-10-08.zip',
    sizeBytes: 2_500_000,
    itemCount: 42,
    errorMessage: null,
    createdAt: '2026-10-08T15:00:00.000Z',
    completedAt: '2026-10-08T15:01:00.000Z',
    expiresAt: '2026-10-15T15:01:00.000Z',
    downloadUrl: `/api/workspaces/${WS}/exports/ex1/download`,
    ...overrides,
  }
}

function overview(
  overrides: Partial<WorkspaceExportOverviewDTO> = {},
): WorkspaceExportOverviewDTO {
  return {
    items: [],
    availability: [
      {
        kind: 'DATA',
        available: true,
        nextAvailableAt: null,
        configured: true,
      },
      {
        kind: 'LOGS',
        available: true,
        nextAvailableAt: null,
        configured: true,
      },
    ],
    retentionDays: 7,
    logsPeriodDays: [1, 7, 30],
    ...overrides,
  }
}

describe('WorkspaceExportsPanel', () => {
  it('lists past exports with status, size and the download link', async () => {
    mockFetch([
      {
        match: `/api/workspaces/${WS}/exports`,
        data: overview({
          items: [
            item(),
            item({
              id: 'ex2',
              kind: 'LOGS',
              status: 'FAILED',
              errorMessage: 'Axiom respondeu 500',
              downloadUrl: null,
              sizeBytes: null,
              itemCount: null,
              requestedBy: null,
            }),
            item({
              id: 'ex3',
              kind: 'LOGS',
              status: 'EXPIRED',
              itemCount: 1200,
              downloadUrl: null,
            }),
          ],
        }),
      },
    ])
    renderWithQuery(<WorkspaceExportsPanel workspaceId={WS} />)

    expect(await screen.findByText('Dados completos')).toBeTruthy()
    expect(screen.getByText('Pronto')).toBeTruthy()
    expect(screen.getByText('Expirado')).toBeTruthy()
    expect(screen.getByText('Falhou')).toBeTruthy()
    expect(screen.getByText('Axiom respondeu 500')).toBeTruthy()
    expect(
      screen.getByText(/Ana Admin · 08\/10\/2026 12:00 · 2,4 MB · 42 tabelas/),
    ).toBeTruthy()
    expect(screen.getByText(/Usuário removido/)).toBeTruthy()
    expect(screen.getByText(/1\.200 eventos/)).toBeTruthy()
    const link = screen.getByText('Baixar').closest('a')
    expect(link?.getAttribute('href')).toBe(
      `/api/workspaces/${WS}/exports/ex1/download`,
    )
    expect(screen.getByText(/Disponível até 15\/10\/2026 12:01/)).toBeTruthy()
  })

  it('requests a data export and confirms it', async () => {
    const spy = mockFetch([
      { method: 'POST', match: '/exports', status: 202, data: item() },
      { match: `/api/workspaces/${WS}/exports`, data: overview() },
    ])
    renderWithQuery(<WorkspaceExportsPanel workspaceId={WS} />)
    expect(await screen.findByText('Nenhuma exportação ainda.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Exportar dados' }))
    await waitFor(() => expect(notify.success).toHaveBeenCalled())
    expect(fetchBody(spy, '/exports')).toEqual({ kind: 'DATA' })
  })

  it('requests a logs export for the chosen window', async () => {
    const spy = mockFetch([
      { method: 'POST', match: '/exports', status: 202, data: item() },
      { match: `/api/workspaces/${WS}/exports`, data: overview() },
    ])
    renderWithQuery(<WorkspaceExportsPanel workspaceId={WS} />)
    await screen.findByText('Nenhuma exportação ainda.')

    const select = screen.getByRole('combobox', { name: 'Período dos logs' })
    fireEvent.click(select)
    const option = await screen.findByRole('option', {
      name: 'Últimos 30 dias',
    })
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.click(option)
    await waitFor(() => expect(select.textContent).toContain('30 dias'))
    fireEvent.click(screen.getByRole('button', { name: 'Exportar logs' }))
    await waitFor(() =>
      expect(fetchBody(spy, '/exports')).toEqual({
        kind: 'LOGS',
        periodDays: 30,
      }),
    )
  })

  it('shows the daily limit and the server error', async () => {
    mockFetch([
      {
        method: 'POST',
        match: '/exports',
        status: 429,
        error: 'A exportação de dados completos já foi feita hoje.',
      },
      {
        match: `/api/workspaces/${WS}/exports`,
        data: overview({
          availability: [
            {
              kind: 'DATA',
              available: false,
              nextAvailableAt: '2026-10-09T03:00:00.000Z',
              configured: true,
            },
            {
              kind: 'LOGS',
              available: true,
              nextAvailableAt: null,
              configured: true,
            },
          ],
        }),
      },
    ])
    renderWithQuery(<WorkspaceExportsPanel workspaceId={WS} />)
    expect(
      await screen.findByText(/Disponível de novo em 09\/10\/2026 00:00/),
    ).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Exportar dados' })
    expect((button as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Exportar logs' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
  })

  it('disables the logs export when Axiom is not configured', async () => {
    mockFetch([
      {
        match: `/api/workspaces/${WS}/exports`,
        data: overview({
          availability: [
            {
              kind: 'DATA',
              available: true,
              nextAvailableAt: null,
              configured: true,
            },
            {
              kind: 'LOGS',
              available: true,
              nextAvailableAt: null,
              configured: false,
            },
          ],
        }),
      },
    ])
    renderWithQuery(<WorkspaceExportsPanel workspaceId={WS} />)
    expect(await screen.findByTestId('logs-unconfigured')).toBeTruthy()
    expect(
      (
        screen.getByRole('button', {
          name: 'Exportar logs',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    expect(
      screen.queryByRole('combobox', { name: 'Período dos logs' }),
    ).toBeNull()
  })

  it('shows loading and error states', async () => {
    mockFetch([
      {
        match: `/api/workspaces/${WS}/exports`,
        status: 403,
        error: 'Permissão insuficiente',
      },
    ])
    renderWithQuery(<WorkspaceExportsPanel workspaceId={WS} />)
    expect(screen.getByTestId('exports-loading')).toBeTruthy()
    expect(await screen.findByText('Permissão insuficiente')).toBeTruthy()
  })

  it('polls only while an export is in flight', () => {
    expect(isExportInFlight(undefined)).toBe(false)
    expect(isExportInFlight(overview({ items: [item()] }))).toBe(false)
    expect(
      isExportInFlight(overview({ items: [item({ status: 'RUNNING' })] })),
    ).toBe(true)
    expect(
      isExportInFlight(overview({ items: [item({ status: 'PENDING' })] })),
    ).toBe(true)
  })
})
