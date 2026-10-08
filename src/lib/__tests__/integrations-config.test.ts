import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WAITING_MINUTES,
  INTEGRATION_NOTIFICATION_EVENTS,
  integrationNotificationEvent,
  isRepoIntegrationKind,
  SD_URGENT_TICKET_EVENT,
  sdSlackEventKey,
} from '../integrations/catalog'
import {
  isLegacyRepoConfig,
  isLegacySlackConfig,
  MAX_SLACK_ROUTES,
  mapLegacySlackConfig,
  parseSlackRoutes,
  parseWorkspaceRepoConfig,
  parseWorkspaceSlackConfig,
  slackChannelsFor,
} from '../integrations/config'

describe('integration catalog', () => {
  it('covers every module the product owner asked for', () => {
    const keys = INTEGRATION_NOTIFICATION_EVENTS.map((event) => event.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        SD_URGENT_TICKET_EVENT,
        'servicedesk.ticket.created_in_department',
        'servicedesk.sla.breached',
        'crm.deal.won',
        'crm.deal.lost',
        'crm.lead.created',
        'communication.conversation.waiting',
        'agents.approval.pending',
      ]),
    )
    expect(new Set(keys).size).toBe(keys.length)
    // Digests are not offered to Slack.
    expect(keys).not.toContain('servicedesk.digest.daily')
  })

  it('finds an event by key and flags the team channel only for ServiceDesk', () => {
    expect(integrationNotificationEvent('crm.deal.won')).toMatchObject({
      module: 'CRM',
      label: 'Negócio ganho',
      allowsTeamChannel: false,
    })
    expect(
      integrationNotificationEvent(sdSlackEventKey('sla.breached'))
        ?.allowsTeamChannel,
    ).toBe(true)
    expect(integrationNotificationEvent('nope')).toBeNull()
  })

  it('tells repository kinds apart', () => {
    expect(isRepoIntegrationKind('GITHUB')).toBe(true)
    expect(isRepoIntegrationKind('GITLAB')).toBe(true)
    expect(isRepoIntegrationKind('SLACK')).toBe(false)
  })
})

describe('legacy config detection', () => {
  it('detects the old ServiceDesk Slack shape', () => {
    expect(isLegacySlackConfig({ events: [] })).toBe(true)
    expect(isLegacySlackConfig({ channels: [] })).toBe(true)
    expect(isLegacySlackConfig({ routes: [], events: [] })).toBe(false)
    expect(isLegacySlackConfig({ servicedesk: {}, channels: [] })).toBe(false)
    expect(isLegacySlackConfig({})).toBe(false)
    expect(isLegacySlackConfig(null)).toBe(false)
    expect(isLegacySlackConfig([1])).toBe(false)
  })

  it('detects the old GitHub shape', () => {
    expect(isLegacyRepoConfig({ suggestPhaseOnClose: false })).toBe(true)
    expect(isLegacyRepoConfig({ allowIssueFromTicket: true })).toBe(true)
    expect(
      isLegacyRepoConfig({ servicedesk: {}, suggestPhaseOnClose: true }),
    ).toBe(false)
    expect(isLegacyRepoConfig({})).toBe(false)
  })
})

describe('mapLegacySlackConfig (migration mapping)', () => {
  it('turns the default channel + events into rules and keeps team channels', () => {
    const mapped = mapLegacySlackConfig({
      channels: [
        { departmentId: null, channelId: 'C0', channelName: 'geral' },
        { departmentId: 'dep-1', channelId: 'C1', channelName: 'n1' },
      ],
      events: ['sla.breached', 'ticket.escalated'],
      allowTicketFromMessage: false,
      mirrorThreadReplies: true,
      ticketType: 'PROBLEM',
      departmentId: 'dep-1',
    })
    expect(mapped).toEqual({
      routes: [
        {
          event: 'servicedesk.sla.breached',
          channelId: 'C0',
          channelName: 'geral',
        },
        {
          event: 'servicedesk.ticket.escalated',
          channelId: 'C0',
          channelName: 'geral',
        },
      ],
      waitingMinutes: DEFAULT_WAITING_MINUTES,
      servicedesk: {
        channels: [
          { departmentId: 'dep-1', channelId: 'C1', channelName: 'n1' },
        ],
        allowTicketFromMessage: false,
        mirrorThreadReplies: true,
        ticketType: 'PROBLEM',
        departmentId: 'dep-1',
      },
    })
  })

  it('without a default channel the rules target the team channel only', () => {
    const mapped = mapLegacySlackConfig({
      channels: [{ departmentId: 'dep-1', channelId: 'C1' }],
    })
    // Missing events = the old defaults.
    expect(mapped.routes.map((route) => route.event)).toEqual([
      'servicedesk.ticket.created_in_department',
      'servicedesk.sla.breached',
      'servicedesk.ticket.escalated',
    ])
    expect(mapped.routes.every((route) => route.channelId === null)).toBe(true)
  })

  it('is what parseWorkspaceSlackConfig returns for a legacy row', () => {
    const legacy = { events: ['sla.breached'], channels: [] }
    expect(parseWorkspaceSlackConfig(legacy)).toEqual(
      mapLegacySlackConfig(legacy),
    )
  })
})

