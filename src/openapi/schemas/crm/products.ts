import { z } from 'zod'
import { dto } from '../../common'

/** DTOs do catálogo de produtos do CRM (`types/crm-product.d.ts`). */

export const CrmBillingTypeEnum = z
  .enum(['ONE_TIME', 'MONTHLY', 'YEARLY'])
  .meta({ description: 'Cobrança: avulsa, mensal ou anual.' })

export const CrmProductDTO = dto(
  'CrmProduct',
  z.object({
    id: z.string().meta({ example: 'ckw1prod0000ab7d3k1e5xyz' }),
    workspaceId: z.string(),
    name: z.string().meta({ example: 'Licença ServiceDesk' }),
    sku: z.string().nullable().meta({
      description: 'Código do produto — único no workspace quando informado.',
      example: 'SD-LIC-01',
    }),
    description: z.string().nullable(),
    unitPrice: z.number().meta({ example: 199.9 }),
    currency: z.string().meta({ example: 'BRL' }),
    billingType: CrmBillingTypeEnum,
    active: z.boolean(),
    position: z.number(),
    createdById: z.string(),
    updatedById: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
)
