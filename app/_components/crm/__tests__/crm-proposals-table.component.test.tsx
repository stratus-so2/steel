import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch } from '@/src/__tests__/component-utils'
import { CrmProposalsTable } from '../crm-proposals-table'

const WS = 'ws_1'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/src/hooks/use-crm-workspace-lookups', () => ({
  useCrmWorkspaceLookups: () => ({
    lookups: {
      maps: { companies: { co1: 'Acme Ltda' } },
      options: {},
    },
  }),
}))

type KanbanProps = {
  groupByKey: string
  columns: { value: string; label: string }[]
  renderCard: (r: Record<string, unknown>) => React.ReactNode
}
// Stub grid: renders the header action, the kanban column labels and each
// record through the component's own `renderCard`.
vi.mock('@/app/_components/crm/table/data-table', () => ({
  DataTable: (props: {
    data: Record<string, unknown>[]
    headerAction?: React.ReactNode
    kanban: KanbanProps
  }) => (
    <div>
      {props.headerAction}
      <ol aria-label='colunas'>
        {props.kanban.columns.map((c) => (
          <li key={c.value}>{c.label}</li>
        ))}
      </ol>
      {props.data.map((r) => (
        <article key={String(r.id)}>{props.kanban.renderCard(r)}</article>
      ))}
    </div>
  ),
}))

function setup(templates: unknown[] = []) {
  mockFetch([
    { match: '/crm/proposal-templates', data: templates },
    {
      match: '/crm/proposals',
      data: [
        {
          id: 'pr1',
          name: '',
          status: 'DRAFT',
          companyId: 'co1',
          validUntil: '2026-12-31T12:00:00.000Z',
        },
        { id: 'pr2', name: 'Implantação ERP', status: 'SENT' },
      ],
    },
  ])
  render(<CrmProposalsTable workspaceId={WS} slug='acme' />)
}

async function openNewMenu() {
  const trigger = screen.getByRole('button', { name: /nova proposta/i })
  fireEvent.click(trigger)
  return screen.findByRole('menuitem', { name: /em branco/i })
}

describe('<CrmProposalsTable />', () => {
  it('groups by the six pt-BR status columns', () => {
    setup()
    const labels = screen
      .getByRole('list', { name: 'colunas' })
      .querySelectorAll('li')
    expect(Array.from(labels).map((l) => l.textContent)).toEqual([
      'Rascunho',
      'Enviada',
      'Visualizada',
      'Aceita',
      'Recusada',
      'Expirada',
    ])
  })

  it('renders kanban cards with fallback title, client and validity', async () => {
    setup()
    expect(await screen.findByText('Proposta sem título')).toBeTruthy()
    expect(screen.getByText('Implantação ERP')).toBeTruthy()
    expect(screen.getByText('Acme Ltda')).toBeTruthy()
    expect(screen.getByText(/Válida até 31\/12\/2026/)).toBeTruthy()
  })

  it('links to the templates page', () => {
    setup()
    expect(
      screen.getByRole('link', { name: /templates/i }).getAttribute('href'),
    ).toBe('/acme/crm/proposal-templates')
  })

  it('creates a blank proposal', async () => {
    setup()
    fireEvent.click(await openNewMenu())
    expect(push).toHaveBeenCalledWith('/acme/crm/proposals/new')
  })

  it('creates a proposal from a template', async () => {
    setup([{ id: 'tpl1', name: 'Consultoria padrão', sections: [] }])
    // Wait for the templates fetch before opening the menu.
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await openNewMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Consultoria padrão' }),
    )
    expect(push).toHaveBeenCalledWith('/acme/crm/proposals/new?templateId=tpl1')
  })
})
