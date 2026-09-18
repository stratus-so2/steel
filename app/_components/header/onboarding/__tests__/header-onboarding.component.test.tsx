import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingBackButton } from '../header-onboarding-back-button'
import { OnboardingProgressBar } from '../header-onboarding-progress-bar'
import { OnboardingUserButton } from '../header-onboarding-user-button'

const nav = vi.hoisted(() => ({
  pathname: '/onboarding/role-setup',
  push: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn() }),
}))

const actions = vi.hoisted(() => ({ goBackOnboarding: vi.fn() }))
vi.mock('@/app/onboarding/actions', () => ({
  goBackOnboarding: actions.goBackOnboarding,
}))

const auth = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('@/src/lib/auth-client', () => ({
  authClient: { signOut: auth.signOut },
}))

describe('<OnboardingBackButton />', () => {
  beforeEach(() => {
    actions.goBackOnboarding.mockResolvedValue(undefined)
  })

  it.each([
    ['/onboarding/role-setup', '/onboarding/profile-setup'],
    ['/onboarding/goals-setup', '/onboarding/role-setup'],
    ['/onboarding/workspace-setup', '/onboarding/goals-setup'],
  ])('on %s goes back to %s after rewinding the step', async (from, to) => {
    nav.pathname = from
    render(<OnboardingBackButton />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith(to))
    expect(actions.goBackOnboarding).toHaveBeenCalledTimes(1)
  })

  it.each([
    '/onboarding/consent-setup',
    '/onboarding/profile-setup',
  ])('renders nothing on the first steps (%s)', (path) => {
    nav.pathname = path
    const { container } = render(<OnboardingBackButton />)
    expect(container.innerHTML).toBe('')
  })
})

describe('<OnboardingProgressBar />', () => {
  function barWidth(container: HTMLElement) {
    const inner = container.firstElementChild?.firstElementChild as HTMLElement
    return inner.style.width
  }

  it.each([
    ['/onboarding/consent-setup', '20%'],
    ['/onboarding/goals-setup', '80%'],
    ['/onboarding/workspace-setup', '100%'],
    ['/onboarding/unknown', '20%'],
  ])('fills %s to %s', async (path, width) => {
    nav.pathname = path
    const { container } = render(<OnboardingProgressBar />)

    // Starts empty and animates on the next frame.
    await act(
      () => new Promise((resolve) => requestAnimationFrame(() => resolve(0))),
    )
    await waitFor(() => expect(barWidth(container)).toBe(width))
  })
})

describe('<OnboardingUserButton />', () => {
  it('shows the name (or e-mail) and initials', () => {
    const { rerender } = render(
      <OnboardingUserButton
        name='Ana Souza'
        email='ana@empresa.com'
        image={null}
        initials='AS'
      />,
    )
    expect(screen.getByText('Ana Souza')).toBeTruthy()
    expect(screen.getByText('AS')).toBeTruthy()

    rerender(
      <OnboardingUserButton
        name={null}
        email='ana@empresa.com'
        image={null}
        initials='A'
      />,
    )
    expect(screen.getByText('ana@empresa.com')).toBeTruthy()
  })

  it('"E-mail incorreto" signs out and returns to sign-in', async () => {
    auth.signOut.mockResolvedValue({})
    render(
      <OnboardingUserButton
        name='Ana Souza'
        email='ana@empresa.com'
        image={null}
        initials='AS'
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Ana Souza/ }))
    fireEvent.click(await screen.findByText('E-mail incorreto'))

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/sign-in'))
    expect(auth.signOut).toHaveBeenCalledTimes(1)
  })
})
