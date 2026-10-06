import { z } from 'zod'
import { ok } from '@/src/lib/result'
import { SdConfigItemStatusEnum } from '@/src/schemas/sd-config-item.schema'
import { SdConfigItemService } from '@/src/services/sd-config-item.service'
import { SdContactService } from '@/src/services/sd-contact.service'
import { SdCustomerService } from '@/src/services/sd-customer.service'
import type { SteelAiTool } from '../types'
import { lookupConfigItem, lookupCustomer } from './lookups'
import {
  flattenCatalog,
  flattenDepartments,
  limitParameter,
  limitSchema,
  loadSdConfig,
  normalizeName,
  PRACTICE_LABELS,
  pageParameter,
  pageSchema,
  practiceParameter,
  practiceSchema,
  refSchema,
  SD_MODULE,
  sdBasePath,
  sdHref,
  zodParser,
} from './shared'

/**
 * Catalog, CMDB and directory lookups. Customer documents (CPF/CNPJ) and
 * full addresses are never returned — the model gets what an agent needs to
 * identify and reach the record.
 */

/* --------------------------------- catalog ------------------------------- */

const CatalogArgs = z.object({
  query: z.string().trim().max(200).optional(),
  practice: practiceSchema.optional(),
  limit: limitSchema,
})

export const sdCatalogTool: SteelAiTool<z.infer<typeof CatalogArgs>> = {
  name: 'sd_catalog',
  label: 'Consultando o catálogo de serviços',
  module: SD_MODULE,
  kind: 'READ',
  description:
    'Catálogo de serviços do ServiceDesk (categoria > subcategoria > serviço) com o caminho completo, práticas aceitas e o departamento que atende. `query` filtra por nome em qualquer nível; `practice` pelas práticas aceitas. Use antes de abrir um chamado para escolher o serviço.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      practice: practiceParameter,
      limit: limitParameter,
    },
    additionalProperties: false,
  },
  permission: { resource: 'sd-tickets', action: 'VIEW' },
  parse: zodParser(CatalogArgs),
  async execute(ctx, args) {
    const config = await loadSdConfig(ctx)
    if (!config.ok) return config
    const departments = new Map(
      flattenDepartments(config.value).map((d) => [d.id, d.name]),
    )
    const needle = args.query ? normalizeName(args.query) : null
    const entries = flattenCatalog(config.value)
      .filter((e) => e.active)
      .filter(
        (e) =>
          !args.practice ||
          e.ticketTypes.length === 0 ||
          e.ticketTypes.includes(args.practice),
      )
      .filter((e) => !needle || normalizeName(e.path).includes(needle))
    return ok({
      data: {
        total: entries.length,
        items: entries.slice(0, args.limit).map((e) => ({
          id: e.id,
          level: e.level,
          path: e.path,
          practices:
            e.ticketTypes.length > 0
              ? e.ticketTypes.map((t) => PRACTICE_LABELS[t])
              : 'todas',
          department: e.departmentId
            ? (departments.get(e.departmentId) ?? null)
            : null,
          description: e.description,
        })),
      },
      summary: `${entries.length} item(ns) do catálogo`,
    })
  },
}

/* ---------------------------------- CMDB --------------------------------- */

const CiSearchArgs = z.object({
  query: z.string().trim().max(200).optional(),
  status: SdConfigItemStatusEnum.optional(),
  customer: refSchema.optional(),
  limit: limitSchema,
  page: pageSchema,
})

export const sdSearchConfigItemsTool: SteelAiTool<
  z.infer<typeof CiSearchArgs>
