import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import {
  CrmEmailCampaignRecipientPicker,
  crmDefaultRecipientSelection,
  type RecipientSelection,
} from '../crm-email-campaign-recipient-picker'

const WS = 'ws_1'

function person(id: string, name: string, emails: string[]) {
  return { id, name, emails, phones: [] }
}

const PEOPLE = [
  person('p1', 'Ana Souza', ['ana@acme.com']),
  person('p2', 'Bruno Lima', ['bruno@acme.com']),
  person('p3', 'Carla Sem Email', []),
]
const LISTS = [
  { id: 'l1', name: 'Clientes VIP', memberCount: 12, description: 'Top' },
  { id: 'l2', name: 'Newsletter', memberCount: 3, description: null },
]

function setup(
  initial: RecipientSelection = crmDefaultRecipientSelection(),
  routes: {
    people: unknown[]
    lists: unknown[]
    optOuts?: unknown[]
  } = { people: PEOPLE, lists: LISTS },
) {
  mockFetch([
    { match: `/api/workspaces/${WS}/crm/people`, data: routes.people },
    { match: `/api/workspaces/${WS}/crm/mailing-lists`, data: routes.lists },
    {
      match: `/api/workspaces/${WS}/crm/email-opt-outs`,
      data: routes.optOuts ?? [],
    },
  ])
  const onChange = vi.fn()
  function Harness() {
    const [value, setValue] = useState(initial)
    return (
      <CrmEmailCampaignRecipientPicker
        workspaceId={WS}
        value={value}
        onChange={(next) => {
          onChange(next)
          setValue(next)
        }}
      />
    )
  }
  renderWithQuery(<Harness />)
  return { onChange, last: () => onChange.mock.lastCall?.[0] }
}

function checkboxFor(name: string) {
  return screen
    .getByText(name)
    .closest('label')
    ?.querySelector('input[type=checkbox]') as HTMLInputElement
}

