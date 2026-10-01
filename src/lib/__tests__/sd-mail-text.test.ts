import { describe, expect, it } from 'vitest'
import {
  cleanSdMailBody,
  isSdMailAutomatic,
  normalizeSdMailAddress,
  normalizeSdMailText,
  SD_MAIL_BODY_MAX,
  sdMailAddressMatches,
  sdMailHtmlToText,
  sdMailOutboundBody,
  sdMailReferences,
  sdMailReplySubject,
  sdMailSenderAllowed,
  sdMailTicketCodeFromSubject,
  sdMailTicketTitle,
  stripSdMailQuote,
  stripSdMailSignature,
} from '../servicedesk/mail-text'

describe('normalizeSdMailText', () => {
  it('normalizes line endings, nbsp, trailing spaces and blank runs', () => {
    expect(
      normalizeSdMailText('  oi\r\nmundo   \r\n\r\n\r\n\r\nfim !  \n'),
    ).toBe('oi\nmundo\n\nfim !')
  })

  it('returns an empty string for whitespace only', () => {
    expect(normalizeSdMailText('   \n\n\t ')).toBe('')
  })
})

describe('stripSdMailQuote', () => {
  it('cuts the pt-BR "Em ... escreveu:" header', () => {
    const body = [
      'Obrigado, resolvido!',
      '',
      'Em 1 de out. de 2026 10:00, Suporte <suporte@x.com> escreveu:',
      '> Pode testar de novo?',
    ].join('\n')
    expect(stripSdMailQuote(body)).toBe('Obrigado, resolvido!\n')
  })

  it('cuts the English "On ... wrote:" header', () => {
    const body =
      'Thanks!\n\nOn Wed, Oct 1, 2026 at 10:00, S <s@x.com> wrote:\n> hi'
    expect(stripSdMailQuote(body)).toBe('Thanks!\n')
  })

  it('cuts the Spanish "El ... escribió:" header', () => {
    expect(
      stripSdMailQuote('Gracias\nEl 1 oct 2026, S escribió:\n> hola'),
    ).toBe('Gracias')
  })

  it.each([
    '-----Mensagem original-----',
    '-----Original Message-----',
    '-----Mensaje original-----',
    '--- Encaminhada por Ana ---',
    '____________________________',
  ])('cuts the Outlook separator %s', (separator) => {
    expect(stripSdMailQuote(`novo texto\n${separator}\nvelho`)).toBe(
      'novo texto',
    )
  })

  it('cuts the Steel marker so our own footer never comes back', () => {
    const body =
      'Já tentei reiniciar.\n-- Responda acima desta linha --\nChamado INC-000001'
    expect(stripSdMailQuote(body)).toBe('Já tentei reiniciar.')
  })

  it('cuts a ">" block of two or more lines', () => {
    expect(stripSdMailQuote('resposta\n> linha 1\n> linha 2')).toBe('resposta')
  })

  it('cuts a ">" line that ends the message', () => {
    expect(stripSdMailQuote('resposta\n> única')).toBe('resposta')
  })

  it('cuts a ">" line followed by a blank line', () => {
    expect(stripSdMailQuote('resposta\n> citada\n\nrodapé')).toBe('resposta')
  })

  it('keeps a ">" line that is clearly part of the text', () => {
    expect(stripSdMailQuote('erro\n> ok ao rodar\nmas falha depois')).toBe(
      'erro\n> ok ao rodar\nmas falha depois',
    )
  })

  it('cuts a pasted Outlook header block without a separator', () => {
    const body = [
      'segue em anexo',
      'De: Ana <ana@x.com>',
      'Enviada em: 1 de outubro',
      'Para: Suporte',
      'Assunto: teste',
    ].join('\n')
    expect(stripSdMailQuote(body)).toBe('segue em anexo')
  })

  it('keeps a lone field-looking line (not a header block)', () => {
    expect(stripSdMailQuote('Assunto: dúvida simples')).toBe(
      'Assunto: dúvida simples',
    )
  })

  it('keeps a body with no quote at all', () => {
    expect(stripSdMailQuote('linha 1\nlinha 2')).toBe('linha 1\nlinha 2')
  })
})

describe('stripSdMailSignature', () => {
  it('cuts from the RFC 3676 separator', () => {
    expect(stripSdMailSignature('texto\n-- \nAna\nGerente')).toBe('texto')
  })

  it('cuts from a bare "--" separator', () => {
    expect(stripSdMailSignature('texto\n--\nAna')).toBe('texto')
  })

  it.each([
    'Atenciosamente,',
    'Att.',
    'Abraços',
    'Best regards',
    'Saudações',
  ])('cuts the trailing "%s" greeting', (greeting) => {
    expect(stripSdMailSignature(`o problema segue\n${greeting}\nAna`)).toBe(
      'o problema segue',
    )
  })

  it('keeps the greeting when it is the whole message', () => {
    expect(stripSdMailSignature('Atenciosamente,')).toBe('Atenciosamente,')
  })

  it('ignores a greeting far from the end', () => {
    const lines = [
      'Atenciosamente,',
      ...Array.from({ length: 10 }, (_, i) => `l${i}`),
    ]
    expect(stripSdMailSignature(lines.join('\n'))).toBe(lines.join('\n'))
  })

  it('keeps a body with no signature', () => {
    expect(stripSdMailSignature('só o texto')).toBe('só o texto')
  })
})