describe('parseWorkspaceSlackConfig', () => {
  it('reads the new shape, clamping the waiting minutes', () => {
    const config = parseWorkspaceSlackConfig({
      routes: [
        { event: 'crm.deal.won', channelId: 'C9', channelName: 'vendas' },
      ],
      waitingMinutes: 2,
      servicedesk: {
        channels: [
          { departmentId: null, channelId: 'C0' },
          { departmentId: 'dep-1', channelId: 'C1' },
        ],
        mirrorThreadReplies: false,
      },
    })
    expect(config.routes).toHaveLength(1)
    expect(config.waitingMinutes).toBe(5)
    expect(config.servicedesk.channels).toEqual([
      { departmentId: 'dep-1', channelId: 'C1', channelName: null },
    ])
    expect(config.servicedesk.mirrorThreadReplies).toBe(false)
    expect(
      parseWorkspaceSlackConfig({ waitingMinutes: 99999 }).waitingMinutes,
    ).toBe(1440)
    expect(
      parseWorkspaceSlackConfig({ waitingMinutes: 30.4 }).waitingMinutes,
    ).toBe(30)
  })

  it('falls back to defaults for an empty or broken config', () => {
    for (const value of [{}, null, 'texto', { waitingMinutes: 'x' }]) {
      const config = parseWorkspaceSlackConfig(value)
      expect(config.routes).toEqual([])
      expect(config.waitingMinutes).toBe(DEFAULT_WAITING_MINUTES)
      expect(config.servicedesk.channels).toEqual([])
      expect(config.servicedesk.ticketType).toBe('INCIDENT')
    }
  })
})

describe('parseSlackRoutes', () => {
  it('drops unknown events, channel-less rules outside the ServiceDesk and duplicates', () => {
    expect(
      parseSlackRoutes([
        { event: 'crm.deal.won', channelId: 'C1' },
        { event: 'crm.deal.won', channelId: 'C1' },
        { event: 'crm.deal.won', channelId: 'C2' },
        { event: 'crm.deal.lost', channelId: null },
        { event: 'servicedesk.sla.breached', channelId: null },
        { event: 'servicedesk.sla.breached' },
        { event: 'desconhecido', channelId: 'C1' },
        { channelId: 'C1' },
        'lixo',
      ]),
    ).toEqual([
      { event: 'crm.deal.won', channelId: 'C1', channelName: null },
      { event: 'crm.deal.won', channelId: 'C2', channelName: null },
      { event: 'servicedesk.sla.breached', channelId: null, channelName: null },
    ])
    expect(parseSlackRoutes('nao-lista')).toEqual([])
  })

  it('caps the number of rules', () => {
    const many = Array.from({ length: MAX_SLACK_ROUTES + 10 }, (_, i) => ({
      event: 'crm.lead.created',
      channelId: `C${i}`,
    }))
    expect(parseSlackRoutes(many)).toHaveLength(MAX_SLACK_ROUTES)
  })
})

describe('parseWorkspaceRepoConfig', () => {
  it('maps the legacy flags and reads the new block', () => {
    expect(
      parseWorkspaceRepoConfig({ suggestPhaseOnClose: false }).servicedesk,
    ).toEqual({ suggestPhaseOnClose: false, allowIssueFromTicket: true })
    expect(
      parseWorkspaceRepoConfig({
        servicedesk: { allowIssueFromTicket: false },
      }).servicedesk,
    ).toEqual({ suggestPhaseOnClose: true, allowIssueFromTicket: false })
    expect(parseWorkspaceRepoConfig(null).servicedesk).toEqual({
      suggestPhaseOnClose: true,
      allowIssueFromTicket: true,
    })
  })
})

describe('slackChannelsFor', () => {
  const config = parseWorkspaceSlackConfig({
    routes: [
      { event: 'servicedesk.sla.breached', channelId: 'C-rule' },
      { event: 'servicedesk.sla.breached', channelId: 'C-rule' },
      { event: 'servicedesk.sla.breached', channelId: 'C-other' },
      { event: 'servicedesk.ticket.escalated', channelId: null },
      { event: 'crm.deal.won', channelId: 'C-sales' },
    ],
    servicedesk: {
      channels: [{ departmentId: 'dep-1', channelId: 'C-team' }],
    },
  })

  it('is null for an event without a rule', () => {
    expect(slackChannelsFor(config, 'crm.deal.lost')).toBeNull()
  })

  it('uses the rule channels (deduplicated) when the team has no channel', () => {
    expect(
      slackChannelsFor(config, 'servicedesk.sla.breached', 'dep-9'),
    ).toEqual(['C-rule', 'C-other'])
    expect(slackChannelsFor(config, 'servicedesk.sla.breached')).toEqual([
      'C-rule',
      'C-other',
    ])
  })

  it("replaces them with the team's channel for ServiceDesk events", () => {
    expect(
      slackChannelsFor(config, 'servicedesk.sla.breached', 'dep-1'),
    ).toEqual(['C-team'])
    expect(
      slackChannelsFor(config, 'servicedesk.ticket.escalated', 'dep-1'),
    ).toEqual(['C-team'])
    // Team-only rule without a team channel: routed, but nowhere to post.
    expect(
      slackChannelsFor(config, 'servicedesk.ticket.escalated', 'dep-9'),
    ).toEqual([])
  })

  it('ignores the department for other modules', () => {
    expect(slackChannelsFor(config, 'crm.deal.won', 'dep-1')).toEqual([
      'C-sales',
    ])
  })
})
