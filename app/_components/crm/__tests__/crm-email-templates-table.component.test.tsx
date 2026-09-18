import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { CrmEmailTemplatesTable } from '../crm-email-templates-table'

const WS = 'ws_1'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))
vi.mock('@/src/hooks/use-crm-workspace-lookups', () => ({
  useCrmWorkspaceLookups: () => ({ lookups: undefined }),
}))
vi.mock('@/app/_components/crm/table/data-table', () => ({
  DataTable: (props: { data: { id: string; name: string }[] }) => (
    <ul>
      {props.data.map((r) => (
        <li key={r.id}>{r.name}</li>
      ))}
    </ul>
  ),
}))

function setup(createRoute?: Parameters<typeof mockFetch>[0][number]) {
  const spy = mockFetch([
    {
      method: 'POST',
      match: '/email-templates/preview',
      data: { html: '<p>preview</p>' },
    },
    createRoute ?? {
      method: 'POST',
      match: /crm\/email-templates$/,
      data: { id: 't9', name: 'Promo' },
    },
    {
      match: '/crm/email-templates',
      data: [{ id: 't1', name: 'Boas-vindas' }],
    },
  ])
  renderWithQuery(<CrmEmailTemplatesTable workspaceId={WS} slug='acme' />)
  return spy
}

function inputUnderLabel(label: string) {
  return screen
    .getByText(label)
    .parentElement?.querySelector('input, textarea') as HTMLInputElement
}

async function pickPromoLayout() {
  fireEvent.click(
    screen.getByRole('button', { name: /criar a partir de um layout/i }),
  )
  fireEvent.click(
    await screen.findByRole('button', { name: /anúncio \/ promoção/i }),
  )
  await screen.findByPlaceholderText('Ex: Promoção de verão')
}

describe('<CrmEmailTemplatesTable /> create from layout', () => {
  it('lists existing templates and offers the fixed layouts', async () => {
    setup()
    expect(await screen.findByText('Boas-vindas')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: /criar a partir de um layout/i }),
    )
    expect(await screen.findByText('Anúncio / Promoção')).toBeTruthy()
    expect(screen.getByText('Newsletter / Atualização')).toBeTruthy()
    // No submit button until a layout is chosen.
    expect(screen.queryByRole('button', { name: 'Criar template' })).toBeNull()
  })

  it('validates name, subject and required layout fields in order', async () => {
    const spy = setup()
    await pickPromoLayout()
    const submit = screen.getByRole('button', { name: 'Criar template' })

    fireEvent.click(submit)
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Informe o nome do template'),
    )

    fireEvent.change(screen.getByPlaceholderText('Ex: Promoção de verão'), {
      target: { value: 'Promo' },
    })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Informe o assunto'),
    )

    fireEvent.change(
      screen.getByPlaceholderText('Ex: Não perca essa novidade'),
      { target: { value: 'Oferta' } },
    )
    fireEvent.change(inputUnderLabel('Título'), { target: { value: '  ' } })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Preencha "Título"'),
    )
    expect(fetchBody(spy, /crm\/email-templates$/)).toBeUndefined()
  })

  it('creates the template with the layout id and props', async () => {
    const spy = setup()
    await pickPromoLayout()
    fireEvent.change(screen.getByPlaceholderText('Ex: Promoção de verão'), {
      target: { value: '  Promo  ' },
    })
    fireEvent.change(
      screen.getByPlaceholderText('Ex: Não perca essa novidade'),
      { target: { value: 'Oferta' } },
    )
    fireEvent.change(inputUnderLabel('Título'), {
      target: { value: 'Mega saldão' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Criar template' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Template criado'),
    )
    const body = fetchBody(spy, /crm\/email-templates$/)
    expect(body).toMatchObject({
      name: 'Promo',
      subject: 'Oferta',
      templateId: 'promo-announcement',
    })
    expect(body.templateProps.heading).toBe('Mega saldão')
  })

  it('renders the debounced server preview', async () => {
    setup()
    await pickPromoLayout()
    expect(screen.getByText('Preview aparece aqui')).toBeTruthy()
    expect(
      await screen.findByTitle('Preview do email', undefined, {
        timeout: 2000,
      }),
    ).toBeTruthy()
  })

  it('shows the API error when creation fails', async () => {
    setup({
      method: 'POST',
      match: /crm\/email-templates$/,
      status: 409,
      error: 'Já existe um template com esse nome',
    })
    await pickPromoLayout()
    fireEvent.change(screen.getByPlaceholderText('Ex: Promoção de verão'), {
      target: { value: 'Promo' },
    })
    fireEvent.change(
      screen.getByPlaceholderText('Ex: Não perca essa novidade'),
      { target: { value: 'Oferta' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Criar template' }))

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        'Já existe um template com esse nome',
      ),
    )
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('goes back to the layout list', async () => {
    setup()
    await pickPromoLayout()
    fireEvent.click(screen.getByRole('button', { name: /trocar layout/i }))
    expect(await screen.findByText('Newsletter / Atualização')).toBeTruthy()
  })
})
