import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import { AdminModuleAccessPanel } from '../admin-module-access-panel'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'
const ACCESS_URL = `/api/admin/workspaces/${WS}/module-access`

const ACCESS = [
  { module: 'SERVICE_DESK', enabled: false },
  { module: 'CRM', enabled: true },
  { module: 'COMMUNICATION', enabled: false },
]

function switchFor(label: string) {
  const row = screen.getByText(label).closest('div') as HTMLElement
  return row.querySelector('[role=switch]') as HTMLElement
}

describe('<AdminModuleAccessPanel />', () => {
  it('lists each module with its current access state', async () => {
    mockFetch([{ match: ACCESS_URL, data: ACCESS }])
    render(<AdminModuleAccessPanel workspaceId={WS} />)

    expect(screen.getByText('Carregando módulos...')).toBeTruthy()
    await screen.findByText('Service Desk')
    expect(switchFor('CRM').getAttribute('aria-checked')).toBe('true')
    expect(
      switchFor('WhatsApp / Comunicação').getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('grants a module and refetches the state', async () => {
    let enabled = false
    const spy = mockFetch([
      {
        method: 'PATCH',
        match: ACCESS_URL,
        handler: () => {
          enabled = true
          return null
        },
      },
      {
        match: ACCESS_URL,
        handler: () => [
          { module: 'COMMUNICATION', enabled },
          { module: 'CRM', enabled: true },
        ],
      },
    ])
    render(<AdminModuleAccessPanel workspaceId={WS} />)
    await screen.findByText('WhatsApp / Comunicação')

    fireEvent.click(switchFor('WhatsApp / Comunicação'))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Módulo liberado'),
    )
    expect(fetchBody(spy, ACCESS_URL, 'PATCH')).toEqual({
      module: 'COMMUNICATION',
      enabled: true,
    })
    await waitFor(() =>
      expect(
        switchFor('WhatsApp / Comunicação').getAttribute('aria-checked'),
      ).toBe('true'),
    )
  })

  it('revokes a module', async () => {
    mockFetch([
      { method: 'PATCH', match: ACCESS_URL, data: null },
      { match: ACCESS_URL, data: ACCESS },
    ])
    render(<AdminModuleAccessPanel workspaceId={WS} />)
    await screen.findByText('CRM')

    fireEvent.click(switchFor('CRM'))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Módulo revogado'),
    )
  })

  it('notifies the API error when the toggle is rejected', async () => {
    mockFetch([
      {
        method: 'PATCH',
        match: ACCESS_URL,
        status: 403,
        error: 'Apenas super admins',
      },
      { match: ACCESS_URL, data: ACCESS },
    ])
    render(<AdminModuleAccessPanel workspaceId={WS} />)
    await screen.findByText('CRM')

    fireEvent.click(switchFor('CRM'))

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Apenas super admins'),
    )
    expect(notify.success).not.toHaveBeenCalled()
  })
})