> = {
  name: 'sd_search_config_items',
  label: 'Consultando a CMDB',
  module: SD_MODULE,
  kind: 'READ',
  description:
    'Busca itens de configuração (CMDB) por nome, código, série, fabricante, modelo, local ou IP; filtros de status (PLANNED, IN_STOCK, ACTIVE, MAINTENANCE, RETIRED) e cliente.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      status: {
        type: 'string',
        enum: ['PLANNED', 'IN_STOCK', 'ACTIVE', 'MAINTENANCE', 'RETIRED'],
      },
      customer: { type: 'string', description: 'Cliente (nome ou id).' },
      limit: limitParameter,
      page: pageParameter,
    },
    additionalProperties: false,
  },
  permission: { resource: 'sd-config-items', action: 'VIEW' },
  parse: zodParser(CiSearchArgs),
  async execute(ctx, args) {
    let customerId: string | undefined
    if (args.customer) {
      const customer = await lookupCustomer(ctx, args.customer)
      if (!customer.ok) return customer
      customerId = customer.value.id
    }
    const [page, base] = await Promise.all([
      SdConfigItemService.list(ctx.actorId, ctx.workspaceId, {
        q: args.query,
        status: args.status,
        customerId,
        page: args.page,
        pageSize: args.limit,
        order: 'asc',
        sort: 'name',
      }),
      sdBasePath(ctx),
    ])
    if (!page.ok) return page
    if (!base.ok) return base
    return ok({
      data: {
        total: page.value.total,
        page: args.page,
        hasMore: args.page * args.limit < page.value.total,
        items: page.value.items.map((ci) => ({
          id: ci.id,
          name: ci.name,
          code: ci.code,
          type: ci.type?.name ?? null,
          status: ci.status,
          criticality: ci.criticality,
          customer: ci.customer?.name ?? null,
          department: ci.department?.name ?? null,
          ipAddress: ci.ipAddress,
          location: ci.location,
        })),
        href: sdHref.page(base.value, 'config-items'),
      },
      summary: `${page.value.total} item(ns) de configuração`,
    })
  },
}

const CiGetArgs = z.object({ configItem: refSchema })

export const sdGetConfigItemTool: SteelAiTool<z.infer<typeof CiGetArgs>> = {
  name: 'sd_get_config_item',
  label: 'Abrindo item de configuração',
  module: SD_MODULE,
  kind: 'READ',
  description:
    'Detalhes de um item de configuração (nome, código, IP ou id): tipo, status, criticidade, dono, garantia, atributos, hierarquia (pais e filhos) e os últimos chamados vinculados.',
  parameters: {
    type: 'object',
    properties: { configItem: { type: 'string' } },
    required: ['configItem'],
    additionalProperties: false,
  },
  permission: { resource: 'sd-config-items', action: 'VIEW' },
  parse: zodParser(CiGetArgs),
  async execute(ctx, args) {
    const ref = await lookupConfigItem(ctx, args.configItem)
    if (!ref.ok) return ref
    const [item, base] = await Promise.all([
      SdConfigItemService.get(ctx.actorId, ctx.workspaceId, ref.value.id),
      sdBasePath(ctx),
    ])
    if (!item.ok) return item
    if (!base.ok) return base
    const ci = item.value
    const href = sdHref.page(base.value, 'config-items')
    return ok({
      data: {
        id: ci.id,
        name: ci.name,
        code: ci.code,
        type: ci.type?.name ?? null,
        status: ci.status,
        criticality: ci.criticality,
        customer: ci.customer?.name ?? null,
        department: ci.department?.name ?? null,
        owner: ci.owner?.name ?? null,
        serialNumber: ci.serialNumber,
        manufacturer: ci.manufacturer,
        model: ci.model,
        location: ci.location,
        ipAddress: ci.ipAddress,
        warrantyUntil: ci.warrantyUntil,
        attributes: ci.attributes,
        ancestors: ci.ancestors.map((a) => a.name),
        children: ci.children.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
        })),
        recentTickets: ci.recentTickets.map((t) => ({
          id: t.id,
          number: t.number,
          title: t.title,
          phase: t.phaseName,
          href: sdHref.ticket(base.value, t.number),
        })),
        href,
      },
      summary: `${ci.name}${ci.code ? ` (${ci.code})` : ''}: ${ci.status}`,
      target: { type: 'sd_config_item', id: ci.id, label: ci.name, href },
    })
  },
}

/* --------------------------- customers / companies ----------------------- */

const CustomerArgs = z.object({
  query: z.string().trim().max(200).optional(),
  kind: z.enum(['client', 'company']).optional(),
  limit: limitSchema,
  page: pageSchema,
})

