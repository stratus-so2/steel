import { describe, expect, it } from 'vitest'
import {
  BackupDownloadQuerySchema,
  ConfirmedWorkspaceActionSchema,
  ListBackupsQuerySchema,
  SetWorkspaceStatusSchema,
  TriggerBackupSchema,
} from '../admin.schema'

describe('admin schemas', () => {
  it('requires a meaningful reason to suspend', () => {
    expect(
      SetWorkspaceStatusSchema.safeParse({ action: 'suspend', reason: 'x' })
        .success,
    ).toBe(false)
    const parsed = SetWorkspaceStatusSchema.parse({
      action: 'suspend',
      reason: '  inadimplência  ',
    })
    expect(parsed.reason).toBe('inadimplência')
  })

  it('requires the typed slug and a reason for destructive actions', () => {
    expect(
      ConfirmedWorkspaceActionSchema.safeParse({
        confirmSlug: '',
        reason: 'encerramento',
      }).success,
    ).toBe(false)
    expect(
      ConfirmedWorkspaceActionSchema.safeParse({
        confirmSlug: 'acme',
        reason: 'encerramento do contrato',
      }).success,
    ).toBe(true)
  })

  it('requires a workspaceId only for WORKSPACE backups', () => {
    expect(TriggerBackupSchema.safeParse({ scope: 'FULL' }).success).toBe(true)
    expect(TriggerBackupSchema.safeParse({ scope: 'WORKSPACE' }).success).toBe(
      false,
    )
    expect(
      TriggerBackupSchema.safeParse({ scope: 'WORKSPACE', workspaceId: 'ws1' })
        .success,
    ).toBe(true)
  })

  it('coerces and bounds the backup list query', () => {
    expect(ListBackupsQuerySchema.parse({}).limit).toBe(50)
    expect(ListBackupsQuerySchema.parse({ limit: '10' }).limit).toBe(10)
    expect(ListBackupsQuerySchema.safeParse({ limit: '1000' }).success).toBe(
      false,
    )
  })

  it('only accepts a hex SHA-256 signature for downloads', () => {
    expect(
      BackupDownloadQuerySchema.safeParse({ exp: '1', sig: 'abc' }).success,
    ).toBe(false)
    expect(
      BackupDownloadQuerySchema.safeParse({ exp: '1', sig: 'a'.repeat(64) })
        .success,
    ).toBe(true)
  })
})
