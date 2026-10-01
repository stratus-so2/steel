import type {
  SdCategoryTreeDTO,
  SdScaleItemDTO,
  SdTicketTemplateDTO,
} from '@/types/sd-config'
import type { SdTicketTypeDTO } from '@/types/sd-ticket'
import type { SdSelectOption } from '../ticket/sd-option-select'
import { SD_TICKET_TYPES } from '../ticket/sd-ticket-meta'

/**
 * Opções do formulário do portal: só o que o solicitante pode escolher
 * (tipos liberados, catálogo `portalVisible`, modelos `portalVisible`).
 * Funções puras — testáveis sem DOM.
 */

function forType(
  item: { ticketTypes: SdTicketTypeDTO[] },
  type: SdTicketTypeDTO,
): boolean {
  return item.ticketTypes.length === 0 || item.ticketTypes.includes(type)
}

/** Tipos liberados no portal, na ordem canônica; vazio = nenhum. */
export function sdPortalTypes(allowed: SdTicketTypeDTO[]): SdTicketTypeDTO[] {
  return SD_TICKET_TYPES.filter((type) => allowed.includes(type))
}

/** Categorias/subcategorias/serviços visíveis no portal, em ordem. */
export function sdPortalCategoryOptions(
  nodes: SdCategoryTreeDTO[],
  type: SdTicketTypeDTO,
): SdSelectOption[] {
  return nodes
    .filter((node) => node.active && node.portalVisible && forType(node, type))
    .sort((a, b) => a.position - b.position)
    .map((node) => ({ value: node.id, label: node.name }))
}

function findNode(
  nodes: SdCategoryTreeDTO[],
  id: string | null | undefined,
): SdCategoryTreeDTO | undefined {
  if (!id) return undefined
  for (const node of nodes) {
    if (node.id === id) return node
    const inner = findNode(node.children, id)
    if (inner) return inner
  }
  return undefined
}

/** Filhos visíveis no portal de um nó do catálogo. */
export function sdPortalChildOptions(
  nodes: SdCategoryTreeDTO[],
  parentId: string | null | undefined,
  type: SdTicketTypeDTO,
): SdSelectOption[] {
  const parent = findNode(nodes, parentId)
  if (!parent) return []
  return sdPortalCategoryOptions(parent.children, type)
}

/** Modelos de chamado oferecidos no portal para um tipo. */
export function sdPortalTemplates(
  templates: SdTicketTemplateDTO[],
  type: SdTicketTypeDTO,
): SdTicketTemplateDTO[] {
  return templates
    .filter((t) => t.active && t.portalVisible && t.ticketType === type)
    .sort((a, b) => a.position - b.position)
}

/** Urgências, da menor para a maior (a prioridade sai da matriz, no servidor). */
export function sdPortalUrgencyOptions(
  urgencies: SdScaleItemDTO[],
): SdSelectOption[] {
  return [...urgencies]
    .sort((a, b) => a.level - b.level)
    .map((u) => ({ value: u.id, label: u.name, color: u.color }))
}

/** Urgência padrão sugerida (a marcada como `isDefault`). */
export function sdPortalDefaultUrgency(
  urgencies: SdScaleItemDTO[],
): string | null {
  return urgencies.find((u) => u.isDefault)?.id ?? null
}
