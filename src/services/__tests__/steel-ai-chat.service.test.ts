import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeAiConversation,
  createFakeAiMessage,
  createFakeAiPendingAction,
} from '@/src/__tests__/factories/steel-ai.factory'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeUserPreference } from '@/src/__tests__/factories/user-preference.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  aiQuotaExceeded,
  databaseError,
  forbidden,
  notFound,
} from '@/src/errors'
import { aiConversationNotFound, validationError } from '@/src/errors/app-error'
import type { AnySteelAiTool } from '@/src/lib/ai/tools/types'
import type {
  AiChatRequest,
  AiChatResponse,
  AiProvider,
  AiStreamChunk,
  AiToolCall,
} from '@/src/lib/ai/types'
import { err, ok } from '@/src/lib/result'
import type { SteelAiStreamEvent } from '@/types/steel-ai'

const tools = vi.hoisted(() => ({ list: [] as unknown[] }))

vi.mock('@/src/lib/ai/tools/registry', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/src/lib/ai/tools/registry')>()
  type Tools = Parameters<typeof actual.availableTools>[2]
  return {
    ...actual,
    resolveToolAccess: vi.fn(),
    availableTools: vi.fn(
      (
        access: Parameters<typeof actual.availableTools>[0],
        mode: 'EXPLORE' | 'AGENT',
      ) => actual.availableTools(access, mode, tools.list as Tools),
    ),
    toolMeta: vi.fn((name: string) =>
      actual.toolMeta(name, tools.list as Tools),
    ),
  }
})
vi.mock('@/src/repositories/ai-conversation.repository')
vi.mock('@/src/repositories/ai-pending-action.repository')
vi.mock('@/src/repositories/ai-settings.repository')
vi.mock('@/src/repositories/user.repository')
vi.mock('@/src/repositories/user-preference.repository')
vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/services/ai-usage.service')
vi.mock('@/src/services/platform-ai-settings.service', () => ({
  PlatformAiSettingsService: { getCostMargin: vi.fn(async () => 2) },
}))
vi.mock('@/src/services/ai-settings.service', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/src/services/ai-settings.service')
  >()),
  // Provider keys are not set in unit tests: usable = enabled.
  isModelUsable: vi.fn((settings: { enabledModels: string[] }, key: string) =>
    settings.enabledModels.includes(key),
  ),
}))

import { resolveToolAccess } from '@/src/lib/ai/tools/registry'
import {
  AiConversationRepository,
  AiMessageRepository,
} from '@/src/repositories/ai-conversation.repository'
import { AiPendingActionRepository } from '@/src/repositories/ai-pending-action.repository'
import { AiUsageRepository } from '@/src/repositories/ai-settings.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { UserPreferenceRepository } from '@/src/repositories/user-preference.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import {
  AiUsageService,
  type PreparedAiCall,
} from '@/src/services/ai-usage.service'
import {
  STEEL_AI_MAX_TOOL_ROUNDS,
  SteelAiChatService,
} from '../steel-ai-chat.service'

const mockedAccess = vi.mocked(resolveToolAccess)
const conversations = vi.mocked(AiConversationRepository)
const messages = vi.mocked(AiMessageRepository)
const pendingRepo = vi.mocked(AiPendingActionRepository)
const usageRepo = vi.mocked(AiUsageRepository)
const users = vi.mocked(UserRepository)
const preferences = vi.mocked(UserPreferenceRepository)
const workspaces = vi.mocked(WorkspaceRepository)
const aiUsage = vi.mocked(AiUsageService)

const ACCESS = {
  modules: ['SERVICE_DESK' as const],
  isPrivileged: true,
  permissions: null,
  agentModeEnabled: true,
  aiEnabled: true,
  agentsEnabled: true,
  autopilotEnabled: false,
}

const readExecute = vi.fn()
const writePreview = vi.fn()

const readTool: AnySteelAiTool = {
  name: 'sd_list_tickets',
  label: 'Consultando chamados',
  module: 'SERVICE_DESK',
  kind: 'READ',
  description: 'Lista chamados',
  parameters: { type: 'object', properties: {} },
  parse: (args) =>
    args.bad ? err(validationError('Argumentos inválidos')) : ok(args),
  execute: readExecute,
}

