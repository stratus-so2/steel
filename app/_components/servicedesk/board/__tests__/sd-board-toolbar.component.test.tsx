import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import { SD_QUICK_FILTERS, type SdBoardFilters } from '../sd-board-state'
import { SdFilterBar } from '../sd-filter-bar'
import { SdNoPhasesNotice } from '../sd-no-phases-notice'

/**
 * O passe visual: a barra dos quadros tem de mostrar **três** controles de
 * consulta, como as grades do CRM (busca, `Filtrar`, `Ordenar`), e não as ~20
 * dimensões nem os 7 atalhos espalhados — era isso que fazia o ServiceDesk
 * parecer outro produto.
 */

const WS = 'ws-1'
const SLUG = 'acme'

function renderBar(
  filters: SdBoardFilters = {},
  overrides: Partial<Parameters<typeof SdFilterBar>[0]> = {},
) {
  const onChange = vi.fn()
  const onSortChange = vi.fn()
  const view = renderWithQuery(
    <SdFilterBar
      workspaceId={WS}
      filters={filters}
      onChange={onChange}
      agents={[]}
      fixedType='INCIDENT'
      sort='createdAt'
      order='desc'
      onSortChange={onSortChange}
      {...overrides}
    />,
  )
  return { ...view, onChange, onSortChange }
}

describe('<SdFilterBar />', () => {
  it('shows only the three CRM controls, with the shortcuts inside the filter popover', async () => {
    renderBar()

    expect(screen.getByLabelText('Buscar chamados')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Filtrar/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ordenar/ })).toBeTruthy()

    // Nenhum atalho ocupa a barra: eles vivem dentro do popover.
    for (const quick of SD_QUICK_FILTERS) {
      expect(screen.queryByRole('button', { name: quick.label })).toBeNull()
    }

    fireEvent.click(screen.getByRole('button', { name: /Filtrar/ }))

    expect(await screen.findByText('Atalhos')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Meus chamados' })).toBeTruthy()
    // E as ~20 dimensões continuam todas lá, agrupadas.
    for (const group of [
      'Classificação',
      'Atribuição',
      'Catálogo',
      'Cliente e ativos',
      'Atendimento',
      'Datas',
    ]) {
      expect(screen.getByRole('heading', { name: group })).toBeTruthy()
    }
  })

  it('counts the active filters on the Filtrar badge and lists them as chips', () => {
    renderBar({ sla: 'breached', assigneeIds: ['me'] })

    expect(screen.getByRole('button', { name: /Filtrar\s*2/ })).toBeTruthy()
    expect(screen.getByText('SLA')).toBeTruthy()
    expect(screen.getByText('Violado')).toBeTruthy()
    expect(screen.getByText('Responsável')).toBeTruthy()
    expect(screen.getByText('Eu')).toBeTruthy()
  })

  it('drops one filter from its chip without touching the others', async () => {
    const { onChange } = renderBar({ sla: 'breached', assigneeIds: ['me'] })

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro SLA' }))

    expect(onChange).toHaveBeenCalledWith({ assigneeIds: ['me'] })
  })

  it('does not badge or chip the default ordering', () => {
    renderBar()

    expect(screen.getByRole('button', { name: 'Ordenar' })).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Remover ordenação/ }),
    ).toBeNull()
  })

  it('sorts from the popover and shows the active ordering as a chip', async () => {
    const { onSortChange } = renderBar(
      {},
      {
        sort: 'priority',
        order: 'asc',
        group: 'phase',
        onGroupChange: vi.fn(),
      },
    )

    // Ordenação fora do padrão: badge na barra e chip removível.
    expect(screen.getByRole('button', { name: /Ordenar\s*1/ })).toBeTruthy()
    expect(screen.getByText('Prioridade')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Remover ordenação' }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Ordenar/ }))

    // O agrupamento da lista também mora aqui, em vez de um select na barra.
    expect(await screen.findByLabelText('Agrupar por')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Título decrescente' }))

    expect(onSortChange).toHaveBeenCalledWith('title', 'desc')
  })

  it('hides the grouping when the board is not in list mode', async () => {
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: /Ordenar/ }))

    expect(await screen.findByText('Ordenar por')).toBeTruthy()
    expect(screen.queryByLabelText('Agrupar por')).toBeNull()
  })
})

describe('<SdNoPhasesNotice />', () => {
  it('explains the missing phases and links to the flows settings', () => {
    renderWithQuery(
      <SdNoPhasesNotice workspaceId={WS} slug={SLUG} type='INCIDENT' />,
    )

    expect(
      screen.getByText('Nenhuma fase configurada para incidente'),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /Configurações/ }).getAttribute('href'),
    ).toBe(`/${SLUG}/servicedesk/settings?tab=flows`)
    // Só admin semeia.
    expect(
      screen.queryByRole('button', { name: /Criar as fases padrão/ }),
    ).toBeNull()
  })

  it('lets an admin create the default phases of the type right there', async () => {
    const fetchSpy = mockFetch([
      {
        method: 'POST',
        match: '/servicedesk/settings/seed-phases',
        data: { created: 8, kept: 0 },
      },
    ])
    renderWithQuery(
      <SdNoPhasesNotice workspaceId={WS} slug={SLUG} type='INCIDENT' isAdmin />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /Criar as fases padrão de incidente/,
      }),
    )

    await waitFor(() => {
      const call = fetchSpy.mock.calls.at(-1)
      expect(String(call?.[0])).toContain(
        `/api/workspaces/${WS}/servicedesk/settings/seed-phases`,
      )
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        ticketType: 'INCIDENT',
      })
    })
  })

  it('speaks for the whole board when no type has phases', () => {
    renderWithQuery(
      <SdNoPhasesNotice workspaceId={WS} slug={SLUG} type={null} isAdmin />,
    )

    expect(
      screen.getByText('Nenhum tipo de chamado tem fases configuradas'),
    ).toBeTruthy()
    // Sem tipo não há fase padrão a criar: só o caminho da configuração.
    expect(
      screen.queryByRole('button', { name: /Criar as fases padrão/ }),
    ).toBeNull()
  })
})
