import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConsentForm } from '../consent-form'

const actions = vi.hoisted(() => ({ acceptOnboardingConsent: vi.fn() }))
vi.mock('../actions', () => ({
  acceptOnboardingConsent: actions.acceptOnboardingConsent,
}))

function continueButton() {
  return screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement
}

describe('<ConsentForm /> (onboarding)', () => {
  it('blocks continuing until both documents are accepted', () => {
    render(<ConsentForm />)
    const [terms, privacy] = screen.getAllByRole('checkbox')

    expect(continueButton().disabled).toBe(true)
    fireEvent.click(terms)
    expect(continueButton().disabled).toBe(true)
    fireEvent.click(privacy)
    expect(continueButton().disabled).toBe(false)

    // Revoking one of them locks the button again.
    fireEvent.click(terms)
    expect(continueButton().disabled).toBe(true)
  })

  it('links the legal documents in new tabs', () => {
    render(<ConsentForm />)

    const terms = screen.getByRole('link', { name: 'Termos de Serviço' })
    expect(terms.getAttribute('href')).toBe('/legals/terms')
    expect(terms.getAttribute('target')).toBe('_blank')
    expect(
      screen
        .getByRole('link', { name: 'Política de Privacidade' })
        .getAttribute('href'),
    ).toBe('/legals/privacy')
  })

  it('uses the right article before each document', () => {
    render(<ConsentForm />)
    const labels = screen
      .getAllByText(/Li e aceito/)
      .map((l) => l.textContent?.replace(/\s+/g, ' ').trim())
    expect(labels).toEqual([
      'Li e aceito os Termos de Serviço',
      'Li e aceito a Política de Privacidade',
    ])
  })

  it('submits both consent flags to the server action', async () => {
    actions.acceptOnboardingConsent.mockResolvedValue({ ok: true })
    render(<ConsentForm />)
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)

    fireEvent.click(continueButton())

    await waitFor(() =>
      expect(actions.acceptOnboardingConsent).toHaveBeenCalled(),
    )
    const fd = actions.acceptOnboardingConsent.mock.calls[0][1] as FormData
    expect(fd.get('acceptedTerms')).toBeTruthy()
    expect(fd.get('acceptedPrivacy')).toBeTruthy()
  })

  it('shows the server action error', async () => {
    actions.acceptOnboardingConsent.mockResolvedValue({
      ok: false,
      error: 'Sessão expirada. Faça login novamente.',
    })
    render(<ConsentForm />)
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
    fireEvent.click(continueButton())

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Sessão expirada. Faça login novamente.',
    )
  })
})
