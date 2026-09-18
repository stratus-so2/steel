import { z } from 'zod'
import {
  CrmProposalSectionContentSchema,
  CrmProposalSectionTypeEnum,
  CrmProposalStatusEnum,
} from '@/src/schemas/crm-proposal.schema'
import { dto } from '../../common'

/** DTOs de propostas e templates (`types/crm-proposal.d.ts`, `types/crm-proposal-template.d.ts`). */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

export const CrmProposalDTO = dto(
  'CrmProposal',
  z
    .object({
      id: z.string().meta({ example: 'ckw1prop0000ab7d3k1e5xyz' }),
      name: z.string().meta({ example: 'Proposta — Implantação ServiceDesk' }),
      templateId: z
        .string()
        .nullable()
        .meta({ description: 'Template de origem, se criada a partir de um.' }),
      companyId: z.string().nullable(),
      contactId: z
        .string()
        .nullable()
        .meta({ description: 'Pessoa (contato) do cliente.' }),
      opportunityId: z.string().nullable(),
      leadId: z.string().nullable().meta({
        description: 'Lead de origem (proposta criada pelo painel de leads).',
      }),
      responsibleId: z
        .string()
        .meta({ description: 'Membro responsável pela proposta.' }),
      validUntil: nullableDateTime(),
      status: CrmProposalStatusEnum,
      isExpired: z.boolean().meta({
        description:
          'Validade vencida (status `EXPIRED` ou data passada ainda não processada pelo job diário).',
      }),
      acceptedAt: nullableDateTime(),
      acceptedByName: z
        .string()
        .nullable()
        .meta({ description: 'Nome informado pelo cliente no aceite.' }),
      expiredAt: nullableDateTime(),
      shareToken: z.string().meta({
        description:
          'Token do link público `/p/<shareToken>` (ver `GET /crm/proposals/{shareToken}`).',
      }),
      viewsCount: z.number().int(),
      sections: z.array(
        z.object({
          id: z.string(),
          type: CrmProposalSectionTypeEnum,
          order: z.number().int(),
          enabled: z.boolean(),
          content: CrmProposalSectionContentSchema,
        }),
      ),
      workspaceId: z.string(),
      createdById: z.string(),
      updatedById: z.string().nullable(),
      position: z.number(),
      createdAt: dateTime(),
      updatedAt: dateTime(),
    })
    .meta({ description: 'Proposta comercial.' }),
)

export const CrmProposalMetricsDTO = dto(
  'CrmProposalMetrics',
  z.object({
    totalViews: z.number().int(),
    uniqueVisitors: z.number().int(),
    completionRate: z
      .number()
      .meta({ description: 'Fração 0..1 de visitas que chegaram ao fim.' }),
    avgDurationMs: z.number(),
    views: z.array(
      z.object({
        id: z.string(),
        durationMs: z.number().int(),
        reachedEnd: z.boolean(),
        scrolledPct: z.number().int().min(0).max(100),
        referrer: z.string().nullable(),
        createdAt: dateTime(),
        updatedAt: dateTime(),
      }),
    ),
  }),
)

export const CrmProposalTemplateDTO = dto(
  'CrmProposalTemplate',
  z
    .object({
      id: z.string(),
      name: z.string().meta({ example: 'Proposta padrão — ServiceDesk' }),
      description: z.string().nullable(),
      logoUrl: z.string().nullable(),
      sections: z.array(
        z.object({
          id: z.string(),
          type: CrmProposalSectionTypeEnum,
          order: z.number().int(),
          enabled: z.boolean(),
          defaultContent: CrmProposalSectionContentSchema.nullable().meta({
            description:
              'Conteúdo pré-preenchido copiado para a proposta criada a partir do template.',
          }),
        }),
      ),
      workspaceId: z.string(),
      createdById: z.string(),
      updatedById: z.string().nullable(),
      position: z.number(),
      createdAt: dateTime(),
      updatedAt: dateTime(),
    })
    .meta({ description: 'Template de proposta.' }),
)
