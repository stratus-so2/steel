import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdIntegrationLinkDTO } from '@/types/sd-integration'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { SdTicketIntegrationLinks } from '../sd-ticket-integration-links'

const WS = 'ws-1'
const LINKS = `/api/workspaces/${WS}/servicedesk/integrations/links`
const ISSUES = `/api/workspaces/${WS}/servicedesk/integrations/github/issues`

function ticket(type: SdTicketDTO['type'] = 'PROBLEM'): SdTicketDTO {
  return {
    id: 't1',
    number: 7,
    code: 'PRB-000007',
    type,
    title: 'Fila travando',
  } as unknown as SdTicketDTO
}

function link(
  overrides: Partial<SdIntegrationLinkDTO> = {},
): SdIntegrationLinkDTO {
  return {
    id: 'link-1',
    integrationId: 'int-gh',
    kind: 'GITHUB_ISSUE',
    ticketId: 't1',
    externalKey: 'owner/repo#42',
    externalUrl: 'https://github.com/owner/repo/issues/42',
    externalState: 'open',
    externalStateLabel: 'Aberta',
    title: 'Fila de e-mail travando',
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
    ...overrides,
  }
}

function render(
  type: SdTicketDTO['type'] = 'PROBLEM',
  mode: 'agent' | 'requester' = 'agent',
) {
  return renderWithQuery(
    <SdTicketIntegrationLinks
      workspaceId={WS}
      ticket={ticket(type)}
      mode={mode}
    />,
  )
}

describe('<SdTicketIntegrationLinks />', () => {
  it('não renderiza nada para o solicitante (a rota é só de agente)', () => {
    const spy = mockFetch([{ match: LINKS, data: [] }])
    const { container } = render('PROBLEM', 'requester')
    expect(container.textContent).toBe('')
    expect(spy).not.toHaveBeenCalled()
  })

  it('não renderiza em incidente sem nenhum vínculo', async () => {
    mockFetch([{ match: LINKS, data: [] }])
    const { container } = render('INCIDENT')
    await waitFor(() => {
      expect(container.querySelector('section')).toBeNull()
    })
  })

  it('mostra os vínculos de um incidente que já tem algum', async () => {
    mockFetch([{ match: LINKS, data: [link()] }])
    render('INCIDENT')
    expect(await screen.findByText('Fila de e-mail travando')).toBeTruthy()
    // Em incidente não oferece vincular nem abrir issue.
    expect(screen.queryByRole('button', { name: 'Vincular' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Abrir issue/ })).toBeNull()
  })

  it('convida a vincular quando o problema não tem nada', async () => {
    mockFetch([{ match: LINKS, data: [] }])
    render()
    expect(
      await screen.findByText(/Nenhuma issue ou pull request vinculada/),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Vincular' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Abrir issue/ })).toBeTruthy()
  })

  it('lista issue, PR e thread do Slack com o estado traduzido', async () => {
    mockFetch([
      {
        match: LINKS,
        data: [
          link(),
          link({
            id: 'link-2',
            kind: 'GITHUB_PULL_REQUEST',
            externalKey: 'owner/repo#9',
            externalState: 'merged',
            externalStateLabel: 'Mesclada',
            title: 'Corrige a fila',
          }),
          link({
            id: 'link-3',
            kind: 'SLACK_THREAD',
            externalKey: 'C1:1700000000.000100',
            externalUrl: null,
            externalState: null,
            externalStateLabel: null,
            title: null,
          }),
        ],
      },
    ])
    render()
    expect(await screen.findByText('Aberta')).toBeTruthy()
    expect(screen.getByText('Mesclada')).toBeTruthy()
    // O rótulo do tipo divide o mesmo parágrafo com a chave externa.
    expect(screen.getByText(/^Issue/)).toBeTruthy()
    expect(screen.getByText(/^Pull request/)).toBeTruthy()
    expect(screen.getByText(/^Thread do Slack/)).toBeTruthy()

    // Issue com URL vira link; thread sem URL fica texto, com a chave crua.
    const issue = screen.getByRole('link', { name: 'Fila de e-mail travando' })
    expect(issue.getAttribute('href')).toBe(
      'https://github.com/owner/repo/issues/42',
    )
    expect(screen.getByText('C1:1700000000.000100')).toBeTruthy()
    // A chave do GitHub aparece como contexto da linha.
    expect(screen.getByText(/Issue · owner\/repo#42/)).toBeTruthy()
  })

  it('vincula a referência digitada e limpa o campo', async () => {
    const spy = mockFetch([
      { match: LINKS, data: [] },
      { method: 'POST', match: LINKS, data: link() },
    ])
    render()
    const input = await screen.findByLabelText('Issue ou pull request')
    fireEvent.change(input, { target: { value: ' #42 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vincular' }))
    await waitFor(() => {
      expect(fetchBody(spy, LINKS, 'POST')).toEqual({
        ticketId: 't1',
        ref: '#42',
      })
    })
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('')
    })
  })

  it('só habilita vincular com algo digitado', async () => {
    mockFetch([{ match: LINKS, data: [] }])
    render()
    const button = await screen.findByRole('button', { name: 'Vincular' })
    expect(button).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Issue ou pull request'), {
      target: { value: '#42' },
    })
    expect(button).toHaveProperty('disabled', false)
  })

  it('abre a issue a partir do chamado', async () => {
    const spy = mockFetch([
      { match: LINKS, data: [] },
      { method: 'POST', match: ISSUES, data: link() },
    ])
    render()
    fireEvent.click(await screen.findByRole('button', { name: /Abrir issue/ }))
    await waitFor(() => {
      expect(fetchBody(spy, ISSUES, 'POST')).toEqual({ ticketId: 't1' })
    })
  })

  it('desvincula pelo botão da linha', async () => {
    const spy = mockFetch([
      { match: LINKS, data: [link()] },
      { method: 'DELETE', match: `${LINKS}/link-1`, data: null },
    ])
    render()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Desvincular owner/repo#42',
      }),
    )
    await waitFor(() => {
      expect(
        spy.mock.calls.some(
          ([url, init]) =>
            String(url).includes(`${LINKS}/link-1`) &&
            init?.method === 'DELETE',
        ),
      ).toBe(true)
    })
  })
})
