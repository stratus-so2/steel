import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { SdExtRequestLink } from '../sd-ext-request-link'
import { SdExtShell } from '../sd-ext-shell'
import { SdExtTicket } from '../sd-ext-ticket'
import { SdExtTickets } from '../sd-ext-tickets'
import {
  API,
  extFormOptions,
  extSession,
  extTicket,
  extTicketDetail,
  extTicketPage,
} from './sd-ext-fixtures'

const replace = vi.fn()
const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => '/suporte/chamados',
}))

beforeEach(() => {
  replace.mockClear()
  push.mockClear()
})

describe('<SdExtRequestLink />', () => {
  it('asks for the e-mail and shows the generic confirmation', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `${API}/link`,
        data: {
          message:
            'Se este e-mail estiver cadastrado como contato, o link de acesso chega em instantes.',
        },
      },
    ])
    renderWithQuery(<SdExtRequestLink />)

    expect(
      screen.getByRole('heading', { name: 'Portal de atendimento' }),
    ).toBeTruthy()
    const submit = screen.getByRole('button', {
      name: /Receber link de acesso/,
    })
    // Sem e-mail, nada é enviado.
    expect(submit.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('Seu e-mail'), {
      target: { value: 'ana@acme.com.br' },
    })
    fireEvent.click(submit)

    expect(await screen.findByText('Verifique seu e-mail')).toBeTruthy()
    expect(
      screen.getByText(/Se este e-mail estiver cadastrado/),
    ).toBeTruthy()
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body))).toEqual({
      email: 'ana@acme.com.br',
    })
  })

  it('lets the contact try another e-mail', async () => {
    mockFetch([
      { method: 'POST', match: `${API}/link`, data: { message: 'ok' } },
    ])
    renderWithQuery(<SdExtRequestLink />)

    fireEvent.change(screen.getByLabelText('Seu e-mail'), {
      target: { value: 'ana@acme.com.br' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /Receber link de acesso/ }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Usar outro e-mail' }),
    )

    expect(screen.getByLabelText('Seu e-mail')).toBeTruthy()
  })

  it('surfaces the server message when the request fails', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `${API}/link`,
        status: 429,
        error: 'Muitas tentativas. Tente mais tarde',
      },
    ])
    renderWithQuery(<SdExtRequestLink />)

    fireEvent.change(screen.getByLabelText('Seu e-mail'), {
      target: { value: 'ana@acme.com.br' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /Receber link de acesso/ }),
    )

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Muitas tentativas')
  })
})

describe('<SdExtShell />', () => {
  it('shows the workspace name on top and the two tabs', async () => {
    mockFetch([{ match: `${API}/session`, data: extSession }])
    renderWithQuery(
      <SdExtShell title='Meus chamados'>
        <p>conteúdo</p>
      </SdExtShell>,
    )

    expect(await screen.findByText('Stratus Telecom')).toBeTruthy()
    expect(screen.getByText('Atendimento para Ana Souza')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Meus chamados' }).getAttribute('href'),
    ).toBe('/suporte/chamados')
    expect(screen.getByRole('link', { name: 'Ajuda' })).toBeTruthy()
    expect(screen.getByText('conteúdo')).toBeTruthy()
  })

  it('invites the contact to ask for a new link once the session is gone', async () => {
    mockFetch([
      {
        match: `${API}/session`,
        status: 401,
        error: 'Sua sessão expirou. Abra o link do e-mail de novo',
      },
    ])
    renderWithQuery(
      <SdExtShell>
        <p>nunca renderiza</p>
      </SdExtShell>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Seu acesso expirou' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Pedir um novo acesso' }).getAttribute(
        'href',
      ),
    ).toBe('/suporte')
    expect(screen.queryByText('nunca renderiza')).toBeNull()
  })

  it('signs out and goes back to /suporte', async () => {
    mockFetch([
      { match: `${API}/session`, data: extSession },
      { method: 'DELETE', match: `${API}/session`, data: null },
    ])
    renderWithQuery(
      <SdExtShell>
        <p>x</p>
      </SdExtShell>,
    )

    await screen.findByText('Stratus Telecom')
    fireEvent.click(screen.getByRole('button', { name: /Sair/ }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/suporte'))
  })
})

