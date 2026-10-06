import { validationError } from '@/src/errors/app-error'
import { err, ok, type Result } from '@/src/lib/result'
import { SdConfigItemService } from '@/src/services/sd-config-item.service'
import { SdContactService } from '@/src/services/sd-contact.service'
import { SdCustomerService } from '@/src/services/sd-customer.service'
import { SdKbArticleService } from '@/src/services/sd-kb-article.service'
import type { SdConfigItemDTO } from '@/types/sd-config-item'
import type { SdContactDTO } from '@/types/sd-contact'
import type { SdCustomerDTO, SdCustomerKindDTO } from '@/types/sd-customer'
import type { SdKbSearchResultDTO } from '@/types/sd-kb-article'
import type { AiToolContext } from '../types'
import { looksLikeId, resolveNamed } from './shared'

/**
 * Text → record lookups backed by the directory/knowledge services (so the
 * caller's ServiceDesk permissions apply). An id is taken as is; anything
 * else is searched and must match exactly one record.
 */

const SEARCH_SIZE = 10

export async function lookupCustomer(
  ctx: AiToolContext,
  input: string,
  kind?: SdCustomerKindDTO,
): Promise<Result<Pick<SdCustomerDTO, 'id' | 'name'>>> {
  if (looksLikeId(input)) return ok({ id: input, name: input })
  const page = await SdCustomerService.list(ctx.actorId, ctx.workspaceId, {
    q: input,
    kind,
    page: 1,
    pageSize: SEARCH_SIZE,
    order: 'asc',
    sort: 'name',
  })
  if (!page.ok) return page
  const label = kind === 'COMPANY' ? 'a empresa' : 'o cliente'
  return resolveNamed(
    page.value.items.map((c) => ({ ...c, aliases: [c.tradeName, c.email] })),
    input,
    label,
  )
}

export async function lookupContact(
  ctx: AiToolContext,
  input: string,
): Promise<Result<Pick<SdContactDTO, 'id' | 'name'>>> {
  if (looksLikeId(input)) return ok({ id: input, name: input })
  const page = await SdContactService.list(ctx.actorId, ctx.workspaceId, {
    q: input,
    page: 1,
    pageSize: SEARCH_SIZE,
    order: 'asc',
    sort: 'name',
  })
  if (!page.ok) return page
  return resolveNamed(
    page.value.items.map((c) => ({ ...c, aliases: [c.email] })),
    input,
    'o contato',
  )
}

export async function lookupConfigItem(
  ctx: AiToolContext,
  input: string,
): Promise<Result<Pick<SdConfigItemDTO, 'id' | 'name' | 'code'>>> {
  if (looksLikeId(input)) return ok({ id: input, name: input, code: null })
  const page = await SdConfigItemService.list(ctx.actorId, ctx.workspaceId, {
    q: input,
    page: 1,
    pageSize: SEARCH_SIZE,
    order: 'asc',
    sort: 'name',
  })
  if (!page.ok) return page
  return resolveNamed(
    page.value.items.map((c) => ({ ...c, aliases: [c.code, c.ipAddress] })),
    input,
    'o item de configuração',
  )
}

export async function lookupKbArticle(
  ctx: AiToolContext,
  input: string,
): Promise<Result<Pick<SdKbSearchResultDTO, 'id' | 'title' | 'status'>>> {
  if (looksLikeId(input)) {
    const article = await SdKbArticleService.getById(
      ctx.actorId,
      ctx.workspaceId,
      input,
    )
    if (!article.ok) return article
    return ok(article.value)
  }
  const found = await SdKbArticleService.search(ctx.actorId, ctx.workspaceId, {
    q: input,
    limit: SEARCH_SIZE,
  })
  if (!found.ok) return found
  const match = resolveNamed(
    found.value.map((a) => ({ ...a, name: a.title })),
    input,
    'o artigo',
  )
  if (match.ok) return match
  // Full-text search ranks by relevance: a single hit is a match even when
  // the title is not literally the text the model sent.
  if (found.value.length === 1) return ok(found.value[0])
  return found.value.length === 0
    ? err(validationError(`Não encontrei o artigo "${input}"`))
    : match
}