export const sdSearchCustomersTool: SteelAiTool<z.infer<typeof CustomerArgs>> =
  {
    name: 'sd_search_customers',
    label: 'Consultando clientes e empresas',
    module: SD_MODULE,
    kind: 'READ',
    description:
      'Busca clientes (kind "client") e empresas (kind "company") do ServiceDesk por nome, nome fantasia, e-mail ou cidade. Retorna contato básico e contagens (sem CPF/CNPJ nem endereço completo).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        kind: { type: 'string', enum: ['client', 'company'] },
        limit: limitParameter,
        page: pageParameter,
      },
      additionalProperties: false,
    },
    permission: { resource: 'sd-customers', action: 'VIEW' },
    parse: zodParser(CustomerArgs),
    async execute(ctx, args) {
      const [page, base] = await Promise.all([
        SdCustomerService.list(ctx.actorId, ctx.workspaceId, {
          q: args.query,
          kind: args.kind
            ? args.kind === 'company'
              ? 'COMPANY'
              : 'CLIENT'
            : undefined,
          page: args.page,
          pageSize: args.limit,
          order: 'asc',
          sort: 'name',
        }),
        sdBasePath(ctx),
      ])
      if (!page.ok) return page
      if (!base.ok) return base
      return ok({
        data: {
          total: page.value.total,
          page: args.page,
          hasMore: args.page * args.limit < page.value.total,
          items: page.value.items.map((c) => ({
            id: c.id,
            kind: c.kind,
            name: c.name,
            tradeName: c.tradeName,
            email: c.email,
            phone: c.phone,
            city: c.city,
            state: c.state,
            active: c.active,
            contactsCount: c.contactsCount,
            configItemsCount: c.configItemsCount,
            href: sdHref.page(
              base.value,
              c.kind === 'COMPANY' ? 'companies' : 'customers',
            ),
          })),
        },
        summary: `${page.value.total} cliente(s)/empresa(s)`,
      })
    },
  }

/* --------------------------------- contacts ------------------------------ */

const ContactArgs = z.object({
  query: z.string().trim().max(200).optional(),
  customer: refSchema.optional(),
  limit: limitSchema,
  page: pageSchema,
})

export const sdSearchContactsTool: SteelAiTool<z.infer<typeof ContactArgs>> = {
  name: 'sd_search_contacts',
  label: 'Consultando contatos',
  module: SD_MODULE,
  kind: 'READ',
  description:
    'Busca contatos do ServiceDesk por nome, cargo, e-mail, telefone ou WhatsApp, opcionalmente só de um cliente/empresa (nome ou id).',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      customer: { type: 'string' },
      limit: limitParameter,
      page: pageParameter,
    },
    additionalProperties: false,
  },
  permission: { resource: 'sd-contacts', action: 'VIEW' },
  parse: zodParser(ContactArgs),
  async execute(ctx, args) {
    let customerId: string | undefined
    if (args.customer) {
      const customer = await lookupCustomer(ctx, args.customer)
      if (!customer.ok) return customer
      customerId = customer.value.id
    }
    const [page, base] = await Promise.all([
      SdContactService.list(ctx.actorId, ctx.workspaceId, {
        q: args.query,
        customerId,
        page: args.page,
        pageSize: args.limit,
        order: 'asc',
        sort: 'name',
      }),
      sdBasePath(ctx),
    ])
    if (!page.ok) return page
    if (!base.ok) return base
    return ok({
      data: {
        total: page.value.total,
        page: args.page,
        hasMore: args.page * args.limit < page.value.total,
        items: page.value.items.map((c) => ({
          id: c.id,
          name: c.name,
          jobTitle: c.jobTitle,
          email: c.email,
          phone: c.phone,
          whatsapp: c.whatsapp,
          active: c.active,
          customers: c.customers.map((x) => x.name),
          hasPlatformUser: c.userId !== null,
        })),
        href: sdHref.page(base.value, 'contacts'),
      },
      summary: `${page.value.total} contato(s)`,
    })
  },
}

export const SD_DIRECTORY_TOOLS = [
  sdCatalogTool,
  sdSearchConfigItemsTool,
  sdGetConfigItemTool,
  sdSearchCustomersTool,
  sdSearchContactsTool,
]
