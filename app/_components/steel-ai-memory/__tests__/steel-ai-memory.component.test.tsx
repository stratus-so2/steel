import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderSteelAi } from '@/app/_components/steel-ai/__tests__/steel-ai-test-utils'
import { notify } from '@/lib/notify'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import type { AiMemoryDTO, AiMemoryListDTO } from '@/types/ai-memory'
import { formatMemoryDate, SteelAiMemoryPage } from '../steel-ai-memory-page'

vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}))

function memory(over: Partial<AiMemoryDTO> = {}): AiMemoryDTO {
  return {
    id: 'm1',
    scope: 'PERSONAL',
    content: 'Prefiro respostas em tópicos',
    source: 'AUTO',
    sourceConversationId: 'conv1',
    lastUsedAt: '2026-10-08T02:00:00.000Z',
    createdAt: '2026-10-07T12:00:00.000Z',
    updatedAt: '2026-10-07T12:00:00.000Z',
    canEdit: true,
    ...over,
  }
}

function list(over: Partial<AiMemoryListDTO> = {}): AiMemoryListDTO {
  return {
    memoryEnabled: true,
    canManageWorkspace: false,
    workspace: [
      memory({
        id: 'w1',
        scope: 'WORKSPACE',
        content: 'O suporte atende das 8h às 18h',
        source: 'MANUAL',
        sourceConversationId: null,
        lastUsedAt: null,
        canEdit: false,
      }),
    ],
    personal: [memory()],
    ...over,
  }
}

function setup(data = list()) {
  return mockFetch([
    { match: '/ai/memories', data },
    { method: 'POST', match: '/ai/memories', status: 201, data: memory() },
    { method: 'PATCH', match: '/ai/memories/m1', data: memory() },
    { method: 'DELETE', match: '/ai/memories/m1', data: { id: 'm1' } },
  ])
}

const render = () =>
  renderSteelAi(<SteelAiMemoryPage workspaceId='ws_1' slug='acme' />)

describe('<SteelAiMemoryPage />', () => {
  it('formats dates in the workspace zone, not the browser’s', () => {
    // 02:00 UTC is still the previous day in São Paulo.
    expect(formatMemoryDate('2026-10-08T02:00:00.000Z')).toBe('07/10/2026')
  })

  it('lists both layers with source, dates and the conversation link', async () => {
    setup()
    render()
    expect(await screen.findByText('Prefiro respostas em tópicos')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: /Workspace \(1\)/ }),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Pessoal \(1\)/ })).toBeTruthy()
    expect(screen.getByText('Automática')).toBeTruthy()
    expect(screen.getByText('Manual')).toBeTruthy()
    expect(screen.getByText('· usada em 07/10/2026')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Ver conversa' }).getAttribute('href'),
    ).toBe('/acme/ai/conv1')
    // Members only edit their own facts and add personal ones.
    expect(
      screen.getAllByRole('button', { name: 'Editar memória' }),
    ).toHaveLength(1)
    expect(screen.queryByLabelText('Novo fato do workspace')).toBeNull()
    expect(screen.getByLabelText('Novo fato pessoal')).toBeTruthy()
  })

  it('edits inline, cancels with Escape and saves', async () => {
    const spy = setup()
    render()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Editar memória' }),
    )
    const box = screen.getByLabelText('Editar memória')
    fireEvent.change(box, { target: { value: 'Rascunho' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(
      screen.queryByLabelText('Editar memória', { selector: 'textarea' }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Editar memória' }))
    fireEvent.change(
      screen.getByLabelText('Editar memória', { selector: 'textarea' }),
      {
        target: { value: 'Prefiro tabelas' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(fetchBody(spy, '/ai/memories/m1', 'PATCH')).toEqual({
        content: 'Prefiro tabelas',
      }),
    )
  })

  it('cancels an edit with the button', async () => {
    setup()
    render()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Editar memória' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText('Prefiro respostas em tópicos')).toBeTruthy()
  })

  it('deletes and adds facts', async () => {
    const spy = setup(list({ canManageWorkspace: true }))
    render()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Apagar memória' }),
    )
    await waitFor(() =>
      expect(
        spy.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/ai/memories/m1') &&
            init?.method === 'DELETE',
        ),
      ).toBe(true),
    )

    fireEvent.change(screen.getByLabelText('Novo fato do workspace'), {
      target: { value: 'O time usa Kanban' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar' })[0])
    await waitFor(() =>
      expect(fetchBody(spy, '/ai/memories')).toEqual({
        scope: 'WORKSPACE',
        content: 'O time usa Kanban',
      }),
    )
  })

  it('reports a refused fact', async () => {
    mockFetch([
      { match: '/ai/memories', data: list() },
      {
        method: 'POST',
        match: '/ai/memories',
        status: 422,
        error: 'Não guardo senhas',
      },
    ])
    render()
    fireEvent.change(await screen.findByLabelText('Novo fato pessoal'), {
      target: { value: 'senha 123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Não guardo senhas'),
    )
  })

  it('searches and shows the empty result', async () => {
    const spy = mockFetch([
      {
        match: '/ai/memories',
        handler: (url) =>
          url.includes('q=') ? list({ workspace: [], personal: [] }) : list(),
      },
    ])
    render()
    await screen.findByText('Prefiro respostas em tópicos')
    fireEvent.change(screen.getByLabelText('Buscar na memória'), {
      target: { value: 'kanban' },
    })
    await waitFor(() =>
      expect(screen.getAllByText('Nada encontrado.')).toHaveLength(2),
    )
    expect(
      spy.mock.calls.some(([url]) => String(url).includes('q=kanban')),
    ).toBe(true)
    expect(screen.queryByLabelText('Novo fato pessoal')).toBeNull()
  })

  it('explains that memory is off and hides the add forms', async () => {
    setup(list({ memoryEnabled: false, workspace: [], personal: [] }))
    render()
    expect(
      await screen.findByText(/A memória está desligada neste workspace/),
    ).toBeTruthy()
    expect(screen.getByText(/Um administrador pode ativá-la/)).toBeTruthy()
    expect(screen.queryByLabelText('Novo fato pessoal')).toBeNull()
    expect(screen.getByText(/Nenhum fato pessoal ainda/)).toBeTruthy()
  })

  it('tells admins where to switch memory on', async () => {
    setup(list({ memoryEnabled: false, canManageWorkspace: true }))
    render()
    expect(await screen.findByText(/Ative em Ajustes > Steel IA/)).toBeTruthy()
  })

  it('shows the error state', async () => {
    mockFetch([{ match: '/ai/memories', status: 500, error: 'x' }])
    render()
    expect(
      await screen.findByText('Não foi possível carregar a memória.'),
    ).toBeTruthy()
  })
})
