import { describe, expect, it } from 'vitest'
import {
  SD_ATTACHMENT_MAX_BYTES,
  SD_TICKET_BUCKET,
  sdAttachmentKey,
  sdAttachmentKind,
  sdBaseMime,
  sdSafeFileName,
  sdSignatureKey,
  sdTicketFilePrefix,
} from '../servicedesk/ticket-files'

describe('servicedesk ticket files', () => {
  it('exposes the bucket and the 25 MB limit', () => {
    expect(SD_TICKET_BUCKET).toBe('servicedesk')
    expect(SD_ATTACHMENT_MAX_BYTES).toBe(25 * 1024 * 1024)
  })

  it('normalizes MIME types and maps kinds', () => {
    expect(sdBaseMime(' Text/Plain; charset=utf-8')).toBe('text/plain')
    expect(sdAttachmentKind('image/PNG')).toBe('IMAGE')
    expect(sdAttachmentKind('video/mp4')).toBe('VIDEO')
    expect(sdAttachmentKind('audio/ogg; codecs=opus')).toBe('AUDIO')
    expect(sdAttachmentKind('application/pdf')).toBe('DOCUMENT')
    expect(sdAttachmentKind('application/zip')).toBe('OTHER')
    expect(sdAttachmentKind('text/html')).toBeNull()
    expect(sdAttachmentKind('')).toBeNull()
  })

  it('builds safe file names', () => {
    expect(sdSafeFileName('C:\\temp\\Relatório Final (v2).pdf')).toBe(
      'Relatorio-Final-v2-.pdf',
    )
    expect(sdSafeFileName('../../etc/passwd')).toBe('passwd')
    expect(sdSafeFileName('.hidden')).toBe('hidden')
    expect(sdSafeFileName('///')).toBe('arquivo')
    expect(sdSafeFileName('ção')).toBe('cao')
    expect(sdSafeFileName(`${'a'.repeat(150)}.txt`)).toHaveLength(100)
  })

  it('builds workspace-prefixed keys', () => {
    expect(sdTicketFilePrefix('ws', 't')).toBe('ws/tickets/t/')
    expect(sdAttachmentKey('ws', 't', 'id', 'a b.png')).toBe(
      'ws/tickets/t/id-a-b.png',
    )
    expect(sdSignatureKey('ws', 't', 'sig')).toBe(
      'ws/tickets/t/signatures/sig.png',
    )
  })
})
