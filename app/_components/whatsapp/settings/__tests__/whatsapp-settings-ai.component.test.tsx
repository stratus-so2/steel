import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { WhatsappSettingsAi } from '../whatsapp-settings-ai'
import { WhatsappSettingsAiKnowledge } from '../whatsapp-settings-ai-knowledge'

// Dialog/select flows render Base UI portals and wait on several fetches;
// the project default (5s) is too tight when the suite runs under load.
vi.setConfig({ testTimeout: 20_000 })

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const CONFIG = '/api/workspaces/ws_1/whatsapp/ai-config'
const DOCS = `${CONFIG}/knowledge-documents`

const savedConfig = {
  id: 'ai_1',
  workspaceId: 'ws_1',
  model: 'gpt-4.1',
  systemPrompt: 'Responda sempre em português.',
  active: true,
  readMedia: false,
  hasApiKey: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function doc(id: string, filename: string, status: string) {
  return {
    id,
    workspaceId: 'ws_1',
    filename,
    contentType: 'application/pdf',
    sizeBytes: 1024,
    status,
    errorMessage: null,
    createdById: 'u_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('<WhatsappSettingsAi />', () => {
  it('hydrates the form from the saved configuration', async () => {
    mockFetch([{ match: CONFIG, data: savedConfig }])
    renderWithQuery(<WhatsappSettingsAi workspaceId='ws_1' />)

    expect(await screen.findByText('Chave da OpenAI configurada')).toBeTruthy()
    await waitFor(() =>
      expect((screen.getByLabelText('Modelo') as HTMLInputElement).value).toBe(
        'gpt-4.1',
      ),
    )
    expect(
      (screen.getByLabelText('Instruções da IA') as HTMLTextAreaElement).value,
    ).toBe('Responda sempre em português.')
    // Existing key is masked, never echoed back.
    const key = screen.getByLabelText('Chave da API OpenAI') as HTMLInputElement
    expect(key.value).toBe('')
    expect(key.placeholder).toBe('••••••••••••')
    const [activeSwitch, mediaSwitch] = screen.getAllByRole('switch')
    expect(activeSwitch.getAttribute('aria-checked')).toBe('true')
    expect(mediaSwitch.getAttribute('aria-checked')).toBe('false')
  })

  it('uses defaults and hints a missing key when nothing is configured', async () => {
    mockFetch([{ match: CONFIG, data: null }])
    renderWithQuery(<WhatsappSettingsAi workspaceId='ws_1' />)

    expect(
      await screen.findByText('Nenhuma chave configurada ainda'),
    ).toBeTruthy()
    expect((screen.getByLabelText('Modelo') as HTMLInputElement).value).toBe(
      'gpt-4o-mini',
    )
    expect(
      (screen.getByLabelText('Chave da API OpenAI') as HTMLInputElement)
        .placeholder,
    ).toBe('sk-...')
  })

  it('saves toggles and omits an empty API key from the payload', async () => {
    const fetchSpy = mockFetch([
      { method: 'PATCH', match: CONFIG, data: savedConfig },
      { match: CONFIG, data: savedConfig },
    ])
    renderWithQuery(<WhatsappSettingsAi workspaceId='ws_1' />)
    await screen.findByText('Chave da OpenAI configurada')
    await waitFor(() =>
      expect((screen.getByLabelText('Modelo') as HTMLInputElement).value).toBe(
        'gpt-4.1',
      ),
    )

    fireEvent.click(screen.getAllByRole('switch')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Configuração de IA salva'),
    )
    expect(fetchBody(fetchSpy, CONFIG, 'PATCH')).toEqual({
      model: 'gpt-4.1',
      systemPrompt: 'Responda sempre em português.',
      active: true,
      readMedia: true,
    })
  })

  it('sends a new API key and clears the field after saving', async () => {
    const fetchSpy = mockFetch([
      { method: 'PATCH', match: CONFIG, data: savedConfig },
      { match: CONFIG, data: savedConfig },
    ])
    renderWithQuery(<WhatsappSettingsAi workspaceId='ws_1' />)
    await screen.findByText('Chave da OpenAI configurada')

    const key = screen.getByLabelText('Chave da API OpenAI') as HTMLInputElement
    fireEvent.change(key, { target: { value: 'sk-nova' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }))

    await waitFor(() => expect(notify.success).toHaveBeenCalled())
    expect(fetchBody(fetchSpy, CONFIG, 'PATCH').openaiApiKey).toBe('sk-nova')
    expect(key.value).toBe('')
  })

  it('reports save failures', async () => {
    mockFetch([
      { method: 'PATCH', match: CONFIG, status: 400, error: 'Chave inválida' },
      { match: CONFIG, data: savedConfig },
    ])
    renderWithQuery(<WhatsappSettingsAi workspaceId='ws_1' />)
    await screen.findByText('Chave da OpenAI configurada')

    fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect((notify.error.mock.calls[0][0] as Error).message).toBe(
      'Chave inválida',
    )
  })
})

describe('<WhatsappSettingsAiKnowledge />', () => {
  it('lists documents with translated status labels', async () => {
    mockFetch([
      {
        match: DOCS,
        data: [
          doc('d1', 'manual.pdf', 'READY'),
          doc('d2', 'faq.docx', 'PROCESSING'),
          doc('d3', 'scan.pdf', 'FAILED'),
        ],
      },
    ])
    renderWithQuery(<WhatsappSettingsAiKnowledge workspaceId='ws_1' />)

    expect(await screen.findByText('manual.pdf')).toBeTruthy()
    expect(screen.getByText('Pronto')).toBeTruthy()
    expect(screen.getByText('Processando')).toBeTruthy()
    expect(screen.getByText('Falhou')).toBeTruthy()
  })

  it('shows the empty state', async () => {
    mockFetch([{ match: DOCS, data: [] }])
    renderWithQuery(<WhatsappSettingsAiKnowledge workspaceId='ws_1' />)
    expect(
      await screen.findByText('Nenhum documento enviado ainda.'),
    ).toBeTruthy()
  })

  it('uploads the chosen file as multipart form data', async () => {
    const fetchSpy = mockFetch([
      {
        method: 'POST',
        match: DOCS,
        data: doc('d9', 'novo.txt', 'PROCESSING'),
      },
      { match: DOCS, data: [] },
    ])
    const { container } = renderWithQuery(
      <WhatsappSettingsAiKnowledge workspaceId='ws_1' />,
    )
    await screen.findByText('Nenhum documento enviado ainda.')

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    expect(input.accept).toBe('.pdf,.docx,.txt,.csv')
    const file = new File(['conteúdo'], 'novo.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(([, init]) => init?.method === 'POST'),
      ).toBe(true),
    )
    const post = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST')
    const body = post?.[1]?.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect((body.get('file') as File).name).toBe('novo.txt')
  })

  it('surfaces an upload error', async () => {
    mockFetch([
      { method: 'POST', match: DOCS, status: 413, error: 'Arquivo grande' },
      { match: DOCS, data: [] },
    ])
    const { container } = renderWithQuery(
      <WhatsappSettingsAiKnowledge workspaceId='ws_1' />,
    )
    await screen.findByText('Nenhum documento enviado ainda.')
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'big.pdf')] },
    })

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect((notify.error.mock.calls[0][0] as Error).message).toBe(
      'Arquivo grande',
    )
  })

  it('deletes a document', async () => {
    const fetchSpy = mockFetch([
      { method: 'DELETE', match: `${DOCS}/d1`, data: null },
      { match: DOCS, data: [doc('d1', 'manual.pdf', 'READY')] },
    ])
    renderWithQuery(<WhatsappSettingsAiKnowledge workspaceId='ws_1' />)

    const name = await screen.findByText('manual.pdf')
    const row = name.parentElement as HTMLElement
    fireEvent.click(row.querySelector('button') as HTMLButtonElement)

    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            init?.method === 'DELETE' && String(url).endsWith('/d1'),
        ),
      ).toBe(true),
    )
  })
})
