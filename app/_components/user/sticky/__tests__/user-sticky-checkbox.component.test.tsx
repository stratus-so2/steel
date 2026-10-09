import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Checkbox } from '@/components/ui/checkbox'
import { renderWithQuery } from '@/src/__tests__/component-utils'
import type { StickyNoteDTO } from '@/types/sticky-note'
import { UserStick } from '../user-sticky'

// The sticky's task checkbox is a native input drawn by `globals.css`; jsdom
// does not apply stylesheets, so the rule is checked as text and the markup
// it targets is checked by rendering the real editor.
const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

function ruleFor(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `missing rule ${selector}`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

const sticky: StickyNoteDTO = {
  id: 'st_1',
  userId: 'u_1',
  color: 'YELLOW',
  content: {
    type: 'doc',
    content: [
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Feita' }] },
            ],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Pendente' }],
              },
            ],
          },
        ],
      },
    ],
  },
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

describe('sticky task checkbox visibility', () => {
  it('draws the unchecked box from the text colour, not from --input', () => {
    const rule = ruleFor(
      '.tiptap ul[data-type="taskList"] li input[type="checkbox"]',
    )
    expect(rule).toMatch(
      /border: 1\.5px solid color-mix\(in oklab, currentColor/,
    )
    expect(rule).toMatch(/background-color: color-mix\(in oklab, currentColor/)
    expect(rule).not.toContain('--color-input')
  })

  it('lays the checkbox beside its text and strikes done items', () => {
    expect(ruleFor('.tiptap ul[data-type="taskList"] li')).toContain(
      'display: flex',
    )
    expect(
      ruleFor('.tiptap ul[data-type="taskList"] li[data-checked="true"] > div'),
    ).toContain('line-through')
  })

  it('renders the markup those rules target', async () => {
    const { container } = renderWithQuery(<UserStick sticky={sticky} />)
    const pending = await screen.findByText('Pendente')
    const item = pending.closest('li')
    expect(item?.getAttribute('data-checked')).toBe('false')
    const list = container.querySelector('.tiptap ul[data-type="taskList"]')
    const boxes = list?.querySelectorAll<HTMLInputElement>(
      'li > label > input[type="checkbox"]',
    )
    expect(boxes).toHaveLength(2)
    expect(boxes?.[1].checked).toBe(false)
    // Every colour keeps the text colour from the theme (no fixed text
    // colour that would fight the currentColor-based box).
    const note = container.firstElementChild as HTMLElement
    expect(note.className).toMatch(/bg-yellow-100 dark:bg-yellow-950/)
    expect(note.className).not.toMatch(/\btext-/)
  })
})

describe('<Checkbox /> unchecked border', () => {
  it('uses a border that reads on white and coloured surfaces', () => {
    render(<Checkbox aria-label='Tarefa' />)
    const box = screen.getByRole('checkbox', { name: 'Tarefa' })
    expect(box.className).toContain('border-muted-foreground/60')
    expect(box.className).not.toMatch(/(^|\s)border-input(\s|$)/)
  })
})
