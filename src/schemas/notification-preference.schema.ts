import { z } from 'zod'
import { configurableNotificationKinds } from '@/src/lib/notification-kind'

/**
 * Kinds the user can mute: everything outside the ServiceDesk (which keeps
 * its own per-event preferences). Derived from the catalog, so a kind added
 * there shows up here without touching this file.
 */
export const CONFIGURABLE_NOTIFICATION_KINDS =
  configurableNotificationKinds().map((info) => info.kind)

export const NotificationPreferenceItemSchema = z.object({
  kind: z.enum(CONFIGURABLE_NOTIFICATION_KINDS, {
    error: 'Tipo de notificação inválido',
  }),
  inApp: z.boolean(),
})

export const UpdateNotificationPreferencesSchema = z.object({
  preferences: z.array(NotificationPreferenceItemSchema).min(1).max(100),
})

export type UpdateNotificationPreferencesDTO = z.infer<
  typeof UpdateNotificationPreferencesSchema
>

/** Delivery channels of the inbox (kind-agnostic): browser notifications. */
export const UpdateNotificationDeliverySchema = z.object({
  browserEnabled: z.boolean(),
})

export type UpdateNotificationDeliveryDTO = z.infer<
  typeof UpdateNotificationDeliverySchema
>