describe('<SdExtTickets />', () => {
  function renderList(items = [extTicket()]) {
    const spy = mockFetch([
      { match: `${API}/tickets`, data: extTicketPage(items) },
    ])
    renderWithQuery(<SdExtTickets />)
    return spy
  }

  it('lists the tickets with the phase progress bar', async () => {
    renderList()

    expect(await screen.findByText('Impressora não imprime')).toBeTruthy()
    expect(screen.getByText('INC-000012')).toBeTruthy()
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '40',
    )
    expect(screen.getByText(/ACME Ltda/)).toBeTruthy()
    expect(screen.getByText(/Carlos A\./)).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Impressora não imprime' })
        .getAttribute('href'),
    ).toBe('/suporte/chamados/INC-000012')
  })

  it('offers the CTA to open a ticket', async () => {
    renderList()
    await screen.findByText('Impressora não imprime')
    expect(
      screen.getByRole('link', { name: /Abrir chamado/ }).getAttribute('href'),
    ).toBe('/suporte/novo')
  })

  it('shows the empty state per tab and switches to the closed ones', async () => {
    const spy = renderList([])

    expect(await screen.findByText('Nenhum chamado em aberto')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Encerrados' }))
    expect(await screen.findByText('Nenhum chamado encerrado')).toBeTruthy()
    await waitFor(() =>
      expect(
        spy.mock.calls.some((call) =>
          String(call[0]).includes('status=closed'),
        ),
      ).toBe(true),
    )
  })

  it('searches by title or code', async () => {
    const spy = renderList()
    await screen.findByText('Impressora não imprime')

    fireEvent.change(screen.getByLabelText('Buscar chamado'), {
      target: { value: 'INC-000012' },
    })

    await waitFor(() =>
      expect(
        spy.mock.calls.some((call) => String(call[0]).includes('q=INC-000012')),
      ).toBe(true),
    )
  })

  it('surfaces the error with a retry', async () => {
    mockFetch([
      {
        match: `${API}/tickets`,
        status: 401,
        error: 'Sua sessão expirou. Abra o link do e-mail de novo',
      },
    ])
    renderWithQuery(<SdExtTickets />)

    expect(await screen.findByText(/Sua sessão expirou/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
})

describe('<SdExtTicket />', () => {
  function renderTicket(
    detail = extTicketDetail(),
    extra: Parameters<typeof mockFetch>[0] = [],
  ) {
    const spy = mockFetch([
      ...extra,
      { match: `${API}/tickets/INC-000012`, data: detail },
    ])
    renderWithQuery(<SdExtTicket code='INC-000012' />)
    return spy
  }

  it('shows the situation, the fields the requester cares about and the chat', async () => {
    renderTicket()

    expect(
      await screen.findByRole('heading', { name: 'Impressora não imprime' }),
    ).toBeTruthy()
    expect(screen.getByText(/Situação: Em andamento/)).toBeTruthy()
    expect(screen.getByText('Infraestrutura › Impressão')).toBeTruthy()
    // Aparece em "Quem está atendendo" e como autor da mensagem.
    expect(screen.getAllByText('Carlos A.').length).toBeGreaterThan(0)
    expect(screen.getByText('Alta')).toBeTruthy()
    expect(screen.getByText('Papel atolado no andar 3')).toBeTruthy()
    expect(screen.getByText('Já estamos olhando')).toBeTruthy()
    expect(screen.getByLabelText('Sua mensagem')).toBeTruthy()
  })

  it('sends a reply and clears the box', async () => {
    const spy = renderTicket(extTicketDetail(), [
      {
        method: 'POST',
        match: `${API}/tickets/INC-000012/messages`,
        data: {
          id: 'm2',
          authorKind: 'CONTACT',
          authorName: 'Você',
          mine: true,
          body: 'Continua parada',
          attachments: [],
          createdAt: '2026-10-01T12:30:00.000Z',
        },
      },
    ])
    await screen.findByLabelText('Sua mensagem')

    fireEvent.change(screen.getByLabelText('Sua mensagem'), {
      target: { value: 'Continua parada' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }))

    await waitFor(() =>
      expect(
        spy.mock.calls.some(
          (call) =>
            String(call[0]).includes('/messages') &&
            call[1]?.method === 'POST',
        ),
      ).toBe(true),
    )
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Sua mensagem') as HTMLTextAreaElement).value,
      ).toBe(''),
    )
  })

  it('hides the reply box on a canceled ticket', async () => {
    renderTicket(
      extTicketDetail({
        canReply: false,
        phase: { name: 'Cancelado', color: null, category: 'CANCELED' },
      }),
    )
    await screen.findByText('Conversa com a equipe')
    expect(screen.queryByLabelText('Sua mensagem')).toBeNull()
  })

  it('shows the solution and the rating on a resolved ticket', async () => {
    renderTicket(
      extTicketDetail({
        phase: { name: 'Resolvido', color: null, category: 'RESOLVED' },
        solution: '<p>Trocamos o fusor</p>',
        canRate: true,
        canReply: true,
      }),
    )

    expect(await screen.findByText('Como foi resolvido')).toBeTruthy()
    expect(screen.getByText('Trocamos o fusor')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Como foi o atendimento?' }),
    ).toBeTruthy()
  })

  it('submits the rating', async () => {
    const spy = renderTicket(
      extTicketDetail({
        phase: { name: 'Resolvido', color: null, category: 'RESOLVED' },
        canRate: true,
      }),
      [
        {
          method: 'POST',
          match: `${API}/tickets/INC-000012/csat`,
          data: { csatScore: 5, csatComment: null },
        },
      ],
    )
    await screen.findByRole('heading', { name: 'Como foi o atendimento?' })

    fireEvent.click(screen.getByRole('button', { name: /5 estrelas/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))

    await waitFor(() =>
      expect(
        spy.mock.calls.some((call) => String(call[0]).includes('/csat')),
      ).toBe(true),
    )
  })

  it('shows the score already given instead of the form', async () => {
    renderTicket(
      extTicketDetail({
        phase: { name: 'Fechado', color: null, category: 'CLOSED' },
        csatScore: 4,
        csatComment: 'Bom atendimento',
        canRate: false,
      }),
    )

    expect(await screen.findByText('Obrigado pela sua avaliação!')).toBeTruthy()
    expect(screen.getByText('“Bom atendimento”')).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Como foi o atendimento?' }),
    ).toBeNull()
  })

  it('links the attachments of a public message to the portal route', async () => {
    renderTicket(
      extTicketDetail({
        messages: [
          {
            id: 'm1',
            authorKind: 'AGENT',
            authorName: 'Carlos A.',
            mine: false,
            body: 'Segue a ordem de serviço',
            attachments: [
              {
                id: 'att1',
                fileName: 'ordem.pdf',
                mimeType: 'application/pdf',
                size: 2048,
                url: `${API}/tickets/12/attachments/att1`,
              },
            ],
            createdAt: '2026-10-01T11:00:00.000Z',
          },
        ],
      }),
    )

    const link = await screen.findByRole('link', { name: /ordem\.pdf/ })
    expect(link.getAttribute('href')).toBe(
      `${API}/tickets/12/attachments/att1?download=1`,
    )
    expect(screen.getByText('(2 KB)')).toBeTruthy()
  })

  it('shows a friendly not-found instead of leaking why', async () => {
    mockFetch([
      {
        match: `${API}/tickets/INC-000999`,
        status: 404,
        error: 'Chamado não encontrado',
      },
    ])
    renderWithQuery(<SdExtTicket code='INC-000999' />)

    expect(await screen.findByText('Não encontramos este chamado')).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Voltar aos meus chamados' })
        .getAttribute('href'),
    ).toBe('/suporte/chamados')
  })

  it('never renders an internal note that the API did not send', async () => {
    renderTicket()
    await screen.findByText('Já estamos olhando')
    // A tela só mostra o que veio em `messages`; nota interna não vem.
    expect(screen.queryByText(/nota interna/i)).toBeNull()
    expect(screen.queryByText(/custo/i)).toBeNull()
    expect(screen.queryByText(/aprovação/i)).toBeNull()
    expect(screen.queryByText(/rastreabilidade/i)).toBeNull()
  })
})

