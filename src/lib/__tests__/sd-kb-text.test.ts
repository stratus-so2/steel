import { describe, expect, it } from 'vitest'
import {
  countSdKbWords,
  extractSdKbPlainText,
  SD_KB_PLAIN_TEXT_MAX,
  sdKbExcerpt,
  sdKbReadingMinutes,
} from '../servicedesk/sd-kb-text'

describe('extractSdKbPlainText', () => {
  it('returns an empty string for non-array content', () => {
    expect(extractSdKbPlainText(null)).toBe('')
    expect(extractSdKbPlainText({ type: 'p' })).toBe('')
  })

  it('joins blocks by line and inlines within a block', () => {
    const content = [
      { type: 'h1', children: [{ text: 'Título' }] },
      {
        type: 'p',
        children: [
          { text: 'Fale com ' },
          { type: 'mention', value: 'Ana', children: [{ text: '' }] },
          { text: ' via ' },
          { type: 'a', url: 'https://x', children: [{ text: 'portal' }] },
        ],
      },
      { type: 'p', children: [{ text: '   ' }] },
      {
        type: 'table',
        children: [
          {
            type: 'tr',
            children: [
              {
                type: 'td',
                children: [{ type: 'p', children: [{ text: 'A1' }] }],
              },
              {
                type: 'td',
                children: [{ type: 'p', children: [{ text: 'B1' }] }],
              },
            ],
          },
        ],
      },
      { type: 'equation', texExpression: 'E=mc^2', children: [{ text: '' }] },
      { type: 'hr', children: [{ text: '' }] },
      'lixo',
    ]
    expect(extractSdKbPlainText(content)).toBe(
      'Título\nFale com Ana via portal\nA1\nB1\nE=mc^2',
    )
  })

  it('handles blocks without children and caps the length', () => {
    expect(extractSdKbPlainText([{ type: 'img', url: 'x' }])).toBe('')
    const long = [
      {
        type: 'p',
        children: [{ text: 'a'.repeat(SD_KB_PLAIN_TEXT_MAX + 10) }],
      },
    ]
    expect(extractSdKbPlainText(long)).toHaveLength(SD_KB_PLAIN_TEXT_MAX)
  })
})

describe('reading time', () => {
  it('counts words and rounds reading minutes up (min 1)', () => {
    expect(countSdKbWords('')).toBe(0)
    expect(countSdKbWords('  um  dois\ntrês ')).toBe(3)
    expect(sdKbReadingMinutes('')).toBe(1)
    expect(sdKbReadingMinutes(Array(201).fill('p').join(' '))).toBe(2)
  })
})

describe('sdKbExcerpt', () => {
  const text = `${'início '.repeat(40)}configurar a impressão de rede ${'fim '.repeat(60)}`

  it('returns short texts untouched', () => {
    expect(sdKbExcerpt('texto  curto', 'x')).toBe('texto curto')
  })

  it('centers the excerpt on the first term, ignoring accents and case', () => {
    const excerpt = sdKbExcerpt(text, 'IMPRESSAO', 60)
    expect(excerpt.startsWith('…')).toBe(true)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt).toContain('impressão')
  })

  it('uses the earliest of several matching terms', () => {
    const excerpt = sdKbExcerpt(text, 'rede impressao', 60)
    expect(excerpt.indexOf('impressão')).toBeLessThan(excerpt.indexOf('rede'))
  })

  it('falls back to the beginning when no term matches', () => {
    const excerpt = sdKbExcerpt(text, 'zz a', 30)
    expect(excerpt.startsWith('início')).toBe(true)
    expect(excerpt.endsWith('…')).toBe(true)
  })

  it('does not prefix an ellipsis when the hit is at the start', () => {
    const excerpt = sdKbExcerpt(`rede ${'x '.repeat(200)}`, 'rede', 40)
    expect(excerpt.startsWith('rede')).toBe(true)
  })

  it('does not suffix an ellipsis when the hit reaches the end', () => {
    const excerpt = sdKbExcerpt(`${'x '.repeat(200)}fim da rede`, 'rede', 40)
    expect(excerpt.endsWith('rede')).toBe(true)
  })
})
