import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import type { AiConversationModeDTO } from '@/types/steel-ai'
import { SteelAiComposer } from '../steel-ai-composer'
import { SteelAiMemoryChip } from '../steel-ai-memory-chip'
import {
  filterSkillOptions,
  type SteelAiSkillOption,
  skillQueryOf,
} from '../steel-ai-skill-picker'
import { skillFromSearch } from '../steel-ai-welcome'

const SKILLS: SteelAiSkillOption[] = [
  {
    id: 'builtin:my-work',
    slug: 'my-work',
    name: 'Meu trabalho',
    description: 'Seus itens em aberto',
    kind: 'BUILT_IN',
    mode: 'EXPLORE',
  },
  {
    id: 'builtin:sla',
    slug: 'sla',
    name: 'SLA em risco',
    description: 'Chamados com SLA estourado',
    kind: 'BUILT_IN',
    mode: null,
  },
  {
    id: 's1',
    slug: 'triagem',
    name: 'Triagem',
    description: 'Classifica e atribui chamados',
    kind: 'WORKSPACE',
    mode: 'AGENT',
  },
]

function Harness({
  onModeChange = vi.fn(),
  onSubmit = vi.fn(),
  agentModeEnabled = true,
  initialMode = 'EXPLORE',
}: {
  onModeChange?: (mode: AiConversationModeDTO) => void
  onSubmit?: () => void
  agentModeEnabled?: boolean
  initialMode?: AiConversationModeDTO
}) {
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<AiConversationModeDTO>(initialMode)
  return (
    <SteelAiComposer
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      mode={mode}
      onModeChange={(next) => {
        setMode(next)
        onModeChange(next)
      }}
      agentModeEnabled={agentModeEnabled}
      skills={SKILLS}
    />
  )
}

const textbox = () => screen.getByLabelText('Mensagem para o Steel AI')
const type = (value: string) =>
  fireEvent.change(textbox(), { target: { value } })
