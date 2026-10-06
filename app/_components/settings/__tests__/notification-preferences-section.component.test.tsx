import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { NotificationPreferencesSection } from '../notification-preferences-section'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const PREFS = [
  {
    kind: 'MEMBER_JOINED',
    module: 'OTHER',
    moduleLabel: 'Plataforma',
    label: 'Novo membro',
    icon: 'member',
    color: 'emerald',
    inApp: true,
  },
  {
    kind: 'CRM_LEAD_ASSIGNED',
    module: 'CRM',
    moduleLabel: 'CRM',
    label: 'Lead atribuído',
    icon: 'assign',
    color: 'violet',
    inApp: true,
  },
  {
    kind: 'CRM_TASK_DUE',
    module: 'CRM',
    moduleLabel: 'CRM',
    label: 'Tarefa vencendo',
    icon: 'alarm',
    color: 'amber',
    inApp: false,
  },
]

function setup() {
  const spy = mockFetch([
    { method: 'PUT', match: '/notifications/preferences', data: PREFS },
    { match: '/notifications/preferences', data: PREFS },
  ])
  renderWithQuery(<NotificationPreferencesSection workspaceId='ws_1' />)
  return spy
}

describe('NotificationPreferencesSection', () => {
  it('should group kinds by module, CRM first, with the saved state', async () => {
    setup()

    const headings = await screen.findAllByText(/^(CRM|Plataforma)$/)
    expect(headings.map((h) => h.textContent)).toEqual(['CRM', 'Plataforma'])
    const switches = screen.getAllByRole('switch')
    expect(switches.map((s) => s.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'true',
    ])
    // CRM has a muted kind, so the bulk action re-enables everything.
    expect(screen.getByRole('button', { name: 'Ativar todas' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Silenciar todas' })).toBeTruthy()
  })

  it('should save a single toggle', async () => {
    const spy = setup()

    fireEvent.click((await screen.findAllByRole('switch'))[0])

    await waitFor(() =>
      expect(fetchBody(spy, '/notifications/preferences', 'PUT')).toEqual({
        preferences: [{ kind: 'CRM_LEAD_ASSIGNED', inApp: false }],
      }),
    )
    await waitFor(() => expect(notify.success).toHaveBeenCalled())
  })

  it('should toggle a whole module at once', async () => {
    const spy = setup()

    fireEvent.click(await screen.findByRole('button', { name: 'Ativar todas' }))

    await waitFor(() =>
      expect(fetchBody(spy, '/notifications/preferences', 'PUT')).toEqual({
        preferences: [
          { kind: 'CRM_LEAD_ASSIGNED', inApp: true },
          { kind: 'CRM_TASK_DUE', inApp: true },
        ],
      }),
    )
  })
})
