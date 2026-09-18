import { z } from 'zod'
import {
  CreateCrmProposalSchema,
  ExtendCrmProposalValiditySchema,
  UpdateCrmProposalSchema,
} from '@/src/schemas/crm-proposal.schema'
import {
  CreateCrmProposalTemplateSchema,
  UpdateCrmProposalTemplateSchema,
} from '@/src/schemas/crm-proposal-template.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import { MediaUrlDTO } from '../../schemas/core'
import {
  CrmProposalDTO,
  CrmProposalMetricsDTO,
  CrmProposalTemplateDTO,
} from '../../schemas/crm/proposals'
import {
  CRM_ERRORS,
  CRM_PRIVILEGED_ERRORS,
  crmAccess,
  describe,
  notFoundError,
} from './shared'

/** CRM · Propostas — `proposals/**`, `proposal-templates/**` (recurso `documents`). */

const TAG = 'CRM · Propostas' as const

const PROPOSAL_ID = { proposalId: 'ID da proposta.' }
const TEMPLATE_ID = { templateId: 'ID do template de proposta.' }

/** Vínculos opcionais conferidos contra o workspace na criação/edição. */
const RELATED_ERRORS: ErrorEntry[] = [
  notFoundError('CrmCompany', '`companyId` não existe no workspace'),
  notFoundError('CrmPerson', '`contactId` não existe no workspace'),
  notFoundError('CrmOpportunity', '`opportunityId` não existe no workspace'),
  {
    code: 'FORBIDDEN',
    when: '`responsibleId` não é membro do workspace',
  },
]

const SECTIONS_NOTE =
  '`sections[].content.type` precisa ser igual a `sections[].type` (conteúdo tipado por seção: capa, apresentação, necessidades, solução, escopo, produtos/preços, condições comerciais, termos e assinatura).'

