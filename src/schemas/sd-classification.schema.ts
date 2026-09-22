import z from 'zod'
import {
  booleanQuery,
  sdColor,
  sdDescription,
  sdName,
} from './sd-config.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'

export const SdClassificationKindEnum = z.enum(['TICKET', 'SOLUTION'])

const ticketTypes = z
  .array(SdTicketTypeEnum)
  .max(4)
  .transform((types) => [...new Set(types)])

export const CreateSdClassificationSchema = z.object({
  kind: SdClassificationKindEnum,
  name: sdName,
  description: sdDescription,
  color: sdColor,
  ticketTypes: ticketTypes.default([]),
  active: z.boolean().default(true),
})
export type CreateSdClassificationDTO = z.infer<
  typeof CreateSdClassificationSchema
>

export const UpdateSdClassificationSchema = z
  .object({
    name: sdName.optional(),
    description: sdDescription,
    color: sdColor,
    ticketTypes: ticketTypes.optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdClassificationDTO = z.infer<
  typeof UpdateSdClassificationSchema
>

export const ListSdClassificationsSchema = z.object({
  kind: SdClassificationKindEnum.optional(),
  includeInactive: booleanQuery,
})
export type ListSdClassificationsDTO = z.infer<
  typeof ListSdClassificationsSchema
>
