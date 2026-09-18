import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { WhatsappSettingsQuickReplies } from '../whatsapp-settings-quick-replies'

// Dialog/select flows render Base UI portals and wait on several fetches;
// the project default (5s) is too tight when the suite runs under load.
vi.setConfig({ testTimeout: 20_000 })

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const BASE = '/api/workspaces/ws_1/whatsapp/quick-replies'

const quickReply = {
  id: 'qr_1',
  workspaceId: 'ws_1',
  shortcut: 'saudacao',
  title: 'Saudação',
  body: 'Olá {nome_cliente}, tudo bem?',
  mediaUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('<WhatsappSettingsQuickReplies />', () => {
  it('lists quick replies with their slash shortcut', async () => {
    mockFetch([{ match: BASE, data: [quickReply] }])
    renderWithQuery(<WhatsappSettingsQuickReplies workspaceId='ws_1' />)

    expect(await screen.findByText('/saudacao')).toBeTruthy()
    expect(screen.getByText('Saudação')).toBeTruthy()
    expect(screen.getByText('Olá {nome_cliente}, tudo bem?')).toBeTruthy()
  })

  it('shows the empty state when there are no quick replies', async () => {
    mockFetch([{ match: BASE, data: [] }])
    renderWithQuery(<WhatsappSettingsQuickReplies workspaceId='ws_1' />)

    expect(
      await screen.findByText('Nenhuma mensagem rápida cadastrada.'),
    ).toBeTruthy()
  })

  it('creates a quick reply with the typed fields', async () => {
    const fetchSpy = mockFetch([
      { match: BASE, data: [] },
      { method: 'POST', match: BASE, data: quickReply },
    ])
    renderWithQuery(<WhatsappSettingsQuickReplies workspaceId='ws_1' />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Nova mensagem rápida' }),
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Atalho'), {
      target: { value: 'saudacao' },
    })
    fireEvent.change(within(dialog).getByLabelText('Título'), {
      target: { value: 'Saudação' },
    })
    fireEvent.change(within(dialog).getByLabelText('Mensagem'), {
      target: { value: 'Olá!' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Mensagem rápida criada'),
    )
    expect(fetchBody(fetchSpy, BASE)).toEqual({
      shortcut: 'saudacao',
      title: 'Saudação',
      body: 'Olá!',
    })
  })

  it('reports an error toast when creation fails', async () => {
    mockFetch([
      { match: BASE, data: [] },
      { method: 'POST', match: BASE, status: 409, error: 'Atalho já existe' },
    ])
    renderWithQuery(<WhatsappSettingsQuickReplies workspaceId='ws_1' />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Nova mensagem rápida' }),
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Atalho'), {
      target: { value: 'saudacao' },
    })
    fireEvent.change(within(dialog).getByLabelText('Título'), {
      target: { value: 'x' },
    })
    fireEvent.change(within(dialog).getByLabelText('Mensagem'), {
      target: { value: 'y' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect((notify.error.mock.calls[0][0] as Error).message).toBe(
      'Atalho já existe',
    )
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('confirms before deleting a quick reply', async () => {
    const fetchSpy = mockFetch([
      { match: BASE, data: [quickReply] },
      { method: 'DELETE', match: `${BASE}/qr_1`, data: null },
    ])
    renderWithQuery(<WhatsappSettingsQuickReplies workspaceId='ws_1' />)

    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    const alert = await screen.findByRole('alertdialog')
    expect(
      within(alert).getByText(/"\/saudacao" não vai mais aparecer/),
    ).toBeTruthy()
    expect(
      fetchSpy.mock.calls.some(([, init]) => init?.method === 'DELETE'),
    ).toBe(false)

    fireEvent.click(within(alert).getByRole('button', { name: 'Remover' }))
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Mensagem removida'),
    )
    expect(
      fetchSpy.mock.calls.some(
        ([url, init]) =>
          init?.method === 'DELETE' && String(url).endsWith('/qr_1'),
      ),
    ).toBe(true)
  })
})