const writeTool: AnySteelAiTool = {
  name: 'sd_create_ticket',
  label: 'Criando chamado',
  module: 'SERVICE_DESK',
  kind: 'CREATE',
  description: 'Cria chamado',
  parameters: { type: 'object', properties: {} },
  parse: (args) => ok(args),
  preview: writePreview,
  execute: vi.fn(),
}

interface Round {
  deltas?: string[]
  response?: Partial<AiChatResponse>
  throws?: Error
}

function response(overrides: Partial<AiChatResponse> = {}): AiChatResponse {
  const toolCalls = overrides.toolCalls ?? []
  const text = overrides.text ?? ''
  return {
    text,
    toolCalls,
    message: {
      role: 'assistant',
      content: text,
      ...(toolCalls.length > 0 && { toolCalls }),
      raw: { provider: 'openai', content: [] },
    },
    usage: { inputTokens: 10, outputTokens: 5 },
    stopReason: toolCalls.length > 0 ? 'tool_use' : 'end',
    ...overrides,
  }
}

function fakeProvider(rounds: Round[], title: Partial<AiChatResponse> = {}) {
  const requests: AiChatRequest[] = []
  const chatStream = vi.fn((request: AiChatRequest) => {
    requests.push(structuredClone(request))
    const round = rounds.shift() ?? { response: { text: 'fim' } }
    return (async function* (): AsyncGenerator<AiStreamChunk> {
      if (round.throws) throw round.throws
      for (const delta of round.deltas ?? []) yield { type: 'text', delta }
      if (round.response) {
        yield { type: 'done', response: response(round.response) }
      }
    })()
  })
  const chat = vi.fn(async () => response({ text: 'Título', ...title }))
  const provider = { id: 'openai', chat, chatStream } as unknown as AiProvider
  return { provider, chatStream, chat, requests }
}

function prepared(provider: AiProvider): PreparedAiCall {
  return {
    feature: 'STEEL_ASSISTANT',
    provider,
    model: {
      key: 'openai:gpt-4o-mini',
      provider: 'openai',
      model: 'gpt-4o-mini',
      label: 'GPT-4o mini',
    },
    usdPer1kTokens: 4,
  }
}

const conversation = createFakeAiConversation({
  id: 'conv1',
  workspaceId: 'ws1',
  userId: 'u1',
  title: null,
})

function setup(
  options: {
    rounds?: Round[]
    title?: Partial<AiChatResponse>
    history?: ReturnType<typeof createFakeAiMessage>[]
    conversationOverrides?: Partial<typeof conversation>
  } = {},
) {
  const fake = fakeProvider(options.rounds ?? [], options.title)
  mockedAccess.mockResolvedValue(ok(ACCESS))
  conversations.findById.mockResolvedValue(
    ok({ ...conversation, ...options.conversationOverrides }),
  )
  conversations.update.mockImplementation(async (id, data) =>
    ok({ ...conversation, id, ...data } as typeof conversation),
  )
  conversations.setTitleIfEmpty.mockResolvedValue(ok(true))
  aiUsage.prepare.mockResolvedValue(ok(prepared(fake.provider)))
  aiUsage.record.mockResolvedValue(undefined)
  users.findById.mockResolvedValue(ok(createFakeUser({ name: 'Ana' })))
  workspaces.findById.mockResolvedValue(
    ok(createFakeWorkspace({ name: 'Acme' })),
  )
  preferences.findByUserId.mockResolvedValue(
    ok(createFakeUserPreference({ timezone: 'America/Manaus' })),
  )
  messages.listRecent.mockResolvedValue(ok(options.history ?? []))
  messages.createMany.mockImplementation(async (rows) =>
    ok(rows.map((row) => createFakeAiMessage({ ...(row as object) }) as never)),
  )
  pendingRepo.create.mockImplementation(async (data) =>
    ok(
      createFakeAiPendingAction({
        id: 'act1',
        ...data,
        args: data.args as never,
        preview: data.preview as never,
      }),
    ),
  )
  return fake
}

async function send(input: { content: string; mode?: 'EXPLORE' | 'AGENT' }) {
  const result = await SteelAiChatService.sendMessage(
    'u1',
    'ws1',
    'conv1',
    input,
  )
  const iterable = expectOk(result)
  const events: SteelAiStreamEvent[] = []
  for await (const event of iterable) events.push(event)
  return events
}

