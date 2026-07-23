import { describe, expect, it } from 'vitest'
import { classifyAttachment } from '../crm-ai-attachment'

describe('classifyAttachment()', () => {
  it('should classify images as IMAGE', () => {
    const result = classifyAttachment('image/png', 1024)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.kind).toBe('IMAGE')
      expect(result.value.ext).toBe('png')
    }
  })

  it('should classify pdf as DOCUMENT', () => {
    const result = classifyAttachment('application/pdf', 1024)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.kind).toBe('DOCUMENT')
  })

  it('should reject an unsupported content type', () => {
    expect(classifyAttachment('video/mp4', 1024).ok).toBe(false)
  })

  it('should reject files over 10MB', () => {
    expect(classifyAttachment('image/png', 11 * 1024 * 1024).ok).toBe(false)
  })
})
