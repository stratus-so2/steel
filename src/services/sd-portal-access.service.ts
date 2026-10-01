import type { SdSettings } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  notFound,
  sdPortalContactInactive,
  sdPortalDisabled,
  sdPortalLinkExpired,
  sdPortalLinkInvalid,
  sdPortalSessionExpired,
  validationError,
  workspaceSuspended,
} from '@/src/errors'
import { sendSdPortalAccessEmail } from '@/src/lib/mail/servicedesk/send-sd-portal-access'
import { err, ok, type Result } from '@/src/lib/result'
import {
  hashSdPortalToken,
  newSdPortalToken,
  sdPortalHomeUrl,
  sdPortalLinkExpiry,
  sdPortalLinkUrl,
  sdPortalSessionExpiry,
} from '@/src/lib/servicedesk/portal-session'
import {
  resolveSdTicketPrefixes,
  type SdTicketPrefixes,
} from '@/src/lib/servicedesk/ticket-code'
import {
  toSdPortalAccessDTO,
  toSdPortalCustomerDTOs,
} from '@/src/mappers/sd-portal.mapper'
import {
  type SdPortalAccessWithContact,
  type SdPortalContactRow,
  SdPortalRepository,
} from '@/src/repositories/sd-portal.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import type {
  IssueSdPortalAccessDTO,
  RequestSdPortalLinkDTO,
} from '@/src/schemas/sd-portal.schema'
import type {
  SdPortalAccessDTO,
  SdPortalCustomerDTO,
  SdPortalSessionDTO,
} from '@/types/sd-portal'
import { SdAccess } from './sd-access'

/**
 * Acesso ao **portal do contato externo** (`/suporte`): emissão do link
 * mágico, abertura da sessão própria, resolução da sessão a cada requisição
 * e revogação.
 *
 * Regras (ver `docs/servicedesk/README.md`):
 * - o agente envia o acesso a um contato **ou** o próprio contato pede pelo
 *   endereço público informando o e-mail — neste caso a resposta é sempre
 *   genérica, para não revelar se o e-mail existe em algum workspace;
 * - token aleatório de 32 bytes, guardado **só como SHA-256**, válido 7 dias
 *   e de **uso único** (`usedAt`), revogável a qualquer momento;
 * - abrir o link cria uma sessão de **12 horas**, também guardada como hash
 *   (`sessionHash`); expirada, o contato pede outro link;
 * - emissão, consumo e revogação são auditados (`sd_portal_access`), sem
 *   nunca logar o token.
 */

const EXPIRES_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
})

/** Links listados na tela do contato. */
const ACCESS_HISTORY_LIMIT = 20

/** Quem está no portal, já com o escopo que o service aplica nas consultas. */
export interface SdPortalSessionContext {
  accessId: string
  contact: { id: string; name: string; email: string | null }
  workspace: { id: string; name: string; slug: string }
  customers: SdPortalCustomerDTO[]
  /**
   * Ids das empresas do contato quando `portalCompanyScope` está ligado;
   * vazio quando ele só vê os chamados em que é o contato.
   */
  customerIds: string[]
  companyScope: boolean
  settings: SdSettings
  prefixes: SdTicketPrefixes
  /** Fim da sessão de 12 horas. */
  expiresAt: Date
}

function label(date: Date): string {
  return EXPIRES_FORMAT.format(date)
}

/** Contato apto a usar o portal (ativo, não excluído). */
function assertUsableContact(
  contact: Pick<SdPortalContactRow, 'active' | 'deletedAt'>,
): Result<void> {
  if (!contact.active || contact.deletedAt !== null) {
    return err(sdPortalContactInactive())
  }
  return ok(undefined)
}