const types = (events: SteelAiStreamEvent[]) => events.map((e) => e.type)
const textOf = (events: SteelAiStreamEvent[]) =>
  events
    .filter((e) => e.type === 'text.delta')
    .map((e) => (e as { delta: string }).delta)
    .join('')
const endOf = (events: SteelAiStreamEvent[]) => {
  const end = events.find((e) => e.type === 'message.end')
  if (end?.type !== 'message.end') throw new Error('no message.end')
  return end
}

const call = (id: string, name: string, args = {}): AiToolCall => ({
  id,
  name,
  arguments: args,
})

beforeEach(() => {
  tools.list = [readTool, writeTool]
  readExecute.mockResolvedValue(
    ok({ data: { total: 3 }, summary: '3 chamados' }),
  )
  writePreview.mockResolvedValue(
    ok({ title: 'Criar chamado “Impressora”', summary: 'Novo incidente' }),
  )
})

describe('SteelAiChatService.sendMessage() — before the stream', () => {
  it('should propagate a membership failure', async () => {
    setup()
    mockedAccess.mockResolvedValue(err(forbidden()))
    expectErr(
      await SteelAiChatService.sendMessage('u1', 'ws1', 'conv1', {
        content: 'Oi',
      }),
      'FORBIDDEN',
    )
  })

  it('should answer 404 for a conversation of someone else', async () => {
    setup()
    conversations.findById.mockResolvedValue(err(aiConversationNotFound()))
    expectErr(
      await SteelAiChatService.sendMessage('u1', 'ws1', 'conv1', {
        content: 'Oi',
      }),
      'AI_CONVERSATION_NOT_FOUND',
    )
  })

  it('should refuse the agent mode when the workspace switched it off', async () => {
    setup()
    mockedAccess.mockResolvedValue(ok({ ...ACCESS, agentModeEnabled: false }))
    expectErr(
      await SteelAiChatService.sendMessage('u1', 'ws1', 'conv1', {
        content: 'Oi',
        mode: 'AGENT',
      }),
      'AI_AGENT_MODE_DISABLED',
    )
    expect(aiUsage.prepare).not.toHaveBeenCalled()
  })

  it('should refuse when the quota is exhausted, before saving anything', async () => {
    setup()
    aiUsage.prepare.mockResolvedValue(err(aiQuotaExceeded(50, 50)))
    expectErr(
      await SteelAiChatService.sendMessage('u1', 'ws1', 'conv1', {
        content: 'Oi',
      }),
      'AI_QUOTA_EXCEEDED',
    )
    expect(messages.createMany).not.toHaveBeenCalled()
  })

  it.each([
    ['user', () => users.findById.mockResolvedValue(err(notFound('User')))],
    [
      'workspace',
      () => workspaces.findById.mockResolvedValue(err(notFound('Workspace'))),
    ],
    [
      'history',
      () => messages.listRecent.mockResolvedValue(err(databaseError())),
    ],
    [
      'mode switch',
      () => conversations.update.mockResolvedValue(err(databaseError())),
    ],
    [
      'user message',
      () => messages.createMany.mockResolvedValue(err(databaseError())),
    ],
  ])('should propagate a %s failure', async (_name, breakIt) => {
    setup()
    breakIt()
    const result = await SteelAiChatService.sendMessage('u1', 'ws1', 'conv1', {
      content: 'Oi',
      mode: 'AGENT',
    })
    expect(result.ok).toBe(false)
  })
})

