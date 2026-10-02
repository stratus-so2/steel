import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CookieConsent } from '@/lib/cookie-consent/types'
import { ConsentedTrackers } from '../consented-trackers'
import { CookieConsentProvider } from '../provider'

// Stub das integrações de analytics com nós marcadores. Os módulos reais
// puxam telemetria só de navegador; aqui interessa apenas *se* eles são
// renderizados, que é exatamente o que o portão de consentimento decide.
vi.mock('@next/third-parties/google', () => ({
  GoogleAnalytics: ({ gaId }: { gaId: string }) => (
    <div data-testid='google-analytics' data-ga-id={gaId} />
  ),
}))
vi.mock('@/lib/axiom/client', () => ({
  WebVitals: () => <div data-testid='axiom-web-vitals' />,
}))

// O PostHog é o único com comportamento próprio a verificar: ele só pode
// tocar o SDK depois do consentimento, e a identidade que manda é só o id.
const loadPostHog = vi.hoisted(() => vi.fn())
vi.mock('@/lib/posthog/client', () => ({ loadPostHog }))

vi.mock('@/lib/env/env', () => ({ NEXT_PUBLIC_GA_ID: 'G-TEST' }))

const TRACKER_TESTIDS = ['axiom-web-vitals', 'google-analytics'] as const

function renderWithConsent(
  initial: CookieConsent,
  userId: string | null = null,
) {
  return render(
    <CookieConsentProvider
      initial={initial}
      isAuthenticated={!!userId}
      userId={userId}
    >
      <ConsentedTrackers />
    </CookieConsentProvider>,
  )
}

describe('<ConsentedTrackers /> consent gate', () => {
  beforeEach(() => {
    loadPostHog.mockReset()
    loadPostHog.mockResolvedValue(null)
  })

  it('mounts all trackers when consent is accepted', () => {
    renderWithConsent('accepted')
    for (const testId of TRACKER_TESTIDS) {
      expect(screen.getByTestId(testId)).toBeTruthy()
    }
  })

  it('mounts no tracker when consent is rejected', () => {
    renderWithConsent('rejected')
    for (const testId of TRACKER_TESTIDS) {
      expect(screen.queryByTestId(testId)).toBeNull()
    }
  })

  it('mounts no tracker when the decision is still pending (null)', () => {
    renderWithConsent(null)
    for (const testId of TRACKER_TESTIDS) {
      expect(screen.queryByTestId(testId)).toBeNull()
    }
  })

  it('loads PostHog once consent is accepted', () => {
    renderWithConsent('accepted')
    expect(loadPostHog).toHaveBeenCalledTimes(1)
  })

  it('never touches the PostHog SDK without consent', () => {
    renderWithConsent('rejected')
    renderWithConsent(null)
    expect(loadPostHog).not.toHaveBeenCalled()
  })

  it('identifies the signed-in user by id and nothing else', async () => {
    const posthog = {
      get_distinct_id: vi.fn(() => 'anon-id'),
      identify: vi.fn(),
      _isIdentified: vi.fn(() => false),
      reset: vi.fn(),
    }
    loadPostHog.mockResolvedValue(posthog)

    renderWithConsent('accepted', 'user_123')
    await vi.waitFor(() => expect(posthog.identify).toHaveBeenCalled())

    expect(posthog.identify).toHaveBeenCalledWith('user_123')
    expect(posthog.reset).not.toHaveBeenCalled()
  })

  it('resets the identity for an anonymous visitor who was identified', async () => {
    const posthog = {
      get_distinct_id: vi.fn(() => 'user_123'),
      identify: vi.fn(),
      _isIdentified: vi.fn(() => true),
      reset: vi.fn(),
    }
    loadPostHog.mockResolvedValue(posthog)

    renderWithConsent('accepted', null)
    await vi.waitFor(() => expect(posthog.reset).toHaveBeenCalledTimes(1))

    expect(posthog.identify).not.toHaveBeenCalled()
  })

  it('does not re-identify when the distinct id already matches', async () => {
    const posthog = {
      get_distinct_id: vi.fn(() => 'user_123'),
      identify: vi.fn(),
      _isIdentified: vi.fn(() => true),
      reset: vi.fn(),
    }
    loadPostHog.mockResolvedValue(posthog)

    renderWithConsent('accepted', 'user_123')
    await vi.waitFor(() => expect(posthog.get_distinct_id).toHaveBeenCalled())

    expect(posthog.identify).not.toHaveBeenCalled()
    expect(posthog.reset).not.toHaveBeenCalled()
  })
})
