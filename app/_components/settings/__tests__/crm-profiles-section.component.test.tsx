import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import { PERMISSION_ACTIONS } from '@/src/lib/permissions'
import { CrmProfilesSection } from '../crm-profiles-section'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'
const PROFILES_URL = `/api/workspaces/${WS}/profiles`

const PROFILES = [
  { id: 'p_admin', name: 'Administrador', isSystem: true, permissions: {} },
  {
    id: 'p_sales',
    name: 'Vendas',
    isSystem: false,
    permissions: { leads: ['VIEW'] },
  },
]

function profileRow(name: string) {
  return screen
    .getByText(name, { selector: 'p' })
    .closest('div.rounded-md') as HTMLElement
}

describe('<CrmProfilesSection />', () => {
  it('lists profiles and protects system profiles from edits', async () => {
    mockFetch([{ match: PROFILES_URL, data: PROFILES }])
    render(<CrmProfilesSection workspaceId={WS} />)

    expect(screen.getByText('Carregando perfis...')).toBeTruthy()
    await screen.findByText('Vendas')

    const system = profileRow('Administrador')
    expect(system.textContent).toContain('Perfil de sistema')
    expect(system.querySelectorAll('button')).toHaveLength(0)

    const custom = profileRow('Vendas')
    expect(custom.textContent).toContain('Editar')
    expect(custom.querySelector('[aria-label="Excluir perfil"]')).toBeTruthy()
  })

  it('requires a name before creating a profile', async () => {
    mockFetch([{ match: PROFILES_URL, data: [] }])
    render(<CrmProfilesSection workspaceId={WS} />)

    fireEvent.click(screen.getByRole('button', { name: /novo perfil/i }))
    const create = (await screen.findByRole('button', {
      name: 'Criar perfil',
    })) as HTMLButtonElement
    expect(create.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('Ex.: Vendedor'), {
      target: { value: '   ' },
    })
    expect(create.disabled).toBe(true)
  })

  it('creates a profile with the permissions ticked in the matrix', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: PROFILES_URL,
        data: { id: 'p_new', name: 'SDR', permissions: {} },
      },
      { match: PROFILES_URL, data: [] },
    ])
    render(<CrmProfilesSection workspaceId={WS} />)

    fireEvent.click(screen.getByRole('button', { name: /novo perfil/i }))
    fireEvent.change(await screen.findByPlaceholderText('Ex.: Vendedor'), {
      target: { value: '  SDR ' },
    })
    const leadsRow = screen
      .getByText('Leads', { selector: 'td' })
      .closest('tr') as HTMLElement
    const [firstAction] = Array.from(
      leadsRow.querySelectorAll('[role=checkbox]'),
    )
    fireEvent.click(firstAction)
    fireEvent.click(screen.getByRole('button', { name: 'Criar perfil' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Perfil criado'),
    )
    expect(fetchBody(spy, PROFILES_URL)).toEqual({
      name: 'SDR',
      permissions: { leads: [PERMISSION_ACTIONS[0]] },
    })
  })

  it('surfaces the API message when creation fails', async () => {
    mockFetch([
      {
        method: 'POST',
        match: PROFILES_URL,
        status: 409,
        error: 'Já existe um perfil com esse nome',
      },
      { match: PROFILES_URL, data: [] },
    ])
    render(<CrmProfilesSection workspaceId={WS} />)

    fireEvent.click(screen.getByRole('button', { name: /novo perfil/i }))
    fireEvent.change(await screen.findByPlaceholderText('Ex.: Vendedor'), {
      target: { value: 'Vendas' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar perfil' }))

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        'Já existe um perfil com esse nome',
      ),
    )
  })

  it('deletes a custom profile and refetches the list', async () => {
    let listCalls = 0
    const spy = mockFetch([
      { method: 'DELETE', match: `${PROFILES_URL}/p_sales`, data: null },
      {
        match: PROFILES_URL,
        handler: () => {
          listCalls += 1
          return listCalls === 1 ? PROFILES : [PROFILES[0]]
        },
      },
    ])
    render(<CrmProfilesSection workspaceId={WS} />)
    await screen.findByText('Vendas')

    fireEvent.click(screen.getByRole('button', { name: 'Excluir perfil' }))

    await waitFor(() => expect(screen.queryByText('Vendas')).toBeNull())
    expect(notify.success).toHaveBeenCalledWith('Perfil excluído')
    expect(spy.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
      true,
    )
  })
})