describe('SteelAiChatService.sendMessage() — the turn', () => {
  it('should stream a text answer, persist it and auto-title the first exchange', async () => {
    const fake = setup({
      rounds: [{ deltas: ['Olá', ', Ana!'], response: { text: 'Olá, Ana!' } }],
    })

    const events = await send({ content: 'Oi, tudo bem?' })

    expect(types(events)).toEqual([
      'message.start',
      'text.delta',
      'text.delta',
      'conversation.title',
      'message.end',
    ])
    const start = events[0] as { messageId: string; conversationId: string }
    expect(start.conversationId).toBe('conv1')
    expect(textOf(events)).toBe('Olá, Ana!')

    const request = fake.requests[0]
    expect(request.system).toContain('Usuário: Ana')
    expect(request.system).toContain('Workspace: Acme')
    expect(request.system).toContain('America/Manaus')
    expect(request.system).toContain('EXPLORAR')
    expect(request.messages).toEqual([
      { role: 'user', content: 'Oi, tudo bem?' },
    ])
    // A greeting mentions no module: only the meta-tool is offered (the
    // write tool is not even allowed in EXPLORE).
    expect(request.tools?.map((t) => t.name)).toEqual(['steel_find_tools'])
    expect(request.toolChoice).toBe('auto')

    // User row before the stream; the assistant row carries the message id.
    expect(messages.createMany.mock.calls[0][0]).toEqual([
      { conversationId: 'conv1', role: 'USER', content: 'Oi, tudo bem?' },
    ])
    const assistantRow = messages.createMany.mock.calls[1][0][0]
    expect(assistantRow).toEqual(
      expect.objectContaining({
        id: start.messageId,
        role: 'ASSISTANT',
        content: 'Olá, Ana!',
        modelKey: 'openai:gpt-4o-mini',
      }),
    )

    expect(conversations.setTitleIfEmpty).toHaveBeenCalledWith(
      'conv1',
      'Título',
    )
    const end = endOf(events)
    expect(end.message).toEqual(
      expect.objectContaining({
        id: start.messageId,
        role: 'ASSISTANT',
        content: 'Olá, Ana!',
        toolCalls: [],
        pendingActions: [],
      }),
    )
    // Turn (10/5) + title (10/5).
    expect(end.usage).toEqual({ inputTokens: 20, outputTokens: 10 })
    expect(aiUsage.record).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: 'ws1',
      userId: 'u1',
      usage: { inputTokens: 20, outputTokens: 10 },
      scope: { module: null, conversationId: 'conv1' },
    })
    expect(conversations.update).toHaveBeenCalledWith('conv1', {
      modelKey: 'openai:gpt-4o-mini',
    })
  })

  it('should run a read tool, feed the result back and separate round texts', async () => {
    const fake = setup({
      rounds: [
        {
          deltas: ['Vou consultar.'],
          response: {
            text: 'Vou consultar.',
            toolCalls: [call('c1', 'sd_list_tickets', { limit: 5 })],
          },
        },
        { deltas: ['São 3.'], response: { text: 'São 3.' } },
      ],
      history: [createFakeAiMessage({ role: 'USER', content: 'antes' })],
    })

    const events = await send({ content: 'Quantos chamados?' })

    expect(types(events)).toEqual([
      'message.start',
      'text.delta',
      'tool.start',
      'tool.end',
      'text.delta',
      'text.delta',
      'message.end',
    ])
    expect(textOf(events)).toBe('Vou consultar.\n\nSão 3.')
    expect(readExecute).toHaveBeenCalledWith(
      { workspaceId: 'ws1', actorId: 'u1', source: 'assistant' },
      { limit: 5 },
    )
    const toolEnd = events[3] as Extract<
      SteelAiStreamEvent,
      { type: 'tool.end' }
    >
    expect(toolEnd.call).toEqual({
      id: 'c1',
      name: 'sd_list_tickets',
      label: 'Consultando chamados',
      module: 'SERVICE_DESK',
      status: 'done',
      summary: '3 chamados',
    })

    // Round 1 rows: ASSISTANT with the call + TOOL with the JSON result.
    const roundRows = messages.createMany.mock.calls[1][0]
    expect(roundRows.map((r) => r.role)).toEqual(['ASSISTANT', 'TOOL'])
    expect(JSON.parse(roundRows[1].content)).toEqual({
      status: 'done',
      summary: '3 chamados',
      data: { total: 3 },
    })
    // Round 2 sees the tool result.
    expect(fake.requests[1].messages.at(-1)).toEqual(
      expect.objectContaining({ role: 'tool', toolCallId: 'c1' }),
    )
    // History had a previous USER row: not the first exchange.
    expect(types(events)).not.toContain('conversation.title')
    expect(endOf(events).message.content).toBe('Vou consultar.\n\nSão 3.')
  })

  it('should report read tool errors and unavailable tools to the model', async () => {
    readExecute.mockResolvedValue(err(forbidden()))
    setup({
      rounds: [
        {
          response: {
            toolCalls: [
              call('c1', 'sd_list_tickets'),
              call('c2', 'sd_create_ticket'),
              call('c3', 'sd_list_tickets', { bad: true }),
            ],
          },
        },
        { response: { text: 'Não consegui.' } },
      ],
      conversationOverrides: { title: 'Já tem' },
    })

    const events = await send({ content: 'Abra um chamado' })

    const ends = events.filter(
      (e): e is Extract<SteelAiStreamEvent, { type: 'tool.end' }> =>
        e.type === 'tool.end',
    )
    expect(ends.map((e) => e.call.status)).toEqual(['error', 'error', 'error'])
    expect(ends[1].call.summary).toBe(
      'Ferramenta indisponível neste modo ou para o seu perfil',
    )
    expect(writePreview).not.toHaveBeenCalled()
    expect(conversations.setTitleIfEmpty).not.toHaveBeenCalled()
  })

  it('should turn a write into a pending action and end after the short reply', async () => {
    const fake = setup({
      rounds: [
        {
          response: {
            toolCalls: [
              call('c1', 'sd_create_ticket', { title: 'Impressora' }),
            ],
          },
        },
        {
          deltas: ['Propus o chamado.'],
          response: { text: 'Propus o chamado.' },
        },
      ],
      conversationOverrides: { mode: 'AGENT', title: 'x' },
    })

    const events = await send({ content: 'Abra um chamado' })

    expect(types(events)).toEqual([
      'message.start',
      'tool.start',
      'action.pending',
      'tool.end',
      'text.delta',
      'message.end',
    ])
    expect(fake.requests[0].system).toContain('Modo atual: BUILD')
    expect(fake.requests[0].tools?.map((t) => t.name)).toEqual([
      'sd_list_tickets',
      'sd_create_ticket',
    ])
    expect(pendingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        requestedById: 'u1',
        conversationId: 'conv1',
        toolCallId: 'c1',
        toolName: 'sd_create_ticket',
        kind: 'CREATE',
        requiresDoubleConfirm: false,
      }),
    )
    const toolEnd = events[3] as Extract<
      SteelAiStreamEvent,
      { type: 'tool.end' }
    >
    expect(toolEnd.call.status).toBe('pending_confirmation')
    expect(toolEnd.call.summary).toBe('Criar chamado “Impressora”')
    // The reply round is forced to text.
    expect(fake.requests[1].toolChoice).toBe('none')
    expect(fake.chatStream).toHaveBeenCalledTimes(2)
    const toolRow = messages.createMany.mock.calls[1][0][1]
    expect(JSON.parse(toolRow.content)).toEqual(
      expect.objectContaining({
        status: 'pending_confirmation',
        actionId: 'act1',
      }),
    )
    expect(endOf(events).message.pendingActions).toHaveLength(1)
    expect(endOf(events).message.toolCalls[0].status).toBe(
      'pending_confirmation',
    )
  })

  it('should switch the conversation mode when the message asks for it', async () => {
    setup({ rounds: [{ response: { text: 'ok' } }] })
    await send({ content: 'Oi', mode: 'AGENT' })
    expect(conversations.update).toHaveBeenCalledWith('conv1', {
      mode: 'AGENT',
    })
  })

  it('should surface a failed preview as a tool error', async () => {
    writePreview.mockResolvedValue(err(forbidden('Sem permissão')))
    setup({
      rounds: [
        { response: { toolCalls: [call('c1', 'sd_create_ticket')] } },
        { response: { text: 'Não deu.' } },
      ],
      conversationOverrides: { mode: 'AGENT', title: 'x' },
    })

    const events = await send({ content: 'Abra' })
    const end = events.find((e) => e.type === 'tool.end') as Extract<
      SteelAiStreamEvent,
      { type: 'tool.end' }
    >
    expect(end.call).toEqual(
      expect.objectContaining({ status: 'error', summary: 'Sem permissão' }),
    )
    expect(types(events)).not.toContain('action.pending')
  })

  it('should answer a refusal with the standard reply', async () => {
    setup({
      rounds: [{ response: { text: '', stopReason: 'refusal' } }],
      conversationOverrides: { title: 'x' },
    })
    const events = await send({ content: '???' })
    expect(textOf(events)).toBe(
      'Não posso ajudar com esse pedido. Tente reformular a pergunta.',
    )
  })

  it('should separate a refusal from earlier text', async () => {
    setup({
      rounds: [
        {
          deltas: ['Vou ver.'],
          response: {
            text: 'Vou ver.',
            toolCalls: [call('c1', 'sd_list_tickets')],
          },
        },
        { response: { text: '', stopReason: 'refusal' } },
      ],
      conversationOverrides: { title: 'x' },
    })
    const events = await send({ content: '???' })
    expect(textOf(events)).toBe(
      'Vou ver.\n\nNão posso ajudar com esse pedido. Tente reformular a pergunta.',
    )
  })

  it('should fall back to a default reply when the model says nothing', async () => {
    setup({
      rounds: [{ response: { text: '' } }],
      conversationOverrides: { title: 'x' },
    })
    const events = await send({ content: 'Oi' })
    expect(textOf(events)).toBe('Não consegui gerar uma resposta agora.')
    const lastRows = messages.createMany.mock.calls.at(-1)?.[0]
    expect(lastRows?.[0]).toEqual(
      expect.objectContaining({
        role: 'ASSISTANT',
        content: 'Não consegui gerar uma resposta agora.',
      }),
    )
  })

  it('should stop at the round limit forcing a text answer', async () => {
    const rounds: Round[] = Array.from(
      { length: STEEL_AI_MAX_TOOL_ROUNDS },
      (_, i) => ({
        response: { toolCalls: [call(`c${i}`, 'sd_list_tickets')] },
      }),
    )
    const fake = setup({ rounds, conversationOverrides: { title: 'x' } })

    const events = await send({ content: 'Loop' })

    expect(fake.chatStream).toHaveBeenCalledTimes(STEEL_AI_MAX_TOOL_ROUNDS)
    expect(fake.requests.at(-1)?.toolChoice).toBe('none')
    expect(readExecute).toHaveBeenCalledTimes(STEEL_AI_MAX_TOOL_ROUNDS - 1)
    const lastEnd = events
      .filter((e) => e.type === 'tool.end')
      .at(-1) as Extract<SteelAiStreamEvent, { type: 'tool.end' }>
    expect(lastEnd.call).toEqual(
      expect.objectContaining({ status: 'error', summary: 'Não executada' }),
    )
  })

  it('should not send tools when none is available', async () => {
    tools.list = []
    const fake = setup({
      rounds: [{ response: { text: 'ok' } }],
      conversationOverrides: { title: 'x' },
    })
    await send({ content: 'Oi' })
    expect(fake.requests[0].tools).toBeUndefined()
    expect(fake.requests[0].toolChoice).toBeUndefined()
  })

  it('should use the default timezone when the user has no preference', async () => {
    const fake = setup({
      rounds: [{ response: { text: 'ok' } }],
      conversationOverrides: { title: 'x' },
    })
    preferences.findByUserId.mockResolvedValue(err(notFound('UserPreference')))
    await send({ content: 'Oi' })
    expect(fake.requests[0].system).toContain('America/Sao_Paulo')
  })

  it('should emit an error event and record usage when the provider fails', async () => {
    setup({
      rounds: [
        { response: { toolCalls: [call('c1', 'sd_list_tickets')] } },
        { throws: new Error('boom') },
      ],
    })

    const events = await send({ content: 'Oi' })

    expect(events.at(-1)).toEqual({
      type: 'error',
      code: 'AI_PROVIDER_UNAVAILABLE',
      message:
        'Não foi possível falar com o provedor de IA agora. Tente novamente em instantes.',
    })
    expect(aiUsage.record).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: 'ws1',
      userId: 'u1',
      usage: { inputTokens: 10, outputTokens: 5 },
      // The read tool ran before the failure: billed to its module.
      scope: { module: 'SERVICE_DESK', conversationId: 'conv1' },
    })
    expect(types(events)).not.toContain('message.end')
  })

  it('should emit an error event when the stream ends without a response', async () => {
    setup({ rounds: [{ deltas: ['meio'] }] })
    const events = await send({ content: 'Oi' })
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        type: 'error',
        code: 'AI_PROVIDER_UNAVAILABLE',
      }),
    )
  })

  it('should emit a DATABASE_ERROR event when a round cannot be saved', async () => {
    setup({ rounds: [{ response: { text: 'ok' } }] })
    messages.createMany
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(err(databaseError()))
    const events = await send({ content: 'Oi' })
    expect(events.at(-1)).toEqual(
      expect.objectContaining({ type: 'error', code: 'DATABASE_ERROR' }),
    )
  })

  it('should fall back to the user message as title when titling fails', async () => {
    const fake = setup({ rounds: [{ response: { text: 'ok' } }] })
    fake.chat.mockRejectedValue(new Error('down'))
    const long = `Preciso de um relatório ${'muito '.repeat(20)}detalhado`
    const events = await send({ content: long })
    const title = events.find((e) => e.type === 'conversation.title') as {
      title: string
    }
    expect(title.title.length).toBeLessThanOrEqual(60)
    expect(title.title.endsWith('…')).toBe(true)
  })

  it('should fall back when the model returns an empty title', async () => {
    setup({ rounds: [{ response: { text: 'ok' } }], title: { text: '""' } })
    const events = await send({ content: 'Oi' })
    expect(events).toContainEqual({ type: 'conversation.title', title: 'Oi' })
  })

  it('should clean quotes from the generated title', async () => {
    setup({
      rounds: [{ response: { text: 'ok' } }],
      title: { text: '"Chamados abertos."' },
    })
    const events = await send({ content: 'Oi' })
    expect(events).toContainEqual({
      type: 'conversation.title',
      title: 'Chamados abertos',
    })
  })

  it('should not announce a title someone else already set', async () => {
    setup({ rounds: [{ response: { text: 'ok' } }] })
    conversations.setTitleIfEmpty.mockResolvedValue(ok(false))
    const events = await send({ content: 'Oi' })
    expect(types(events)).not.toContain('conversation.title')
  })

  it('should still finish the turn when touching the conversation fails', async () => {
    setup({
      rounds: [{ response: { text: 'ok' } }],
      conversationOverrides: { title: 'x' },
    })
    conversations.update.mockResolvedValue(err(databaseError()))
    const events = await send({ content: 'Oi' })
    expect(types(events).at(-1)).toBe('message.end')
  })
})

