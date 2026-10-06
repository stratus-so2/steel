import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SteelAgentToolCatalogItemDTO } from '@/types/steel-agent'
import { SteelAgentToolPicker } from '../steel-agent-tool-picker'

const TOOLS: SteelAgentToolCatalogItemDTO[] = [
  {
    name: 'ws_overview',
    label: 'Consultando o workspace',
    description: 'Resumo do workspace',
    module: null,
    kind: 'READ',
  },
  {
    name: 'sd_list_tickets',
    label: 'Consultando chamados',
    description: 'Lista chamados',
    module: 'SERVICE_DESK',
    kind: 'READ',
  },
  {
    name: 'crm_create_task',
    label: 'Criando tarefa',
    description: 'Cria tarefa no CRM',
    module: 'CRM',
    kind: 'CREATE',
  },
  {
    name: 'crm_delete_task',
    label: 'Excluindo tarefa',
    description: 'Exclui tarefa',
    module: 'CRM',
    kind: 'DELETE',
  },
]

describe('<SteelAgentToolPicker />', () => {
  it('groups tools by module', () => {
    render(<SteelAgentToolPicker tools={TOOLS} value={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Plataforma' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'ServiceDesk' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'CRM' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Comunicação' })).toBeNull()
  })

  it('adds a tool requiring approval by default and removes it', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <SteelAgentToolPicker tools={TOOLS} value={[]} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Criando tarefa' }))
    expect(onChange).toHaveBeenLastCalledWith([
      { toolName: 'crm_create_task', mode: 'APPROVAL' },
    ])

    rerender(
      <SteelAgentToolPicker
        tools={TOOLS}
        value={[{ toolName: 'crm_create_task', mode: 'APPROVAL' }]}
        onChange={onChange}
      />,
    )
    expect(screen.getByText('Requer aprovação')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Criando tarefa' }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('switches a write to automatic and back', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <SteelAgentToolPicker
        tools={TOOLS}
        value={[{ toolName: 'crm_create_task', mode: 'APPROVAL' }]}
        onChange={onChange}
      />,
    )
    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Executar Criando tarefa automaticamente',
      }),
    )
    expect(onChange).toHaveBeenLastCalledWith([
      { toolName: 'crm_create_task', mode: 'AUTO' },
    ])

    rerender(
      <SteelAgentToolPicker
        tools={TOOLS}
        value={[{ toolName: 'crm_create_task', mode: 'AUTO' }]}
        onChange={onChange}
      />,
    )
    expect(screen.getByText('Automática')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Executar Criando tarefa automaticamente',
      }),
    )
    expect(onChange).toHaveBeenLastCalledWith([
      { toolName: 'crm_create_task', mode: 'APPROVAL' },
    ])
  })

  it('locks DELETE tools to approval (no switch)', () => {
    render(
      <SteelAgentToolPicker
        tools={TOOLS}
        value={[{ toolName: 'crm_delete_task', mode: 'AUTO' }]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Sempre requer aprovação')).toBeTruthy()
    expect(
      screen.queryByRole('switch', {
        name: 'Executar Excluindo tarefa automaticamente',
      }),
    ).toBeNull()
  })

  it('shows no mode control for read tools and an empty state', () => {
    const { unmount } = render(
      <SteelAgentToolPicker
        tools={TOOLS}
        value={[{ toolName: 'sd_list_tickets', mode: 'APPROVAL' }]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByRole('switch')).toBeNull()
    unmount()
    render(<SteelAgentToolPicker tools={[]} value={[]} onChange={vi.fn()} />)
    expect(
      screen.getByText(
        'Nenhuma ferramenta disponível para os módulos habilitados.',
      ),
    ).toBeTruthy()
  })
})