describe('cleanSdMailBody', () => {
  it('strips quote and signature in one pass', () => {
    const raw = [
      'Bom dia,',
      '',
      'a impressora voltou a falhar.',
      '',
      '-- ',
      'Ana Silva',
      'Analista',
      '',
      'Em 1 de out. de 2026, Suporte escreveu:',
      '> Pode testar?',
    ].join('\r\n')
    expect(cleanSdMailBody(raw)).toBe(
      'Bom dia,\n\na impressora voltou a falhar.',
    )
  })

  it('returns an empty string for empty input', () => {
    expect(cleanSdMailBody(null)).toBe('')
    expect(cleanSdMailBody(undefined)).toBe('')
    expect(cleanSdMailBody('   ')).toBe('')
  })

  it('returns an empty string when the message is only a quote', () => {
    expect(cleanSdMailBody('> tudo citado\n> mesmo')).toBe('')
  })

  it('keeps the text before the quote when only the signature survives', () => {
    expect(cleanSdMailBody('Atenciosamente,\n> citado\n> mais')).toBe(
      'Atenciosamente,',
    )
  })

  it('truncates very long bodies with an ellipsis', () => {
    const cleaned = cleanSdMailBody('a'.repeat(SD_MAIL_BODY_MAX + 500))
    expect(cleaned).toHaveLength(SD_MAIL_BODY_MAX)
    expect(cleaned.endsWith('…')).toBe(true)
  })
})

describe('sdMailHtmlToText', () => {
  it('drops script/style, turns breaks into newlines and decodes entities', () => {
    const html = [
      '<style>p{color:red}</style>',
      '<script>alert(1)</script>',
      '<p>Oi&nbsp;&amp; ol&aacute;</p>',
      '<div>linha<br>quebrada</div>',
      '<ul><li>um</li><li>dois</li></ul>',
      '<p>&lt;tag&gt; &quot;x&quot; &#39;y&#39;</p>',
    ].join('')
    expect(sdMailHtmlToText(html)).toBe(
      'Oi & ol&aacute;\nlinha\nquebrada\n• um\n• dois\n<tag> "x" \'y\'',
    )
  })
})

describe('normalizeSdMailAddress', () => {
  it.each([
    ['Ana <A@X.COM>', 'a@x.com'],
    ['  B@X.com ', 'b@x.com'],
    [null, ''],
    [undefined, ''],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeSdMailAddress(input)).toBe(expected)
  })
})

describe('sdMailAddressMatches', () => {
  it('matches an exact address', () => {
    expect(sdMailAddressMatches('Ana <a@x.com>', 'a@x.com')).toBe(true)
    expect(sdMailAddressMatches('a@x.com', 'b@x.com')).toBe(false)
  })

  it('matches a whole domain with the "@dominio" form', () => {
    expect(sdMailAddressMatches('a@x.com', '@x.com')).toBe(true)
    expect(sdMailAddressMatches('a@y.com', '@x.com')).toBe(false)
  })

  it('refuses empty sides', () => {
    expect(sdMailAddressMatches('', '@x.com')).toBe(false)
    expect(sdMailAddressMatches('a@x.com', '  ')).toBe(false)
  })
})

describe('sdMailSenderAllowed', () => {
  const lists = (allowed: string[] = [], blocked: string[] = []) => ({
    allowedSenders: allowed,
    blockedSenders: blocked,
  })

  it('accepts anyone when the allow list is empty', () => {
    expect(sdMailSenderAllowed('a@x.com', lists())).toBe(true)
  })

  it('accepts only the allow list when it has entries', () => {
    expect(sdMailSenderAllowed('a@x.com', lists(['@x.com']))).toBe(true)
    expect(sdMailSenderAllowed('a@y.com', lists(['@x.com']))).toBe(false)
  })

  it('lets the block list win over the allow list', () => {
    expect(sdMailSenderAllowed('a@x.com', lists(['@x.com'], ['a@x.com']))).toBe(
      false,
    )
  })

  it('refuses an empty sender', () => {
    expect(sdMailSenderAllowed('', lists())).toBe(false)
  })
})

