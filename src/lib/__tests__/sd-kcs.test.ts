import { describe, expect, it } from 'vitest'
import {
  buildSdKcsDraftSystem,
  SD_KCS_SECTIONS,
  sdKcsContent,
  sdKcsDaysUntilReview,
  sdKcsEffectiveInterval,
  sdKcsReviewDueAt,
  sdKcsReviewDueBody,
  sdKcsReviewOverdue,
  sdKcsSkeleton,
  sdKcsTitleFromTicket,
} from '../servicedesk/kcs'

const HEADINGS = ['Problema', 'Ambiente', 'Causa', 'Solução', 'Validação']

describe('sdKcsSkeleton', () => {
  it('traz as cinco seções com a dica de preenchimento', () => {
    const blocks = sdKcsSkeleton()
    expect(blocks).toHaveLength(SD_KCS_SECTIONS.length * 2)
    expect(
      blocks.filter((b) => b.type === 'h2').map((b) => b.children[0].text),
    ).toEqual(HEADINGS)
    expect(blocks[1]).toEqual({
      type: 'p',
      children: [{ text: SD_KCS_SECTIONS[0].hint }],
    })
  })
})

describe('sdKcsContent', () => {
  it('escreve um parágrafo por linha e preserva a ordem das seções', () => {
    const blocks = sdKcsContent({
      problem: ['A VPN cai no login.'],
      solution: ['Reinstale o cliente.', 'Importe o perfil.'],
    })
    expect(
      blocks.filter((b) => b.type === 'h2').map((b) => b.children[0].text),
    ).toEqual(HEADINGS)
    const texts = blocks.map((b) => b.children[0].text)
    expect(texts).toContain('A VPN cai no login.')
    expect(texts).toContain('Importe o perfil.')
  })

  it('cai na dica quando a seção vem vazia ou só com espaços', () => {
    const blocks = sdKcsContent({ problem: ['   ', ''], cause: [] })
    const problemBody = blocks[1].children[0].text
    expect(problemBody).toBe(SD_KCS_SECTIONS[0].hint)
  })
})

describe('sdKcsTitleFromTicket', () => {
  it('limpa prefixo de resposta, etiqueta e espaços', () => {
    expect(sdKcsTitleFromTicket('Re: VPN   não conecta')).toBe(
      'VPN não conecta',
    )
    expect(sdKcsTitleFromTicket('[Suporte] Impressora sem toner')).toBe(
      'Impressora sem toner',
    )
    expect(sdKcsTitleFromTicket('ENC: chamado')).toBe('chamado')
  })

  it('corta em 255 caracteres', () => {
    expect(sdKcsTitleFromTicket('a'.repeat(300))).toHaveLength(255)
  })
})

describe('buildSdKcsDraftSystem', () => {
  it('descreve as seções, proíbe dado pessoal e inclui o chamado', () => {
    const prompt = buildSdKcsDraftSystem({ ticket: 'Chamado INC-1 — VPN' })
    for (const section of SD_KCS_SECTIONS) {
      expect(prompt).toContain(section.key)
      expect(prompt).toContain(section.heading)
    }
    expect(prompt).toContain('Chamado INC-1 — VPN')
    expect(prompt).toMatch(/não copie nome de pessoa/i)
  })
})

describe('validade da revisão', () => {
  const now = new Date('2026-10-02T12:00:00.000Z')

  it('usa a validade do artigo e cai no padrão do workspace', () => {
    expect(sdKcsEffectiveInterval(30, 180)).toBe(30)
    expect(sdKcsEffectiveInterval(null, 180)).toBe(180)
    expect(sdKcsEffectiveInterval(0, 180)).toBe(180)
    expect(sdKcsEffectiveInterval(undefined, 90)).toBe(90)
  })

  it('agenda o próximo prazo e trata "sem validade"', () => {
    expect(sdKcsReviewDueAt(now, 10)?.toISOString()).toBe(
      '2026-10-12T12:00:00.000Z',
    )
    expect(sdKcsReviewDueAt(now, null)).toBeNull()
    expect(sdKcsReviewDueAt(now, 0)).toBeNull()
  })

  it('reconhece o vencido (inclusive na data exata) e ignora valor inválido', () => {
    expect(sdKcsReviewOverdue('2026-10-01T00:00:00.000Z', now)).toBe(true)
    expect(sdKcsReviewOverdue(now, now)).toBe(true)
    expect(sdKcsReviewOverdue('2026-12-01T00:00:00.000Z', now)).toBe(false)
    expect(sdKcsReviewOverdue(null, now)).toBe(false)
    expect(sdKcsReviewOverdue('não é data', now)).toBe(false)
    expect(sdKcsReviewOverdue(new Date('2020-01-01'))).toBe(true)
  })

  it('conta os dias que faltam (negativo quando venceu)', () => {
    expect(sdKcsDaysUntilReview('2026-10-12T12:00:00.000Z', now)).toBe(10)
    expect(sdKcsDaysUntilReview('2026-09-30T12:00:00.000Z', now)).toBe(-2)
    expect(sdKcsDaysUntilReview(null, now)).toBeNull()
    expect(sdKcsDaysUntilReview('nope', now)).toBeNull()
    expect(
      sdKcsDaysUntilReview(new Date('2026-10-03T12:00:00.000Z'), now),
    ).toBe(1)
  })

  it('escreve o aviso no singular e no plural', () => {
    expect(sdKcsReviewDueBody(1)).toContain('1 artigo que você mantém')
    expect(sdKcsReviewDueBody(4)).toContain('4 artigos')
  })
})
