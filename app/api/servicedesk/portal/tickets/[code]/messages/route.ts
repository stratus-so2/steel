import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { badRequest } from '@/src/errors'
import { SD_ATTACHMENT_MAX_BYTES } from '@/src/lib/servicedesk/ticket-files'
import {
  CreateSdPortalMessageSchema,
  SD_PORTAL_MAX_ATTACHMENTS,
} from '@/src/schemas/sd-portal.schema'
import {
  SdPortalService,
  type SdPortalUpload,
} from '@/src/services/sd-portal.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'
import { consumePortalWrite, portalSession } from '../../../_support'

type Params = { params: Promise<{ code: string }> }

/** Folga do multipart (boundary e cabeçalhos) sobre o limite dos arquivos. */
const MAX_UPLOAD_BYTES =
  SD_ATTACHMENT_MAX_BYTES * SD_PORTAL_MAX_ATTACHMENTS + 1024 * 1024

/** `multipart/form-data` com `body` e até 5 campos `files`. */
async function readMultipart(
  request: NextRequest,
): Promise<{ body: unknown; uploads: SdPortalUpload[] } | null> {
  const form = await request.formData().catch(() => null)
  if (!form) return null
  const files = form
    .getAll('files')
    .filter((entry): entry is File => entry instanceof File)
  if (files.length > SD_PORTAL_MAX_ATTACHMENTS) return null
  const uploads: SdPortalUpload[] = []
  for (const file of files) {
    uploads.push({
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      fileName: file.name,
    })
  }
  const body = form.get('body')
  return {
    body: {
      body: typeof body === 'string' ? body : '',
      attachmentCount: uploads.length,
    },
    uploads,
  }
}

/**
 * Resposta do contato no histórico do chamado. Aceita JSON (`{ body }`) ou
 * `multipart/form-data` com `body` + `files` (até 5 arquivos, 25 MB cada).
 * A mensagem é sempre pública, com autor `CONTACT`; em chamado resolvido,
 * reabre quando `reopenOnRequesterReply` está ligado.
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const session = await portalSession()
  if (!session.ok) return handleError(session.error)

  const limit = await consumePortalWrite(request, session.value.contact.id)
  if (!limit.ok) return handleError(limit.error)

  const contentType = request.headers.get('content-type') ?? ''
  let raw: unknown
  let uploads: SdPortalUpload[] = []

  if (contentType.includes('multipart/form-data')) {
    const length = Number(request.headers.get('content-length') ?? '0')
    if (length > MAX_UPLOAD_BYTES) {
      return handleError(badRequest('Arquivos muito grandes'))
    }
    const parsedForm = await readMultipart(request)
    if (!parsedForm) {
      return handleError(badRequest('Envio inválido. Tente de novo'))
    }
    raw = parsedForm.body
    uploads = parsedForm.uploads
  } else {
    const json = await readJsonBody(request)
    if (!json.ok) return handleError(json.error)
    raw = json.value
  }

  const parsed = CreateSdPortalMessageSchema.safeParse(raw)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const { code } = await ctx.params
  const created = await SdPortalService.reply(
    session.value,
    code,
    parsed.data,
    uploads,
  )
  if (!created.ok) return handleError(created.error)
  return successResponse(created.value, 201)
})
