import { createHash } from 'node:crypto'
import { createId } from '@paralleldrive/cuid2'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  sdSignatureNotFound,
  storageError,
  validationError,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  SD_TICKET_BUCKET,
  sdSignatureKey,
} from '@/src/lib/servicedesk/ticket-files'
import { ensureBucket, getObject, putObject } from '@/src/lib/storage/s3'
import { toSdTicketSignatureDTO } from '@/src/mappers/sd-ticket-signature.mapper'
import {
  SdTicketRepository,
  type SdTicketWithRelations,
} from '@/src/repositories/sd-ticket.repository'
import {
  SdTicketSignatureRepository,
  type SdTicketSignatureTotals,
} from '@/src/repositories/sd-ticket-signature.repository'
import type { CreateSdTicketSignatureDTO } from '@/src/schemas/sd-ticket-signature.schema'
import type {
  SdTicketSignatureDTO,
  SdTicketSignatureVerificationDTO,
} from '@/types/sd-ticket-signature'
import { SdTicketEngine } from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import {
  loadSdTicketTab,
  publishSdTicketTab,
  sdTabAuthorKind,
} from './sd-ticket-tab-support'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** PNG decodificado: até 1,5 MB. */
const MAX_PNG_BYTES = 1.5 * 1024 * 1024
const DEFAULT_PURPOSE = 'Aceite do atendimento'

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex')
}

/** PNG do data URL (já validado pelo schema), ou erro se não for PNG. */
export function decodeSdSignaturePng(dataUrl: string): Result<Buffer> {
  const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  if (
    buffer.byteLength <= PNG_MAGIC.byteLength ||
    !buffer.subarray(0, PNG_MAGIC.byteLength).equals(PNG_MAGIC)
  ) {
    return err(validationError('A assinatura deve ser uma imagem PNG'))
  }
  if (buffer.byteLength > MAX_PNG_BYTES) {
    return err(validationError('Imagem da assinatura muito grande'))
  }
  return ok(buffer)
}

/**
 * Snapshot canônico do chamado no momento da assinatura (ordem de chaves
 * fixa): id, número, título, fase, solução, totais de custos e peças e
 * `updatedAt`. O SHA-256 dele prova o estado que foi aceito.
 */
export function sdTicketSnapshot(
  ticket: Pick<
    SdTicketWithRelations,
    'id' | 'number' | 'title' | 'phase' | 'solution' | 'updatedAt'
  >,
  totals: SdTicketSignatureTotals,
): string {
  return JSON.stringify({
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    phase: {
      id: ticket.phase.id,
      name: ticket.phase.name,
      category: ticket.phase.category,
    },
    solution: ticket.solution,
    costsTotal: totals.costs,
    partsTotal: totals.parts,
    updatedAt: ticket.updatedAt.toISOString(),
  })
}

async function currentTicketHash(
  ticket: SdTicketWithRelations,
): Promise<Result<string>> {
  const totals = await SdTicketSignatureRepository.ticketTotals(ticket.id)
  if (!totals.ok) return totals
  return ok(sha256Hex(sdTicketSnapshot(ticket, totals.value)))
}

async function readImage(key: string): Promise<Buffer | null> {
  try {
    return await getObject({ bucket: SD_TICKET_BUCKET, key })
  } catch {
    return null
  }
}

/**
 * Assinaturas do chamado (canvas → PNG no MinIO). Guarda o SHA-256 do PNG e
 * do snapshot do chamado; `verify` recalcula os dois. Agentes e o próprio
 * solicitante (portal) assinam. O motor exige uma assinatura antes de
 * CLOSED quando `requireSignatureOnClose`.
 */
