import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { CrmWorkflowsTable } from '../crm-workflows-table'

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
    { method: 'POST', match: /crm\/workflows$/, data: { id: 'wf9' } },
    {
      match: '/crm/workflows',
      data: [{ id: 'wf1', name: 'Boas-vindas', status: 'ACTIVE' }],
    },
  ])
  renderWithQuery(<CrmWorkflowsTable workspaceId={WS} slug='acme' />)
  return spy
}

async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: /novo workflow/i }))
  return (await screen.findByLabelText('Nome')) as HTMLInputElement
}

describe('<CrmWorkflowsTable />', () => {
  it('opens an existing workflow in the canvas', async () => {
    setup()
    fireEvent.click(
      await screen.findByRole('button', { name: 'abrir Boas-vindas' }),
    )
    expect(push).toHaveBeenCalledWith('/acme/crm/workflows/wf1')
  })

  it('requires a name before creating', async () => {
    const spy = setup()
    const input = await openDialog()
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar e abrir' }))
    expect(notify.error).toHaveBeenCalledWith('Informe o nome do workflow.')
    expect(fetchBody(spy, /crm\/workflows$/)).toBeUndefined()
  })

  it('creates with a trimmed name and navigates to it', async () => {
    const spy = setup()
    const input = await openDialog()
    fireEvent.change(input, { target: { value: '  Follow-up  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar e abrir' }))

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/acme/crm/workflows/wf9'),
    )
    expect(fetchBody(spy, /crm\/workflows$/)).toEqual({ name: 'Follow-up' })
  })

  it('reports an API failure without navigating', async () => {
    setup([
      {
        method: 'POST',
        match: /crm\/workflows$/,
        status: 500,
        error: 'Falha interna',
      },
    ])
    const input = await openDialog()
    fireEvent.change(input, { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar e abrir' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
  })
})
