import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdTicketSignatureDTO } from '@/types/sd-ticket-signature'
import { SdSignaturePad } from '../signature/sd-signature-pad'
import { SdTicketSignatureTab } from '../tabs/signature-tab'
import {
  stubEventSource,
  TAB_URL,
  TICKET_ID,
  tabProps,
  user,
} from './sd-ticket-tab-fixtures'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

const ctx = {
  setTransform: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
}

beforeEach(() => {
  stubEventSource()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(PNG)
})

function draw() {
  const canvas = screen.getByLabelText('Quadro de assinatura')
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 })
  fireEvent.pointerMove(canvas, { clientX: 40, clientY: 30, pointerId: 1 })
  fireEvent.pointerUp(canvas, { pointerId: 1 })
}

describe('SdSignaturePad', () => {
  it('emits the PNG after a stroke, and null after undo/clear', () => {
    const onChange = vi.fn()
    render(<SdSignaturePad onChange={onChange} />)
    expect(screen.getByText('Assine aqui')).toBeTruthy()
    draw()
    expect(onChange).toHaveBeenLastCalledWith(PNG)
    expect(ctx.stroke).toHaveBeenCalled()
    expect(screen.queryByText('Assine aqui')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(onChange).toHaveBeenLastCalledWith(null)

    draw()
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(
      (screen.getByRole('button', { name: 'Limpar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('ignores input when disabled', () => {
    const onChange = vi.fn()
    render(<SdSignaturePad onChange={onChange} disabled />)
    draw()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('SdTicketSignatureTab', () => {
  const signature: SdTicketSignatureDTO = {
    id: 's1',
    ticketId: TICKET_ID,
    purpose: 'Aceite do atendimento',
    signerName: 'Rui Solicitante',
    signerDocument: '123.456.789-00',
    signerEmail: 'rui@example.com',
    signedBy: user('u-agent', 'Ana Agente'),
    imageUrl: `${TAB_URL}/signatures/s1/image`,
    imageSha256: 'a'.repeat(64),
    ticketSha256: 'b'.repeat(64),
    signedAt: '2026-09-21T12:00:00.000Z',
  }

  function routes(verify: Record<string, unknown> = {}) {
    return mockFetch([
      {
        match: `${TAB_URL}/signatures/s1/verify`,
        data: {
          signatureId: 's1',
          imageIntact: true,
          storedImageSha256: 'a'.repeat(64),
          computedImageSha256: 'a'.repeat(64),
          ticketUnchanged: false,
          signedTicketSha256: 'b'.repeat(64),
          currentTicketSha256: 'c'.repeat(64),
          verifiedAt: '2026-09-22T12:00:00.000Z',
          ...verify,
        },
      },
      { match: `${TAB_URL}/signatures`, data: [signature] },
      { method: 'POST', match: `${TAB_URL}/signatures`, data: signature },
    ])
  }

  it('lists signatures and verifies integrity', async () => {
    routes()
    renderWithQuery(<SdTicketSignatureTab {...tabProps('agent')} />)
    expect(await screen.findByText('Rui Solicitante')).toBeTruthy()
    expect(
      screen.getByAltText('Assinatura de Rui Solicitante').getAttribute('src'),
    ).toBe(`${TAB_URL}/signatures/s1/image`)
    expect(screen.getByText(/registrado por Ana Agente/)).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Verificar integridade' }),
    )
    expect(await screen.findByText('Imagem íntegra')).toBeTruthy()
    expect(screen.getByText('Chamado alterado desde a assinatura')).toBeTruthy()
  })

  it('reports a tampered image', async () => {
    routes({ imageIntact: false, computedImageSha256: 'f'.repeat(64) })
    renderWithQuery(<SdTicketSignatureTab {...tabProps('agent')} />)
    await screen.findByText('Rui Solicitante')
    fireEvent.click(
      screen.getByRole('button', { name: 'Verificar integridade' }),
    )
    expect(await screen.findByText(/Imagem adulterada/)).toBeTruthy()
  })

  it('lets a requester sign from the portal', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketSignatureTab {...tabProps('requester')} />)
    await screen.findByText('Rui Solicitante')
    const submit = screen.getByRole('button', {
      name: 'Registrar assinatura',
    }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Nome de quem assina'), {
      target: { value: 'Rui Solicitante' },
    })
    fireEvent.change(screen.getByLabelText('Documento'), {
      target: { value: '123' },
    })
    draw()
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/signatures`)).toEqual({
        signerName: 'Rui Solicitante',
        signerDocument: '123',
        signerEmail: null,
        purpose: 'Aceite do atendimento',
        image: PNG,
      }),
    )
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Nome de quem assina') as HTMLInputElement)
          .value,
      ).toBe(''),
    )
  })
})
