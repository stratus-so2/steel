import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AdminWorkspaceSummaryDTO } from '@/types/admin-workspace'
import { AdminWorkspacesTable } from '../workspaces/admin-workspaces-table'

function ws(overrides: Partial<AdminWorkspaceSummaryDTO>) {
  return {
    id: 'ws_1',
    name: 'Acme',
    slug: 'acme',
    activePlan: 'PRO',
    status: 'ACTIVE',
    memberCount: 3,
    createdAt: '2026-01-10T12:00:00.000Z',
    ...overrides,
  } as AdminWorkspaceSummaryDTO
}

const WORKSPACES = [
  ws({}),
  ws({
    id: 'ws_2',
    name: 'Padaria São João Comércio de Alimentos e Bebidas Artesanais Ltda',
    slug: 'padaria-sao-joao',
    status: 'SUSPENDED',
  }),
  ws({ id: 'ws_3', name: 'Beta', slug: 'beta', status: 'DELETING' }),
]

const rows = () => screen.getAllByRole('row').slice(1)

describe('<AdminWorkspacesTable />', () => {
  it('lists workspaces with status pill, counts per status and full name as title', () => {
    render(<AdminWorkspacesTable workspaces={WORKSPACES} />)

    expect(rows()).toHaveLength(3)
    expect(screen.getByText('Suspenso')).toBeTruthy()
    expect(screen.getByText('Excluindo')).toBeTruthy()
    const longName = screen.getByText(/Padaria São João/)
    // Nome longo trunca na célula; o título mostra o valor completo.
    expect(longName.getAttribute('title')).toContain('Artesanais Ltda')
    expect(longName.className).toContain('truncate')
    expect(
      within(screen.getByRole('tab', { name: /Suspensos/ })).getByText('1'),
    ).toBeTruthy()
  })

  it('filters by status', () => {
    render(<AdminWorkspacesTable workspaces={WORKSPACES} />)

    fireEvent.click(screen.getByRole('tab', { name: /Suspensos/ }))

    expect(rows()).toHaveLength(1)
    expect(screen.getByText(/Padaria/)).toBeTruthy()
  })

  it('searches accent-insensitively by name, slug or id', () => {
    render(<AdminWorkspacesTable workspaces={WORKSPACES} />)
    const search = screen.getByLabelText('Buscar workspace')

    fireEvent.change(search, { target: { value: 'sao joao' } })
    expect(rows()).toHaveLength(1)

    fireEvent.change(search, { target: { value: 'ws_3' } })
    expect(screen.getByText('Beta')).toBeTruthy()
  })

  it('shows an empty state when nothing matches', () => {
    render(<AdminWorkspacesTable workspaces={WORKSPACES} />)
    fireEvent.change(screen.getByLabelText('Buscar workspace'), {
      target: { value: 'nada-disso' },
    })
    expect(screen.getByText('Nenhum workspace encontrado')).toBeTruthy()
  })

  it('shows a platform-level empty state without workspaces', () => {
    render(<AdminWorkspacesTable workspaces={[]} />)
    expect(screen.getByText('Nenhum workspace na plataforma')).toBeTruthy()
  })
})
