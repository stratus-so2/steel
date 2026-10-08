import type { z } from 'zod'
import { validationError } from '@/src/errors/app-error'
import { err, ok, type Result } from '@/src/lib/result'
import { toAiMemoryRefDTO } from '@/src/mappers/ai-memory.mapper'
import {
  type MemoryForgetArgs,
  MemoryForgetArgsSchema,
  type MemorySaveArgs,
  MemorySaveArgsSchema,
} from '@/src/schemas/ai-memory.schema'
import { AiMemoryService } from '@/src/services/ai-memory.service'
import type { AnySteelAiTool, SteelAiTool } from '../tools/types'
import { MEMORY_MAX_CHARS } from './memory-guard'
import {
  MEMORY_FORGET_TOOL_NAME,
  MEMORY_SAVE_TOOL_NAME,
  MEMORY_TOOL_LABELS,
} from './memory-tool-names'

/**
 * The memory tools of the Steel AI assistant. They are NOT part of
 * `STEEL_AI_TOOLS`: the chat runtime offers them only while
 * `memoryEnabled` is on and runs them straight away, in every mode, without
 * an AiPendingAction — a memory is metadata, not business data, and the
 * transcript always shows a "Memória salva" chip with undo.
 */

function parser<T>(schema: z.ZodType<T, unknown>) {
  return (args: Record<string, unknown>): Result<T> => {
    const parsed = schema.safeParse(args ?? {})
    if (parsed.success) return ok(parsed.data)
    return err(
      validationError(
        'Argumentos inválidos para a ferramenta',
        parsed.error.issues,
      ),
    )
  }
}

export const memorySaveTool: SteelAiTool<MemorySaveArgs> = {
  name: MEMORY_SAVE_TOOL_NAME,
  label: MEMORY_TOOL_LABELS[MEMORY_SAVE_TOOL_NAME],
  module: null,
  kind: 'CREATE',
  description:
    'Guarda um fato curto e duradouro na memória do Steel AI (sem confirmação; o usuário pode desfazer). Use para preferências, forma de trabalhar, contexto do time e decisões. Nunca para credenciais, documentos ou dados pessoais sensíveis.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        maxLength: MEMORY_MAX_CHARS,
        description:
          'O fato, em uma frase autoexplicativa (ex.: "Ana prefere respostas em tópicos").',
      },
      scope: {
        type: 'string',
        enum: ['personal', 'workspace'],
        description:
          'personal (padrão) = só deste usuário; workspace = vale para todo o time (só administradores).',
      },
    },
    required: ['content'],
    additionalProperties: false,
  },
  parse: parser(MemorySaveArgsSchema),
  // Only used by Teste mode, which simulates every write (memory included).
  async preview(_ctx, args) {
    return ok({
      title: 'Salvar na memória',
      summary: args.content,
      fields: [
        {
          label: 'Escopo',
          after: args.scope === 'WORKSPACE' ? 'Workspace' : 'Pessoal',
        },
      ],
    })
  },
  async execute(ctx, args) {
    const saved = await AiMemoryService.saveFromModel(ctx, args)
    if (!saved.ok) return saved
    const { memory, action, downgraded } = saved.value
    const summary =
      action === 'duplicate'
        ? 'Já estava na memória'
        : downgraded
          ? 'Memória pessoal salva (a memória do workspace é só de administradores)'
          : 'Memória salva'
    return ok({
      summary,
      data: { memoryRef: toAiMemoryRefDTO(memory, action) },
    })
  },
}

export const memoryForgetTool: SteelAiTool<MemoryForgetArgs> = {
  name: MEMORY_FORGET_TOOL_NAME,
  label: MEMORY_TOOL_LABELS[MEMORY_FORGET_TOOL_NAME],
  module: null,
  kind: 'DELETE',
  description:
    'Apaga um fato da memória do Steel AI pelo id (o que aparece entre colchetes na memória). Use quando o usuário pedir para esquecer algo ou quando um fato estiver errado.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Id do fato na memória.' },
    },
    required: ['id'],
    additionalProperties: false,
  },
  parse: parser(MemoryForgetArgsSchema),
  // Only used by Teste mode, which simulates every write (memory included).
  async preview(_ctx, args) {
    return ok({
      title: 'Esquecer um fato da memória',
      summary: `Fato ${args.id}`,
    })
  },
  async execute(ctx, args) {
    const forgotten = await AiMemoryService.forgetFromModel(ctx, args.id)
    if (!forgotten.ok) return forgotten
    return ok({
      summary: 'Memória esquecida',
      data: { memoryRef: toAiMemoryRefDTO(forgotten.value, 'forgotten') },
    })
  },
}

export const STEEL_AI_MEMORY_TOOLS: readonly AnySteelAiTool[] = [
  memorySaveTool,
  memoryForgetTool,
]
