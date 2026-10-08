import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { WorkspaceDTO } from '@/types/workspace'
import { DELETE_WORKSPACE_COPY } from '../delete-workspace-dialog'
import {
  normalizeSlugInput,
  WorkspaceGeneralSettings,
} from '../general-settings'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const WS: WorkspaceDTO = {
  id: 'ws_1',
  name: 'Acme',
  slug: 'acme',
  activePlan: 'FREE',
  trialEndsAt: null,
  logoUrl: null,
  companySize: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
const API = `/api/workspaces/${WS.id}`

function renderPage(role = 'OWNER', workspace: Partial<WorkspaceDTO> = {}) {
  return renderWithQuery(
    <WorkspaceGeneralSettings
      workspace={{ ...WS, ...workspace }}
      role={role}
      appUrl='https://steel.test/'
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('normalizeSlugInput()', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(normalizeSlugInput('Minha Empresa')).toBe('minha-empresa')
  })
})

describe('<WorkspaceGeneralSettings /> header', () => {
  it('shows the name, the initial and the workspace link', () => {
    mockFetch([])
    renderPage()
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0)
    expect(screen.getByText('https://steel.test/acme')).toBeTruthy()
    expect(screen.getAllByText('A').length).toBeGreaterThan(0)
  })

  it('copies the link', async () => {
    mockFetch([])
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    renderPage()

    fireEvent.click(
      screen.getByRole('button', { name: 'Copiar link do workspace' }),
    )
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://steel.test/acme'),
    )
    expect(notify.success).toHaveBeenCalledWith('Link copiado')
  })

  it('reports a clipboard failure', async () => {
    mockFetch([])
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) },
    })
    renderPage()
    fireEvent.click(
      screen.getByRole('button', { name: 'Copiar link do workspace' }),
    )
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        'Não foi possível copiar o link',
      ),
    )
  })

  it('renders the logo image when there is one', () => {
    mockFetch([])
    renderPage('OWNER', { logoUrl: 'https://cdn.test/logo.png' })
    expect(screen.getAllByAltText('Logo de Acme').length).toBe(2)
  })
})