describe('<CrmEmailCampaignRecipientPicker /> contacts tab', () => {
  it('disables opted-out people and leaves them out of the counts (LGPD)', async () => {
    const { last } = setup(crmDefaultRecipientSelection(), {
      people: PEOPLE,
      lists: LISTS,
      optOuts: [
        {
          id: 'o1',
          email: 'bruno@acme.com',
          personId: null,
          campaignId: 'c1',
          source: 'LINK',
          createdAt: '2026-09-01T12:00:00.000Z',
        },
      ],
    })

    expect(await screen.findByText('Descadastrado')).toBeTruthy()
    expect(
      screen.getByText(
        '1 de 1 selecionada(s) · 1 descadastrada(s) excluída(s)',
      ),
    ).toBeTruthy()
    expect(checkboxFor('Bruno Lima').disabled).toBe(true)
    expect(checkboxFor('Bruno Lima').checked).toBe(false)

    fireEvent.click(checkboxFor('Ana Souza'))
    await waitFor(() =>
      expect(last()).toMatchObject({ scope: 'SELECTED', personIds: [] }),
    )
  })

  it('lists only people with e-mail and starts in ALL scope', async () => {
    setup()
    expect(await screen.findByText('Ana Souza')).toBeTruthy()
    expect(screen.getByText('Bruno Lima')).toBeTruthy()
    expect(screen.queryByText('Carla Sem Email')).toBeNull()
    expect(screen.getByText('2 de 2 selecionada(s)')).toBeTruthy()
    expect(screen.getByText('Inclui pessoas adicionadas depois')).toBeTruthy()
    expect(checkboxFor('Ana Souza').checked).toBe(true)
    expect(screen.getByRole('button', { name: 'Desmarcar todos' })).toBeTruthy()
  })

  it('unchecking one person in ALL scope switches to SELECTED with the rest', async () => {
    const { last } = setup()
    await screen.findByText('Ana Souza')

    fireEvent.click(checkboxFor('Ana Souza'))

    expect(last()).toMatchObject({ scope: 'SELECTED', personIds: ['p2'] })
    expect(screen.getByText('1 de 2 selecionada(s)')).toBeTruthy()
    expect(screen.queryByText('Inclui pessoas adicionadas depois')).toBeNull()
  })

  it('toggle all clears the selection and then restores ALL scope', async () => {
    const { last } = setup()
    await screen.findByText('Ana Souza')

    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar todos' }))
    expect(last()).toMatchObject({ scope: 'SELECTED', personIds: [] })
    expect(screen.getByText('0 de 2 selecionada(s)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Marcar todos' }))
    expect(last()).toMatchObject({ scope: 'ALL' })
  })

  it('selecting every person manually counts as all marked', async () => {
    setup({ ...crmDefaultRecipientSelection(), scope: 'SELECTED' })
    await screen.findByText('Ana Souza')
    fireEvent.click(checkboxFor('Ana Souza'))
    fireEvent.click(checkboxFor('Bruno Lima'))
    expect(screen.getByRole('button', { name: 'Desmarcar todos' })).toBeTruthy()
  })

  it('filters by name or e-mail and shows the empty message', async () => {
    setup()
    await screen.findByText('Ana Souza')
    const search = screen.getByPlaceholderText('Buscar pessoa ou email…')

    fireEvent.change(search, { target: { value: 'BRUNO@' } })
    expect(screen.queryByText('Ana Souza')).toBeNull()
    expect(screen.getByText('Bruno Lima')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(
      screen.getByText('Nenhuma pessoa com email encontrada.'),
    ).toBeTruthy()
  })

  it('disables toggle-all when nobody has an e-mail', async () => {
    setup(undefined, { people: [PEOPLE[2]], lists: [] })
    expect(
      await screen.findByText('Nenhuma pessoa com email encontrada.'),
    ).toBeTruthy()
    const btn = screen.getByRole('button', {
      name: /marcar todos/i,
    }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})

describe('<CrmEmailCampaignRecipientPicker /> lists tab', () => {
  it('selects mailing lists independently of the contact scope', async () => {
    const { last } = setup()
    fireEvent.click(screen.getByRole('tab', { name: 'Listas' }))

    expect(await screen.findByText('Clientes VIP')).toBeTruthy()
    expect(screen.getByText('12 membro(s) · Top')).toBeTruthy()
    expect(screen.getByText('3 membro(s)')).toBeTruthy()

    fireEvent.click(checkboxFor('Newsletter'))
    expect(last()).toMatchObject({ scope: 'ALL', mailingListIds: ['l2'] })
    expect(screen.getByText('1 lista(s) selecionada(s)')).toBeTruthy()

    fireEvent.click(checkboxFor('Newsletter'))
    expect(last()?.mailingListIds).toEqual([])
  })

  it('shows the empty state when no list exists', async () => {
    setup(undefined, { people: PEOPLE, lists: [] })
    fireEvent.click(screen.getByRole('tab', { name: 'Listas' }))
    expect(
      await screen.findByText(
        'Nenhuma lista criada. Crie listas em Marketing → Listas.',
      ),
    ).toBeTruthy()
  })
})

describe('<CrmEmailCampaignRecipientPicker /> extra e-mails tab', () => {
  async function openExtra() {
    fireEvent.click(screen.getByRole('tab', { name: 'Avulsos' }))
    return (await screen.findByPlaceholderText(
      'nome@empresa.com',
    )) as HTMLInputElement
  }

  it('rejects invalid and duplicate e-mails with pt-BR messages', async () => {
    const { onChange } = setup({
      ...crmDefaultRecipientSelection(),
      extraEmails: ['ja@acme.com'],
    })
    const input = await openExtra()

    fireEvent.change(input, { target: { value: 'nao-e-email' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    expect(screen.getByText('Email inválido')).toBeTruthy()

    fireEvent.change(input, { target: { value: ' JA@acme.com ' } })
    expect(screen.queryByText('Email inválido')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    expect(screen.getByText('Email já adicionado')).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('adds a normalized e-mail on Enter and removes it via its chip', async () => {
    const { last } = setup()
    const input = await openExtra()
    expect(screen.getByText('Nenhum email avulso adicionado.')).toBeTruthy()

    fireEvent.change(input, { target: { value: '  Novo@Cliente.COM ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(last()?.extraEmails).toEqual(['novo@cliente.com']),
    )
    expect(input.value).toBe('')

    fireEvent.click(
      screen.getByRole('button', { name: 'Remover novo@cliente.com' }),
    )
    expect(last()?.extraEmails).toEqual([])
    expect(screen.getByText('Nenhum email avulso adicionado.')).toBeTruthy()
  })
})
