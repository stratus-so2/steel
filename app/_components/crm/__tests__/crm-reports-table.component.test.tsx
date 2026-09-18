import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { CRM_REPORT_FIELDS } from '@/src/config/crm-report-fields'
import { CrmReportsTable } from '../crm-reports-table'

const WS = 'ws_1'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))
vi.mock('@/src/hooks/use-crm-workspace-lookups', () => ({
  useCrmWorkspaceLookups: () => ({ lookups: undefined }),
}))
vi.mock('@/app/_components/crm/table/data-table', () => ({
  DataTable: (props: {
    data: { id: string; name: string }[]
    headerAction?: React.ReactNode
    onOpenRecord?: (r: { id: string }) => void
  }) => (
    <div>
      {props.headerAction}
      {props.data.map((row) => (
        <button
          key={row.id}
          type='button'
          onClick={() => props.onOpenRecord?.(row)}
        >
          abrir {row.name}
        </button>
      ))}
    </div>
  ),
}))

function setup(extra: Parameters<typeof mockFetch>[0] = []) {
  const spy = mockFetch([
    ...extra,
    { method: 'POST', match: /crm\/reports$/, data: { id: 'rp9' } },
    {
      match: '/crm/reports',
      data: [{ id: 'rp1', name: 'Pipeline mensal', source: 'opportunity' }],
    },
  ])
  renderWithQuery(<CrmReportsTable workspaceId={WS} slug='acme' />)
  return spy
}

async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: /novo relatório/i }))
  return (await screen.findByLabelText('Nome')) as HTMLInputElement
}

describe('<CrmReportsTable />', () => {
  it('opens an existing report in the builder', async () => {
    setup()
    fireEvent.click(
      await screen.findByRole('button', { name: 'abrir Pipeline mensal' }),
    )
    expect(push).toHaveBeenCalledWith('/acme/crm/reports/rp1')
  })

  it('defaults the source to companies and requires a name', async () => {
    const spy = setup()
    await openDialog()
    expect(screen.getByRole('combobox').textContent).toContain('Empresas')
    expect(
      screen.getByText('A fonte não pode ser alterada depois de criada.'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Criar e abrir' }))
    expect(notify.error).toHaveBeenCalledWith('Informe o nome do relatório.')
    expect(fetchBody(spy, /crm\/reports$/)).toBeUndefined()
  })

  it('creates a report seeded with the first column of the chosen source', async () => {
    const spy = setup()
    const input = await openDialog()
    fireEvent.change(input, { target: { value: '  Oportunidades Q3 ' } })

    fireEvent.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Oportunidades' })
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.click(option)
    await waitFor(() =>
      expect(screen.getByRole('combobox').textContent).toContain(
        'Oportunidades',
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Criar e abrir' }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/acme/crm/reports/rp9'),
    )
    expect(fetchBody(spy, /crm\/reports$/)).toEqual({
      name: 'Oportunidades Q3',
      source: 'opportunity',
      columns: [CRM_REPORT_FIELDS.opportunity[0].key],
    })
  })

  it('reports an API failure without navigating', async () => {
    setup([
      {
        method: 'POST',
        match: /crm\/reports$/,
        status: 400,
        error: 'Nome inválido',
      },
    ])
    const input = await openDialog()
    fireEvent.change(input, { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar e abrir' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
  })
})
