import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createFakeWhiteboardVersionSummaryDTO } from '@/src/__tests__/factories/whiteboard.factory'
import { WhiteboardHistoryPanel } from '../whiteboard-history-panel'

const versions = [
  createFakeWhiteboardVersionSummaryDTO({
    id: 'v3',
    kind: 'RESTORE',
    name: 'Entrega',
    restoredFromId: 'v1',
    elementCount: 1,
  }),
  createFakeWhiteboardVersionSummaryDTO({
    id: 'v2',
    kind: 'MANUAL',
    name: 'Proposta',
    createdBy: { id: 'u2', name: 'Bruno' },
  }),
  createFakeWhiteboardVersionSummaryDTO({ id: 'v1', kind: 'AUTO' }),
]

function renderPanel(
  props: Partial<Parameters<typeof WhiteboardHistoryPanel>[0]> = {},
) {
  const onSelect = vi.fn()
  const onRestore = vi.fn()
  render(
    <WhiteboardHistoryPanel
      versions={versions}
      isLoading={false}
      canRestore
      selectedId={null}
      onSelect={onSelect}
      onRestore={onRestore}
      restoring={false}
      preview={<span>prévia</span>}
      {...props}
    />,
  )
  return { onSelect, onRestore }
}

describe('<WhiteboardHistoryPanel />', () => {
  it('lists every version with its kind, author and size', () => {
    renderPanel()

    const list = screen.getByRole('list', { name: 'Versões' })
    expect(list.querySelectorAll('li')).toHaveLength(3)
    expect(screen.getByText('Restauração')).toBeTruthy()
    expect(screen.getByText('Salva')).toBeTruthy()
    expect(screen.getByText('Automática')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Proposta/ }).textContent,
    ).toContain('Bruno')
    expect(
      screen.getByRole('button', { name: /Entrega/ }).textContent,
    ).toContain('1 elemento')
  })

  it('selects a version for preview and toggles it off', () => {
    const { onSelect } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Proposta/ }))
    expect(onSelect).toHaveBeenCalledWith('v2')

    const selected = renderPanel({ selectedId: 'v2' })
    fireEvent.click(screen.getAllByRole('button', { name: /Proposta/ })[1])
    expect(selected.onSelect).toHaveBeenCalledWith(null)
  })

  it('restores the previewed version after confirmation', async () => {
    const { onRestore } = renderPanel({ selectedId: 'v2' })

    expect(screen.getByText('prévia')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Restaurar esta versão' }),
    )
    expect(await screen.findByText('Restaurar esta versão?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }))

    expect(onRestore).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'v2' }),
    )
  })

  it('explains why restoring is blocked', () => {
    renderPanel({
      selectedId: 'v2',
      canRestore: false,
      restoreBlockedReason: 'Bruno está editando agora.',
    })
    expect(
      screen.queryByRole('button', { name: 'Restaurar esta versão' }),
    ).toBeNull()
    expect(screen.getByText('Bruno está editando agora.')).toBeTruthy()
  })

  it('shows the loading and empty states', () => {
    const { unmount } = render(
      <WhiteboardHistoryPanel
        versions={undefined}
        isLoading
        canRestore
        selectedId={null}
        onSelect={vi.fn()}
        onRestore={vi.fn()}
        restoring={false}
      />,
    )
    expect(
      screen.getByRole('status', { name: 'Carregando histórico' }),
    ).toBeTruthy()
    unmount()

    renderPanel({ versions: [] })
    expect(screen.getByText(/Nenhuma versão ainda/)).toBeTruthy()
  })
})
