import { fireEvent, render, screen, within } from '@testing-library/react'
import { type ComponentType, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  type CrmProposalSectionContent,
  CrmProposalSectionContentSchema,
} from '@/src/schemas/crm-proposal.schema'
import {
  CommercialTermsDisplay,
  CommercialTermsEditor,
  commercialTermsDefaultContent,
} from '../commercial-terms-section'
import { type ListItem, ListItemsEditor } from '../list-items-editor'
import {
  ProductsPricingDisplay,
  ProductsPricingEditor,
  productsPricingDefaultContent,
} from '../products-pricing-section'
import { SECTION_ORDER, SECTION_REGISTRY } from '../registry'
import {
  SignatureDisplay,
  SignatureEditor,
  signatureDefaultContent,
} from '../signature-section'

vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}))

// Controlled harness: keeps the editor's content in state and records every
// emitted value, mirroring how the proposal builder wires section editors.
function harness<C>(
  Editor: ComponentType<{
    content: C
    onChange: (c: C) => void
    workspaceId: string
  }>,
  initial: C,
) {
  const onChange = vi.fn()
  function Harness() {
    const [content, setContent] = useState(initial)
    return (
      <Editor
        content={content}
        workspaceId='ws_1'
        onChange={(next) => {
          onChange(next)
          setContent(next)
        }}
      />
    )
  }
  render(<Harness />)
  return { onChange, last: () => onChange.mock.lastCall?.[0] as C }
}

// Intl currency output uses a non-breaking space between "R$" and the value;
// Testing Library normalizes DOM whitespace, so normalize the expectation too.
const brl = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(n)
    .replace(/\s/g, ' ')

describe('<ListItemsEditor />', () => {
  function setup(items: ListItem[]) {
    const onChange = vi.fn()
    function Harness() {
      const [value, setValue] = useState(items)
      return (
        <ListItemsEditor
          items={value}
          addLabel='Adicionar necessidade'
          itemPlaceholder='Necessidade'
          onChange={(next) => {
            onChange(next)
            setValue(next)
          }}
        />
      )
    }
    render(<Harness />)
    return () => onChange.mock.lastCall?.[0] as ListItem[]
  }

  it('adds an item seeded with the placeholder title', () => {
    const last = setup([])
    fireEvent.click(
      screen.getByRole('button', { name: /adicionar necessidade/i }),
    )
    expect(last()).toEqual([{ title: 'Necessidade', description: '' }])
  })

  it('edits and removes a specific item', () => {
    const last = setup([
      { title: 'A', description: '' },
      { title: 'B', description: '' },
    ])
    const descriptions = screen.getAllByPlaceholderText('Descrição (opcional)')
    fireEvent.change(descriptions[1], { target: { value: 'detalhe B' } })
    expect(last()).toEqual([
      { title: 'A', description: '' },
      { title: 'B', description: 'detalhe B' },
    ])

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover item' })[0])
    expect(last()).toEqual([{ title: 'B', description: 'detalhe B' }])
  })
})

describe('<ProductsPricingEditor />', () => {
  function numberInputs() {
    return screen.getAllByRole('spinbutton') as HTMLInputElement[]
  }

  it('recomputes the line and proposal totals as quantity/price change', () => {
    const { last } = harness(
      ProductsPricingEditor,
      productsPricingDefaultContent(),
    )
    const [qty, price] = numberInputs()
    fireEvent.change(qty, { target: { value: '3' } })
    fireEvent.change(price, { target: { value: '25.5' } })

    expect(last().items[0]).toMatchObject({
      quantity: 3,
      unitPrice: 25.5,
      total: 76.5,
    })
    expect(last().total).toBe(76.5)
    expect(screen.getAllByText(brl(76.5)).length).toBeGreaterThan(0)
  })

  const priced = () => ({
    ...productsPricingDefaultContent(),
    items: [{ name: 'Consultoria', quantity: 2, unitPrice: 50, total: 100 }],
    total: 100,
  })

  it('subtracts the discount from the total, never going negative', () => {
    const { last } = harness(ProductsPricingEditor, priced())
    const discount = numberInputs().at(-1) as HTMLInputElement

    fireEvent.change(discount, { target: { value: '30' } })
    expect(last().total).toBe(70)

    fireEvent.change(discount, { target: { value: '500' } })
    expect(last().total).toBe(0)
  })

  // Regression: the typed discount used to be dropped from the emitted content.
  it('persists the typed discount in the emitted content', () => {
    const { last } = harness(ProductsPricingEditor, priced())
    const discount = numberInputs().at(-1) as HTMLInputElement

    fireEvent.change(discount, { target: { value: '30' } })
    expect(last()).toMatchObject({ discount: 30, total: 70 })
    // Editing a line afterwards must keep the discount applied.
    fireEvent.change(numberInputs()[0], { target: { value: '3' } })
    expect(last()).toMatchObject({ discount: 30, total: 120 })
  })

  it('adds and removes line items, keeping the total in sync', () => {
    const { last } = harness(ProductsPricingEditor, {
      type: 'PRODUCTS_PRICING',
      items: [{ name: 'A', quantity: 1, unitPrice: 10, total: 10 }],
      discount: 0,
      total: 10,
    })
    fireEvent.click(screen.getByRole('button', { name: /adicionar produto/i }))
    expect(last().items).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover item' })[0])
    expect(last().items.map((i) => i.name)).toEqual(['Produto ou serviço'])
    expect(last().total).toBe(0)
  })

  it('treats non-numeric input as zero', () => {
    const { last } = harness(ProductsPricingEditor, {
      type: 'PRODUCTS_PRICING',
      items: [{ name: 'A', quantity: 2, unitPrice: 10, total: 20 }],
      discount: 0,
      total: 20,
    })
    fireEvent.change(numberInputs()[1], { target: { value: '' } })
    expect(last().items[0]).toMatchObject({ unitPrice: 0, total: 0 })
  })

  it('display shows the discount line only when there is a discount', () => {
    const content = {
      type: 'PRODUCTS_PRICING' as const,
      items: [
        {
          name: 'Licença',
          description: 'Anual',
          quantity: 1,
          unitPrice: 1000,
          total: 1000,
        },
      ],
      discount: 100,
      total: 900,
    }
    const { rerender } = render(<ProductsPricingDisplay content={content} />)
    expect(screen.getByText('Anual')).toBeTruthy()
    expect(screen.getByText(`Desconto: ${brl(100)}`)).toBeTruthy()
    expect(screen.getByText(`Total: ${brl(900)}`)).toBeTruthy()

    rerender(
      <ProductsPricingDisplay
        content={{ ...content, discount: 0, total: 1000 }}
      />,
    )
    expect(screen.queryByText(/Desconto:/)).toBeNull()
  })
})

