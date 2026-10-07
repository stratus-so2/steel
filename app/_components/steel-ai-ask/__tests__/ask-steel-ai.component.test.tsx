import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { takeSteelAiPrompt } from '@/app/_components/steel-ai/steel-ai-handoff'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { AskSteelAiButton } from '../ask-steel-ai-button'
import { AskSteelAiDialog } from '../ask-steel-ai-dialog'
import {
  ASK_STEEL_AI_DEFAULT_QUESTION,
  ASK_STEEL_AI_LABEL_MAX,
  buildAskSteelAiPrompt,
  cleanAskSteelAiLabel,
  finalizeAskSteelAiPrompt,
} from '../ask-steel-ai-prompt'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/servicedesk',
  useParams: () => ({ 'workspace-slug': 'from-url' }),
}))

const errorSpy = vi.fn()
vi.mock('@/lib/notify', () => ({
  notify: {
    error: (...args: unknown[]) => errorSpy(...args),
    success: vi.fn(),
  },
}))

afterEach(() => {
  push.mockReset()
  errorSpy.mockReset()
  window.sessionStorage.clear()
})

const conversation = {
  id: 'c42',
  title: null,
  mode: 'EXPLORE',
  modelKey: null,
  pinnedAt: null,
  createdAt: '2026-10-07T12:00:00.000Z',
  updatedAt: '2026-10-07T12:00:00.000Z',
}

function createOk() {
  return mockFetch([
    {
      method: 'POST',
      match: /\/ai\/conversations$/,
      status: 201,
      data: conversation,
    },
  ])
}

describe('buildAskSteelAiPrompt', () => {
  it.each([
    [
      { kind: 'ticket', code: 'INC-000123', label: 'Impressora parada' },
      'Sobre o chamado INC-000123 — Impressora parada: ',
    ],
    [{ kind: 'lead', label: 'Ana Souza' }, 'Sobre o lead Ana Souza: '],
    [
      { kind: 'opportunity', label: 'Contrato Acme' },
      'Sobre a oportunidade Contrato Acme: ',
    ],
    [{ kind: 'person', label: 'João' }, 'Sobre a pessoa João: '],
    [{ kind: 'company', label: 'Acme' }, 'Sobre a empresa Acme: '],
    [
      { kind: 'conversation', label: '+55 11 9999' },
      'Sobre a conversa com +55 11 9999: ',
    ],
    [{ kind: 'ticket', code: 'INC-1', label: '' }, 'Sobre o chamado INC-1: '],
    [{ kind: 'lead', label: '   ' }, 'Sobre o lead este registro: '],
  ] as const)('phrases %o', (ref, expected) => {
    expect(buildAskSteelAiPrompt(ref)).toBe(expected)
  })

  it('collapses whitespace and caps long labels', () => {
    expect(cleanAskSteelAiLabel('  a \n  b\t c ')).toBe('a b c')
    const long = cleanAskSteelAiLabel('x'.repeat(300))
    expect(long).toHaveLength(ASK_STEEL_AI_LABEL_MAX)
    expect(long.endsWith('…')).toBe(true)
  })

  it('appends the default question only when nothing was typed', () => {
    const prefix = 'Sobre o lead Ana: '
    expect(finalizeAskSteelAiPrompt(prefix, prefix)).toBe(
      `Sobre o lead Ana: ${ASK_STEEL_AI_DEFAULT_QUESTION}`,
    )
    expect(finalizeAskSteelAiPrompt(prefix, '   ')).toBe(
      `Sobre o lead Ana: ${ASK_STEEL_AI_DEFAULT_QUESTION}`,
    )
    expect(finalizeAskSteelAiPrompt(prefix, `${prefix}quem é o dono?`)).toBe(
      'Sobre o lead Ana: quem é o dono?',
    )
  })
})

describe('<AskSteelAiDialog />', () => {
  const reference = {
    kind: 'ticket',
    code: 'INC-000123',
    label: 'Impressora parada',
  } as const

  function renderDialog(onOpenChange = vi.fn()) {
    renderWithQuery(
      <AskSteelAiDialog
        open
        onOpenChange={onOpenChange}
        workspaceId='ws_1'
        slug='acme'
        reference={reference}
      />,
    )
    return onOpenChange
  }

  const input = () =>
    screen.getByLabelText('Pergunta para o Steel AI') as HTMLTextAreaElement

  it('prefills the prompt with the record reference', () => {
    renderDialog()
    expect(input().value).toBe(
      'Sobre o chamado INC-000123 — Impressora parada: ',
    )
  })

  it('creates an Ask conversation, stashes the exact prompt and navigates', async () => {
    const spy = createOk()
    const onOpenChange = renderDialog()
    fireEvent.change(input(), {
      target: {
        value: 'Sobre o chamado INC-000123 — Impressora parada: quem atende?',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Perguntar' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/acme/ai/c42'))
    expect(fetchBody(spy, /\/ai\/conversations$/)).toEqual({ mode: 'EXPLORE' })
    // The chat screen sends the message, never this dialog.
    expect(fetchBody(spy, '/messages')).toBeUndefined()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(takeSteelAiPrompt('c42')).toEqual({
      content: 'Sobre o chamado INC-000123 — Impressora parada: quem atende?',
      mode: 'EXPLORE',
    })
  })

  it('sends the default question when only the reference is left (Ctrl+Enter)', async () => {
    createOk()
    renderDialog()
    fireEvent.keyDown(input(), { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/acme/ai/c42'))
    expect(takeSteelAiPrompt('c42')?.content).toBe(
      `Sobre o chamado INC-000123 — Impressora parada: ${ASK_STEEL_AI_DEFAULT_QUESTION}`,
    )
  })

  it('ignores a plain Enter (new line, not submit)', () => {
    const spy = createOk()
    renderDialog()
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('fills the question from a suggestion chip', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Riscos' }))
    expect(input().value).toBe(
      'Sobre o chamado INC-000123 — Impressora parada: quais riscos ou pendências você vê aqui?',
    )
  })

  it('closes on Cancelar without creating anything', () => {
    const spy = createOk()
    const onOpenChange = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('reports a failure and stays on the page', async () => {
    mockFetch([
      {
        method: 'POST',
        match: /\/ai\/conversations$/,
        status: 403,
        error: 'IA desligada',
      },
    ])
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Perguntar' }))
    await waitFor(() => expect(errorSpy).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Perguntar' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    )
  })
})

describe('<AskSteelAiButton />', () => {
  it('opens the dialog and uses the slug from the URL when none is given', async () => {
    createOk()
    renderWithQuery(
      <AskSteelAiButton
        workspaceId='ws_1'
        reference={{ kind: 'company', label: 'Acme' }}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Perguntar ao Steel AI' }),
    )
    const field = (await screen.findByLabelText(
      'Pergunta para o Steel AI',
    )) as HTMLTextAreaElement
    expect(field.value).toBe('Sobre a empresa Acme: ')
    fireEvent.click(screen.getByRole('button', { name: 'Perguntar' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/from-url/ai/c42'))
  })
})
