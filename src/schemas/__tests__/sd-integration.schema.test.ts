import { describe, expect, it } from 'vitest'
import {
  CreateSdGithubIssueSchema,
  LinkSdGithubItemSchema,
  ListSdIntegrationLinksSchema,
  SdIntegrationKindEnum,
  SdIntegrationLinkKindEnum,
  SdRepoProviderEnum,
  SdSlackChannelsSchema,
  UpdateSdRepoConfigSchema,
  UpdateSdSlackConfigSchema,
} from '../sd-integration.schema'

describe('enums', () => {
  it('cover the connection, provider and link kinds', () => {
    expect(SdIntegrationKindEnum.options).toEqual(['SLACK', 'GITHUB', 'GITLAB'])
    expect(SdRepoProviderEnum.options).toEqual(['GITHUB', 'GITLAB'])
    expect(SdIntegrationLinkKindEnum.options).toEqual([
      'SLACK_THREAD',
      'GITHUB_ISSUE',
      'GITHUB_PULL_REQUEST',
      'GITLAB_ISSUE',
      'GITLAB_MERGE_REQUEST',
    ])
  })
})

describe('SdSlackChannelsSchema', () => {
  it('accepts one channel per team', () => {
    const parsed = SdSlackChannelsSchema.parse([
      { departmentId: 'dep-1', channelId: 'C1', channelName: 'suporte' },
      { departmentId: 'dep-2', channelId: 'C2' },
    ])
    expect(parsed[1]).toEqual({
      departmentId: 'dep-2',
      channelId: 'C2',
      channelName: null,
    })
  })

  it('refuses two channels for the same team', () => {
    const result = SdSlackChannelsSchema.safeParse([
      { departmentId: 'dep-1', channelId: 'C1' },
      { departmentId: 'dep-1', channelId: 'C2' },
    ])
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('mesmo time')
  })

  it('refuses the old default channel (no team) — it lives in the workspace rules', () => {
    expect(
      SdSlackChannelsSchema.safeParse([{ departmentId: null, channelId: 'C1' }])
        .success,
    ).toBe(false)
    expect(SdSlackChannelsSchema.safeParse([{ channelId: 'C1' }]).success).toBe(
      false,
    )
  })

  it('refuses an empty channel or odd characters', () => {
    expect(
      SdSlackChannelsSchema.safeParse([{ departmentId: 'd', channelId: '' }])
        .success,
    ).toBe(false)
    expect(
      SdSlackChannelsSchema.safeParse([{ departmentId: 'd', channelId: 'C 1' }])
        .success,
    ).toBe(false)
  })
})

describe('UpdateSdSlackConfigSchema', () => {
  it('accepts a single field', () => {
    expect(
      UpdateSdSlackConfigSchema.parse({ mirrorThreadReplies: false }),
    ).toEqual({ mirrorThreadReplies: false })
    expect(UpdateSdSlackConfigSchema.parse({ departmentId: null })).toEqual({
      departmentId: null,
    })
  })

  it('refuses an empty body and an unknown ticket type', () => {
    expect(UpdateSdSlackConfigSchema.safeParse({}).success).toBe(false)
    expect(
      UpdateSdSlackConfigSchema.safeParse({ ticketType: 'ALGO' }).success,
    ).toBe(false)
  })

  it('drops the event list (it moved to the workspace rules)', () => {
    expect(
      UpdateSdSlackConfigSchema.safeParse({ events: ['sla.breached'] }).success,
    ).toBe(false)
  })
})

describe('UpdateSdRepoConfigSchema', () => {
  it('accepts one switch at a time and refuses an empty body', () => {
    expect(
      UpdateSdRepoConfigSchema.parse({ suggestPhaseOnClose: false }),
    ).toEqual({ suggestPhaseOnClose: false })
    expect(
      UpdateSdRepoConfigSchema.parse({ allowIssueFromTicket: true }),
    ).toEqual({ allowIssueFromTicket: true })
    expect(UpdateSdRepoConfigSchema.safeParse({}).success).toBe(false)
  })
})

describe('links', () => {
  it('needs the ticket in the listing and the reference in the link', () => {
    expect(ListSdIntegrationLinksSchema.parse({ ticketId: 't1' })).toEqual({
      ticketId: 't1',
    })
    expect(ListSdIntegrationLinksSchema.safeParse({}).success).toBe(false)
    expect(
      LinkSdGithubItemSchema.parse({ ticketId: 't1', ref: ' #42 ' }),
    ).toEqual({ ticketId: 't1', ref: '#42' })
    expect(
      LinkSdGithubItemSchema.parse({
        ticketId: 't1',
        ref: '!7',
        provider: 'GITLAB',
      }).provider,
    ).toBe('GITLAB')
    expect(
      LinkSdGithubItemSchema.safeParse({ ticketId: 't1', ref: '  ' }).success,
    ).toBe(false)
    expect(
      LinkSdGithubItemSchema.safeParse({
        ticketId: 't1',
        ref: '#1',
        provider: 'BITBUCKET',
      }).success,
    ).toBe(false)
  })

  it('accepts the issue from the ticket with an optional title', () => {
    expect(CreateSdGithubIssueSchema.parse({ ticketId: 't1' })).toEqual({
      ticketId: 't1',
    })
    expect(
      CreateSdGithubIssueSchema.parse({ ticketId: 't1', title: 'Outro' }).title,
    ).toBe('Outro')
    expect(
      CreateSdGithubIssueSchema.safeParse({ ticketId: 't1', title: '' })
        .success,
    ).toBe(false)
  })
})
