import { describe, expect, it } from 'vitest'
import {
  fileNameFromUrl,
  findExactQuickReply,
  matchQuickReplies,
  mediaTypeFromUrl,
  normalizeQuickReplyShortcut,
  quickReplyQueryOf,
} from '@/src/lib/whatsapp/quick-reply-match'

const replies = [
  { id: 'a', shortcut: 'saudacao-tarde', title: 'Boa tarde' },
  { id: 'b', shortcut: '/Saudação', title: 'Saudação' },
  { id: 'c', shortcut: 'preco', title: 'Tabela de preços' },
  { id: 'd', shortcut: 'horario', title: 'Horário de atendimento' },
]

describe('normalizeQuickReplyShortcut', () => {
  it('drops the leading slashes, accents, case and outer spaces', () => {
    expect(normalizeQuickReplyShortcut('  //Saudação ')).toBe('saudacao')
    expect(normalizeQuickReplyShortcut('preco')).toBe('preco')
  })
})

describe('quickReplyQueryOf', () => {
  it('reads the query of a lone `/word`', () => {
    expect(quickReplyQueryOf('/')).toBe('')
    expect(quickReplyQueryOf('/Saudação')).toBe('saudacao')
  })

  it('ignores text that is not a lone slash command', () => {
    expect(quickReplyQueryOf('oi /saudacao')).toBeNull()
    expect(quickReplyQueryOf('/saudacao amigo')).toBeNull()
    expect(quickReplyQueryOf('saudacao')).toBeNull()
  })
})

describe('matchQuickReplies', () => {
  it('ranks the exact shortcut first, then prefixes, then titles', () => {
    expect(matchQuickReplies(replies, 'saudacao').map((r) => r.id)).toEqual([
      'b',
      'a',
    ])
    expect(matchQuickReplies(replies, 'atendimento').map((r) => r.id)).toEqual([
      'd',
    ])
  })

  it('lists everything for a bare slash, capped by the limit', () => {
    expect(matchQuickReplies(replies, '')).toHaveLength(4)
    expect(matchQuickReplies(replies, '', 2)).toHaveLength(2)
  })

  it('returns nothing when no shortcut or title matches', () => {
    expect(matchQuickReplies(replies, 'zzz')).toEqual([])
  })
})

describe('findExactQuickReply', () => {
  it('finds the reply whose shortcut is exactly the typed text', () => {
    expect(findExactQuickReply(replies, ' /saudacao ')?.id).toBe('b')
    expect(findExactQuickReply(replies, '/PRECO')?.id).toBe('c')
  })

  it('returns null for partial, empty or non-command text', () => {
    expect(findExactQuickReply(replies, '/sauda')).toBeNull()
    expect(findExactQuickReply(replies, '/')).toBeNull()
    expect(findExactQuickReply(replies, 'olá')).toBeNull()
  })
})

describe('mediaTypeFromUrl', () => {
  it('maps the extension to the WhatsApp media type', () => {
    expect(mediaTypeFromUrl('https://x.test/media/a.JPG?v=1')).toBe('IMAGE')
    expect(mediaTypeFromUrl('https://x.test/media/a.mp4')).toBe('VIDEO')
    expect(mediaTypeFromUrl('https://x.test/media/a.ogg#t')).toBe('AUDIO')
    expect(mediaTypeFromUrl('https://x.test/media/a.pdf')).toBe('DOCUMENT')
  })

  it('falls back to a plain path split for relative urls', () => {
    expect(mediaTypeFromUrl('/media/foto.png?x=1')).toBe('IMAGE')
  })
})

describe('fileNameFromUrl', () => {
  it('takes the decoded last path segment', () => {
    expect(
      fileNameFromUrl('https://x.test/media/ws/Tabela%20de%20pre%C3%A7os.pdf'),
    ).toBe('Tabela de preços.pdf')
  })

  it('keeps a segment that is not valid percent-encoding', () => {
    expect(fileNameFromUrl('/media/100%.pdf')).toBe('100%.pdf')
  })

  it('falls back to a generic name without a path', () => {
    expect(fileNameFromUrl('https://x.test/')).toBe('anexo')
  })
})
