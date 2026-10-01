import type { SdAiConversation } from '@prisma/client'
import type { SdAiCatalog } from '@/src/lib/servicedesk/ai-prompts'
import type { SdAiTriageOutput } from '@/src/schemas/sd-ai.schema'
import type {
  SdAiArticleCardDTO,
  SdAiClassificationDTO,
  SdAiConversationDTO,
  SdAiMessageDTO,
  SdAiModeDTO,
  SdAiOutcomeDTO,
} from '@/types/sd-ai'

const OUTCOMES = new Set<string>(['resolved_by_kb', 'ticket_opened', 'abandoned'])

function isCard(value: unknown): value is SdAiArticleCardDTO {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.excerpt === 'string'
  )
}

/** Lê `SdAiConversation.messages` (JSON) descartando entradas malformadas. */
export function parseSdAiMessages(raw: unknown): SdAiMessageDTO[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): SdAiMessageDTO[] => {
    if (!item || typeof item !== 'object') return []
    const m = item as Record<string, unknown>
    if (
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string' ||
      typeof m.at !== 'string'
    ) {
      return []
    }
    const articles = Array.isArray(m.articles)
      ? m.articles.filter(isCard)
      : undefined
    return [
      {
        role: m.role,
        content: m.content,
        at: m.at,
        ...(articles && articles.length > 0 ? { articles } : {}),
      },
    ]
  })
}

export function toSdAiConversationDTO(
  row: SdAiConversation,
): SdAiConversationDTO {
  return {
    id: row.id,
    mode: (row.mode === 'COPILOT' ? 'COPILOT' : 'PRE_SERVICE') as SdAiModeDTO,
    ticketId: row.ticketId,
    outcome:
      row.outcome && OUTCOMES.has(row.outcome)
        ? (row.outcome as SdAiOutcomeDTO)
        : null,
    messages: parseSdAiMessages(row.messages),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Converte a triagem do modelo em sugestões válidas: só ids que existem no
 * catálogo e um caminho categoria > subcategoria > serviço consistente
 * (o que quebrar o caminho é descartado, junto com os níveis abaixo).
 */
export function toSdAiClassification(
  output: SdAiTriageOutput,
  catalog: SdAiCatalog,
): SdAiClassificationDTO {
  const byId = new Map(catalog.categories.map((c) => [c.id, c]))
  const ref = (row: { id: string; name: string } | undefined) =>
    row ? { id: row.id, name: row.name } : null

  const category = output.categoryId ? byId.get(output.categoryId) : undefined
  const validCategory = category?.level === 'CATEGORY' ? category : undefined
  const sub = output.subcategoryId ? byId.get(output.subcategoryId) : undefined
  const validSub =
    validCategory && sub?.level === 'SUBCATEGORY' && sub.parentId === validCategory.id
      ? sub
      : undefined
  const service = output.serviceId ? byId.get(output.serviceId) : undefined
  const validService =
    validSub && service?.level === 'SERVICE' && service.parentId === validSub.id
      ? service
      : undefined

  const find = <T extends { id: string; name: string }>(
    rows: T[],
    id: string | null,
  ) => ref(id ? rows.find((r) => r.id === id) : undefined)

  return {
    category: ref(validCategory),
    subcategory: ref(validSub),
    service: ref(validService),
    impact: find(catalog.impacts, output.impactId),
    urgency: find(catalog.urgencies, output.urgencyId),
    priority: find(catalog.priorities, output.priorityId),
    department: find(catalog.departments, output.departmentId),
    tags: output.tags.slice(0, 5),
    confidence: Math.round(output.confidence * 100) / 100,
    reasoning: output.reasoning,
  }
}
