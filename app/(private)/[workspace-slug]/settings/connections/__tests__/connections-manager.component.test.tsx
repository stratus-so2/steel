import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { ConnectionsManager } from '../connections-manager'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'
const BASE = `/api/workspaces/${WS}/connections`

const crmConnection = {
  id: 'conn_1',
  module: 'CRM',
  host: 'db.cliente.com',
  port: 6543,
  username: 'crm_user',
  database: 'crm',
  sslEnabled: false,
}

function card(title: string) {
  const heading = screen.getByText(title, {
    selector: '[data-slot=card-title]',
  })
  return heading.closest('[data-slot=card]') as HTMLElement
}

function fillCard(scope: HTMLElement, prefix: string) {
  const byId = (field: string) =>
    scope.querySelector(`#${prefix}-${field}`) as HTMLInputElement
  fireEvent.change(byId('host'), { target: { value: 'db.novo.com' } })
  fireEvent.change(byId('database'), { target: { value: 'sd' } })
  fireEvent.change(byId('username'), { target: { value: 'sd_user' } })
  fireEvent.change(byId('password'), { target: { value: 's3nh4' } })
}

describe('<ConnectionsManager />', () => {
  it('shows a loading state, then one card per module', async () => {
    mockFetch([{ match: BASE, data: [] }])
    renderWithQuery(<ConnectionsManager workspaceId={WS} />)

    expect(screen.getByText('Carregando conexões...')).toBeTruthy()
    expect(await screen.findByText('ServiceDesk')).toBeTruthy()
    expect(card('CRM')).toBeTruthy()
    expect(card('Comunicação')).toBeTruthy()
  })

  it('prefills an existing connection without the password and offers removal', async () => {
    mockFetch([{ match: BASE, data: [crmConnection] }])
    renderWithQuery(<ConnectionsManager workspaceId={WS} />)
    await screen.findByText('ServiceDesk')

    const crm = card('CRM')
    const host = crm.querySelector('#CRM-host') as HTMLInputElement
    const port = crm.querySelector('#CRM-port') as HTMLInputElement
    const password = crm.querySelector('#CRM-password') as HTMLInputElement
    await waitFor(() => expect(host.value).toBe('db.cliente.com'))
    expect(port.value).toBe('6543')
    expect(password.value).toBe('')
    expect(password.required).toBe(false)
    expect(within(crm).getByRole('button', { name: 'Remover' })).toBeTruthy()

    // Modules without a saved connection have no "Remover" and require a
    // password.
    const sd = card('ServiceDesk')
    expect(within(sd).queryByRole('button', { name: 'Remover' })).toBeNull()
    expect(
      (sd.querySelector('#SERVICE_DESK-password') as HTMLInputElement).required,
    ).toBe(true)
  })

  it('only enables "Testar conexão" once a password is typed', async () => {
    mockFetch([{ match: BASE, data: [] }])
    renderWithQuery(<ConnectionsManager workspaceId={WS} />)
    await screen.findByText('ServiceDesk')

    const sd = card('ServiceDesk')
    const test = within(sd).getByRole('button', {
      name: 'Testar conexão',
    }) as HTMLButtonElement
    expect(test.disabled).toBe(true)
    fireEvent.change(sd.querySelector('#SERVICE_DESK-password') as Element, {
      target: { value: 'x' },
    })
    expect(test.disabled).toBe(false)
  })

  it('saves a connection with a numeric port via PUT', async () => {
    const spy = mockFetch([
      { method: 'PUT', match: `${BASE}/SERVICE_DESK`, data: crmConnection },
      { match: BASE, data: [] },
    ])
    renderWithQuery(<ConnectionsManager workspaceId={WS} />)
    await screen.findByText('ServiceDesk')

    const sd = card('ServiceDesk')
    fillCard(sd, 'SERVICE_DESK')
    fireEvent.click(within(sd).getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith(
        'Conexão de ServiceDesk salva',
      ),
    )
    expect(fetchBody(spy, `${BASE}/SERVICE_DESK`, 'PUT')).toEqual({
      host: 'db.novo.com',
      port: 5432,
      username: 'sd_user',
      password: 's3nh4',
      database: 'sd',
      sslEnabled: true,
    })
  })

  it('reports a failing connection test', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `${BASE}/test`,
        status: 400,
        error: 'Conexão recusada',
      },
      { match: BASE, data: [] },
    ])
    renderWithQuery(<ConnectionsManager workspaceId={WS} />)
    await screen.findByText('ServiceDesk')

    const sd = card('ServiceDesk')
    fillCard(sd, 'SERVICE_DESK')
    fireEvent.click(within(sd).getByRole('button', { name: 'Testar conexão' }))

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect((notify.error.mock.calls[0][0] as Error).message).toBe(
      'Conexão recusada',
    )
  })

  it('removes an existing connection', async () => {
    const spy = mockFetch([
      { method: 'DELETE', match: `${BASE}/CRM`, data: null },
      { match: BASE, data: [crmConnection] },
    ])
    renderWithQuery(<ConnectionsManager workspaceId={WS} />)
    await screen.findByText('ServiceDesk')

    fireEvent.click(
      within(card('CRM')).getByRole('button', { name: 'Remover' }),
    )

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Conexão de CRM removida'),
    )
    expect(
      spy.mock.calls.some(
        ([url, init]) =>
          init?.method === 'DELETE' && String(url).endsWith('/connections/CRM'),
      ),
    ).toBe(true)
  })
})