describe('SteelAiChatService.capabilities()', () => {
  function setupCapabilities() {
    mockedAccess.mockResolvedValue(
      ok({ ...ACCESS, modules: ['COMMUNICATION', 'SERVICE_DESK'] }),
    )
    aiUsage.resolveModel.mockResolvedValue(
      ok({
        settings: {
          enabledModels: ['openai:gpt-4o-mini'],
          crmAssistantModel: 'openai:gpt-4o-mini',
          whatsappReplyModel: 'openai:gpt-4o-mini',
          whatsappSentimentModel: 'openai:gpt-4o-mini',
          monthlyQuotaUsd: 50,
          usdPer1kTokens: 4,
          agentModeEnabled: true,
        },
        model: {
          key: 'openai:gpt-4o-mini',
          provider: 'openai',
          model: 'gpt-4o-mini',
          label: 'GPT-4o mini',
        },
      }),
    )
    usageRepo.sumSince.mockResolvedValue(
      ok({ inputTokens: 1, outputTokens: 1, costUsd: 12.345 }),
    )
  }

  it('should return agent mode, ordered modules, model and quota', async () => {
    setupCapabilities()
    expect(
      expectOk(await SteelAiChatService.capabilities('u1', 'ws1')),
    ).toEqual({
      aiEnabled: true,
      agentModeEnabled: true,
      autopilotEnabled: false,
      modules: ['SERVICE_DESK', 'COMMUNICATION'],
      modelKey: 'openai:gpt-4o-mini',
      models: [
        {
          key: 'openai:gpt-4o-mini',
          provider: 'openai',
          providerLabel: 'OpenAI',
          label: 'GPT-4o mini',
          // Provider price × platform margin (2).
          inputUsdPer1M: 0.3,
          outputUsdPer1M: 1.2,
        },
      ],
      attachments: expect.objectContaining({ maxPerMessage: 5 }),
      quota: { usedUsd: 12.35, quotaUsd: 50 },
    })
    expect(aiUsage.resolveModel).toHaveBeenCalledWith(
      'ws1',
      'STEEL_ASSISTANT',
      'u1',
    )
  })

  it('should return a null model when none is usable', async () => {
    setupCapabilities()
    const resolved = await aiUsage.resolveModel('ws1', 'STEEL_ASSISTANT')
    if (!resolved.ok) throw new Error('setup')
    aiUsage.resolveModel.mockResolvedValue(
      ok({ ...resolved.value, model: null }),
    )
    expect(
      expectOk(await SteelAiChatService.capabilities('u1', 'ws1')).modelKey,
    ).toBeNull()
  })

  it.each([
    ['access', () => mockedAccess.mockResolvedValue(err(forbidden()))],
    [
      'model',
      () => aiUsage.resolveModel.mockResolvedValue(err(databaseError())),
    ],
    ['usage', () => usageRepo.sumSince.mockResolvedValue(err(databaseError()))],
  ])('should propagate a %s failure', async (_name, breakIt) => {
    setupCapabilities()
    breakIt()
    expect((await SteelAiChatService.capabilities('u1', 'ws1')).ok).toBe(false)
  })
})

