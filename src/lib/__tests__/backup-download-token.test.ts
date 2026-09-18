import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env/server', () => ({
  BETTER_AUTH_SECRET: 'ba_test-secret-with-enough-length',
}))

import {
  BACKUP_DOWNLOAD_TTL_SECONDS,
  createBackupDownloadToken,
  verifyBackupDownloadToken,
} from '@/src/lib/backup-download-token'

const NOW = Date.UTC(2026, 8, 18, 12)

describe('backup download token', () => {
  it('verifies a fresh token for the same backup and admin', () => {
    const { exp, sig } = createBackupDownloadToken('b1', 'admin1', NOW)
    expect(exp).toBe(NOW / 1000 + BACKUP_DOWNLOAD_TTL_SECONDS)
    expect(
      verifyBackupDownloadToken(
        { backupId: 'b1', actorId: 'admin1', exp, sig },
        NOW,
      ),
    ).toBe(true)
  })

  it('rejects another backup, another admin or a tampered expiry', () => {
    const { exp, sig } = createBackupDownloadToken('b1', 'admin1', NOW)
    const check = (backupId: string, actorId: string, e: number) =>
      verifyBackupDownloadToken({ backupId, actorId, exp: e, sig }, NOW)
    expect(check('b2', 'admin1', exp)).toBe(false)
    expect(check('b1', 'admin2', exp)).toBe(false)
    expect(check('b1', 'admin1', exp + 3600)).toBe(false)
  })

  it('rejects an expired token', () => {
    const { exp, sig } = createBackupDownloadToken('b1', 'admin1', NOW)
    const later = NOW + (BACKUP_DOWNLOAD_TTL_SECONDS + 1) * 1000
    expect(
      verifyBackupDownloadToken(
        { backupId: 'b1', actorId: 'admin1', exp, sig },
        later,
      ),
    ).toBe(false)
  })

  it('rejects a malformed signature without throwing', () => {
    expect(
      verifyBackupDownloadToken(
        { backupId: 'b1', actorId: 'admin1', exp: NOW / 1000 + 60, sig: 'zz' },
        NOW,
      ),
    ).toBe(false)
  })
})
