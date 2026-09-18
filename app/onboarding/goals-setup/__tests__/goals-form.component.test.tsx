import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GoalsForm } from '../goals-form'

const actions = vi.hoisted(() => ({ saveGoalsSetup: vi.fn() }))
vi.mock('../actions', () => ({ saveGoalsSetup: actions.saveGoalsSetup }))

function lastFormData(): FormData {
  const call = actions.saveGoalsSetup.mock.calls.at(-1)
  if (!call) throw new Error('saveGoalsSetup was not called')
  return call[1] as FormData
}

function continueButton() {
  return screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement
}

describe('<GoalsForm /> (onboarding)', () => {
  it('renders the five goals and disables "Continuar" with none checked', () => {
    render(<GoalsForm />)

    expect(screen.getAllByRole('checkbox')).toHaveLength(5)
    expect(
      screen.getByText('Planejar e acompanhar roadmaps de produto'),
    ).toBeTruthy()
    expect(continueButton().disabled).toBe(true)
  })

  it('enables continue once a goal is checked and disables it again when unchecked', () => {
    render(<GoalsForm />)
    const [first] = screen.getAllByRole('checkbox')

    fireEvent.click(first)
    expect(continueButton().disabled).toBe(false)

    fireEvent.click(first)
    expect(continueButton().disabled).toBe(true)
  })

  it('submits every checked goal with the continue intent', async () => {
    actions.saveGoalsSetup.mockResolvedValue({ ok: true })
    render(<GoalsForm />)
    const boxes = screen.getAllByRole('checkbox')

    fireEvent.click(boxes[0])
    fireEvent.click(boxes[2])
    fireEvent.click(continueButton())

    await waitFor(() => expect(actions.saveGoalsSetup).toHaveBeenCalled())
    const fd = lastFormData()
    expect(fd.getAll('goals')).toEqual(['ROADMAP', 'CROSS_FUNCTIONAL'])
    expect(fd.get('intent')).toBe('continue')
  })

  it('allows skipping without choosing anything', async () => {
    actions.saveGoalsSetup.mockResolvedValue({ ok: true })
    render(<GoalsForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Pular esta etapa' }))

    await waitFor(() => expect(actions.saveGoalsSetup).toHaveBeenCalled())
    const fd = lastFormData()
    expect(fd.get('intent')).toBe('skip')
    expect(fd.getAll('goals')).toEqual([])
  })

  it('shows the server action error', async () => {
    actions.saveGoalsSetup.mockResolvedValue({
      ok: false,
      error: 'Selecione ao menos um objetivo',
    })
    render(<GoalsForm />)

    fireEvent.click(screen.getAllByRole('checkbox')[4])
    fireEvent.click(continueButton())

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Selecione ao menos um objetivo',
    )
  })
})