export const SdTicketSignatureService = {
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketSignatureDTO[]>> {
    const scope = await loadSdTicketTab(actorId, workspaceId, ticketRef, 'VIEW')
    if (!scope.ok) return scope
    const rows = await SdTicketSignatureRepository.list(scope.value.ticket.id)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdTicketSignatureDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    dto: CreateSdTicketSignatureDTO,
  ): Promise<Result<SdTicketSignatureDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'CREATE',
    )
    if (!loaded.ok) return loaded
    const { ctx, ticket } = loaded.value

    const png = decodeSdSignaturePng(dto.image)
    if (!png.ok) return png

    // A atividade entra antes do snapshot: o hash guarda o `updatedAt` final.
    await SdTicketEngine.touchActivity(ticket.id)
    const fresh = await SdTicketRepository.findById(ticket.id, workspaceId)
    if (!fresh.ok) return fresh
    const ticketSha256 = await currentTicketHash(fresh.value)
    if (!ticketSha256.ok) return ticketSha256

    const id = createId()
    const storageKey = sdSignatureKey(workspaceId, ticket.id, id)
    try {
      await ensureBucket(SD_TICKET_BUCKET)
      await putObject({
        bucket: SD_TICKET_BUCKET,
        key: storageKey,
        body: png.value,
        contentType: 'image/png',
      })
    } catch (error) {
      logger.error('servicedesk.signature.persist_failed', {
        workspaceId,
        ticketId: ticket.id,
        message: error instanceof Error ? error.message : String(error),
      })
      return err(storageError('Falha ao armazenar a assinatura'))
    }

    const created = await SdTicketSignatureRepository.create({
      id,
      workspaceId,
      ticketId: ticket.id,
      purpose: dto.purpose ?? DEFAULT_PURPOSE,
      signerName: dto.signerName,
      signerDocument: dto.signerDocument ?? null,
      signerEmail: dto.signerEmail ?? null,
      signedById: actorId,
      storageKey,
      imageSha256: sha256Hex(png.value),
      ticketSha256: ticketSha256.value,
      signedAt: new Date(),
    })
    if (!created.ok) return created

    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: sdTabAuthorKind(ctx),
      actorUserId: actorId,
      action: 'signed',
      toValue: { id, label: created.value.signerName },
      meta: { purpose: created.value.purpose },
    })
    await publishSdTicketTab(ticket, 'ticket.signature', actorId)
    // LGPD: nome/documento de quem assinou não vão para o log.
    auditMutation({
      entity: 'sd_ticket_signature',
      action: 'sign',
      actorId,
      targetId: id,
      meta: { workspaceId, ticketId: ticket.id, byRequester: !ctx.isAgent },
    })
    return ok(toSdTicketSignatureDTO(created.value))
  },

  /** PNG da assinatura (a rota serve com `image/png`). */
  async image(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    signatureId: string,
  ): Promise<Result<Buffer>> {
    const scope = await loadSdTicketTab(actorId, workspaceId, ticketRef, 'VIEW')
    if (!scope.ok) return scope
    const row = await SdTicketSignatureRepository.findById(
      signatureId,
      scope.value.ticket.id,
    )
    if (!row.ok) return row
    const body = await readImage(row.value.storageKey)
    if (!body) return err(sdSignatureNotFound())
    return ok(body)
  },

  /** Recalcula o SHA-256 do PNG armazenado e do chamado atual. */
  async verify(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    signatureId: string,
  ): Promise<Result<SdTicketSignatureVerificationDTO>> {
    const scope = await loadSdTicketTab(actorId, workspaceId, ticketRef, 'VIEW')
    if (!scope.ok) return scope
    const { ticket } = scope.value
    const row = await SdTicketSignatureRepository.findById(
      signatureId,
      ticket.id,
    )
    if (!row.ok) return row
    const current = await currentTicketHash(ticket)
    if (!current.ok) return current

    const body = await readImage(row.value.storageKey)
    const computed = body ? sha256Hex(body) : null
    const imageIntact = computed === row.value.imageSha256
    if (!imageIntact) {
      logger.warn('servicedesk.signature.integrity_mismatch', {
        workspaceId,
        ticketId: ticket.id,
        signatureId,
        missing: computed === null,
      })
    }
    return ok({
      signatureId,
      imageIntact,
      storedImageSha256: row.value.imageSha256,
      computedImageSha256: computed,
      ticketUnchanged: current.value === row.value.ticketSha256,
      signedTicketSha256: row.value.ticketSha256,
      currentTicketSha256: current.value,
      verifiedAt: new Date().toISOString(),
    })
  },
}
