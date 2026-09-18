import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspacePermissionsProvider } from '@/app/_components/workspace/workspace-permissions'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { WhatsappSettingsService } from '../whatsapp-settings-service'

vi.setConfig({ testTimeout: 20_000 })

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const SETTINGS = '/api/workspaces/ws_1/whatsapp/settings'

describe('<WhatsappSettingsService />', () => {
  it('hydrates the auto-close window and saves a new value', async () => {
    const fetchSpy = mockFetch([
      { method: 'PATCH', match: SETTINGS, data: { autoCloseAfterHours: 0 } },
      {
        match: SETTINGS,
        data: { workspaceId: 'ws_1', autoCloseAfterHours: 12 },
      },
    ])
    renderWithQuery(<WhatsappSettingsService workspaceId='ws_1' />)

    const input = (await screen.findByLabelText(
      'Fechar após quantas horas sem mensagens',
    )) as HTMLInputElement
    await waitFor(() => expect(input.value).toBe('12'))

    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(fetchBody(fetchSpy, SETTINGS, 'PATCH')).toEqual({
        autoCloseAfterHours: 0,
      }),
    )
    await waitFor(() => expect(notify.success).toHaveBeenCalled())
  })

  it('rejects an invalid value without calling the API', async () => {
    const fetchSpy = mockFetch([
      {
        match: SETTINGS,
        data: { workspaceId: 'ws_1', autoCloseAfterHours: 24 },
      },
    ])
    renderWithQuery(<WhatsappSettingsService workspaceId='ws_1' />)

    const input = (await screen.findByLabelText(
      'Fechar após quantas horas sem mensagens',
    )) as HTMLInputElement
    await waitFor(() => expect(input.value).toBe('24'))
    fireEvent.change(input, { target: { value: '1.5' } })
    // Submete direto: o clique seria barrado pela validação nativa (step=1).
    const form = input.closest('form')
    if (form) fireEvent.submit(form)

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(fetchBody(fetchSpy, SETTINGS, 'PATCH')).toBeUndefined()
  })

  it('tells non-admins the settings are restricted', () => {
    mockFetch([])
    renderWithQuery(
      <WorkspacePermissionsProvider
        value={{ isPrivileged: false, permissions: null }}
      >
        <WhatsappSettingsService workspaceId='ws_1' />
      </WorkspacePermissionsProvider>,
    )

    expect(
      screen.getByText(/Somente proprietários e administradores/),
    ).toBeTruthy()
  })
})