describe('SteelAiChatService.sendMessage() — tool selection', () => {
  const crmTool: AnySteelAiTool = {
    ...readTool,
    name: 'crm_list_leads',
    label: 'Consultando leads',
    module: 'CRM',
    description: 'Lista leads do CRM',
    execute: vi.fn(async () => ok({ data: { total: 1 }, summary: '1 lead' })),
  }
  const multiModule = {
    ...ACCESS,
    modules: ['SERVICE_DESK' as const, 'CRM' as const],
  }

  beforeEach(() => {
    tools.list = [readTool, writeTool, crmTool]
  })

  it('should show only the tools of the module the message is about', async () => {
    const fake = setup({ rounds: [{ response: { text: 'Há 3.' } }] })
    mockedAccess.mockResolvedValue(ok(multiModule))

    await send({ content: 'Quantos chamados abertos eu tenho?' })

    expect(fake.requests[0].tools?.map((t) => t.name)).toEqual([
      'sd_list_tickets',
      'steel_find_tools',
    ])
  })

  it('should offer write tools of the module in agent mode', async () => {
    const fake = setup({ rounds: [{ response: { text: 'Ok.' } }] })
    mockedAccess.mockResolvedValue(ok(multiModule))

    await send({ content: 'Crie um chamado para a impressora', mode: 'AGENT' })

    expect(fake.requests[0].tools?.map((t) => t.name)).toEqual([
      'sd_list_tickets',
      'sd_create_ticket',
      'steel_find_tools',
    ])
  })

  it('should activate the tools steel_find_tools returns on the next round', async () => {
    const fake = setup({
      rounds: [
        {
          response: {
            toolCalls: [call('c1', 'steel_find_tools', { module: 'CRM' })],
          },
        },
        { response: { toolCalls: [call('c2', 'crm_list_leads')] } },
        { response: { text: 'Você tem 1 lead.' } },
      ],
    })
    mockedAccess.mockResolvedValue(ok(multiModule))

    const events = await send({ content: 'Oi! O que tenho para hoje?' })

    expect(fake.requests[0].tools?.map((t) => t.name)).toEqual([
      'steel_find_tools',
    ])
    expect(fake.requests[1].tools?.map((t) => t.name)).toEqual([
      'crm_list_leads',
      'steel_find_tools',
    ])
    const ends = events.filter((e) => e.type === 'tool.end') as {
      call: { name: string; status: string; summary?: string; label: string }
    }[]
    expect(ends[0].call).toEqual(
      expect.objectContaining({
        name: 'steel_find_tools',
        status: 'done',
        summary: '1 ferramenta(s) encontrada(s)',
        label: 'Procurando ferramentas',
      }),
    )
    expect(ends[1].call.status).toBe('done')
    const toolRow = messages.createMany.mock.calls[1][0][1] as {
      toolName: string
      content: string
    }
    expect(toolRow.toolName).toBe('steel_find_tools')
    expect(JSON.parse(toolRow.content).data.tools[0].name).toBe(
      'crm_list_leads',
    )
  })

  it('should keep offering the tools used earlier in the conversation', async () => {
    const fake = setup({
      rounds: [{ response: { text: 'Ontem foram 2.' } }],
      history: [
        createFakeAiMessage({ role: 'USER', content: 'Liste os leads' }),
        createFakeAiMessage({
          role: 'ASSISTANT',
          content: '',
          toolCalls: [{ id: 'c0', name: 'crm_list_leads', arguments: {} }],
        }),
        createFakeAiMessage({
          role: 'TOOL',
          toolCallId: 'c0',
          toolName: 'crm_list_leads',
          content: '{"status":"done"}',
        }),
      ],
    })
    mockedAccess.mockResolvedValue(ok(multiModule))

    await send({ content: 'E os de ontem?' })

    expect(fake.requests[0].tools?.map((t) => t.name)).toEqual([
      'crm_list_leads',
      'steel_find_tools',
    ])
  })
})
