import { describe, expect, it } from 'vitest'
import { createFakeCrmHookVaultItem } from '@/src/__tests__/factories/crm-hook-vault.factory'
import { toCrmHookVaultItemDTO } from '../crm-hook-vault.mapper'

describe('toCrmHookVaultItemDTO()', () => {
  it('should map all fields correctly', () => {
    const item = createFakeCrmHookVaultItem({
      id: 'h1',
      text: 'Hook de teste',
      platform: 'TIKTOK',
    })
    const dto = toCrmHookVaultItemDTO(item)
    expect(dto.id).toBe('h1')
    expect(dto.text).toBe('Hook de teste')
    expect(dto.platform).toBe('TIKTOK')
  })

  it('should serialize dates as ISO strings', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    const item = createFakeCrmHookVaultItem({ createdAt })
    expect(toCrmHookVaultItemDTO(item).createdAt).toBe(createdAt.toISOString())
  })
})
