import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import type { AiAttachmentDTO, AiMessageDTO } from '@/types/steel-ai'
import {
  formatBytes,
  isAcceptedFile,
  STEEL_AI_DEFAULT_ATTACHMENT_LIMITS,
  validateSteelAiFile,
} from '../steel-ai-attachments'
import { SteelAiChat } from '../steel-ai-chat'
import { SteelAiExecutedActionCard } from '../steel-ai-executed-action-card'
import { takeSteelAiPrompt } from '../steel-ai-handoff'
import { allowedSteelAiMode, SteelAiModeSwitch } from '../steel-ai-mode-switch'
import { formatModelPrice, SteelAiModelPicker } from '../steel-ai-model-picker'
import { SteelAiWelcome } from '../steel-ai-welcome'
import {
  capabilities,
  conversation,
  pendingAction,
  renderSteelAi,
  sseResponse,
} from './steel-ai-test-utils'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/ai/c1',
}))

afterEach(() => {
  window.sessionStorage.clear()
  notify.error.mockClear()
  push.mockClear()
})

const MODELS = capabilities().models

function attachment(over: Partial<AiAttachmentDTO> = {}): AiAttachmentDTO {
  return {
    id: 'att_1',
    conversationId: 'c1',
    messageId: null,
    kind: 'DOCUMENT',
    filename: 'contrato.pdf',
    contentType: 'application/pdf',
    sizeBytes: 2048,
    url: '/api/workspaces/ws_1/ai/conversations/c1/attachments/att_1',
    createdAt: '2026-10-07T12:00:00.000Z',
    ...over,
  }
}

const file = (name: string, type: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type })

describe('<SteelAiModeSwitch /> — Autopilot', () => {
  it('locks Autopilot with the reason when the workspace did not enable it', async () => {
    const onChange = vi.fn()
    renderSteelAi(
      <SteelAiModeSwitch
        value='AGENT'
        onChange={onChange}
        agentModeEnabled
        autopilotEnabled={false}
      />,
    )
    const autopilot = screen.getByRole('button', { name: /^Autopilot$/ })
    expect((autopilot as HTMLButtonElement).disabled).toBe(true)
    expect(
      screen
        .getByRole('button', { name: /^Build$/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.focus(autopilot.parentElement as HTMLElement)
    expect(await screen.findByText(/O Autopilot está desligado/)).toBeTruthy()
  })

  it('selects Autopilot when enabled', () => {
    const onChange = vi.fn()
    renderSteelAi(
      <SteelAiModeSwitch
        value='EXPLORE'
        onChange={onChange}
        agentModeEnabled
        autopilotEnabled
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Autopilot$/ }))
    expect(onChange).toHaveBeenCalledWith('AUTOPILOT')
  })

  it('falls back to the closest allowed mode', () => {
    const on = { agentModeEnabled: true, autopilotEnabled: true }
    expect(allowedSteelAiMode('AUTOPILOT', null)).toBe('AUTOPILOT')
    expect(allowedSteelAiMode('AUTOPILOT', on)).toBe('AUTOPILOT')
    expect(
      allowedSteelAiMode('AUTOPILOT', { ...on, autopilotEnabled: false }),
    ).toBe('AGENT')
    expect(
      allowedSteelAiMode('AUTOPILOT', {
        agentModeEnabled: false,
        autopilotEnabled: false,
      }),
    ).toBe('EXPLORE')
    expect(
      allowedSteelAiMode('AGENT', { ...on, agentModeEnabled: false }),
    ).toBe('EXPLORE')
  })
})

describe('<SteelAiModelPicker />', () => {
  it('shows the current model and lists the models by provider with prices', async () => {
    const onChange = vi.fn()
    renderSteelAi(
      <SteelAiModelPicker
        models={MODELS}
        value='anthropic:claude-sonnet-5'
        onChange={onChange}
      />,
    )
    const trigger = screen.getByRole('button', {
      name: 'Modelo: Claude Sonnet 5',
    })
    fireEvent.click(trigger)
    expect(await screen.findByText('OpenAI')).toBeTruthy()
    expect(screen.getByText('Anthropic (Claude)')).toBeTruthy()
    expect(screen.getAllByText(/por 1M tokens/)).toHaveLength(2)
    fireEvent.click(screen.getByRole('menuitemradio', { name: /GPT-4o mini/ }))
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('openai:gpt-4o-mini'),
    )
  })

  it('falls back to the first model and hides itself without models', () => {
    const { container } = renderSteelAi(
      <SteelAiModelPicker models={[]} value={null} onChange={vi.fn()} />,
    )
    expect(container.textContent).toBe('')
    renderSteelAi(
      <SteelAiModelPicker models={MODELS} value='gone' onChange={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: 'Modelo: GPT-4o mini' }),
    ).toBeTruthy()
  })

  it('formats prices in dollars', () => {
    expect(formatModelPrice(MODELS[0])).toMatch(/US\$\s?0,15 \/ US\$\s?0,60/)
  })
})

