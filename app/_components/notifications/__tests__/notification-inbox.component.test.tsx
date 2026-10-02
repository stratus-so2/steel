import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type FetchRoute,
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { NotificationInbox } from '../notification-inbox'

vi.setConfig({ testTimeout: 20_000 })

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('sonner', () => ({ toast }))

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const BASE = '/api/workspaces/ws_1/notifications'

function notification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    workspaceId: 'ws_1',
    kind: 'SD_SLA_BREACHED',
    title: 'SLA violado: INC-000123',
    body: 'O prazo de resolução estourou às 14h.',
    href: '/acme/servicedesk/tickets/123',
    read: false,
    readAt: null,
    archived: false,
    archivedAt: null,
    module: 'SERVICE_DESK',
    moduleLabel: 'ServiceDesk',
    kindLabel: 'SLA violado',
    icon: 'alarm',
    color: 'rose',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

const WHATSAPP = notification({
  id: 'n2',
  kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
  title: 'Sentimento negativo: Maria',
  body: 'A conversa com Maria está com média -0,50.',
  href: '/acme/zap?conversa=c1',
  read: true,
  readAt: new Date().toISOString(),
  module: 'COMMUNICATION',
  moduleLabel: 'Comunicação',
  kindLabel: 'Sentimento negativo',
  icon: 'chat',
  color: 'rose',
})

function page(items: unknown[], extra: Record<string, unknown> = {}) {
  return {
    items,
    unreadCount: 1,
    nextCursor: null,
    counts: { all: items.length, unread: 1, archived: 2 },
    ...extra,
  }
}

function routes(extra: FetchRoute[] = []): FetchRoute[] {
  return [
    ...extra,
    { method: 'POST', match: `${BASE}/actions`, data: { updated: 1 } },
    { method: 'POST', match: `${BASE}/read`, data: { updated: 1 } },
    // O resumo do chamado é opcional: aqui ele não existe (degrada).
    {
      match: /\/servicedesk\/tickets\//,
      status: 404,
      error: 'Chamado não encontrado',
    },
    { match: BASE, handler: () => page([notification(), WHATSAPP]) },
  ]
}