describe('isSdMailAutomatic', () => {
  it('detects Auto-Submitted other than "no"', () => {
    expect(
      isSdMailAutomatic({ headers: { 'auto-submitted': 'auto-replied' } }),
    ).toBe(true)
    expect(isSdMailAutomatic({ headers: { 'auto-submitted': 'no' } })).toBe(
      false,
    )
  })

  it.each([
    'x-autoreply',
    'x-autorespond',
    'x-auto-response-suppress',
    'list-id',
    'list-unsubscribe',
  ])('detects the %s header', (name) => {
    expect(isSdMailAutomatic({ headers: { [name]: 'yes' } })).toBe(true)
  })

  it.each([
    'bulk',
    'list',
    'junk',
    'auto_reply',
  ])('detects Precedence: %s', (precedence) => {
    expect(isSdMailAutomatic({ headers: { precedence } })).toBe(true)
  })

  it('ignores Precedence: normal', () => {
    expect(isSdMailAutomatic({ headers: { precedence: 'normal' } })).toBe(false)
  })

  it('detects an empty Return-Path (bounce)', () => {
    expect(isSdMailAutomatic({ headers: { 'return-path': '<>' } })).toBe(true)
    expect(isSdMailAutomatic({ headers: { 'Return-Path': '' } })).toBe(true)
    expect(isSdMailAutomatic({ headers: { 'return-path': '<a@x.com>' } })).toBe(
      false,
    )
  })

  it('joins array header values before matching', () => {
    expect(isSdMailAutomatic({ headers: { precedence: ['bulk'] } })).toBe(true)
  })

  it.each([
    'MAILER-DAEMON@x.com',
    'postmaster@x.com',
    'no-reply@x.com',
    'noreply@x.com',
  ])('detects the robot sender %s', (fromAddress) => {
    expect(isSdMailAutomatic({ fromAddress })).toBe(true)
  })

  it.each([
    'Out of office',
    'Automatic reply: férias',
    'Resposta automática',
    'Ausência temporária',
    'Undeliverable: teste',
    'Delivery Status Notification (Failure)',
    'Mail delivery failed',
    'Returned mail: see transcript',
  ])('detects the automatic subject "%s"', (subject) => {
    expect(isSdMailAutomatic({ subject })).toBe(true)
  })

  it('treats a normal message as not automatic', () => {
    expect(
      isSdMailAutomatic({
        headers: { from: 'ana@x.com' },
        subject: 'Impressora parada',
        fromAddress: 'ana@x.com',
      }),
    ).toBe(false)
  })

  it('treats a message with no headers at all as not automatic', () => {
    expect(isSdMailAutomatic({})).toBe(false)
  })
})

describe('sdMailTicketCodeFromSubject', () => {
  it('reads the bracketed code', () => {
    expect(sdMailTicketCodeFromSubject('Re: [INC-000123] Impressora')).toEqual({
      prefix: 'INC',
      number: 123,
      code: 'INC-000123',
    })
  })

  it('reads the code without brackets, case-insensitively', () => {
    expect(sdMailTicketCodeFromSubject('chamado req-45 em aberto')).toEqual({
      prefix: 'REQ',
      number: 45,
      code: 'REQ-45',
    })
  })

  it('returns null without a code', () => {
    expect(sdMailTicketCodeFromSubject('Impressora parada')).toBeNull()
    expect(sdMailTicketCodeFromSubject(null)).toBeNull()
    expect(sdMailTicketCodeFromSubject('[INC-0] zero')).toBeNull()
  })
})

describe('sdMailTicketTitle', () => {
  it('drops reply prefixes and the ticket code', () => {
    expect(
      sdMailTicketTitle('Re: Enc: [INC-000123]  Impressora   parada'),
    ).toBe('Impressora parada')
  })

  it('drops the numbered Outlook prefix', () => {
    expect(sdMailTicketTitle('RES[2]: dúvida')).toBe('dúvida')
  })

  it('falls back when nothing is left', () => {
    expect(sdMailTicketTitle('[INC-000123]')).toBe('Chamado aberto por e-mail')
    expect(sdMailTicketTitle(null, 'Sem assunto')).toBe('Sem assunto')
  })

  it('caps the title at 200 characters', () => {
    expect(sdMailTicketTitle('x'.repeat(300))).toHaveLength(200)
  })
})

describe('sdMailReplySubject', () => {
  it('builds "Re: [CODE] assunto" without duplicating either part', () => {
    expect(
      sdMailReplySubject('INC-000123', 'Re: [INC-000123] Impressora'),
    ).toBe('Re: [INC-000123] Impressora')
  })

  it('falls back to "Chamado" with an empty subject', () => {
    expect(sdMailReplySubject('INC-000123', '  ')).toBe(
      'Re: [INC-000123] Chamado',
    )
  })

  it('caps the subject at 250 characters', () => {
    expect(
      sdMailReplySubject('INC-000123', 'y'.repeat(400)).length,
    ).toBeLessThanOrEqual(250)
  })
})

describe('sdMailReferences', () => {
  it('appends the replied id, dedupes and keeps the last 20', () => {
    expect(sdMailReferences([' <a> ', '<b>'], '<a>')).toEqual(['<a>', '<b>'])
    expect(sdMailReferences(['<a>'], '<b>')).toEqual(['<a>', '<b>'])
    expect(sdMailReferences([], null)).toEqual([])
    expect(
      sdMailReferences(
        Array.from({ length: 30 }, (_, i) => `<${i}>`),
        '<x>',
      ),
    ).toHaveLength(20)
  })
})

describe('sdMailOutboundBody', () => {
  it('adds the separator line and the footer', () => {
    expect(sdMailOutboundBody('  resposta  ', 'Chamado INC-1')).toBe(
      'resposta\n\n-- Responda acima desta linha --\nChamado INC-1',
    )
  })
})