describe('attachment helpers', () => {
  it('validates type, emptiness and size', () => {
    const limits = STEEL_AI_DEFAULT_ATTACHMENT_LIMITS
    expect(isAcceptedFile(file('a.md', ''), limits.accept)).toBe(true)
    expect(validateSteelAiFile(file('a.png', 'image/png'), limits)).toBeNull()
    expect(
      validateSteelAiFile(file('a.zip', 'application/zip'), limits),
    ).toMatch(/tipo não suportado/)
    expect(validateSteelAiFile(file('a.txt', 'text/plain', 0), limits)).toMatch(
      /está vazio/,
    )
    expect(
      validateSteelAiFile(
        file('a.png', 'image/png', limits.maxImageBytes + 1),
        limits,
      ),
    ).toMatch(/passa do limite de 5,0 MB/)
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
  })
})

describe('<SteelAiExecutedActionCard />', () => {
  it('shows a compact executed write without confirm buttons', () => {
    renderSteelAi(
      <SteelAiExecutedActionCard
        action={pendingAction({
          status: 'EXECUTED',
          autoExecuted: true,
          resultSummary: 'Oportunidade movida para Negociação',
        })}
      />,
    )
    expect(screen.getByText('Autopilot')).toBeTruthy()
    expect(screen.getByText('Alterado')).toBeTruthy()
    expect(screen.getByText('Oportunidade movida para Negociação')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir registro' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull()
  })

  it('shows the failure', () => {
    renderSteelAi(
      <SteelAiExecutedActionCard
        action={pendingAction({
          status: 'FAILED',
          autoExecuted: true,
          error: 'Sem permissão',
        })}
      />,
    )
    expect(screen.getByText('Falhou')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Sem permissão')
    expect(screen.queryByRole('link')).toBeNull()
  })
})

const userWithFile: AiMessageDTO = {
  id: 'm_u',
  conversationId: 'c1',
  role: 'USER',
  content: 'Resuma',
  toolCalls: [],
  pendingActions: [],
  attachments: [
    attachment({ messageId: 'm_u' }),
    attachment({
      id: 'att_2',
      kind: 'IMAGE',
      filename: 'foto.png',
      contentType: 'image/png',
      url: '/img/foto.png',
    }),
  ],
  createdAt: '2026-10-07T12:00:00.000Z',
}

const autopilotReply: AiMessageDTO = {
  id: 'm_a',
  conversationId: 'c1',
  role: 'ASSISTANT',
  content: 'Feito.',
  toolCalls: [],
  pendingActions: [
    pendingAction({
      status: 'EXECUTED',
      autoExecuted: true,
      resultSummary: 'Movida',
    }),
  ],
  attachments: [],
  createdAt: '2026-10-07T12:00:01.000Z',
}

describe('<SteelAiChat /> — Steel AI 2', () => {
  it('shows attachments and autopilot results in the transcript', async () => {
    mockFetch([
      {
        match: '/ai/capabilities',
        data: capabilities({ autopilotEnabled: true }),
      },
      {
        match: /\/conversations\/c1\/messages$/,
        data: [userWithFile, autopilotReply],
      },
      {
        match: /\/conversations\/c1$/,
        data: conversation({ mode: 'AUTOPILOT', title: 'x' }),
      },
    ])
    renderSteelAi(<SteelAiChat conversationId='c1' />)
    expect(await screen.findByText('contrato.pdf')).toBeTruthy()
    expect(screen.getByAltText('foto.png')).toBeTruthy()
    expect(screen.getByText('Movida')).toBeTruthy()
    expect(screen.getByText(/Autopilot ligado/)).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: /^Autopilot$/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('falls back to Build when Autopilot is off for the workspace', async () => {
    mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      { match: /\/conversations\/c1\/messages$/, data: [] },
      {
        match: /\/conversations\/c1$/,
        data: conversation({ mode: 'AUTOPILOT' }),
      },
    ])
    renderSteelAi(<SteelAiChat conversationId='c1' />)
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: /^Build$/ })
          .getAttribute('aria-pressed'),
      ).toBe('true'),
    )
    expect(screen.queryByText(/Autopilot ligado/)).toBeNull()
  })

  it('explains and blocks the composer when the AI is switched off', async () => {
    mockFetch([
      { match: '/ai/capabilities', data: capabilities({ aiEnabled: false }) },
      { match: /\/conversations\/c1\/messages$/, data: [] },
      { match: /\/conversations\/c1$/, data: conversation() },
    ])
    renderSteelAi(<SteelAiChat conversationId='c1' />)
    expect(await screen.findByText(/O Steel AI está desligado/)).toBeTruthy()
    expect(
      (screen.getByLabelText('Mensagem para o Steel AI') as HTMLTextAreaElement)
        .disabled,
    ).toBe(true)
  })

  it('uploads a file, sends it with the picked model and clears the tray', async () => {
    const spy = mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      {
        method: 'POST',
        match: /\/conversations\/c1\/attachments$/,
        status: 201,
        data: attachment(),
      },
      {
        method: 'PATCH',
        match: /\/conversations\/c1$/,
        data: conversation({ modelKey: 'anthropic:claude-sonnet-5' }),
      },
      {
        method: 'POST',
        match: /\/conversations\/c1\/messages$/,
        handler: () =>
          sseResponse([
            { type: 'message.start', conversationId: 'c1', messageId: 'm' },
            {
              type: 'message.end',
              message: { ...autopilotReply, pendingActions: [] },
              usage: { inputTokens: 1, outputTokens: 1 },
            },
          ]),
      },
      { match: /\/conversations\/c1\/messages$/, data: [] },
      { match: /\/conversations\/c1$/, data: conversation() },
      { match: /\/ai\/conversations(\?|$)/, data: [] },
    ])
    renderSteelAi(<SteelAiChat conversationId='c1' />)
    await screen.findByRole('button', { name: 'Modelo: GPT-4o mini' })

    fireEvent.click(screen.getByRole('button', { name: 'Modelo: GPT-4o mini' }))
    fireEvent.click(
      await screen.findByRole('menuitemradio', { name: /Claude Sonnet 5/ }),
    )
    await waitFor(() =>
      expect(fetchBody(spy, /\/conversations\/c1$/, 'PATCH')).toEqual({
        modelKey: 'anthropic:claude-sonnet-5',
      }),
    )

    fireEvent.change(screen.getByTestId('steel-ai-file-input'), {
      target: { files: [file('contrato.pdf', 'application/pdf')] },
    })
    expect(await screen.findByText('contrato.pdf')).toBeTruthy()
    const send = screen.getByRole('button', { name: 'Enviar mensagem' })
    await waitFor(() =>
      expect((send as HTMLButtonElement).disabled).toBe(false),
    )
    fireEvent.click(send)

    await waitFor(() =>
      expect(fetchBody(spy, /\/conversations\/c1\/messages$/)).toEqual({
        content: '',
        mode: 'EXPLORE',
        modelKey: 'anthropic:claude-sonnet-5',
        attachmentIds: ['att_1'],
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remover contrato.pdf' }),
      ).toBeNull(),
    )
  })

  it('rejects unsupported files and removes uploaded ones', async () => {
    const spy = mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      {
        method: 'POST',
        match: /\/conversations\/c1\/attachments$/,
        status: 201,
        data: attachment(),
      },
      {
        method: 'DELETE',
        match: /\/attachments\/att_1$/,
        data: null,
      },
      { match: /\/conversations\/c1\/messages$/, data: [] },
      { match: /\/conversations\/c1$/, data: conversation() },
    ])
    renderSteelAi(<SteelAiChat conversationId='c1' />)
    const box = await screen.findByLabelText('Mensagem para o Steel AI')

    fireEvent.change(screen.getByTestId('steel-ai-file-input'), {
      target: { files: [file('virus.exe', 'application/x-msdownload')] },
    })
    expect(notify.error).toHaveBeenCalledWith(
      expect.stringMatching(/tipo não suportado/),
    )

    fireEvent.paste(box, {
      clipboardData: { files: [file('contrato.pdf', 'application/pdf')] },
    })
    const remove = await screen.findByRole('button', {
      name: 'Remover contrato.pdf',
    })
    await waitFor(() =>
      expect(
        spy.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/attachments') && init?.method === 'POST',
        ),
      ).toBe(true),
    )
    await waitFor(() =>
      expect(remove.closest('li')?.getAttribute('data-status')).toBe('ready'),
    )
    fireEvent.click(remove)
    await waitFor(() =>
      expect(spy.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
        true,
      ),
    )
  })
})

