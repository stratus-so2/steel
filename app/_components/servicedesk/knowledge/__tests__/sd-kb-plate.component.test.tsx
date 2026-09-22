import { screen } from '@testing-library/react'
import type { Value } from 'platejs'
import { describe, expect, it, vi } from 'vitest'
import { KbRichEditor } from '@/components/editor/kb-editor'
import { KbRichViewer } from '@/components/editor/kb-viewer'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'

// Fumaça do port do editor Plate do Nexo: os kits carregam e o documento
// renderiza de verdade (sem stub), no editor e na leitura.
const CONTENT: Value = [
  { type: 'h2', children: [{ text: 'Configurar a VPN' }] },
  {
    type: 'p',
    children: [{ text: 'Abra o cliente e ' }, { text: 'conecte', bold: true }],
  },
  {
    type: 'p',
    indent: 1,
    listStyleType: 'disc',
    children: [{ text: 'Passo com lista' }],
  },
  {
    type: 'code_block',
    children: [{ type: 'code_line', children: [{ text: 'ping 10.0.0.1' }] }],
  },
]

describe('Plate editor port', () => {
  it('renders the read-only viewer', () => {
    renderWithQuery(<KbRichViewer content={CONTENT} />)
    const viewer = screen.getByTestId('sd-kb-viewer')
    expect(viewer.textContent).toContain('Configurar a VPN')
    expect(viewer.textContent).toContain('ping 10.0.0.1')
    expect(viewer.querySelector('h2')).toBeTruthy()
    expect(viewer.querySelector('strong')?.textContent).toBe('conecte')
  })

  it('renders the full editor with its toolbar', () => {
    mockFetch([{ match: '/comments', data: [] }])
    renderWithQuery(
      <KbRichEditor
        workspaceId='ws-1'
        articleId='a1'
        userId='u1'
        userName='Ana'
        content={CONTENT}
        onChange={vi.fn()}
      />,
    )
    const editor = screen.getByTestId('sd-kb-editor')
    expect(editor.textContent).toContain('Passo com lista')
    expect(editor.querySelector('[contenteditable="true"]')).toBeTruthy()
    expect(screen.getAllByRole('toolbar').length).toBeGreaterThan(0)
  })
})
