import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import { takeSteelAiPrompt } from '../steel-ai-handoff'
import { SteelAiModeSwitch } from '../steel-ai-mode-switch'
import { SteelAiWelcome } from '../steel-ai-welcome'
import {
  capabilities,
  conversation,
  renderSteelAi,
} from './steel-ai-test-utils'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/ai',
}))

afterEach(() => {
  window.sessionStorage.clear()
})

function setup(caps = capabilities()) {
  return mockFetch([
    { match: '/ai/capabilities', data: caps },
    {
      method: 'POST',
      match: /\/ai\/conversations$/,
      status: 201,
      data: conversation({ id: 'c42' }),
    },
  ])
}

describe('<SteelAiWelcome />', () => {
  it('greets the user and lists starters for the enabled modules', async () => {
    setup(capabilities({ modules: ['CRM'] }))
    renderSteelAi(<SteelAiWelcome />)
    expect(screen.getByRole('heading', { name: 'Olá, Ana' })).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: /Pipeline por estágio/ }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /SLA em risco/ })).toBeNull()
  })

  it('creates the conversation, hands the prompt over and navigates', async () => {
    const spy = setup()
    renderSteelAi(<SteelAiWelcome />)
    await screen.findByRole('button', { name: /Pipeline por estágio/ })

    fireEvent.click(screen.getByRole('button', { name: /^Agente$/ }))
    fireEvent.change(screen.getByLabelText('Mensagem para o Steel AI'), {
      target: { value: '  Feche a oportunidade Acme  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/acme/ai/c42'))
    expect(fetchBody(spy, /\/ai\/conversations$/)).toEqual({ mode: 'AGENT' })
    // The message itself is sent by the chat screen, never from here.
    expect(fetchBody(spy, '/messages')).toBeUndefined()
    expect(takeSteelAiPrompt('c42')).toEqual({
      content: 'Feche a oportunidade Acme',
      mode: 'AGENT',
    })
    // Taken once: a remount of the chat screen does not resend it.
    expect(takeSteelAiPrompt('c42')).toBeNull()
  })

  it('starts from a prompt starter with its own mode', async () => {
    const spy = setup()
    renderSteelAi(<SteelAiWelcome />)
    fireEvent.click(
      await screen.findByRole('button', { name: /Criar tarefas de follow-up/ }),
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith('/acme/ai/c42'))
    expect(fetchBody(spy, /\/ai\/conversations$/)).toEqual({ mode: 'AGENT' })
  })

  it('submits with Enter but not with Shift+Enter', async () => {
    setup()
    renderSteelAi(<SteelAiWelcome />)
    const box = screen.getByLabelText('Mensagem para o Steel AI')
    fireEvent.change(box, { target: { value: 'Oi' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(push).not.toHaveBeenCalled()
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/acme/ai/c42'))
  })

  it('shows the API error and stays when the conversation cannot be created', async () => {
    mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      {
        method: 'POST',
        match: /\/ai\/conversations$/,
        status: 403,
        error: 'Você não tem acesso a este workspace.',
      },
    ])
    renderSteelAi(<SteelAiWelcome />)
    fireEvent.change(screen.getByLabelText('Mensagem para o Steel AI'), {
      target: { value: 'Oi' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    expect(
      await screen.findByText('Você não tem acesso a este workspace.'),
    ).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })

  it('blocks sending when the monthly quota is used up', async () => {
    setup(capabilities({ quota: { usedUsd: 50, quotaUsd: 50 } }))
    renderSteelAi(<SteelAiWelcome />)
    expect(await screen.findByText(/cota mensal de IA/)).toBeTruthy()
    expect(
      (screen.getByLabelText('Mensagem para o Steel AI') as HTMLTextAreaElement)
        .disabled,
    ).toBe(true)
  })

  it('disables Agente when agent mode is turned off for the workspace', async () => {
    setup(capabilities({ agentModeEnabled: false }))
    renderSteelAi(<SteelAiWelcome />)
    await screen.findByRole('button', { name: /Pipeline por estágio/ })
    const agent = screen.getByRole('button', { name: /^Agente$/ })
    expect((agent as HTMLButtonElement).disabled).toBe(true)
    // Agent-only starters are hidden too.
    expect(
      screen.queryByRole('button', { name: /Criar tarefas de follow-up/ }),
    ).toBeNull()
  })
})

describe('<SteelAiModeSwitch />', () => {
  it('reports the selected mode and explains why Agente is locked', async () => {
    const onChange = vi.fn()
    renderSteelAi(
      <SteelAiModeSwitch
        value='EXPLORE'
        onChange={onChange}
        agentModeEnabled={false}
      />,
    )
    const explore = screen.getByRole('button', { name: /Explorar/ })
    const agent = screen.getByRole('button', { name: /^Agente$/ })
    expect(explore.getAttribute('aria-pressed')).toBe('true')
    expect((agent as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(agent)
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.focus(agent.parentElement as HTMLElement)
    expect(await screen.findByText(/O modo Agente foi desativado/)).toBeTruthy()
  })

  it('switches modes when enabled', () => {
    const onChange = vi.fn()
    renderSteelAi(
      <SteelAiModeSwitch
        value='EXPLORE'
        onChange={onChange}
        agentModeEnabled
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Agente$/ }))
    expect(onChange).toHaveBeenCalledWith('AGENT')
  })
})
