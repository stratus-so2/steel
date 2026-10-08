import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { ListMembersResult, MemberDTO, MemberRole } from '@/types/member'
import { canManageMember } from '../columns'
import { MembersManager } from '../members-manager'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'
const DIRECTORY = `/api/workspaces/${WS}/members/directory`
const INVITATIONS = `/api/workspaces/${WS}/invitations`

function member(overrides: Partial<MemberDTO>): MemberDTO {
  return {
    membershipId: `m_${overrides.userId ?? 'u'}`,
    userId: 'u_member',
    name: 'Carla Souza',
    username: 'carla',
    email: 'carla@empresa.com',
    image: null,
    role: 'MEMBER',
    accountStatus: 'ACTIVE',
    authMethods: ['EMAIL_PASSWORD'],
    twoFactorEnabled: false,
    joinedAt: '2026-09-20T12:00:00.000Z',
    ...overrides,
  }
}

const OWNER = member({
  userId: 'u_owner',
  name: 'Ana Castro',
  username: 'ana',
  email: 'ana@empresa.com',
  role: 'OWNER',
  authMethods: ['EMAIL_PASSWORD', 'GOOGLE'],
  twoFactorEnabled: true,
})
const ADMIN = member({
  userId: 'u_admin',
  name: 'Bruno Lima',
  username: 'bruno',
  email: 'bruno@empresa.com',
  role: 'ADMIN',
  accountStatus: 'UNVERIFIED',
  authMethods: ['GITHUB'],
})
const MEMBER = member({ userId: 'u_member' })
const VIEWER = member({
  userId: 'u_viewer',
  name: 'Diego Ramos',
  username: 'diego',
  email: 'diego@empresa.com',
  role: 'VIEWER',
  accountStatus: 'PENDING_DELETION',
})

function directory(overrides: Partial<ListMembersResult> = {}) {
  const members = overrides.members ?? [OWNER, ADMIN, MEMBER, VIEWER]
  return {
    members,
    total: members.length,
    page: 1,
    pageSize: 20,
    seats: { used: 5, limit: 12 },
    ...overrides,
  }
}

function renderManager(
  actor: { userId: string; role: MemberRole } = {
    userId: 'u_owner',
    role: 'OWNER',
  },
) {
  return renderWithQuery(
    <MembersManager
      workspaceId={WS}
      currentUserId={actor.userId}
      actorRole={actor.role}
    />,
  )
}

function rowOf(name: string) {
  return screen.getByText(name).closest('tr') as HTMLElement
}

