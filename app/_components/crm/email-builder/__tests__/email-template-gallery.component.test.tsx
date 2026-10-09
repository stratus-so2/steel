import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { EmailTemplateGallery } from '../email-template-gallery'

const push = vi.hoisted(() => vi.fn())
const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'

function setup(createStatus = 201) {
  const spy = mockFetch([
    {
      method: 'POST',
      match: /crm\/email-templates$/,
      status: createStatus,
      ...(createStatus === 201
        ? { data: { id: 't9', kind: 'BUILDER' } }
        : { error: 'Falhou' }),
    },
    {
      match: '/crm/email-brand',
      data: {
        companyName: 'Acme Gallery',
        logoUrl: '',
        primaryColor: '#0F766E',
        address: '',
        website: '',
        saved: true,
        updatedAt: null,
      },
    },
  ])
  renderWithQuery(<EmailTemplateGallery workspaceId={WS} slug='acme' />)
  return spy
}

describe('<EmailTemplateGallery />', () => {
  it('lists the 8 ready layouts with branded thumbnails', async () => {
    setup()
    for (const label of [
      'Newsletter',
      'Promoção / oferta',
      'Convite para evento',
      'Boas-vindas',
      'Follow-up de proposta',
      'Pesquisa NPS',
      'Anúncio de produto',
      'Lembrete',
    ]) {
      expect(screen.getByRole('heading', { name: label })).toBeTruthy()
    }
    await waitFor(() => {
      const thumb = screen.getByTitle(
        'Miniatura: Promoção / oferta',
      ) as HTMLIFrameElement
      expect(thumb.getAttribute('srcdoc')).toContain('Acme Gallery')
      expect(thumb.getAttribute('srcdoc')).toContain('#0F766E')
    })
  })

  it('creates a template from a layout and opens the editor', async () => {
    const spy = setup()
    fireEvent.click(
      screen.getByRole('button', { name: 'Usar o modelo Pesquisa NPS' }),
    )
    const name = (await screen.findByLabelText(
      'Nome do template',
    )) as HTMLInputElement
    expect(name.value).toBe('Pesquisa NPS')
    fireEvent.change(name, { target: { value: 'NPS trimestral' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar e editar' }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/acme/crm/email-templates/t9'),
    )
    expect(fetchBody(spy, 'crm/email-templates')).toEqual({
      name: 'NPS trimestral',
      subject: '{{primeiro_nome|Olá}}, você tem 10 segundos?',
      builderLayout: 'pesquisa-nps',
    })
  })

  it('validates name and subject before creating', async () => {
    const spy = setup()
    fireEvent.click(
      screen.getByRole('button', { name: 'Usar o modelo Lembrete' }),
    )
    fireEvent.change(await screen.findByLabelText('Nome do template'), {
      target: { value: ' ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar e editar' }))
    expect(notify.error).toHaveBeenCalledWith('Informe o nome do template')
    fireEvent.change(screen.getByLabelText('Nome do template'), {
      target: { value: 'Lembrete' },
    })
    fireEvent.change(screen.getByLabelText('Assunto do e-mail'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar e editar' }))
    expect(notify.error).toHaveBeenCalledWith('Informe o assunto')
    expect(fetchBody(spy, 'crm/email-templates')).toBeUndefined()
  })

  it('shows the API error when creation fails', async () => {
    setup(500)
    fireEvent.click(
      screen.getByRole('button', { name: 'Usar o modelo Boas-vindas' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Criar e editar' }),
    )
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalledWith('/acme/crm/email-templates/t9')
  })
})
