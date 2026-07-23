import { describe, expect, it } from 'vitest'
import { createFakeCrmNote } from '@/src/__tests__/factories/crm-note.factory'
import { toCrmNoteDTO } from '../crm-note.mapper'

describe('toCrmNoteDTO()', () => {
  it('should map all fields correctly', () => {
    const note = createFakeCrmNote({ id: 'n-1', body: 'Notas' })
    const dto = toCrmNoteDTO(note)
    expect(dto.id).toBe('n-1')
    expect(dto.body).toBe('Notas')
  })
})
