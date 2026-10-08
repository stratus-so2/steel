import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderSteelAi } from '@/app/_components/steel-ai/__tests__/steel-ai-test-utils'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import type { AiSkillDTO, AiSkillListDTO } from '@/types/ai-skill'
import { SteelAiSkillForm, validateSkillForm } from '../steel-ai-skill-form'
import { appendSkillInstructions } from '../steel-ai-skill-insert-menu'
import { SteelAiSkillsPage } from '../steel-ai-skills-page'

function skill(over: Partial<AiSkillDTO> = {}): AiSkillDTO {
  return {
    id: 'builtin:my-work',
    kind: 'BUILT_IN',
    slug: 'my-work',
    name: 'Meu trabalho',
    description: 'Seus itens em aberto',
    instructions: 'Liste tudo.',
    mode: 'EXPLORE',
    toolNames: ['sd_my_queue'],
    enabled: true,
    canEdit: false,
    canToggle: true,
    canDelete: false,
    updatedAt: null,
    ...over,
  }
}

const TOOLS = [
  { name: 'ws_overview', label: 'Consultando o workspace' },
  { name: 'sd_my_queue', label: 'Consultando minha fila' },
]

function list(over: Partial<AiSkillListDTO> = {}): AiSkillListDTO {
  return {
    canManageWorkspace: true,
    skills: [
      skill(),
      skill({
        id: 'builtin:sla',
        slug: 'sla',
        name: 'SLA em risco',
        enabled: false,
        mode: null,
      }),
      skill({
        id: 'p1',
        kind: 'PERSONAL',
        slug: 'resumo',
        name: 'Resumo',
        mode: 'AGENT',
        canEdit: true,
        canDelete: true,
      }),
    ],
    ...over,
  }
}

function setup(data = list()) {
  return mockFetch([
    { match: /\/ai\/skills$/, data },
    {
      match: '/agents/catalog',
      data: {
        tools: TOOLS,
        events: [],
        agentModeEnabled: true,
        canManage: true,
      },
    },
    { method: 'POST', match: /\/ai\/skills$/, status: 201, data: skill() },
    { method: 'PATCH', match: '/ai/skills/', data: skill() },
    { method: 'DELETE', match: '/ai/skills/', data: { id: 'p1' } },
  ])
}

describe('validateSkillForm()', () => {
  it('requires every field and a valid command', () => {
    expect(
      validateSkillForm({
        scope: 'PERSONAL',
        name: '',
        slug: 'Meu comando',
        description: ' ',
        instructions: '',
        mode: null,
        toolNames: [],
      }),
    ).toEqual({
      name: 'Informe o nome',
      slug: 'Use letras minúsculas, números e hífens (ex.: meu-trabalho)',
      description: 'Descreva a skill',
      instructions: 'Escreva as instruções',
    })
    expect(
      validateSkillForm({
        scope: 'PERSONAL',
        name: 'x',
        slug: '/',
        description: 'x',
        instructions: 'x',
        mode: null,
        toolNames: [],
      }).slug,
    ).toBe('Informe o comando')
  })

  it('appends skill instructions to an agent prompt', () => {
    const s = { slug: 'sla', name: 'SLA', instructions: 'Liste.' }
    expect(appendSkillInstructions('', s)).toBe('## Skill /sla — SLA\nListe.')
    expect(appendSkillInstructions('Base.\n\n', s)).toBe(
      'Base.\n\n## Skill /sla — SLA\nListe.',
    )
  })
})

