import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { AiPendingActionDTO } from '@/types/steel-ai'
import { SteelAgentApprovalCard } from '../steel-agent-approval-card'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'

function action(over: Partial<AiPendingActionDTO> = {}): AiPendingActionDTO {
  return {
    id: 'act_1',
    conversationId: null,
    agentRunId: 'run_1',
    toolName: 'crm_update_opportunity',
    kind: 'UPDATE',
    module: 'CRM',
    preview: {
      title: 'Alterar a oportunidade “Contrato Acme”',
      summary: 'Move para Negociação.',
      fields: [{ label: 'Estágio', before: 'Proposta', after: 'Negociação' }],
      target: { type: 'Oportunidade', label: 'Contrato Acme' },
    },
    status: 'PENDING',
    requiresDoubleConfirm: false,
    resultSummary: null,
    error: null,
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    decidedAt: null,
    executedAt: null,
    createdAt: '2026-10-06T12:00:00.000Z',
    ...over,
  }
}

const URL_BASE = `/api/workspaces/${WS}/agents/runs/run_1/actions/act_1`

describe('<SteelAgentApprovalCard />', () => {
  it('shows the preview before → after', () => {
    renderWithQuery(
      <SteelAgentApprovalCard
        workspaceId={WS}
        runId='run_1'
        action={action()}
        canApprove
      />,
    )
    expect(
      screen.getByRole('heading', {
        name: 'Alterar a oportunidade “Contrato Acme”',
      }),
    ).toBeTruthy()
    expect(screen.getByText('Proposta')).toBeTruthy()
    expect(screen.getByText('Negociação')).toBeTruthy()
    expect(screen.getByText('Contrato Acme')).toBeTruthy()
    expect(screen.getByText('Aguardando aprovação')).toBeTruthy()
  })

  it('approves with one click and shows the outcome', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `${URL_BASE}/approve`,
        data: action({ status: 'EXECUTED', resultSummary: 'Movida.' }),
      },
    ])
    renderWithQuery(
      <SteelAgentApprovalCard
        workspaceId={WS}
        runId='run_1'
        action={action()}
        canApprove
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    expect(await screen.findByText(/Movida\./)).toBeTruthy()
    expect(screen.getByText('Aprovada e executada')).toBeTruthy()
    expect(fetchBody(spy, '/approve')).toEqual({})
    expect(notify.success).toHaveBeenCalledWith('Ação aprovada.')
  })

  it('rejects', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `${URL_BASE}/reject`,
        data: action({ status: 'CANCELED' }),
      },
    ])
    renderWithQuery(
      <SteelAgentApprovalCard
        workspaceId={WS}
        runId='run_1'
        action={action()}
        canApprove
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar' }))
    expect(
      await screen.findByText('Rejeitada — nada foi alterado'),
    ).toBeTruthy()
  })

  it('asks twice before approving a delete and sends doubleConfirmed', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `${URL_BASE}/approve`,
        data: action({ kind: 'DELETE', status: 'EXECUTED' }),
      },
    ])
    renderWithQuery(
      <SteelAgentApprovalCard
        workspaceId={WS}
        runId='run_1'
        action={action({ kind: 'DELETE', requiresDoubleConfirm: true })}
        canApprove
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    expect(await screen.findByText('Aprovar exclusão?')).toBeTruthy()
    expect(fetchBody(spy, '/approve')).toBeUndefined()
    fireEvent.click(
      screen.getByRole('button', { name: 'Excluir definitivamente' }),
    )
    expect(await screen.findByText('Aprovada e executada')).toBeTruthy()
    expect(fetchBody(spy, '/approve')).toEqual({ doubleConfirmed: true })
  })

  it('reports errors from the server', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `${URL_BASE}/approve`,
        status: 403,
        error: 'Sem permissão',
      },
    ])
    renderWithQuery(
      <SteelAgentApprovalCard
        workspaceId={WS}
        runId='run_1'
        action={action()}
        canApprove
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeTruthy()
  })

  it('hides the buttons for who cannot decide and shows decided outcomes', () => {
    const { unmount } = renderWithQuery(
      <SteelAgentApprovalCard
        workspaceId={WS}
        runId='run_1'
        action={action()}
        canApprove={false}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull()
    expect(
      screen.getByText(
        'Só o responsável pelo agente ou um administrador pode decidir.',
      ),
    ).toBeTruthy()
    unmount()

    renderWithQuery(
      <SteelAgentApprovalCard
        workspaceId={WS}
        runId='run_1'
        action={action({ status: 'FAILED', error: 'Sem permissão' })}
        canApprove
      />,
    )
    expect(screen.getByText(/Sem permissão/)).toBeTruthy()
  })

  it('treats an overdue pending action as expired', () => {
    renderWithQuery(
      <SteelAgentApprovalCard
        workspaceId={WS}
        runId='run_1'
        action={action({ expiresAt: '2020-01-01T00:00:00.000Z' })}
        canApprove
      />,
    )
    expect(
      screen.getByText('Expirou sem decisão — nada foi alterado'),
    ).toBeTruthy()
  })
})