function render() {
  return renderWithQuery(<NotificationInbox workspaceId='ws_1' />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('<NotificationInbox /> — lista', () => {
  it('mostra remetente, assunto, prévia e as pastas com contagem', async () => {
    mockFetch(routes())
    render()

    expect(await screen.findByText('SLA violado: INC-000123')).toBeTruthy()
    const list = screen.getByRole('list', { name: 'Notificações' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('ServiceDesk')).toBeTruthy()
    expect(within(rows[0]).getByText('SLA violado')).toBeTruthy()
    expect(
      within(rows[0]).getByText('O prazo de resolução estourou às 14h.'),
    ).toBeTruthy()
    // Só a primeira está não lida.
    expect(within(rows[0]).getByLabelText('Não lida')).toBeTruthy()
    expect(within(rows[1]).queryByLabelText('Não lida')).toBeNull()

    const folders = screen.getByRole('tablist', { name: 'Pastas' })
    expect(within(folders).getByRole('tab', { name: /Tudo/ })).toBeTruthy()
    expect(
      within(folders).getByRole('tab', { name: /Não lidas\s*1/ }),
    ).toBeTruthy()
    expect(
      within(folders).getByRole('tab', { name: /Arquivadas\s*2/ }),
    ).toBeTruthy()
  })

  it('mostra o estado vazio da pasta escolhida', async () => {
    mockFetch([
      {
        match: BASE,
        handler: (url) =>
          url.includes('folder=archived')
            ? page([], { counts: { all: 0, unread: 0, archived: 0 } })
            : page([notification()]),
      },
    ])
    render()
    await screen.findByText('SLA violado: INC-000123')

    fireEvent.click(screen.getByRole('tab', { name: /Arquivadas/ }))

    expect(
      await screen.findByText('Nenhuma notificação arquivada.'),
    ).toBeTruthy()
  })
})

describe('<NotificationInbox /> — painel de leitura', () => {
  it('abre a notificação, marca como lida e leva ao href pela ação principal', async () => {
    const spy = mockFetch(routes())
    render()

    fireEvent.click(await screen.findByText('SLA violado: INC-000123'))

    await waitFor(() =>
      expect(fetchBody(spy, `${BASE}/actions`)).toEqual({
        action: 'read',
        ids: ['n1'],
      }),
    )

    const panel = await screen.findByRole('article', { name: 'Notificação' })
    expect(within(panel).getByText('ServiceDesk')).toBeTruthy()
    expect(
      within(panel).getByText('O prazo de resolução estourou às 14h.'),
    ).toBeTruthy()
    // Sem resumo do chamado, o botão fica no texto genérico.
    fireEvent.click(within(panel).getByRole('button', { name: 'Abrir' }))
    expect(push).toHaveBeenCalledWith('/acme/servicedesk/tickets/123')
  })

  it('mostra o resumo do chamado e nomeia a ação principal com o código', async () => {
    mockFetch(
      routes([
        {
          match: /\/servicedesk\/tickets\//,
          data: {
            code: 'INC-000123',
            phase: { name: 'Em atendimento', color: '#2563eb' },
            priority: { name: 'Alta', color: null },
          },
        },
      ]),
    )
    render()

    fireEvent.click(await screen.findByText('SLA violado: INC-000123'))

    const panel = await screen.findByRole('article', { name: 'Notificação' })
    const summary = await within(panel).findByRole('region', {
      name: 'Resumo do chamado',
    })
    expect(within(summary).getByText('INC-000123')).toBeTruthy()
    expect(within(summary).getByText('Em atendimento')).toBeTruthy()
    expect(within(summary).getByText('Prioridade: Alta')).toBeTruthy()
    expect(
      await within(panel).findByRole('button', {
        name: 'Abrir chamado INC-000123',
      }),
    ).toBeTruthy()
  })

  it('arquiva pelo painel e oferece desfazer', async () => {
    const spy = mockFetch(routes())
    render()
    fireEvent.click(await screen.findByText('SLA violado: INC-000123'))
    const panel = await screen.findByRole('article', { name: 'Notificação' })

    fireEvent.click(within(panel).getByRole('button', { name: 'Arquivar' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith(
      'Arquivada',
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Desfazer' }),
      }),
    )

    // Desfazer manda a ação inversa.
    const [, options] = toast.success.mock.calls.at(-1) as [
      string,
      { action: { onClick: () => void } },
    ]
    options.action.onClick()
    await waitFor(() => {
      const bodies = spy.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => JSON.parse(String(init?.body)))
      expect(bodies).toEqual(
        expect.arrayContaining([{ action: 'unarchive', ids: ['n1'] }]),
      )
    })
  })
})

describe('<NotificationInbox /> — seleção e lote', () => {
  it('seleciona várias e aplica a ação em lote', async () => {
    const spy = mockFetch(routes())
    render()

    fireEvent.click(
      await screen.findByLabelText('Selecionar: SLA violado: INC-000123'),
    )
    fireEvent.click(
      screen.getByLabelText('Selecionar: Sentimento negativo: Maria'),
    )

    const toolbar = await screen.findByRole('toolbar', {
      name: 'Ações da seleção',
    })
    expect(within(toolbar).getByText('2 selecionadas')).toBeTruthy()

    fireEvent.click(within(toolbar).getByRole('button', { name: 'Arquivar' }))

    await waitFor(() =>
      expect(fetchBody(spy, `${BASE}/actions`)).toEqual({
        action: 'archive',
        ids: ['n1', 'n2'],
      }),
    )
  })

  it('exclui em lote e limpa a seleção', async () => {
    const spy = mockFetch(routes())
    render()
    fireEvent.click(
      await screen.findByLabelText('Selecionar: SLA violado: INC-000123'),
    )
    const toolbar = await screen.findByRole('toolbar', {
      name: 'Ações da seleção',
    })

    fireEvent.click(within(toolbar).getByRole('button', { name: 'Excluir' }))

    await waitFor(() =>
      expect(fetchBody(spy, `${BASE}/actions`)).toEqual({
        action: 'delete',
        ids: ['n1'],
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('toolbar', { name: 'Ações da seleção' }),
      ).toBeNull(),
    )
  })

  it('limpa a seleção pelo botão', async () => {
    mockFetch(routes())
    render()
    fireEvent.click(
      await screen.findByLabelText('Selecionar: SLA violado: INC-000123'),
    )
    const toolbar = await screen.findByRole('toolbar', {
      name: 'Ações da seleção',
    })

    fireEvent.click(
      within(toolbar).getByRole('button', { name: 'Limpar seleção' }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('toolbar', { name: 'Ações da seleção' }),
      ).toBeNull(),
    )
  })

  it('marca todas como lidas', async () => {
    const spy = mockFetch(routes())
    render()
    await screen.findByText('SLA violado: INC-000123')

    fireEvent.click(
      screen.getByRole('button', { name: 'Marcar todas como lidas' }),
    )

    await waitFor(() => expect(fetchBody(spy, `${BASE}/read`)).toEqual({}))
  })
})

describe('<NotificationInbox /> — atalhos de teclado', () => {
  async function renderWithRows() {
    const spy = mockFetch(routes())
    render()
    await screen.findByText('SLA violado: INC-000123')
    return spy
  }

  function row(id: string) {
    return document.querySelector(`[data-notification-row="${id}"]`)
  }

  it('navega com j/k e abre com Enter', async () => {
    await renderWithRows()

    fireEvent.keyDown(window, { key: 'j' })
    expect(document.activeElement).toBe(row('n1'))

    fireEvent.keyDown(window, { key: 'j' })
    expect(document.activeElement).toBe(row('n2'))

    fireEvent.keyDown(window, { key: 'k' })
    expect(document.activeElement).toBe(row('n1'))

    // Com o foco na linha, o Enter é o do próprio botão.
    fireEvent.click(row('n1') as HTMLElement)
    expect(
      await screen.findByRole('article', { name: 'Notificação' }),
    ).toBeTruthy()
  })

  it('arquiva com "e", exclui com "#" e seleciona com "x"', async () => {
    const spy = await renderWithRows()

    fireEvent.keyDown(window, { key: 'j' })
    fireEvent.keyDown(window, { key: 'x' })
    expect(
      await screen.findByRole('toolbar', { name: 'Ações da seleção' }),
    ).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() =>
      expect(
        screen.queryByRole('toolbar', { name: 'Ações da seleção' }),
      ).toBeNull(),
    )

    fireEvent.keyDown(window, { key: 'e' })
    await waitFor(() =>
      expect(fetchBody(spy, `${BASE}/actions`)).toEqual({
        action: 'archive',
        ids: ['n1'],
      }),
    )

    fireEvent.keyDown(window, { key: '#' })
    await waitFor(() => {
      const bodies = spy.mock.calls
        .filter(([url, init]) => String(url).includes('/actions') && init)
        .map(([, init]) => JSON.parse(String(init?.body)))
      expect(bodies).toEqual(
        expect.arrayContaining([{ action: 'delete', ids: ['n1'] }]),
      )
    })
  })

  it('foca a busca com "/" e abre os atalhos com "?"', async () => {
    await renderWithRows()

    fireEvent.keyDown(window, { key: '/' })
    expect(document.activeElement).toBe(
      screen.getByLabelText('Buscar nas notificações'),
    )

    // Dentro de um campo de texto, a tecla não vira atalho.
    fireEvent.keyDown(screen.getByLabelText('Buscar nas notificações'), {
      key: '?',
    })
    expect(screen.queryByText('Atalhos do teclado')).toBeNull()

    fireEvent.keyDown(window, { key: '?' })
    expect(await screen.findByText('Atalhos do teclado')).toBeTruthy()
    expect(screen.getByText('Próxima notificação')).toBeTruthy()
  })

  it('volta para a lista com "u"', async () => {
    await renderWithRows()
    fireEvent.click(await screen.findByText('SLA violado: INC-000123'))
    await screen.findByRole('article', { name: 'Notificação' })

    fireEvent.keyDown(window, { key: 'u' })

    await waitFor(() =>
      expect(screen.queryByRole('article', { name: 'Notificação' })).toBeNull(),
    )
  })
})

describe('<NotificationInbox /> — filtros, busca e paginação', () => {
  it('filtra por módulo e limita os tipos ao módulo escolhido', async () => {
    const spy = mockFetch(routes())
    render()
    await screen.findByText('SLA violado: INC-000123')

    fireEvent.click(screen.getByLabelText('Filtrar por módulo'))
    const option = await screen.findByRole('option', { name: 'Comunicação' })
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.click(option)

    await waitFor(() =>
      expect(
        spy.mock.calls.some(([url]) =>
          String(url).includes('module=COMMUNICATION'),
        ),
      ).toBe(true),
    )

    fireEvent.click(screen.getByLabelText('Filtrar por tipo'))
    expect(
      await screen.findByRole('option', { name: 'Sentimento negativo' }),
    ).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'SLA violado' })).toBeNull()
  })

  it('busca por texto no título e no corpo', async () => {
    const spy = mockFetch(routes())
    render()
    await screen.findByText('SLA violado: INC-000123')

    fireEvent.change(screen.getByLabelText('Buscar nas notificações'), {
      target: { value: 'prazo' },
    })

    await waitFor(
      () =>
        expect(
          spy.mock.calls.some(([url]) => String(url).includes('search=prazo')),
        ).toBe(true),
      { timeout: 3000 },
    )
  })

  it('carrega a próxima página pelo cursor', async () => {
    const spy = mockFetch([
      {
        match: BASE,
        handler: (url) =>
          url.includes('cursor=n1')
            ? page([WHATSAPP], { nextCursor: null })
            : page([notification()], { nextCursor: 'n1' }),
      },
    ])
    render()
    await screen.findByText('SLA violado: INC-000123')

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByText('Sentimento negativo: Maria')).toBeTruthy()
    expect(
      spy.mock.calls.some(([url]) => String(url).includes('cursor=n1')),
    ).toBe(true)
  })
})

describe('<NotificationInbox /> — falhas', () => {
  it('avisa quando a ação falha', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `${BASE}/actions`,
        status: 500,
        error: 'Banco fora do ar',
      },
      { match: BASE, handler: () => page([notification()]) },
    ])
    render()

    fireEvent.click(
      await screen.findByLabelText('Selecionar: SLA violado: INC-000123'),
    )
    const toolbar = await screen.findByRole('toolbar', {
      name: 'Ações da seleção',
    })
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
  })
})