function directoryCalls(spy: ReturnType<typeof mockFetch>) {
  return spy.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes(DIRECTORY))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('<MembersManager />', () => {
  it('renders the directory with Nexo columns and pt-BR labels', async () => {
    mockFetch([
      { match: DIRECTORY, data: directory() },
      { match: INVITATIONS, data: [] },
    ])
    renderManager()

    expect(screen.getByText('Carregando membros...')).toBeTruthy()
    expect(await screen.findByText('Ana Castro')).toBeTruthy()

    const owner = rowOf('Ana Castro')
    expect(owner.textContent).toContain('@ana')
    expect(owner.textContent).toContain('Dono')
    expect(owner.textContent).toContain('Ativo')
    expect(owner.textContent).toContain('E-mail e senha')
    expect(owner.textContent).toContain('Google')
    expect(owner.textContent).toContain('2FA')
    expect(owner.textContent).toContain('Você')

    const admin = rowOf('Bruno Lima')
    expect(admin.textContent).toContain('Administrador')
    expect(admin.textContent).toContain('Não verificado')
    expect(admin.textContent).toContain('GitHub')

    expect(rowOf('Carla Souza').textContent).toContain('Membro')
    const viewer = rowOf('Diego Ramos')
    expect(viewer.textContent).toContain('Visualizador')
    expect(viewer.textContent).toContain('Exclusão agendada')
    expect(viewer.textContent).toContain('20 de set. de 2026')

    expect(screen.getByText('Pessoas')).toBeTruthy()
    expect(screen.getByText('4 resultados')).toBeTruthy()
    expect(screen.getByText('5/12 assentos')).toBeTruthy()
    expect(screen.getByText('Página 1 de 1 · 4 membros')).toBeTruthy()
  })

  it('asks the API for the newest members first, 20 per page', async () => {
    const spy = mockFetch([
      { match: DIRECTORY, data: directory() },
      { match: INVITATIONS, data: [] },
    ])
    renderManager()
    await screen.findByText('Ana Castro')

    expect(directoryCalls(spy)[0]).toContain(
      'sortBy=joinedAt&sortOrder=desc&page=1&pageSize=20',
    )
  })

  it('shows the empty state and singular counters', async () => {
    mockFetch([
      {
        match: DIRECTORY,
        data: directory({ members: [], seats: { used: 1, limit: null } }),
      },
      { match: INVITATIONS, data: [] },
    ])
    renderManager()

    expect(await screen.findByText('Nenhum membro encontrado.')).toBeTruthy()
    expect(screen.getByText('0 resultados')).toBeTruthy()
    expect(screen.getByText('Nenhum membro')).toBeTruthy()
    expect(screen.getByText('1 assentos · ilimitado')).toBeTruthy()
  })

  it('debounces the search before querying the API', async () => {
    const spy = mockFetch([
      { match: DIRECTORY, data: directory() },
      { match: INVITATIONS, data: [] },
    ])
    renderManager()
    await screen.findByText('Ana Castro')

    fireEvent.change(screen.getByLabelText('Pesquisar membros'), {
      target: { value: 'bru' },
    })

    await waitFor(() =>
      expect(directoryCalls(spy).some((u) => u.includes('search=bru'))).toBe(
        true,
      ),
    )
  })

  it('filters by role through the Cargos filter', async () => {
    const spy = mockFetch([
      { match: DIRECTORY, data: directory() },
      { match: INVITATIONS, data: [] },
    ])
    renderManager()
    await screen.findByText('Ana Castro')

    fireEvent.click(screen.getByRole('button', { name: /Cargos/ }))
    fireEvent.click(
      await screen.findByRole('option', { name: /Administrador/ }),
    )

    await waitFor(() =>
      expect(directoryCalls(spy).some((u) => u.includes('roles=ADMIN'))).toBe(
        true,
      ),
    )
  })

  it('sorts through the column header menu', async () => {
    const spy = mockFetch([
      { match: DIRECTORY, data: directory() },
      { match: INVITATIONS, data: [] },
    ])
    renderManager()
    await screen.findByText('Ana Castro')

    fireEvent.click(screen.getByRole('button', { name: /Nome completo/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /A-Z/ }))

    await waitFor(() =>
      expect(
        directoryCalls(spy).some((u) =>
          u.includes('sortBy=name&sortOrder=asc'),
        ),
      ).toBe(true),
    )
  })

  it('pages forward and back', async () => {
    const spy = mockFetch([
      { match: DIRECTORY, data: directory({ total: 45 }) },
      { match: INVITATIONS, data: [] },
    ])
    renderManager()
    await screen.findByText('Página 1 de 3 · 45 membros')

    expect(
      (screen.getByRole('button', { name: 'Anterior' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))

    await waitFor(() =>
      expect(directoryCalls(spy).some((u) => u.includes('page=2'))).toBe(true),
    )
  })

  it('blocks new invitations when every seat is taken', async () => {
    mockFetch([
      {
        match: DIRECTORY,
        data: directory({ seats: { used: 12, limit: 12 } }),
      },
      { match: INVITATIONS, data: [] },
    ])
    renderManager()

    expect(await screen.findByText('12/12 assentos')).toBeTruthy()
    expect(
      screen.getByText(/Todos os assentos do plano estão em uso/),
    ).toBeTruthy()
    const invite = screen.getByRole('button', { name: 'Adicionar membro' })
    expect(
      invite.hasAttribute('disabled') ||
        invite.getAttribute('aria-disabled') === 'true' ||
        invite.hasAttribute('data-disabled'),
    ).toBe(true)
  })

  describe('row actions (permissions)', () => {
    it('lets the owner manage admins, members and viewers but not themselves', async () => {
      mockFetch([
        { match: DIRECTORY, data: directory() },
        { match: INVITATIONS, data: [] },
      ])
      renderManager({ userId: 'u_owner', role: 'OWNER' })
      await screen.findByText('Ana Castro')

      expect(screen.queryByLabelText('Ações de Ana Castro')).toBeNull()
      expect(screen.getByLabelText('Ações de Bruno Lima')).toBeTruthy()
      expect(screen.getByLabelText('Ações de Carla Souza')).toBeTruthy()
      expect(screen.getByLabelText('Ações de Diego Ramos')).toBeTruthy()
    })

    it('hides the actions an admin cannot take (owner, other admins, self)', async () => {
      mockFetch([
        {
          match: DIRECTORY,
          data: directory({
            members: [
              OWNER,
              ADMIN,
              member({
                userId: 'u_admin2',
                name: 'Elisa Martins',
                role: 'ADMIN',
              }),
              MEMBER,
            ],
          }),
        },
        { match: INVITATIONS, data: [] },
      ])
      renderManager({ userId: 'u_admin', role: 'ADMIN' })
      await screen.findByText('Ana Castro')

      expect(screen.queryByLabelText('Ações de Ana Castro')).toBeNull()
      expect(screen.queryByLabelText('Ações de Bruno Lima')).toBeNull()
      expect(screen.queryByLabelText('Ações de Elisa Martins')).toBeNull()
      expect(screen.getByLabelText('Ações de Carla Souza')).toBeTruthy()
    })

    it('changes a member role through the actions menu', async () => {
      const spy = mockFetch([
        { match: DIRECTORY, data: directory() },
        { match: INVITATIONS, data: [] },
        {
          method: 'PATCH',
          match: `/api/workspaces/${WS}/members/u_member`,
          data: { userId: 'u_member', role: 'VIEWER' },
        },
      ])
      renderManager()
      await screen.findByText('Carla Souza')

      fireEvent.click(screen.getByLabelText('Ações de Carla Souza'))
      fireEvent.click(await screen.findByText('Alterar cargo'))
      fireEvent.click(
        await screen.findByRole('menuitemradio', { name: 'Visualizador' }),
      )

      await waitFor(() =>
        expect(
          fetchBody(spy, `/api/workspaces/${WS}/members/u_member`, 'PATCH'),
        ).toEqual({ role: 'VIEWER' }),
      )
      await waitFor(() =>
        expect(notify.success).toHaveBeenCalledWith(
          'Carla Souza agora é visualizador',
        ),
      )
    })

    it('reports a failed role change', async () => {
      mockFetch([
        { match: DIRECTORY, data: directory() },
        { match: INVITATIONS, data: [] },
        {
          method: 'PATCH',
          match: `/api/workspaces/${WS}/members/u_member`,
          status: 403,
          error: 'Só o dono do workspace pode alterar administradores',
        },
      ])
      renderManager()
      await screen.findByText('Carla Souza')

      fireEvent.click(screen.getByLabelText('Ações de Carla Souza'))
      fireEvent.click(await screen.findByText('Alterar cargo'))
      fireEvent.click(
        await screen.findByRole('menuitemradio', { name: 'Administrador' }),
      )

      await waitFor(() => expect(notify.error).toHaveBeenCalled())
      expect(notify.error.mock.calls[0][1]).toBe(
        'Não foi possível alterar o cargo',
      )
    })

    it('ignores picking the role the member already has', async () => {
      const spy = mockFetch([
        { match: DIRECTORY, data: directory() },
        { match: INVITATIONS, data: [] },
      ])
      renderManager()
      await screen.findByText('Carla Souza')

      fireEvent.click(screen.getByLabelText('Ações de Carla Souza'))
      fireEvent.click(await screen.findByText('Alterar cargo'))
      fireEvent.click(
        await screen.findByRole('menuitemradio', { name: 'Membro' }),
      )

      expect(spy.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(
        false,
      )
    })

    it('removes a member after confirmation', async () => {
      const spy = mockFetch([
        { match: DIRECTORY, data: directory() },
        { match: INVITATIONS, data: [] },
        {
          method: 'DELETE',
          match: `/api/workspaces/${WS}/members/u_viewer`,
          data: { userId: 'u_viewer' },
        },
      ])
      renderManager()
      await screen.findByText('Diego Ramos')

      fireEvent.click(screen.getByLabelText('Ações de Diego Ramos'))
      fireEvent.click(
        await screen.findByRole('menuitem', { name: /Remover do workspace/ }),
      )

      const dialog = await screen.findByRole('alertdialog')
      expect(within(dialog).getByText('Remover Diego Ramos?')).toBeTruthy()
      expect(
        within(dialog).getByText(/diego@empresa.com perde o acesso/),
      ).toBeTruthy()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remover' }))

      await waitFor(() =>
        expect(
          spy.mock.calls.some(
            ([input, init]) =>
              String(input).endsWith('/members/u_viewer') &&
              init?.method === 'DELETE',
          ),
        ).toBe(true),
      )
      await waitFor(() =>
        expect(notify.success).toHaveBeenCalledWith(
          'Diego Ramos foi removido do workspace',
        ),
      )
    })

    it('reports a failed removal and keeps the dialog open', async () => {
      mockFetch([
        { match: DIRECTORY, data: directory() },
        { match: INVITATIONS, data: [] },
        {
          method: 'DELETE',
          match: `/api/workspaces/${WS}/members/u_viewer`,
          status: 500,
          error: 'boom',
        },
      ])
      renderManager()
      await screen.findByText('Diego Ramos')

      fireEvent.click(screen.getByLabelText('Ações de Diego Ramos'))
      fireEvent.click(
        await screen.findByRole('menuitem', { name: /Remover do workspace/ }),
      )
      const dialog = await screen.findByRole('alertdialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remover' }))

      await waitFor(() => expect(notify.error).toHaveBeenCalled())
      expect(notify.error.mock.calls[0][1]).toBe(
        'Não foi possível remover o membro',
      )
      expect(screen.getByRole('alertdialog')).toBeTruthy()
    })
  })
})

describe('canManageMember()', () => {
  const owner = { currentUserId: 'me', actorRole: 'OWNER' as const }
  const admin = { currentUserId: 'me', actorRole: 'ADMIN' as const }

  it('never lets a non-privileged actor manage anyone', () => {
    expect(
      canManageMember(
        { userId: 'x', role: 'VIEWER' },
        { currentUserId: 'me', actorRole: 'MEMBER' },
      ),
    ).toBe(false)
  })

  it('protects self and the owner', () => {
    expect(canManageMember({ userId: 'me', role: 'ADMIN' }, owner)).toBe(false)
    expect(canManageMember({ userId: 'x', role: 'OWNER' }, owner)).toBe(false)
  })

  it('lets only the owner manage admins', () => {
    expect(canManageMember({ userId: 'x', role: 'ADMIN' }, owner)).toBe(true)
    expect(canManageMember({ userId: 'x', role: 'ADMIN' }, admin)).toBe(false)
    expect(canManageMember({ userId: 'x', role: 'MEMBER' }, admin)).toBe(true)
  })
})