/** Grava o link e manda o e-mail. Devolve o registro criado. */
async function issueLink(params: {
  contact: SdPortalContactRow
  email: string
  requestedById: string | null
  requestedByName: string | null
  workspace: { id: string; name: string; slug: string }
  now: Date
}): Promise<Result<SdPortalAccessDTO>> {
  const { token, hash } = newSdPortalToken()
  const expiresAt = sdPortalLinkExpiry(params.now)

  // Um link válido por vez: emitir outro invalida os pendentes.
  await SdPortalRepository.revokePending(params.contact.id, params.now)

  const created = await SdPortalRepository.createAccess({
    workspaceId: params.workspace.id,
    contactId: params.contact.id,
    tokenHash: hash,
    email: params.email,
    requestedById: params.requestedById,
    expiresAt,
  })
  if (!created.ok) {
    auditMutation({
      entity: 'sd_portal_access',
      action: 'create',
      actorId: params.requestedById,
      outcome: 'failure',
      reason: created.error.code,
      meta: {
        workspaceId: params.workspace.id,
        contactId: params.contact.id,
      },
    })
    return created
  }

  try {
    await sendSdPortalAccessEmail({
      email: params.email,
      contactName: params.contact.name,
      workspaceName: params.workspace.name,
      sentByName: params.requestedByName,
      expiresAtLabel: label(expiresAt),
      accessUrl: sdPortalLinkUrl(token),
      supportUrl: sdPortalHomeUrl(),
    })
  } catch (error) {
    logger.error('servicedesk.portal.access_email_failed', {
      workspaceId: params.workspace.id,
      contactId: params.contact.id,
      accessId: created.value.id,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  auditMutation({
    entity: 'sd_portal_access',
    action: 'create',
    actorId: params.requestedById,
    targetId: created.value.id,
    meta: {
      workspaceId: params.workspace.id,
      contactId: params.contact.id,
      selfService: params.requestedById === null,
      expiresAt: expiresAt.toISOString(),
    },
  })
  logger.info('servicedesk.portal.access_issued', {
    workspaceId: params.workspace.id,
    contactId: params.contact.id,
    accessId: created.value.id,
    selfService: params.requestedById === null,
  })

  return ok(toSdPortalAccessDTO(created.value, params.now))
}

/** Escopo de empresas do contato, conforme a configuração do workspace. */
function scopeFor(
  contact: SdPortalContactRow,
  settings: SdSettings,
): { customers: SdPortalCustomerDTO[]; customerIds: string[] } {
  const customers = toSdPortalCustomerDTOs(contact)
  return {
    customers,
    customerIds: settings.portalCompanyScope
      ? customers.map((customer) => customer.id)
      : [],
  }
}

/** Monta o contexto da sessão — não falha: só reorganiza o que já veio. */
function buildContext(
  access: SdPortalAccessWithContact,
  settings: SdSettings,
): SdPortalSessionContext {
  const { customers, customerIds } = scopeFor(access.contact, settings)
  return {
    accessId: access.id,
    contact: {
      id: access.contact.id,
      name: access.contact.name,
      email: access.contact.email,
    },
    workspace: {
      id: access.workspace.id,
      name: access.workspace.name,
      slug: access.workspace.slug,
    },
    customers,
    customerIds,
    companyScope: settings.portalCompanyScope,
    settings,
    prefixes: resolveSdTicketPrefixes(settings.ticketPrefixes),
    expiresAt: access.sessionExpiresAt ?? new Date(0),
  }
}

export const SdPortalAccessService = {
  /**
   * O agente envia o acesso a um contato do workspace (botão na tela do
   * contato e na do chamado). Requer agente com `sd-contacts` × `EDIT`.
   */
  async issue(
    actorId: string,
    workspaceId: string,
    dto: IssueSdPortalAccessDTO,
  ): Promise<Result<SdPortalAccessDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-contacts',
      action: 'EDIT',
    })
    if (!ctx.ok) return ctx

    const settings = await SdTicketContextRepository.ensureSettings(workspaceId)
    if (!settings.ok) return settings
    if (!settings.value.portalEnabled) return err(sdPortalDisabled())

    const contact = await SdPortalRepository.findContact(
      dto.contactId,
      workspaceId,
    )
    if (!contact.ok) return contact
    const usable = assertUsableContact(contact.value)
    if (!usable.ok) return usable

    const email = dto.email ?? contact.value.email?.trim().toLowerCase()
    if (!email) {
      return err(validationError('Este contato não tem e-mail cadastrado'))
    }

    const workspace = await SdTicketContextRepository.findWorkspace(workspaceId)
    if (!workspace.ok) return workspace
    if (!workspace.value) return err(notFound('Workspace'))

    const actor = await SdTicketContextRepository.findUserNames([actorId])
    const requestedByName = actor.ok
      ? (actor.value.get(actorId)?.name ?? null)
      : null

    return issueLink({
      contact: contact.value,
      email,
      requestedById: actorId,
      requestedByName,
      workspace: workspace.value,
      now: new Date(),
    })
  },

  /**
   * O próprio contato pede o link no endereço público informando o e-mail.
   * **Sempre devolve sucesso** (e a mesma mensagem), exista ou não o
   * e-mail: a tela pública não pode servir para descobrir clientes. Um link
   * por workspace em que o e-mail é um contato ativo com o portal ligado.
   */
  async requestByEmail(
    dto: RequestSdPortalLinkDTO,
  ): Promise<Result<{ sent: number }>> {
    const contacts = await SdPortalRepository.findActiveContactsByEmail(
      dto.email,
    )
    if (!contacts.ok) {
      logger.error('servicedesk.portal.link_request_failed', {
        reason: contacts.error.code,
      })
      return ok({ sent: 0 })
    }

    const now = new Date()
    let sent = 0
    for (const contact of contacts.value) {
      const settings = await SdTicketContextRepository.ensureSettings(
        contact.workspaceId,
      )
      if (!settings.ok || !settings.value.portalEnabled) continue
      const workspace = await SdTicketContextRepository.findWorkspace(
        contact.workspaceId,
      )
      if (!workspace.ok || !workspace.value) continue

      const issued = await issueLink({
        contact,
        email: dto.email,
        requestedById: null,
        requestedByName: null,
        workspace: workspace.value,
        now,
      })
      if (issued.ok) sent += 1
    }

    logger.info('servicedesk.portal.link_requested', { matches: sent })
    return ok({ sent })
  },

  /**
   * Consome o link e abre a sessão de 12 horas. Devolve o token da sessão
   * (vai para o cookie) — o banco só guarda o hash. Uso único: a condição
   * está no `UPDATE`, então dois cliques simultâneos não abrem duas sessões.
   */
  async openSession(token: string): Promise<
    Result<{
      sessionToken: string
      expiresAt: Date
      session: SdPortalSessionDTO
      context: SdPortalSessionContext
    }>
  > {
    const found = await SdPortalRepository.findByTokenHash(
      hashSdPortalToken(token),
    )
    if (!found.ok) return found
    const access = found.value
    if (!access || access.revokedAt !== null) {
      return err(sdPortalLinkInvalid())
    }
    if (access.usedAt !== null) {
      return err(
        sdPortalLinkInvalid('Este link já foi usado. Peça um novo acesso'),
      )
    }

    const now = new Date()
    if (access.expiresAt.getTime() <= now.getTime()) {
      return err(sdPortalLinkExpired())
    }
    if (access.workspace.status !== 'ACTIVE') {
      return err(workspaceSuspended())
    }
    const usable = assertUsableContact(access.contact)
    if (!usable.ok) return usable

    const settings = await SdTicketContextRepository.ensureSettings(
      access.workspaceId,
    )
    if (!settings.ok) return settings
    if (!settings.value.portalEnabled) return err(sdPortalDisabled())

    const { token: sessionToken, hash } = newSdPortalToken()
    const expiresAt = sdPortalSessionExpiry(now)
    const consumed = await SdPortalRepository.consume({
      id: access.id,
      usedAt: now,
      sessionHash: hash,
      sessionExpiresAt: expiresAt,
    })
    if (!consumed.ok) return consumed
    if (!consumed.value) {
      return err(
        sdPortalLinkInvalid('Este link já foi usado. Peça um novo acesso'),
      )
    }

    const context = buildContext(
      { ...access, usedAt: now, sessionExpiresAt: expiresAt },
      settings.value,
    )

    auditMutation({
      entity: 'sd_portal_session',
      action: 'create',
      actorId: null,
      targetId: access.id,
      meta: {
        workspaceId: access.workspaceId,
        contactId: access.contactId,
        expiresAt: expiresAt.toISOString(),
      },
    })
    logger.info('servicedesk.portal.session_opened', {
      workspaceId: access.workspaceId,
      contactId: access.contactId,
      accessId: access.id,
    })

    return ok({
      sessionToken,
      expiresAt,
      session: SdPortalAccessService.toSessionDTO(context),
      context,
    })
  },

  /**
   * Resolve a sessão a partir do token do cookie. Expirada, revogada,
   * contato desativado ou portal desligado ⇒ erro próprio, e a tela pede
   * outro link.
   */
  async resolveSession(
    sessionToken: string,
  ): Promise<Result<SdPortalSessionContext>> {
    const found = await SdPortalRepository.findBySessionHash(
      hashSdPortalToken(sessionToken),
    )
    if (!found.ok) return found
    const access = found.value
    if (!access || access.revokedAt !== null) {
      return err(sdPortalSessionExpired())
    }
    if (
      access.sessionExpiresAt === null ||
      access.sessionExpiresAt.getTime() <= Date.now()
    ) {
      return err(sdPortalSessionExpired())
    }
    if (access.workspace.status !== 'ACTIVE') {
      return err(workspaceSuspended())
    }
    const usable = assertUsableContact(access.contact)
    if (!usable.ok) return usable

    const settings = await SdTicketContextRepository.ensureSettings(
      access.workspaceId,
    )
    if (!settings.ok) return settings
    if (!settings.value.portalEnabled) return err(sdPortalDisabled())

    return ok(buildContext(access, settings.value))
  },

  /** Recorte da sessão que a UI pública recebe. */
  toSessionDTO(context: SdPortalSessionContext): SdPortalSessionDTO {
    return {
      contact: context.contact,
      workspace: context.workspace,
      customers: context.customers,
      expiresAt: context.expiresAt.toISOString(),
      companyScope: context.companyScope,
      ticketTypes: context.settings.portalTicketTypes,
    }
  },

  /** Sair do portal: encerra a sessão (o link já estava consumido). */
  async closeSession(sessionToken: string): Promise<Result<void>> {
    const found = await SdPortalRepository.findBySessionHash(
      hashSdPortalToken(sessionToken),
    )
    if (!found.ok) return found
    if (!found.value) return ok(undefined)

    const closed = await SdPortalRepository.closeSession(found.value.id)
    if (!closed.ok) return closed
    auditMutation({
      entity: 'sd_portal_session',
      action: 'delete',
      actorId: null,
      targetId: found.value.id,
      meta: {
        workspaceId: found.value.workspaceId,
        contactId: found.value.contactId,
      },
    })
    return ok(undefined)
  },

  /** Links emitidos para um contato (tela do contato, visão do agente). */
  async listForContact(
    actorId: string,
    workspaceId: string,
    contactId: string,
  ): Promise<Result<SdPortalAccessDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-contacts',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx

    const contact = await SdPortalRepository.findContact(contactId, workspaceId)
    if (!contact.ok) return contact

    const rows = await SdPortalRepository.listByContact(
      workspaceId,
      contactId,
      ACCESS_HISTORY_LIMIT,
    )
    if (!rows.ok) return rows
    const now = new Date()
    return ok(rows.value.map((row) => toSdPortalAccessDTO(row, now)))
  },

  /** Revoga um link (e derruba a sessão aberta por ele). */
  async revoke(
    actorId: string,
    workspaceId: string,
    accessId: string,
  ): Promise<Result<SdPortalAccessDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-contacts',
      action: 'EDIT',
    })
    if (!ctx.ok) return ctx

    const revoked = await SdPortalRepository.revoke(
      accessId,
      workspaceId,
      new Date(),
    )
    if (!revoked.ok) return revoked
    if (!revoked.value) return err(notFound('SdPortalAccess'))

    auditMutation({
      entity: 'sd_portal_access',
      action: 'revoke',
      actorId,
      targetId: accessId,
      meta: { workspaceId, contactId: revoked.value.contactId },
    })
    logger.info('servicedesk.portal.access_revoked', {
      workspaceId,
      accessId,
      contactId: revoked.value.contactId,
    })
    return ok(toSdPortalAccessDTO(revoked.value))
  },
}
