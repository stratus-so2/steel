import type { SdCategory } from '@prisma/client'
import type { SdCategoryDTO, SdCategoryTreeDTO } from '@/types/sd-config'

export function toSdCategoryDTO(category: SdCategory): SdCategoryDTO {
  return {
    id: category.id,
    parentId: category.parentId,
    level: category.level,
    name: category.name,
    description: category.description,
    icon: category.icon,
    ticketTypes: category.ticketTypes,
    departmentId: category.departmentId,
    slaPolicyId: category.slaPolicyId,
    portalVisible: category.portalVisible,
    active: category.active,
    position: category.position,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }
}

/**
 * Lista plana (já ordenada) → árvore categoria > subcategoria > serviço.
 * Nós cujo pai não está na lista são descartados (subárvore oculta).
 */
export function toSdCategoryTree(
  categories: SdCategoryDTO[],
): SdCategoryTreeDTO[] {
  const build = (parentId: string | null): SdCategoryTreeDTO[] =>
    categories
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ ...c, children: build(c.id) }))
  return build(null)
}

/** Mantém só os nós cujos ancestrais também estão na lista. */
export function pruneSdCategoryOrphans(
  categories: SdCategoryDTO[],
): SdCategoryDTO[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const reachable = (c: SdCategoryDTO): boolean => {
    if (!c.parentId) return true
    const parent = byId.get(c.parentId)
    return parent ? reachable(parent) : false
  }
  return categories.filter(reachable)
}