describe('<SdExtNewTicket />', () => {
  async function renderForm(
    options: Parameters<typeof mockFetch>[0] = [],
    data = extFormOptions,
  ) {
    const { SdExtNewTicket } = await import('../sd-ext-new-ticket')
    const spy = mockFetch([...options, { match: `${API}/options`, data }])
    renderWithQuery(<SdExtNewTicket />)
    return spy
  }

  it('offers only the released types, catalog and templates', async () => {
    await renderForm()

    expect(await screen.findByLabelText('Resumo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Incidente' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Requisição' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mudança' })).toBeNull()
    expect(screen.getByLabelText('Assunto')).toBeTruthy()
    expect(screen.getByLabelText('Urgência')).toBeTruthy()
    expect(screen.getByLabelText('Andar')).toBeTruthy()
    // O modelo é de SERVICE_REQUEST; o tipo corrente é INCIDENT.
    expect(screen.queryByLabelText('Modelo (opcional)')).toBeNull()
  })

  it('creates the ticket and goes to it', async () => {
    const spy = await renderForm([
      {
        method: 'POST',
        match: `${API}/tickets`,
        data: extTicket({ code: 'INC-000020', number: 20 }),
      },
    ])
    await screen.findByLabelText('Resumo')

    fireEvent.change(screen.getByLabelText('Resumo'), {
      target: { value: 'Internet caiu' },
    })
    fireEvent.change(screen.getByLabelText('Detalhes'), {
      target: { value: 'Desde as 9h' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Abrir chamado/ }))

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/suporte/chamados/INC-000020'),
    )
    const body = JSON.parse(
      String(
        spy.mock.calls.find((call) => call[1]?.method === 'POST')?.[1]?.body,
      ),
    )
    expect(body).toEqual({
      type: 'INCIDENT',
      title: 'Internet caiu',
      description: 'Desde as 9h',
    })
  })

  it('explains when the portal does not accept new tickets', async () => {
    await renderForm([], { ...extFormOptions, ticketTypes: [] })
    expect(
      await screen.findByText(
        'A abertura de chamados pelo portal está desligada',
      ),
    ).toBeTruthy()
  })

  it('surfaces the server refusal', async () => {
    await renderForm([
      {
        method: 'POST',
        match: `${API}/tickets`,
        status: 403,
        error: 'Este tipo de chamado não pode ser aberto pelo portal',
      },
    ])
    await screen.findByLabelText('Resumo')

    fireEvent.change(screen.getByLabelText('Resumo'), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Abrir chamado/ }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain(
      'não pode ser aberto pelo portal',
    )
  })
})
