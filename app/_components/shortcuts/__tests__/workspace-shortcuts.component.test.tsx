import { act, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'

const push = vi.fn()
let pathname = '/agro'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname,
}))
const prefs = vi.hoisted(() => ({
  data: { singleKeyShortcuts: true, quickSendShortcut: 'ENTER' } as
    | { singleKeyShortcuts: boolean; quickSendShortcut: string }
    | undefined,
}))
vi.mock('@/src/hooks/use-user-preferences', () => ({
  useUserPreferences: () => ({ data: prefs.data }),
}))
vi.mock('@/app/_components/steel-ai-ask/ask-steel-ai-dialog', () => ({
  AskSteelAiDialog: ({
    reference,
    onOpenChange,
  }: {
    reference: { kind: string; label: string }
    onOpenChange: (open: boolean) => void
  }) => (
    <div role='dialog' aria-label='Perguntar'>
      {reference.kind}:{reference.label}
      <button type='button' onClick={() => onOpenChange(false)}>
        fechar
      </button>
    </div>
  ),
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

import { availableCommands, workspaceCommands } from '../workspace-commands'
import { screenLabel, WorkspaceShortcuts } from '../workspace-shortcuts'

function press(key: string, init: KeyboardEventInit = {}, target?: Element) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  act(() => {
    ;(target ?? window).dispatchEvent(event)
  })
  return event
}

function renderShell(
  modules: string[] = ['SERVICE_DESK', 'CRM'],
  children: React.ReactNode = null,
) {
  mockFetch([
    {
      match: '/ai/capabilities',
      data: { aiEnabled: true, modules },
    },
  ])
  return renderWithQuery(
    <WorkspaceShortcuts slug='agro' workspaceId='ws1' wikiEnabled={false}>
      {children}
    </WorkspaceShortcuts>,
  )
}

beforeEach(() => {
  push.mockClear()
  notify.success.mockClear()
  pathname = '/agro'
  prefs.data = { singleKeyShortcuts: true, quickSendShortcut: 'ENTER' }
})

describe('WorkspaceShortcuts', () => {
  it('navigates with G sequences only to enabled modules', async () => {
    renderShell()
    await waitFor(() => {
      press('g')
      press('c')
      expect(push).toHaveBeenCalledWith('/agro/crm')
    })
    press('g')
    press('n')
    expect(push).toHaveBeenCalledWith('/agro/inbox')
    press('g')
    press('z')
    expect(push).not.toHaveBeenCalledWith('/agro/zap')
    press('g')
    press('w')
    expect(push).not.toHaveBeenCalledWith('/agro/wiki')
  })

  it('creates with C sequences, with a full load on the same page', async () => {
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        origin: 'http://x',
        assign,
        href: 'http://x/agro',
      },
    })
    pathname = '/agro/crm/leads'
    renderShell()
    await waitFor(() => {
      press('c')
      press('t')
      expect(push).toHaveBeenCalledWith('/agro/servicedesk/tickets?new=1')
    })
    press('c')
    press('l')
    expect(assign).toHaveBeenCalledWith('/agro/crm/leads?new=1')
  })

  it('turns single keys off from the preference', async () => {
    prefs.data = { singleKeyShortcuts: false, quickSendShortcut: 'CTRL_ENTER' }
    renderShell()
    await new Promise((r) => setTimeout(r, 50))
    press('g')
    press('c')
    expect(push).not.toHaveBeenCalled()
  })

  it('Esc leaves a field; Ctrl+Enter submits and Ctrl+S saves', () => {
    const submit = vi.fn((e: React.FormEvent) => e.preventDefault())
    const save = vi.fn()
    renderShell(
      [],
      <>
        <form onSubmit={submit}>
          <input aria-label='Nome' />
          <button type='submit'>Criar</button>
        </form>
        <button type='button' data-shortcut-save onClick={save}>
          Salvar
        </button>
        <div
          contentEditable
          data-testid='rico'
          suppressContentEditableWarning
        />
      </>,
    )
    const input = screen.getByLabelText('Nome')
    input.focus()
    press('Escape', {}, input)
    expect(document.activeElement).not.toBe(input)
    expect(press('Escape').defaultPrevented).toBe(false)
    expect(
      press('Escape', {}, screen.getByTestId('rico')).defaultPrevented,
    ).toBe(false)

    press('Enter', { ctrlKey: true }, input)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(press('Enter', { ctrlKey: true }).defaultPrevented).toBe(false)

    press('s', { ctrlKey: true }, input)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+S falls back to the focused form, else leaves the browser alone', () => {
    const submit = vi.fn((e: React.FormEvent) => e.preventDefault())
    renderShell(
      [],
      <form onSubmit={submit}>
        <input aria-label='Nome' />
        <button type='submit'>Salvar</button>
      </form>,
    )
    press('s', { ctrlKey: true }, screen.getByLabelText('Nome'))
    expect(submit).toHaveBeenCalledTimes(1)
    expect(press('s', { ctrlKey: true }).defaultPrevented).toBe(false)
  })

  it('copies the page link with Shift+L', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    renderShell()
    press('L', { shiftKey: true })
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Link copiado'),
    )
    expect(writeText).toHaveBeenCalled()
  })

  it('Ctrl+I asks Steel AI about the screen', async () => {
    document.title = 'Incidentes | ServiceDesk | Steel'
    renderShell()
    await waitFor(() => {
      press('i', { ctrlKey: true })
      expect(screen.getByRole('dialog', { name: 'Perguntar' })).toBeTruthy()
    })
    expect(screen.getByText('page:Incidentes · ServiceDesk')).toBeTruthy()
    act(() => screen.getByText('fechar').click())
    expect(screen.queryByRole('dialog', { name: 'Perguntar' })).toBeNull()
  })
})

describe('workspace commands', () => {
  it('filters by module and wiki', () => {
    expect(workspaceCommands('a')).toHaveLength(17)
    const ids = availableCommands('a', ['CRM'], false).map((c) => c.id)
    expect(ids).toContain('create.lead')
    expect(ids).not.toContain('create.ticket')
    expect(ids).not.toContain('nav.wiki')
    expect(availableCommands('a', [], true).map((c) => c.id)).toContain(
      'nav.wiki',
    )
  })

  it('labels the screen from the page title', () => {
    expect(screenLabel('Leads | CRM | Steel')).toBe('Leads · CRM')
    expect(screenLabel('Steel')).toBe('atual')
  })
})
