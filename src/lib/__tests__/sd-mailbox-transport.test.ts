import { simpleParser } from 'mailparser'
import { describe, expect, it } from 'vitest'
import { toSdFetchedMail } from '../mail/sd-mailbox-transport'

/**
 * `toSdFetchedMail` é a parte pura do transporte: recebe o MIME já parseado
 * e devolve o que a recepção precisa. O parser roda de verdade (é local,
 * sem rede); o IMAP e o SMTP em si são sempre mockados nos services.
 */

const MAX = 25 * 1024 * 1024

function raw(lines: string[]): string {
  return lines.join('\r\n')
}

async function parse(source: string) {
  return simpleParser(Buffer.from(source, 'utf8'))
}

describe('toSdFetchedMail', () => {
  it('maps a plain-text reply with threading headers and recipients', async () => {
    const parsed = await parse(
      raw([
        'Message-ID: <nova@cliente.com>',
        'In-Reply-To: <anterior@empresa.com.br>',
        'References: <raiz@empresa.com.br> <anterior@empresa.com.br>',
        'From: Cliente Silva <Cliente@Cliente.com>',
        'To: Suporte <Suporte@Empresa.com.BR>, outro@empresa.com.br',
        'Cc: Chefe <chefe@cliente.com>',
        'Subject: Re: [INC-000007] Impressora parada',
        'Date: Thu, 01 Oct 2026 10:00:00 +0000',
        'Auto-Submitted: no',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'A impressora voltou a falhar.',
        '',
      ]),
    )

    expect(toSdFetchedMail(42, parsed, MAX)).toMatchObject({
      uid: 42,
      messageId: '<nova@cliente.com>',
      inReplyTo: '<anterior@empresa.com.br>',
      references: ['<raiz@empresa.com.br>', '<anterior@empresa.com.br>'],
      fromAddress: 'cliente@cliente.com',
      fromName: 'Cliente Silva',
      toAddresses: ['suporte@empresa.com.br', 'outro@empresa.com.br'],
      ccAddresses: ['chefe@cliente.com'],
      subject: 'Re: [INC-000007] Impressora parada',
      html: null,
      attachments: [],
    })
    const mail = toSdFetchedMail(42, parsed, MAX)
    expect(mail?.text.trim()).toBe('A impressora voltou a falhar.')
    expect(mail?.headers['auto-submitted']).toBe('no')
    expect(mail?.date.toISOString()).toBe('2026-10-01T10:00:00.000Z')
  })

  it('keeps the HTML part and reads the array headers', async () => {
    const parsed = await parse(
      raw([
        'Message-ID: <html@cliente.com>',
        'From: a@cliente.com',
        'Received: from um',
        'Received: from dois',
        'Subject: ',
        'Content-Type: text/html; charset=utf-8',
        '',
        '<p>Olá</p>',
        '',
      ]),
    )
    const mail = toSdFetchedMail(1, parsed, MAX)

    expect(mail?.html).toBe('<p>Olá</p>')
    expect(mail?.subject).toBeNull()
    expect(mail?.fromName).toBeNull()
    expect(mail?.toAddresses).toEqual([])
    expect(mail?.headers.received).toEqual(['from um', 'from dois'])
  })

  it('reads a single References header and a date-less message', async () => {
    const parsed = await parse(
      raw([
        'Message-ID: <uma@cliente.com>',
        'References: <so-uma@empresa.com.br>',
        'From: a@cliente.com',
        '',
        'texto',
        '',
      ]),
    )
    const mail = toSdFetchedMail(1, parsed, MAX)
    expect(mail?.references).toEqual(['<so-uma@empresa.com.br>'])
    expect(mail?.date).toBeInstanceOf(Date)
  })

  it('keeps the attachments inside the size limit and names the nameless one', async () => {
    const parsed = await parse(
      raw([
        'Message-ID: <anexo@cliente.com>',
        'From: a@cliente.com',
        'Subject: com anexo',
        'Content-Type: multipart/mixed; boundary="sep"',
        '',
        '--sep',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'veja o anexo',
        '--sep',
        'Content-Type: application/pdf; name="nota.pdf"',
        'Content-Disposition: attachment; filename="nota.pdf"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from('conteudo-pdf').toString('base64'),
        '--sep',
        'Content-Type: image/png',
        'Content-Disposition: attachment',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from('png').toString('base64'),
        '--sep--',
        '',
      ]),
    )

    const mail = toSdFetchedMail(7, parsed, MAX)
    expect(mail?.attachments).toEqual([
      {
        fileName: 'nota.pdf',
        mimeType: 'application/pdf',
        content: Buffer.from('conteudo-pdf'),
      },
      {
        fileName: 'anexo',
        mimeType: 'image/png',
        content: Buffer.from('png'),
      },
    ])

    // Com o teto abaixo do tamanho, nenhum anexo passa.
    expect(toSdFetchedMail(7, parsed, 2)?.attachments).toEqual([])
  })

  it('refuses a message with no Message-ID or no sender', async () => {
    const noId = await parse(
      raw(['From: a@cliente.com', 'Subject: sem id', '', 'texto', '']),
    )
    expect(toSdFetchedMail(1, { ...noId, messageId: undefined }, MAX)).toBeNull()

    const noFrom = await parse(
      raw(['Message-ID: <x@cliente.com>', 'Subject: sem from', '', 'oi', '']),
    )
    expect(toSdFetchedMail(1, noFrom, MAX)).toBeNull()
  })
})
