import z from 'zod'
import { isSdPortalToken } from '@/src/lib/servicedesk/portal-session'
import { sdId } from './sd-config.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'

/**
 * Contrato do **portal do contato externo** (`/suporte`, API em
 * `/api/servicedesk/portal/**`). Quem usa é o cliente da Stratus — um
 * `SdContact` sem conta na plataforma —, autenticado por link mágico e por
 * uma sessão própria de 12 horas (nada de Better Auth).
 *
 * Tudo que o contato pode informar passa por aqui; o escopo (quais chamados
 * ele enxerga) é resolvido **no service**, nunca pela entrada.
 */

/** Token do link mágico e da sessão: 32 bytes em base64url. */
export const SdPortalTokenSchema = z
  .string()
  .refine(isSdPortalToken, 'Link de acesso inválido')

/**
 * E-mail normalizado **antes** de validar (o contato digita com espaço e
 * maiúsculas), sempre em minúsculas.
 */
const portalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(255, 'E-mail muito longo')
  .pipe(z.email('Informe um e-mail válido'))

/** O contato pede um link informando o e-mail (resposta sempre genérica). */
export const RequestSdPortalLinkSchema = z.object({
  email: portalEmail,
})
export type RequestSdPortalLinkDTO = z.infer<typeof RequestSdPortalLinkSchema>

/** O agente envia o acesso a um contato do workspace. */
export const IssueSdPortalAccessSchema = z.object({
  contactId: sdId,
  /** Envia para outro endereço que não o cadastrado (ex.: e-mail corporativo). */
  email: portalEmail.optional(),
})
export type IssueSdPortalAccessDTO = z.infer<typeof IssueSdPortalAccessSchema>

/** Abre a sessão a partir do token do link (uso único). */
export const OpenSdPortalSessionSchema = z.object({
  token: SdPortalTokenSchema,
})
export type OpenSdPortalSessionDTO = z.infer<typeof OpenSdPortalSessionSchema>

export const SD_PORTAL_TICKET_STATUSES = ['open', 'closed', 'all'] as const

/** `?status=open&q=impressora&page=1&pageSize=20`. */
export const ListSdPortalTicketsSchema = z.object({
  status: z.enum(SD_PORTAL_TICKET_STATUSES).default('open'),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})
export type ListSdPortalTicketsDTO = z.infer<typeof ListSdPortalTicketsSchema>

/**
 * Abertura pelo portal externo: só os campos que o solicitante informa. O
 * tipo precisa estar em `SdSettings.portalTicketTypes`; catálogo e modelo,
 * marcados como `portalVisible` (conferido pelo motor com `portal: true`).
 */
export const CreateSdPortalTicketSchema = z.object({
  type: SdTicketTypeEnum,
  title: z
    .string()
    .trim()
    .min(1, 'Conte em poucas palavras o que houve')
    .max(200),
  /** Texto puro digitado pelo contato (vira HTML sanitizado no service). */
  description: z
    .string()
    .trim()
    .max(20_000, 'Descrição muito longa')
    .optional(),
  templateId: sdId.optional(),
  categoryId: sdId.optional(),
  subcategoryId: sdId.optional(),
  serviceId: sdId.optional(),
  urgencyId: sdId.optional(),
  customFields: z.record(z.string().max(64), z.unknown()).optional(),
})
export type CreateSdPortalTicketDTO = z.infer<typeof CreateSdPortalTicketSchema>

/** Tamanho do texto de uma resposta do contato no histórico. */
export const SD_PORTAL_MESSAGE_MAX_LENGTH = 10_000
/** Anexos por resposta. */
export const SD_PORTAL_MAX_ATTACHMENTS = 5

/** Resposta do contato no histórico (texto e/ou anexos, sempre pública). */
export const CreateSdPortalMessageSchema = z
  .object({
    body: z
      .string()
      .max(SD_PORTAL_MESSAGE_MAX_LENGTH, 'Mensagem muito longa')
      .transform((value) => value.trim())
      .default(''),
    attachmentCount: z
      .number()
      .int()
      .min(0)
      .max(SD_PORTAL_MAX_ATTACHMENTS)
      .default(0),
  })
  .refine((data) => data.body.length > 0 || data.attachmentCount > 0, {
    message: 'Escreva uma mensagem ou anexe um arquivo',
    path: ['body'],
  })
export type CreateSdPortalMessageDTO = z.infer<
  typeof CreateSdPortalMessageSchema
>

/** `?q=&categoryId=&limit=` na base de conhecimento do portal. */
export const SearchSdPortalKbSchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: sdId.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type SearchSdPortalKbDTO = z.infer<typeof SearchSdPortalKbSchema>
