import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import { CrmFormsTable } from '../crm-forms-table'

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
    onOpenRecord?: (r: { id: string; name: string }) => void
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
vi.mock('@/app/_components/crm/crm-form-stats-panel', () => ({
  CrmFormStatsPanel: (p: {
    formId: string
    formName: string
    onOpenChange: (open: boolean) => void
  }) => (
    <div role='dialog' aria-label='stats'>
      stats:{p.formId}:{p.formName}
      <button type='button' onClick={() => p.onOpenChange(false)}>
        fechar stats
      </button>
    </div>
  ),
}))

function setup(extra: Parameters<typeof mockFetch>[0] = []) {
  const spy = mockFetch([
    ...extra,
    { method: 'POST', match: /crm\/forms$/, data: { id: 'fm9' } },
    {
      match: '/crm/forms',
      data: [{ id: 'fm1', name: 'Contato site', fields: [] }],
    },
  ])
  render(<CrmFormsTable workspaceId={WS} slug='acme' />)
  return spy
}

describe('<CrmFormsTable />', () => {
  it('creates a draft form and opens the builder', async () => {
    const spy = setup()
    fireEvent.click(screen.getByRole('button', { name: /novo formulário/i }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/acme/crm/forms/fm9'),
    )
    expect(fetchBody(spy, /crm\/forms$/)).toEqual({ name: 'Novo formulário' })
  })

  it('reports a creation failure and re-enables the button', async () => {
    setup([
      {
        method: 'POST',
        match: /crm\/forms$/,
        status: 403,
        error: 'Limite de formulários atingido',
      },
    ])
    const btn = screen.getByRole('button', {
      name: /novo formulário/i,
    }) as HTMLButtonElement
    fireEvent.click(btn)
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        'Limite de formulários atingido',
      ),
    )
    expect(push).not.toHaveBeenCalled()
    expect(btn.disabled).toBe(false)
  })

  it('opens and closes the stats panel for a record', async () => {
    setup()
    fireEvent.click(
      await screen.findByRole('button', { name: 'abrir Contato site' }),
    )
    expect(screen.getByText('stats:fm1:Contato site')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'fechar stats' }))
    expect(screen.queryByRole('dialog', { name: 'stats' })).toBeNull()
  })
})