export const crmProposalsRoutes: RouteConfig[] = [
  /* -------------------------------- propostas ------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/proposals',
    tags: [TAG],
    summary: 'Listar propostas',
    description: describe(
      'Propostas do workspace, na ordem da grade (`position`).',
      crmAccess('documents', 'VIEW'),
    ),
    responses: {
      200: { description: 'Propostas.', schema: z.array(CrmProposalDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/proposals',
    tags: [TAG],
    summary: 'Criar proposta',
    description: describe(
      'Com `templateId` e sem `sections`, copia as seções habilitadas do template que têm conteúdo padrão. Sem `validUntil`, a validade é hoje + `proposalValidityDays` das configurações do CRM. Nasce `DRAFT`.',
      SECTIONS_NOTE,
      crmAccess('documents', 'CREATE'),
    ),
    consent: true,
    body: CreateCrmProposalSchema,
    responses: {
      201: { description: 'Proposta criada.', schema: CrmProposalDTO },
    },
    errors: [
      ...CRM_ERRORS,
      ...RELATED_ERRORS,
      {
        code: 'CRM_PROPOSAL_TEMPLATE_NOT_FOUND',
        when: '`templateId` não existe no workspace',
      },
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/proposals/images',
    tags: [TAG],
    summary: 'Enviar imagem de proposta',
    description: describe(
      'Corpo **binário** (não multipart) com o `Content-Type` da imagem. JPEG, PNG ou WebP até 5 MB. Devolve a URL pública para usar nas seções (`coverImageUrl`, `imageUrls`, `signatureImageUrl`).',
      crmAccess('documents', 'EDIT'),
    ),
    rateLimit: 'upload',
    body: {
      contentType: 'image/*',
      schema: { type: 'string', format: 'binary' },
      description: 'Bytes da imagem.',
    },
    responses: { 201: { description: 'Imagem salva.', schema: MediaUrlDTO } },
    errors: [
      ...CRM_ERRORS,
      {
        code: 'BAD_REQUEST',
        message: 'Content-Type é obrigatório',
        when: 'Sem header `Content-Type`',
      },
      {
        code: 'BAD_REQUEST',
        message: 'Arquivo muito grande. Máximo 5 MB',
        when: '`Content-Length` acima de 5 MB',
      },
      {
        code: 'VALIDATION_ERROR',
        message: 'Formato não suportado. Use JPEG, PNG ou WebP',
      },
      'STORAGE_ERROR',
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/proposals/{proposalId}',
    tags: [TAG],
    summary: 'Detalhe da proposta',
    description: crmAccess('documents', 'VIEW'),
    params: PROPOSAL_ID,
    responses: { 200: { description: 'Proposta.', schema: CrmProposalDTO } },
    errors: [...CRM_ERRORS, 'CRM_PROPOSAL_NOT_FOUND'],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/proposals/{proposalId}',
    tags: [TAG],
    summary: 'Atualizar proposta',
    description: describe(
      'Atualização parcial; `null` desvincula empresa/contato/oportunidade ou limpa a validade. `sections`, quando enviado, substitui todas as seções.',
      'Regras de validade: marcar como `ACCEPTED` uma proposta vencida responde `409 CRM_PROPOSAL_EXPIRED`. Mexer na validade ou no status de uma proposta `EXPIRED` equivale a estendê-la — só OWNER/ADMIN, a nova data precisa ser futura e, sem status explícito, ela volta a `SENT` (ou `VIEWED`, se já teve visitas).',
      SECTIONS_NOTE,
      crmAccess('documents', 'EDIT'),
    ),
    params: PROPOSAL_ID,
    consent: true,
    body: UpdateCrmProposalSchema,
    responses: {
      200: { description: 'Proposta atualizada.', schema: CrmProposalDTO },
    },
    errors: [
      ...CRM_ERRORS,
      {
        code: 'FORBIDDEN',
        message:
          'Só administradores do CRM podem alterar a validade de uma proposta expirada',
        when: 'Proposta expirada editada por quem não é OWNER/ADMIN',
      },
      ...RELATED_ERRORS,
      'CRM_PROPOSAL_NOT_FOUND',
      {
        code: 'CRM_PROPOSAL_EXPIRED',
        when: 'Aceite de proposta com validade vencida',
      },
      {
        code: 'VALIDATION_ERROR',
        message: 'A nova validade precisa ser uma data futura',
        when: 'Nova validade de proposta expirada no passado',
      },
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/proposals/{proposalId}',
    tags: [TAG],
    summary: 'Excluir proposta',
    description: describe(
      'Exclusão lógica (soft delete): o link público deixa de responder.',
      crmAccess('documents', 'DELETE'),
    ),
    params: PROPOSAL_ID,
    consent: true,
    responses: { 200: { description: 'Proposta excluída.', schema: null } },
    errors: [...CRM_ERRORS, 'CRM_PROPOSAL_NOT_FOUND'],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/proposals/{proposalId}/extend-validity',
    tags: [TAG],
    summary: 'Estender validade da proposta',
    description: describe(
      'Define uma nova validade (futura) — inclusive para proposta já `EXPIRED`, que volta a `SENT` (ou `VIEWED`, se já teve visitas) e pode ser aceita de novo. Propostas já respondidas (`ACCEPTED`/`REJECTED`) não mudam.',
      crmAccess('privileged'),
    ),
    params: PROPOSAL_ID,
    consent: true,
    body: ExtendCrmProposalValiditySchema,
    responses: {
      200: { description: 'Validade estendida.', schema: CrmProposalDTO },
    },
    errors: [
      ...CRM_PRIVILEGED_ERRORS,
      'CRM_PROPOSAL_NOT_FOUND',
      {
        code: 'CONFLICT',
        message:
          'Esta proposta já foi respondida pelo cliente — a validade não pode mais ser alterada',
        when: 'Proposta aceita ou recusada',
      },
      {
        code: 'VALIDATION_ERROR',
        message: 'A nova validade precisa ser uma data futura',
        when: '`validUntil` no passado',
      },
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/proposals/{proposalId}/metrics',
    tags: [TAG],
    summary: 'Métricas de visualização da proposta',
    description: describe(
      'Visitas registradas pelo link público (`/p/<shareToken>`): total, visitantes únicos, taxa de leitura até o fim, tempo médio e a lista de visitas.',
      crmAccess('documents', 'VIEW'),
    ),
    params: PROPOSAL_ID,
    responses: {
      200: { description: 'Métricas.', schema: CrmProposalMetricsDTO },
    },
    errors: [...CRM_ERRORS, 'CRM_PROPOSAL_NOT_FOUND'],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/proposals/{proposalId}/save-as-template',
    tags: [TAG],
    summary: 'Salvar proposta como template',
    description: describe(
      'Cria um template com o nome e as seções da proposta (o conteúdo de cada seção vira o `defaultContent`).',
      'Acesso: sessão + membro do workspace com o módulo **CRM** habilitado e as permissões `documents` × `VIEW` e `documents` × `CREATE` no perfil (OWNER/ADMIN sempre passam).',
    ),
    params: PROPOSAL_ID,
    consent: true,
    responses: {
      201: { description: 'Template criado.', schema: CrmProposalTemplateDTO },
    },
    errors: [...CRM_ERRORS, 'CRM_PROPOSAL_NOT_FOUND'],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/proposals/{proposalId}/send',
    tags: [TAG],
    summary: 'Marcar proposta como enviada',
    description: describe(
      'Muda o status para `SENT` (o link público passa a registrar visitas e aceitar o aceite). Não envia e-mail — o compartilhamento do link é feito pelo usuário. Proposta vencida precisa ter a validade ajustada antes.',
      crmAccess('documents', 'EDIT'),
    ),
    params: PROPOSAL_ID,
    consent: true,
    responses: {
      200: { description: 'Proposta enviada.', schema: CrmProposalDTO },
    },
    errors: [
      ...CRM_ERRORS,
      'CRM_PROPOSAL_NOT_FOUND',
      { code: 'CRM_PROPOSAL_EXPIRED', when: 'Validade vencida' },
    ],
  },

  /* -------------------------------- templates ------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/proposal-templates',
    tags: [TAG],
    summary: 'Listar templates de proposta',
    description: crmAccess('documents', 'VIEW'),
    responses: {
      200: {
        description: 'Templates.',
        schema: z.array(CrmProposalTemplateDTO),
      },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/proposal-templates',
    tags: [TAG],
    summary: 'Criar template de proposta',
    description: describe(
      '`sections[].defaultContent` (opcional) precisa ter o mesmo `type` da seção.',
      crmAccess('documents', 'CREATE'),
    ),
    consent: true,
    body: CreateCrmProposalTemplateSchema,
    responses: {
      201: { description: 'Template criado.', schema: CrmProposalTemplateDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/proposal-templates/{templateId}',
    tags: [TAG],
    summary: 'Detalhe do template de proposta',
    description: crmAccess('documents', 'VIEW'),
    params: TEMPLATE_ID,
    responses: {
      200: { description: 'Template.', schema: CrmProposalTemplateDTO },
    },
    errors: [...CRM_ERRORS, 'CRM_PROPOSAL_TEMPLATE_NOT_FOUND'],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/proposal-templates/{templateId}',
    tags: [TAG],
    summary: 'Atualizar template de proposta',
    description: describe(
      'Atualização parcial; `sections`, quando enviado, substitui todas as seções. Propostas já criadas a partir do template não mudam.',
      crmAccess('documents', 'EDIT'),
    ),
    params: TEMPLATE_ID,
    consent: true,
    body: UpdateCrmProposalTemplateSchema,
    responses: {
      200: {
        description: 'Template atualizado.',
        schema: CrmProposalTemplateDTO,
      },
    },
    errors: [...CRM_ERRORS, 'CRM_PROPOSAL_TEMPLATE_NOT_FOUND'],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/proposal-templates/{templateId}',
    tags: [TAG],
    summary: 'Excluir template de proposta',
    description: crmAccess('documents', 'DELETE'),
    params: TEMPLATE_ID,
    consent: true,
    responses: { 200: { description: 'Template excluído.', schema: null } },
    errors: [...CRM_ERRORS, 'CRM_PROPOSAL_TEMPLATE_NOT_FOUND'],
  },
]