const key = (k: string, extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(textbox(), { key: k, ...extra })

describe('skill picker helpers', () => {
  it('detects the command being typed', () => {
    expect(skillQueryOf('/')).toBe('')
    expect(skillQueryOf('/My-W')).toBe('my-w')
    expect(skillQueryOf('/my-work ')).toBeNull()
    expect(skillQueryOf('oi /x')).toBeNull()
  })

  it('ranks command prefixes before text matches', () => {
    expect(filterSkillOptions(SKILLS, '').map((s) => s.slug)).toEqual([
      'my-work',
      'sla',
      'triagem',
    ])
    expect(filterSkillOptions(SKILLS, 'cha').map((s) => s.slug)).toEqual([
      'sla',
      'triagem',
    ])
    expect(filterSkillOptions(SKILLS, 's').map((s) => s.slug)).toEqual([
      'sla',
      'my-work',
      'triagem',
    ])
    expect(filterSkillOptions(SKILLS, 'zzz')).toEqual([])
  })

  it('reads ?skill= only when it is a valid command', () => {
    expect(skillFromSearch('?skill=My-Work')).toBe('my-work')
    expect(skillFromSearch('?skill=a b')).toBeNull()
    expect(skillFromSearch('')).toBeNull()
  })
})

describe('<SteelAiComposer /> slash picker', () => {
  it('opens on "/" and filters as you type', () => {
    render(<Harness />)
    expect(screen.queryByRole('listbox')).toBeNull()
    type('/')
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(textbox().getAttribute('aria-expanded')).toBe('true')
    type('/triag')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0].textContent).toContain('/triagem')
    type('/zzz')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('navigates with the arrows and picks with Enter without sending', () => {
    const onSubmit = vi.fn()
    const onModeChange = vi.fn()
    render(<Harness onSubmit={onSubmit} onModeChange={onModeChange} />)
    type('/')
    key('ArrowDown')
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe(
      'true',
    )
    key('ArrowUp')
    key('ArrowUp')
    expect(screen.getAllByRole('option')[2].getAttribute('aria-selected')).toBe(
      'true',
    )
    key('Enter')
    expect((textbox() as HTMLTextAreaElement).value).toBe('/triagem ')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onModeChange).toHaveBeenCalledWith('AGENT')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('picks with Tab and a click; keeps the mode when not allowed', () => {
    const onModeChange = vi.fn()
    render(<Harness agentModeEnabled={false} onModeChange={onModeChange} />)
    type('/tri')
    key('Tab')
    expect((textbox() as HTMLTextAreaElement).value).toBe('/triagem ')
    expect(onModeChange).not.toHaveBeenCalled()

    type('/s')
    fireEvent.mouseEnter(screen.getAllByRole('option')[0])
    fireEvent.click(screen.getAllByRole('option')[0])
    expect((textbox() as HTMLTextAreaElement).value).toBe('/sla ')
  })

  it('closes with Escape and then sends normally', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    type('/sla')
    key('Escape')
    expect(screen.queryByRole('listbox')).toBeNull()
    key('Enter')
    expect(onSubmit).toHaveBeenCalled()
  })

  it('does not switch when the skill keeps the current mode', () => {
    const onModeChange = vi.fn()
    render(<Harness onModeChange={onModeChange} />)
    type('/my')
    key('Enter')
    expect(onModeChange).not.toHaveBeenCalled()
  })
})

describe('<SteelAiMemoryChip />', () => {
  const memory = {
    id: 'm1',
    scope: 'PERSONAL' as const,
    content: 'Prefere tabelas',
    action: 'saved' as const,
  }

  it('undoes a saved memory', async () => {
    const spy = mockFetch([
      { method: 'DELETE', match: '/ai/memories/m1', data: { id: 'm1' } },
    ])
    renderWithQuery(
      <ul>
        <SteelAiMemoryChip workspaceId='ws1' memory={memory} />
      </ul>,
    )
    expect(screen.getByText('Memória salva')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await waitFor(() =>
      expect(screen.getByText('Memória desfeita')).toBeTruthy(),
    )
    expect(spy).toHaveBeenCalledWith(
      '/api/workspaces/ws1/ai/memories/m1',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull()
  })

  it('treats an already deleted memory as undone and reports failures', async () => {
    mockFetch([
      {
        method: 'DELETE',
        match: '/ai/memories/m1',
        handler: () =>
          new Response(
            JSON.stringify({
              success: false,
              message: 'Memória não encontrada',
              error: { code: 'AI_MEMORY_NOT_FOUND' },
            }),
            { status: 404 },
          ),
      },
      { method: 'DELETE', match: '/ai/memories/m2', status: 500, error: 'x' },
    ])
    renderWithQuery(
      <ul>
        <SteelAiMemoryChip workspaceId='ws1' memory={memory} />
        <SteelAiMemoryChip
          workspaceId='ws1'
          memory={{ ...memory, id: 'm2', scope: 'WORKSPACE' }}
        />
      </ul>,
    )
    const [first, second] = screen.getAllByRole('button', { name: 'Desfazer' })
    fireEvent.click(first)
    await waitFor(() =>
      expect(screen.getByText('Memória desfeita')).toBeTruthy(),
    )
    fireEvent.click(second)
    await waitFor(() =>
      expect(screen.getByText(/Não foi possível desfazer/)).toBeTruthy(),
    )
    expect(screen.getByText(/\(workspace\)/)).toBeTruthy()
  })

  it('shows duplicates and forgotten facts without undo', () => {
    renderWithQuery(
      <ul>
        <SteelAiMemoryChip
          workspaceId='ws1'
          memory={{ ...memory, action: 'duplicate' }}
        />
        <SteelAiMemoryChip
          workspaceId='ws1'
          memory={{ ...memory, id: 'm3', action: 'forgotten' }}
        />
      </ul>,
    )
    expect(screen.getByText('Já estava na memória')).toBeTruthy()
    expect(screen.getByText('Memória esquecida')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull()
  })
})