describe('<WorkspaceGeneralSettings /> permissions', () => {
  it.each(['MEMBER', 'VIEWER'])('is read-only for a %s', (role) => {
    mockFetch([])
    renderPage(role)

    expect(
      screen.getByText(
        'Apenas o dono e os administradores do workspace podem editar estas informações.',
      ),
    ).toBeTruthy()
    expect(
      (screen.getByLabelText('Nome do espaço de trabalho') as HTMLInputElement)
        .disabled,
    ).toBe(true)
    expect(
      screen.queryByRole('button', { name: 'Salvar alterações' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Carregar logo' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Excluir este workspace' }),
    ).toBeNull()
    expect(
      screen.getByText('Apenas o dono do workspace pode excluí-lo.'),
    ).toBeTruthy()
  })

  it('lets an ADMIN edit but not delete', () => {
    mockFetch([])
    renderPage('ADMIN')
    expect(
      screen.getByRole('button', { name: 'Salvar alterações' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Excluir este workspace' }),
    ).toBeNull()
  })

  it('shows the danger zone with the exact copy to the OWNER', () => {
    mockFetch([])
    renderPage('OWNER')
    expect(screen.getByText(DELETE_WORKSPACE_COPY)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Excluir este workspace' }),
    ).toBeTruthy()
  })
})

describe('<WorkspaceGeneralSettings /> form', () => {
  it('saves the name and company size', async () => {
    const spy = mockFetch([
      {
        method: 'PATCH',
        match: API,
        data: { ...WS, name: 'Acme Co', companySize: 'SIZE_11_50' },
      },
    ])
    renderPage('ADMIN')

    const save = screen.getByRole('button', { name: 'Salvar alterações' })
    expect((save as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Nome do espaço de trabalho'), {
      target: { value: '  Acme Co ' },
    })
    fireEvent.click(save)

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Alterações salvas'),
    )
    expect(fetchBody(spy, API, 'PATCH')).toEqual({ name: 'Acme Co' })
    expect(router.refresh).toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('validates the name length', () => {
    mockFetch([])
    renderPage()
    fireEvent.change(screen.getByLabelText('Nome do espaço de trabalho'), {
      target: { value: 'A' },
    })
    expect(screen.getByText('Nome deve ter ao menos 2 caracteres')).toBeTruthy()
    expect(
      (
        screen.getByRole('button', {
          name: 'Salvar alterações',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
  })

  it('discards changes', () => {
    mockFetch([])
    renderPage()
    const input = screen.getByLabelText(
      'Nome do espaço de trabalho',
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Outro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(input.value).toBe('Acme')
  })

  it('shows the API error when saving fails', async () => {
    mockFetch([
      {
        method: 'PATCH',
        match: API,
        status: 409,
        error: 'Slug já está em uso',
      },
    ])
    renderPage()
    fireEvent.change(screen.getByLabelText('Nome do espaço de trabalho'), {
      target: { value: 'Acme 2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect((notify.error.mock.calls[0][0] as Error).message).toBe(
      'Slug já está em uso',
    )
  })
})

describe('<WorkspaceGeneralSettings /> workspace URL', () => {
  it('flags an invalid format without calling the API', () => {
    const spy = mockFetch([])
    renderPage()
    fireEvent.change(screen.getByLabelText('URL do espaço de trabalho'), {
      target: { value: 'acme_co' },
    })
    expect(
      screen.getByText(
        'Slug deve conter apenas letras minúsculas, números e hífens',
      ),
    ).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })

  it('flags reserved words', () => {
    mockFetch([])
    renderPage()
    fireEvent.change(screen.getByLabelText('URL do espaço de trabalho'), {
      target: { value: 'Admin' },
    })
    expect(
      screen.getByText('Este endereço é reservado. Escolha outro.'),
    ).toBeTruthy()
  })

  it('checks availability, warns about old links and redirects after saving', async () => {
    const spy = mockFetch([
      {
        match: `${API}/slug-availability?slug=acme-co`,
        data: { slug: 'acme-co', available: true, reason: null, message: null },
      },
      { method: 'PATCH', match: API, data: { ...WS, slug: 'acme-co' } },
    ])
    renderPage()

    fireEvent.change(screen.getByLabelText('URL do espaço de trabalho'), {
      target: { value: 'acme co' },
    })
    expect(screen.getByText(/os links antigos/)).toBeTruthy()

    expect(await screen.findByText('Endereço disponível.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/acme-co/settings'),
    )
    expect(fetchBody(spy, API, 'PATCH')).toEqual({ slug: 'acme-co' })
  })

  it('shows when the URL is taken and blocks saving', async () => {
    mockFetch([
      {
        match: `${API}/slug-availability`,
        data: {
          slug: 'taken',
          available: false,
          reason: 'taken',
          message: 'Este endereço já está em uso. Escolha outro.',
        },
      },
    ])
    renderPage()
    fireEvent.change(screen.getByLabelText('URL do espaço de trabalho'), {
      target: { value: 'taken' },
    })
    expect(
      await screen.findByText('Este endereço já está em uso. Escolha outro.'),
    ).toBeTruthy()
    expect(
      (
        screen.getByRole('button', {
          name: 'Salvar alterações',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
  })
})

describe('<WorkspaceGeneralSettings /> slug check failure', () => {
  it('tells the user when the check fails', async () => {
    mockFetch([
      { match: `${API}/slug-availability`, status: 500, error: 'boom' },
    ])
    renderPage()
    fireEvent.change(screen.getByLabelText('URL do espaço de trabalho'), {
      target: { value: 'novo-endereco' },
    })
    expect(
      await screen.findByText(
        'Não foi possível verificar o endereço. Tente de novo.',
      ),
    ).toBeTruthy()
  })
})

describe('<WorkspaceGeneralSettings /> logo', () => {
  function pick(file: File) {
    fireEvent.change(screen.getByTestId('workspace-logo-input'), {
      target: { files: [file] },
    })
  }

  it('uploads a logo', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `${API}/logo`,
        data: { ...WS, logoUrl: 'https://cdn.test/new.png' },
      },
    ])
    renderPage('ADMIN')
    pick(new File(['x'], 'logo.png', { type: 'image/png' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Logo atualizado'),
    )
    expect(spy.mock.calls[0][1]?.body).toBeInstanceOf(FormData)
    expect(screen.getAllByAltText('Logo de Acme').length).toBe(2)
  })

  it('opens the file picker from the button', () => {
    mockFetch([])
    renderPage()
    const input = screen.getByTestId('workspace-logo-input') as HTMLInputElement
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByRole('button', { name: 'Carregar logo' }))
    expect(click).toHaveBeenCalled()
  })

  it('ignores an empty selection', () => {
    const spy = mockFetch([])
    renderPage()
    fireEvent.change(screen.getByTestId('workspace-logo-input'), {
      target: { files: [] },
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects unsupported types and big files on the client', () => {
    const spy = mockFetch([])
    renderPage()
    pick(new File(['x'], 'logo.svg', { type: 'image/svg+xml' }))
    expect(notify.error).toHaveBeenCalledWith(
      'Formato não suportado. Use PNG, JPEG ou WebP',
    )
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 })
    pick(big)
    expect(notify.error).toHaveBeenCalledWith(
      'Arquivo muito grande. Máximo 2 MB',
    )
    expect(spy).not.toHaveBeenCalled()
  })

  it('reports an upload failure', async () => {
    mockFetch([
      { method: 'POST', match: `${API}/logo`, status: 500, error: 'falhou' },
    ])
    renderPage()
    pick(new File(['x'], 'logo.png', { type: 'image/png' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
  })

  it('removes the logo', async () => {
    mockFetch([{ method: 'DELETE', match: `${API}/logo`, data: WS }])
    renderPage('OWNER', { logoUrl: 'https://cdn.test/logo.png' })

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Logo removido'),
    )
    expect(screen.queryByAltText('Logo de Acme')).toBeNull()
  })

  it('reports a removal failure', async () => {
    mockFetch([
      { method: 'DELETE', match: `${API}/logo`, status: 500, error: 'x' },
    ])
    renderPage('OWNER', { logoUrl: 'https://cdn.test/logo.png' })
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
  })
})

describe('<WorkspaceGeneralSettings /> delete', () => {
  it('opens the confirmation dialog', async () => {
    mockFetch([])
    renderPage('OWNER')
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Excluir este workspace' }),
      )
    })
    expect(await screen.findByText('Excluir Acme?')).toBeTruthy()
  })
})
