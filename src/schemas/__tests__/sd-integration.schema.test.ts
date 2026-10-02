import { describe, expect, it } from 'vitest'
import {
  ConnectSdGithubSchema,
  CreateSdGithubIssueSchema,
  LinkSdGithubItemSchema,
  ListSdIntegrationLinksSchema,
  SdIntegrationKindEnum,
  SdIntegrationLinkKindEnum,
  SdSlackChannelsSchema,
  UpdateSdGithubConfigSchema,
  UpdateSdSlackConfigSchema,
} from '../sd-integration.schema'

const TOKEN = 'github_pat_11ABCDEFG0123456789'

describe('enums', () => {
  it('cobrem os tipos de integração e de vínculo', () => {
    expect(SdIntegrationKindEnum.options).toEqual(['SLACK', 'GITHUB'])
    expect(SdIntegrationLinkKindEnum.options).toEqual([
      'SLACK_THREAD',
      'GITHUB_ISSUE',
      'GITHUB_PULL_REQUEST',
    ])
  })
})

describe('SdSlackChannelsSchema', () => {
  it('aceita um canal por time e o padrão', () => {
    const parsed = SdSlackChannelsSchema.parse([
      { departmentId: 'dep-1', channelId: 'C1', channelName: 'suporte' },
      { channelId: 'C2' },
    ])
    expect(parsed[1]).toEqual({
      departmentId: null,
      channelId: 'C2',
      channelName: null,
    })
  })

  it('recusa dois canais para o mesmo time', () => {
    const result = SdSlackChannelsSchema.safeParse([
      { departmentId: 'dep-1', channelId: 'C1' },
      { departmentId: 'dep-1', channelId: 'C2' },
    ])
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('mesmo time')
  })

  it('recusa dois canais padrão', () => {
    expect(
      SdSlackChannelsSchema.safeParse([
        { channelId: 'C1' },
        { channelId: 'C2' },
      ]).success,
    ).toBe(false)
  })

  it('recusa canal vazio ou com caractere estranho', () => {
    expect(SdSlackChannelsSchema.safeParse([{ channelId: '' }]).success).toBe(
      false,
    )
    expect(
      SdSlackChannelsSchema.safeParse([{ channelId: 'C 1' }]).success,
    ).toBe(false)
  })
})

describe('UpdateSdSlackConfigSchema', () => {
  it('aceita um campo só', () => {
    expect(
      UpdateSdSlackConfigSchema.parse({ mirrorThreadReplies: false }),
    ).toEqual({ mirrorThreadReplies: false })
    expect(UpdateSdSlackConfigSchema.parse({ departmentId: null })).toEqual({
      departmentId: null,
    })
  })

  it('recusa corpo vazio, tipo inválido e evento sem nome', () => {
    expect(UpdateSdSlackConfigSchema.safeParse({}).success).toBe(false)
    expect(
      UpdateSdSlackConfigSchema.safeParse({ ticketType: 'ALGO' }).success,
    ).toBe(false)
    expect(UpdateSdSlackConfigSchema.safeParse({ events: [''] }).success).toBe(
      false,
    )
  })

  it('limita a quantidade de eventos', () => {
    const many = Array.from({ length: 41 }, (_, i) => `evento.${i}`)
    expect(UpdateSdSlackConfigSchema.safeParse({ events: many }).success).toBe(
      false,
    )
  })
})

describe('ConnectSdGithubSchema', () => {
  it('liga a sugestão de fase e a issue a partir do chamado por padrão', () => {
    const parsed = ConnectSdGithubSchema.parse({
      repo: 'stratus-so2/steel',
      token: TOKEN,
    })
    expect(parsed).toEqual({
      repo: 'stratus-so2/steel',
      token: TOKEN,
      suggestPhaseOnClose: true,
      allowIssueFromTicket: true,
    })
  })

  it('aceita segredo de webhook e `null` para removê-lo', () => {
    expect(
      ConnectSdGithubSchema.parse({
        repo: 'owner/repo',
        token: TOKEN,
        webhookSecret: 'segredo-de-teste',
      }).webhookSecret,
    ).toBe('segredo-de-teste')
    expect(
      ConnectSdGithubSchema.parse({
        repo: 'owner/repo',
        token: TOKEN,
        webhookSecret: null,
      }).webhookSecret,
    ).toBeNull()
  })

  it('recusa repositório curto, token curto e segredo curto', () => {
    expect(
      ConnectSdGithubSchema.safeParse({ repo: 'ab', token: TOKEN }).success,
    ).toBe(false)
    expect(
      ConnectSdGithubSchema.safeParse({ repo: 'owner/repo', token: 'curto' })
        .success,
    ).toBe(false)
    expect(
      ConnectSdGithubSchema.safeParse({
        repo: 'owner/repo',
        token: TOKEN,
        webhookSecret: 'curto',
      }).success,
    ).toBe(false)
  })
})

describe('UpdateSdGithubConfigSchema', () => {
  it('aceita trocar só o token ou só um interruptor', () => {
    expect(UpdateSdGithubConfigSchema.parse({ token: TOKEN }).token).toBe(TOKEN)
    expect(
      UpdateSdGithubConfigSchema.parse({ suggestPhaseOnClose: false }),
    ).toEqual({ suggestPhaseOnClose: false })
  })

  it('recusa corpo vazio', () => {
    expect(UpdateSdGithubConfigSchema.safeParse({}).success).toBe(false)
  })
})

describe('vínculos', () => {
  it('exige o chamado na listagem e a referência no vínculo', () => {
    expect(ListSdIntegrationLinksSchema.parse({ ticketId: 't1' })).toEqual({
      ticketId: 't1',
    })
    expect(ListSdIntegrationLinksSchema.safeParse({}).success).toBe(false)
    expect(
      LinkSdGithubItemSchema.parse({ ticketId: 't1', ref: ' #42 ' }),
    ).toEqual({ ticketId: 't1', ref: '#42' })
    expect(
      LinkSdGithubItemSchema.safeParse({ ticketId: 't1', ref: '  ' }).success,
    ).toBe(false)
  })

  it('aceita a issue a partir do chamado com título opcional', () => {
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