describe('<CommercialTermsEditor />', () => {
  it('edits labelled fields and clears optional ones to undefined', () => {
    const { last } = harness(
      CommercialTermsEditor,
      commercialTermsDefaultContent(),
    )
    fireEvent.change(screen.getByLabelText('Condições de pagamento'), {
      target: { value: '50% na assinatura' },
    })
    fireEvent.change(screen.getByLabelText('Prazo de entrega'), {
      target: { value: '30 dias' },
    })
    expect(last()).toMatchObject({
      paymentTerms: '50% na assinatura',
      deliveryTerms: '30 dias',
    })

    fireEvent.change(screen.getByLabelText('Prazo de entrega'), {
      target: { value: '' },
    })
    expect(last().deliveryTerms).toBeUndefined()
  })

  it('display hides empty optional blocks', () => {
    render(
      <CommercialTermsDisplay
        content={{ type: 'COMMERCIAL_TERMS', paymentTerms: 'À vista' }}
      />,
    )
    expect(screen.getByText('À vista')).toBeTruthy()
    expect(screen.queryByText('Entrega')).toBeNull()
    expect(screen.queryByText('Observações')).toBeNull()
  })
})

describe('<SignatureEditor />', () => {
  it('defaults the company signer to the responsible user', () => {
    expect(
      signatureDefaultContent({ responsibleName: 'Ana' }).companySignerName,
    ).toBe('Ana')
    expect(signatureDefaultContent({}).companySignerName).toBe(
      'Responsável pela empresa',
    )
  })

  it('edits signer fields', () => {
    const { last } = harness(
      SignatureEditor,
      signatureDefaultContent({ responsibleName: 'Ana' }),
    )
    fireEvent.change(screen.getByLabelText('Cargo'), {
      target: { value: 'CEO' },
    })
    fireEvent.change(screen.getByLabelText('Responsável pelo cliente'), {
      target: { value: 'Bruno' },
    })
    expect(last()).toMatchObject({
      companySignerName: 'Ana',
      companySignerRole: 'CEO',
      clientSignerName: 'Bruno',
    })
  })

  it('display falls back to "Cliente" when no client signer is set', () => {
    render(
      <SignatureDisplay
        content={{ type: 'SIGNATURE', companySignerName: 'Ana' }}
      />,
    )
    expect(screen.getByText('Cliente')).toBeTruthy()
    expect(screen.queryByAltText('Assinatura')).toBeNull()
  })
})

describe('section registry', () => {
  it('covers every section type in order with pt-BR labels', () => {
    expect(SECTION_ORDER).toHaveLength(9)
    for (const type of SECTION_ORDER) {
      expect(SECTION_REGISTRY[type].type).toBe(type)
      expect(SECTION_REGISTRY[type].label.length).toBeGreaterThan(0)
    }
  })

  it.each(
    SECTION_ORDER,
  )('%s default content is valid and renders in editor and display', (type) => {
    const def = SECTION_REGISTRY[type]
    const content = def.createDefaultContent({
      proposalName: 'Proposta Acme',
      responsibleName: 'Ana',
    }) as CrmProposalSectionContent
    expect(content.type).toBe(type)
    expect(CrmProposalSectionContentSchema.safeParse(content).success).toBe(
      true,
    )

    const { unmount } = render(
      <def.Editor content={content} onChange={() => {}} workspaceId='ws_1' />,
    )
    unmount()
    const { container } = render(<def.Display content={content} />)
    expect(within(container).getByRole('heading')).toBeTruthy()
  })
})