describe('<SteelAiSkillForm />', () => {
  it('shows validation errors and submits the normalized skill', () => {
    const onSubmit = vi.fn()
    render(
      <SteelAiSkillForm
        canManageWorkspace
        tools={TOOLS}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Criar skill' }))
    expect(screen.getByText('Informe o nome')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: ' Resumo ' },
    })
    fireEvent.change(screen.getByLabelText('Comando'), {
      target: { value: '/Resumo-Cliente' },
    })
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'Resumo do cliente' },
    })
    fireEvent.change(screen.getByLabelText('Instruções'), {
      target: { value: 'Resuma.' },
    })
    fireEvent.click(screen.getByText('Todo o workspace'))
    fireEvent.change(screen.getByLabelText(/Ferramentas sugeridas/), {
      target: { value: 'fila' },
    })
    expect(screen.queryByText('Consultando o workspace')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText(/Ferramentas sugeridas/), {
      target: { value: 'nada-disso' },
    })
    expect(screen.getByText('Nenhuma ferramenta encontrada.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Criar skill' }))

    expect(onSubmit).toHaveBeenCalledWith({
      scope: 'WORKSPACE',
      name: 'Resumo',
      slug: 'resumo-cliente',
      description: 'Resumo do cliente',
      instructions: 'Resuma.',
      mode: null,
      toolNames: ['sd_my_queue'],
    })
  })

  it('edits without the scope and unchecks a tool', () => {
    const onSubmit = vi.fn()
    render(
      <SteelAiSkillForm
        skill={skill({ kind: 'PERSONAL', canEdit: true })}
        canManageWorkspace={false}
        tools={TOOLS}
        error='Já existe uma skill com este comando'
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText('Todo o workspace')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Já existe')
    const checked = screen
      .getAllByRole('checkbox')
      .find((box) => box.getAttribute('aria-checked') === 'true')
    if (!checked) throw new Error('no checked tool')
    fireEvent.click(checked)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'my-work',
        toolNames: [],
        mode: 'EXPLORE',
      }),
    )
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('scope')
  })

  it('is read-only for a built-in', () => {
    const onCancel = vi.fn()
    render(
      <SteelAiSkillForm
        skill={skill({ toolNames: [] })}
        canManageWorkspace
        tools={TOOLS}
        readOnly
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
    expect(screen.getByText('Qualquer ferramenta disponível')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('<SteelAiSkillsPage />', () => {
  it('groups the skills and links "Usar no chat"', async () => {
    setup()
    renderSteelAi(<SteelAiSkillsPage workspaceId='ws_1' slug='acme' />)
    expect(await screen.findByText('/resumo')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: /Embutidas \(2\)/ }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: /Do workspace \(0\)/ }),
    ).toBeTruthy()
    expect(screen.getByText('Desativada')).toBeTruthy()
    expect(
      screen.getByLabelText('Usar /my-work no chat').getAttribute('href'),
    ).toBe('/acme/ai?skill=my-work')
    expect(
      screen.getByRole('button', { name: 'Usar /sla no chat' }),
    ).toBeTruthy()
  })

  it('toggles a built-in', async () => {
    const spy = setup()
    renderSteelAi(<SteelAiSkillsPage workspaceId='ws_1' slug='acme' />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Ativar /sla' }))
    await waitFor(() =>
      expect(fetchBody(spy, '/ai/skills/builtin%3Asla', 'PATCH')).toEqual({
        enabled: true,
      }),
    )
  })

  it('creates a skill from the dialog', async () => {
    const spy = setup()
    renderSteelAi(<SteelAiSkillsPage workspaceId='ws_1' slug='acme' />)
    await screen.findByText('/resumo')
    fireEvent.click(screen.getByRole('button', { name: 'Nova skill' }))
    fireEvent.change(await screen.findByLabelText('Nome'), {
      target: { value: 'Nova' },
    })
    fireEvent.change(screen.getByLabelText('Comando'), {
      target: { value: 'nova' },
    })
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'Desc' },
    })
    fireEvent.change(screen.getByLabelText('Instruções'), {
      target: { value: 'Faça.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar skill' }))
    await waitFor(() =>
      expect(fetchBody(spy, /\/ai\/skills$/)).toMatchObject({
        scope: 'PERSONAL',
        slug: 'nova',
      }),
    )
  })

  it('opens a built-in read-only and edits a personal skill', async () => {
    const spy = setup()
    renderSteelAi(<SteelAiSkillsPage workspaceId='ws_1' slug='acme' />)
    fireEvent.click(await screen.findByText('/my-work'))
    expect(
      await screen.findByText(/pode ser desativada, mas não editada/),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    fireEvent.click(screen.getByText('/resumo'))
    fireEvent.change(await screen.findByLabelText('Nome'), {
      target: { value: 'Resumo 2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(fetchBody(spy, '/ai/skills/p1', 'PATCH')).toMatchObject({
        name: 'Resumo 2',
      }),
    )
  })

  it('shows the error state', async () => {
    mockFetch([
      { match: /\/ai\/skills$/, status: 500, error: 'x' },
      { match: '/agents/catalog', status: 500, error: 'x' },
    ])
    renderSteelAi(<SteelAiSkillsPage workspaceId='ws_1' slug='acme' />)
    expect(
      await screen.findByText('Não foi possível carregar as skills.'),
    ).toBeTruthy()
  })

  it('tells members that admins create workspace skills', async () => {
    setup(list({ canManageWorkspace: false }))
    renderSteelAi(<SteelAiSkillsPage workspaceId='ws_1' slug='acme' />)
    expect(
      await screen.findByText(/Administradores criam skills para o time/),
    ).toBeTruthy()
  })
})