describe('<SteelAiWelcome /> — attachments', () => {
  it('uploads queued files after creating the chat and hands them over', async () => {
    mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      {
        method: 'POST',
        match: /\/ai\/conversations$/,
        status: 201,
        data: conversation({ id: 'c42' }),
      },
      {
        method: 'POST',
        match: /\/conversations\/c42\/attachments$/,
        status: 201,
        data: attachment({ conversationId: 'c42' }),
      },
    ])
    renderSteelAi(<SteelAiWelcome />)
    await screen.findByRole('button', { name: 'Modelo: GPT-4o mini' })
    fireEvent.drop(
      screen
        .getByLabelText('Mensagem para o Steel AI')
        .closest('form') as HTMLElement,
      {
        dataTransfer: {
          files: [file('contrato.pdf', 'application/pdf')],
          types: ['Files'],
        },
      },
    )
    expect(await screen.findByText('contrato.pdf')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/acme/ai/c42'))
    expect(takeSteelAiPrompt('c42')).toEqual(
      expect.objectContaining({
        content: '',
        attachments: [expect.objectContaining({ id: 'att_1' })],
      }),
    )
  })

  it('stays on the screen when an upload fails', async () => {
    mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      {
        method: 'POST',
        match: /\/ai\/conversations$/,
        status: 201,
        data: conversation({ id: 'c42' }),
      },
      {
        method: 'POST',
        match: /\/attachments$/,
        status: 415,
        error: 'Tipo de arquivo não suportado pelo Steel AI',
      },
    ])
    renderSteelAi(<SteelAiWelcome />)
    await screen.findByRole('button', { name: 'Modelo: GPT-4o mini' })
    fireEvent.change(screen.getByTestId('steel-ai-file-input'), {
      target: { files: [file('a.pdf', 'application/pdf')] },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enviar mensagem' }),
    )
    expect(
      await screen.findByText(/Não foi possível enviar um dos anexos/),
    ).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })
})
