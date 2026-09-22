import { z } from 'zod'
import { dto } from '../../common'

/**
 * DTOs dos cadastros do ServiceDesk (`types/sd-customer.d.ts`,
 * `sd-contact.d.ts`, `sd-config-item.d.ts`, `sd-directory.d.ts`,
 * `sd-cep.d.ts`).
 */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()
const text = () => z.string().nullable()

const customFields = z
  .record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
    ]),
  )
  .meta({ description: 'Valores de campos customizados `{ chave: valor }`.' })

export const SdOptionDTO = dto(
  'SdOption',
  z
    .object({
      id: z.string(),
      label: z.string(),
      sublabel: text(),
    })
    .meta({ description: 'Item dos seletores leves (combobox).' }),
)

export const SdLinkedTicketDTO = dto(
  'SdLinkedTicket',
  z.object({
    id: z.string(),
    number: z.number().int(),
    type: z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM']),
    title: z.string(),
    phaseName: z.string(),
    phaseCategory: z.enum([
      'NEW',
      'IN_PROGRESS',
      'WAITING',
      'RESOLVED',
      'CLOSED',
      'CANCELED',
    ]),
    createdAt: dateTime(),
  }),
)

export const SdCepAddressDTO = dto(
  'SdCepAddress',
  z.object({
    zipCode: z.string().meta({ example: '01001000' }),
    street: text(),
    complement: text(),
    district: text(),
    city: text(),
    state: text(),
    ibgeCode: text(),
  }),
)

const customerKind = z.enum(['CLIENT', 'COMPANY'])

export const SdCustomerDTO = dto(
  'SdCustomer',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    kind: customerKind,
    personType: z.enum(['INDIVIDUAL', 'LEGAL']),
    name: z.string(),
    tradeName: text(),
    document: text().meta({ description: 'CPF/CNPJ sem máscara.' }),
    email: text(),
    phone: text().meta({ description: 'Só dígitos com DDI.' }),
    whatsapp: text(),
    zipCode: text(),
    street: text(),
    number: text(),
    complement: text(),
    district: text(),
    city: text(),
    state: text(),
    country: z.string(),
    ibgeCode: text(),
    notes: text(),
    customFields,
    active: z.boolean(),
    contactsCount: z.number().int(),
    configItemsCount: z.number().int(),
    createdById: z.string(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdCustomerDetailDTO = dto(
  'SdCustomerDetail',
  SdCustomerDTO.extend({
    contacts: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        jobTitle: text(),
        email: text(),
        phone: text(),
        whatsapp: text(),
        isPrimary: z.boolean(),
      }),
    ),
    recentTickets: z.array(SdLinkedTicketDTO),
  }),
)

export const SdContactDTO = dto(
  'SdContact',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    jobTitle: text(),
    email: text(),
    phone: text(),
    whatsapp: text(),
    userId: text(),
    user: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        image: text(),
      })
      .nullable(),
    notes: text(),
    customFields,
    active: z.boolean(),
    customers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: customerKind,
        isPrimary: z.boolean(),
      }),
    ),
    createdById: z.string(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdContactDetailDTO = dto(
  'SdContactDetail',
  SdContactDTO.extend({ recentTickets: z.array(SdLinkedTicketDTO) }),
)

const attributeDefinition = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'date', 'select', 'boolean']),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
})

export const SdConfigItemTypeDTO = dto(
  'SdConfigItemType',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    icon: text(),
    color: text(),
    attributeSchema: z.array(attributeDefinition),
    position: z.number().int(),
    itemsCount: z.number().int(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

const ciStatus = z.enum([
  'PLANNED',
  'IN_STOCK',
  'ACTIVE',
  'MAINTENANCE',
  'RETIRED',
])
const ciRef = z.object({ id: z.string(), name: z.string(), code: text() })

export const SdConfigItemDTO = dto(
  'SdConfigItem',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    code: text(),
    status: ciStatus,
    criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
    typeId: text(),
    type: z
      .object({
        id: z.string(),
        name: z.string(),
        icon: text(),
        color: text(),
      })
      .nullable(),
    parentId: text(),
    parent: ciRef.nullable(),
    customerId: text(),
    customer: z
      .object({ id: z.string(), name: z.string(), kind: customerKind })
      .nullable(),
    departmentId: text(),
    department: z.object({ id: z.string(), name: z.string() }).nullable(),
    ownerId: text(),
    owner: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        image: text(),
      })
      .nullable(),
    serialNumber: text(),
    manufacturer: text(),
    model: text(),
    location: text(),
    ipAddress: text(),
    purchasedAt: nullableDateTime(),
    warrantyUntil: nullableDateTime(),
    attributes: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean()]),
    ),
    customFields,
    notes: text(),
    childrenCount: z.number().int(),
    createdById: z.string(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdConfigItemDetailDTO = dto(
  'SdConfigItemDetail',
  SdConfigItemDTO.extend({
    ancestors: z
      .array(ciRef)
      .meta({ description: 'Cadeia de pais, da raiz até o pai direto.' }),
    children: z.array(
      ciRef.extend({
        status: ciStatus,
        typeName: text(),
        childrenCount: z.number().int(),
      }),
    ),
    recentTickets: z.array(SdLinkedTicketDTO),
  }),
)

/** Página `{ items, total, page, pageSize }`. */
export function sdPage<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  })
}
