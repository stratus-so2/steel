import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WhatsappAiBanner } from '../whatsapp-ai-banner'
import { WhatsappHandoffBanner } from '../whatsapp-handoff-banner'

describe('<WhatsappHandoffBanner />', () => {
  it('explains the human handoff and resumes the AI on click', () => {
    const onResumeAi = vi.fn()
    render(<WhatsappHandoffBanner onResumeAi={onResumeAi} isResuming={false} />)

    expect(
      screen.getByText(
        'Esta conversa foi transferida para atendimento humano.',
      ),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Retomar atendimento da IA' }),
    )
    expect(onResumeAi).toHaveBeenCalledTimes(1)
  })

  it('disables the action while resuming', () => {
    const onResumeAi = vi.fn()
    render(<WhatsappHandoffBanner onResumeAi={onResumeAi} isResuming />)

    const button = screen.getByRole('button', {
      name: 'Retomar atendimento da IA',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onResumeAi).not.toHaveBeenCalled()
  })
})

describe('<WhatsappAiBanner />', () => {
  it('warns that the AI is handling the conversation and allows removal', () => {
    const onRemoveFromAi = vi.fn()
    render(
      <WhatsappAiBanner onRemoveFromAi={onRemoveFromAi} isRemoving={false} />,
    )

    expect(screen.getByText(/A IA está atendendo esta conversa/)).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Remover do atendimento da IA' }),
    )
    expect(onRemoveFromAi).toHaveBeenCalledTimes(1)
  })

  it('disables removal while the request is in flight', () => {
    render(<WhatsappAiBanner onRemoveFromAi={vi.fn()} isRemoving />)
    const button = screen.getByRole('button', {
      name: 'Remover do atendimento da IA',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})
