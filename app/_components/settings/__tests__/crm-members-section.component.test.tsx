import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import { CrmMembersSection } from '../crm-members-section'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'

const MEMBERS = [
  {
    userId: 'u_owner',
    name: 'Olívia Dona',
    email: 'olivia@empresa.com',
    role: 'OWNER',
    profileId: null,
  },
  {
    userId: 'u_member',
    name: 'Marcos Membro',
    email: 'marcos@empresa.com',
    role: 'MEMBER',
    profileId: 'p_sales',
  },
]

const PROFILES = [
  { id: 'p_sales', name: 'Vendas', permissions: {} },
  { id: 'p_support', name: 'Suporte', permissions: {} },
]

function routes(extra: Parameters<typeof mockFetch>[0] = []) {
  return mockFetch([
    ...extra,
    { match: `/api/workspaces/${WS}/members`, data: MEMBERS },
    { match: `/api/workspaces/${WS}/profiles`, data: PROFILES },
  ])
}

function rowOf(name: string) {
  return screen.getByText(name).closest('tr') as HTMLElement
}

async function chooseProfile(memberName: string, profileName: string) {
  const trigger = rowOf(memberName).querySelector(
    '[data-slot=select-trigger]',
  ) as HTMLElement
  fireEvent.click(trigger)
  const option = await screen.findByRole('option', { name: profileName })
  // Base UI only commits a mouse click that started on the item itself.
  fireEvent.pointerDown(option, { pointerType: 'mouse' })
  fireEvent.click(option)
}

describe('<CrmMembersSection />', () => {
  it('shows a loading state, then members with pt-BR role labels', async () => {
    routes()
    render(<CrmMembersSection workspaceId={WS} />)

    expect(screen.getByText('Carregando membros...')).toBeTruthy()
    expect(await screen.findByText('Olívia Dona')).toBeTruthy()
    expect(rowOf('Olívia Dona').textContent).toContain('Proprietário')
    expect(rowOf('Marcos Membro').textContent).toContain('Membro')
    expect(screen.getByText('marcos@empresa.com')).toBeTruthy()
  })

  it('uses a custom API base path (admin console)', async () => {
    const spy = mockFetch([
      { match: `/api/admin/workspaces/${WS}/members`, data: MEMBERS },
      { match: `/api/admin/workspaces/${WS}/profiles`, data: PROFILES },
    ])
    render(
      <CrmMembersSection workspaceId={WS} basePath='/api/admin/workspaces' />,
    )
    await screen.findByText('Olívia Dona')
    expect(
      spy.mock.calls.every(([url]) =>
        String(url).startsWith('/api/admin/workspaces/'),
      ),
    ).toBe(true)
  })

  it('assigns an access profile to a member', async () => {
    const spy = routes([
      {
        method: 'PATCH',
        match: '/members/u_owner/profile',
        data: null,
      },
    ])
    render(<CrmMembersSection workspaceId={WS} />)
    await screen.findByText('Olívia Dona')

    await chooseProfile('Olívia Dona', 'Suporte')

    await waitFor(() =>
      expect(fetchBody(spy, '/members/u_owner/profile', 'PATCH')).toEqual({
        profileId: 'p_support',
      }),
    )
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('sends null when resetting to the role default', async () => {
    const spy = routes([
      { method: 'PATCH', match: '/members/u_member/profile', data: null },
    ])
    render(<CrmMembersSection workspaceId={WS} />)
    await screen.findByText('Marcos Membro')

    await chooseProfile('Marcos Membro', 'Padrão do papel')

    await waitFor(() =>
      expect(fetchBody(spy, '/members/u_member/profile', 'PATCH')).toEqual({
        profileId: null,
      }),
    )
  })

  it('notifies when the profile update is rejected', async () => {
    routes([
      {
        method: 'PATCH',
        match: '/members/u_owner/profile',
        status: 403,
        error: 'Sem permissão',
      },
    ])
    render(<CrmMembersSection workspaceId={WS} />)
    await screen.findByText('Olívia Dona')

    await chooseProfile('Olívia Dona', 'Vendas')

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Sem permissão'),
    )
  })
})
