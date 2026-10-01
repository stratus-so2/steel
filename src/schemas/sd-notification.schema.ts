import z from 'zod'
import { SD_NOTIFICATION_EVENTS } from '@/src/config/servicedesk-notifications'
import { sdId } from './sd-config.schema'

/**
 * Central de notificações do ServiceDesk: preferências por usuário
 * (evento × canal) e quem segue um chamado. O catálogo
 * (`src/config/servicedesk-notifications.ts`) é a fonte da verdade dos
 * eventos — aqui só validamos que a chave existe nele.
 */

export const SdNotificationChannelEnum = z.enum(['IN_APP', 'EMAIL', 'WHATSAPP'])
export type SdNotificationChannelDTO = z.infer<typeof SdNotificationChannelEnum>

const EVENT_KEYS = SD_NOTIFICATION_EVENTS.map((event) => event.key)

export const sdNotificationEventKey = z
  .string()
  .refine((value) => EVENT_KEYS.includes(value), 'Evento desconhecido')

/** Uma célula da matriz evento × canal. */
export const SdNotificationPreferenceItemSchema = z.object({
  event: sdNotificationEventKey,
  channel: SdNotificationChannelEnum,
  enabled: z.boolean(),
})
export type SdNotificationPreferenceItemDTO = z.infer<
  typeof SdNotificationPreferenceItemSchema
>

/** Teto generoso: a matriz inteira tem evento × canal células. */
const MAX_ITEMS = SD_NOTIFICATION_EVENTS.length * 3

/**
 * Salva um pedaço da matriz. `items` vazio não faz nada; para voltar aos
 * padrões do catálogo use `DELETE` (apaga as linhas salvas).
 */
export const UpdateSdNotificationPreferencesSchema = z.object({
  items: z
    .array(SdNotificationPreferenceItemSchema)
    .max(MAX_ITEMS, 'Preferências demais numa chamada')
    .default([]),
})
export type UpdateSdNotificationPreferencesDTO = z.infer<
  typeof UpdateSdNotificationPreferencesSchema
>

/** Agentes citados numa mensagem (`@`), validados contra o workspace. */
export const SD_MESSAGE_MAX_MENTIONS = 20

export const SdMessageMentionsSchema = z
  .array(sdId)
  .max(SD_MESSAGE_MAX_MENTIONS, 'Menções demais numa mensagem')
  .optional()
