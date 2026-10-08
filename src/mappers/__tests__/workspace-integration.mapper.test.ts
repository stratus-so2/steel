import { describe, expect, it } from 'vitest'
import {
  createFakeGitlabIntegration,
  createFakeSdIntegration,
} from '@/src/__tests__/factories/sd-integration.factory'
import { toWorkspaceIntegrationDTO } from '../workspace-integration.mapper'

describe('toWorkspaceIntegrationDTO', () => {
  it('never exposes the token or the secret', () => {
    const dto = toWorkspaceIntegrationDTO(
      createFakeGitlabIntegration({
        encryptedToken: 'enc:super-secreto',
        encryptedSigningSecret: 'enc:hook',
      }),
    )
    expect(dto.hasWebhookSecret).toBe(true)
    expect(JSON.stringify(dto)).not.toContain('super-secreto')
    expect(JSON.stringify(dto)).not.toContain('enc:hook')
    expect(dto).not.toHaveProperty('encryptedToken')
    expect(dto.baseUrl).toBe('https://gitlab.com')
    expect(dto.slack).toBeNull()
  })

  it('maps the Slack rules (legacy rows included) and the activity dates', () => {
    const dto = toWorkspaceIntegrationDTO(
      createFakeSdIntegration({
        config: {
          events: ['sla.breached'],
          channels: [{ departmentId: null, channelId: 'C0' }],
        },
        lastEventAt: new Date('2026-10-08T10:00:00.000Z'),
        lastEventType: 'slack:servicedesk.sla.breached',
        lastCheckedAt: new Date('2026-10-08T11:00:00.000Z'),
      }),
    )
    expect(dto.slack).toEqual({
      routes: [
        {
          event: 'servicedesk.sla.breached',
          channelId: 'C0',
          channelName: null,
        },
      ],
      waitingMinutes: 15,
    })
    expect(dto.lastEventAt).toBe('2026-10-08T10:00:00.000Z')
    expect(dto.lastEventType).toBe('slack:servicedesk.sla.breached')
    expect(dto.lastCheckedAt).toBe('2026-10-08T11:00:00.000Z')
    expect(dto.hasWebhookSecret).toBe(false)
    expect(dto.createdAt).toBe('2026-10-02T12:00:00.000Z')
  })

  it('keeps empty activity as null', () => {
    const dto = toWorkspaceIntegrationDTO(createFakeSdIntegration())
    expect(dto.lastEventAt).toBeNull()
    expect(dto.lastCheckedAt).toBeNull()
  })
})
