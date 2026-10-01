import { z } from 'zod'
import {
  RequestSdTicketApprovalSchema,
  ResendSdTicketApprovalSchema,
  RespondSdApprovalSchema,
} from '@/src/schemas/sd-ticket-approval.schema'
import {
  CreateSdTicketCostSchema,
  UpdateSdTicketCostSchema,
} from '@/src/schemas/sd-ticket-cost.schema'
import {
  CreateSdTicketMessageSchema,
  ListSdTicketMessagesSchema,
  UpdateSdTicketMessageSchema,
} from '@/src/schemas/sd-ticket-message.schema'
import {
  CreateSdTicketPartSchema,
  UpdateSdTicketPartSchema,
} from '@/src/schemas/sd-ticket-part.schema'
import { CreateSdTicketSignatureSchema } from '@/src/schemas/sd-ticket-signature.schema'
import {
  CreateSdTicketTaskSchema,
  ReorderSdTicketTasksSchema,
  UpdateSdTicketTaskSchema,
} from '@/src/schemas/sd-ticket-task.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdPublicApprovalDTO,
  SdTicketApprovalDTO,
  SdTicketAttachmentDTO,
  SdTicketCostDTO,
  SdTicketCostListDTO,
  SdTicketMessageDTO,
  SdTicketMessagePageDTO,
  SdTicketPartDTO,
  SdTicketPartListDTO,
  SdTicketSignatureDTO,
  SdTicketSignatureVerificationDTO,
  SdTicketTaskDTO,
  SdTicketTaskListDTO,
} from '../../schemas/servicedesk/ticket-tabs'

/**
 * ServiceDesk · abas do chamado — `app/api/workspaces/[id]/servicedesk/
 * tickets/[ticketId]/{messages,attachments,tasks,costs,parts,approvals,
 * signatures}/**` e a aprovação pública `app/api/servicedesk/approvals/
 * [token]`. Autorização no service (`loadSdTicketTab`): membro + módulo
 * SERVICE_DESK + `sd-tickets` × ação, agente × solicitante e visibilidade
 * do chamado.
 */

const HISTORY = 'ServiceDesk · Histórico e anexos' as const
const WORK = 'ServiceDesk · Execução do atendimento' as const
const APPROVALS = 'ServiceDesk · Aprovações e assinaturas' as const

const ticket = '/workspaces/{id}/servicedesk/tickets/{ticketId}'
const TICKET_PARAM = {
  ticketId: 'Id do chamado, número (`123`) ou código (`INC-000123`).',
}

function access(action: string, who: 'all' | 'agent'): string {
  const role =
    who === 'agent'
      ? ' Só agentes (membros de um departamento) e admins.'
      : ' Agentes, ou o solicitante/participante/contato do chamado.'
  return `Acesso: sessão + membro com o módulo **ServiceDesk** habilitado e a permissão \`sd-tickets\` × \`${action}\` (OWNER/ADMIN sempre passam).${role}`
}

const ACCESS_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede a permissão',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
  'SD_TICKET_NOT_FOUND',
  {
    code: 'SD_TICKET_FORBIDDEN',
    when: 'Solicitante sem vínculo com o chamado',
  },
]
const AGENT_ERRORS: ErrorEntry[] = [
  ...ACCESS_ERRORS,
  {
    code: 'SD_NOT_AGENT',
    when: 'Solicitante (sem departamento) tentou uma ação de agente',
  },
]
const CLOSED: ErrorEntry = {
  code: 'SD_TICKET_CLOSED',
  when: 'Chamado fechado ou cancelado',
}

const BINARY = {
  envelope: false,
  schema: { type: 'string', format: 'binary' },
} as const

/* ------------------------------ histórico ------------------------------ */

const historyRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: `${ticket}/messages`,
    tags: [HISTORY],
    summary: 'Listar mensagens do chamado',
    description: `Histórico em páginas das mais novas para as mais antigas (\`?before=<messageId>&limit=50\`); cada página volta em ordem cronológica. Solicitantes não recebem notas internas. ${access('VIEW', 'all')}`,
    params: TICKET_PARAM,
    query: ListSdTicketMessagesSchema,
    responses: {
      200: {
        description: 'Página de mensagens.',
        schema: SdTicketMessagePageDTO,
      },
    },
    errors: ACCESS_ERRORS,
  },
  {
    method: 'post',
    path: `${ticket}/messages`,
    tags: [HISTORY],
    summary: 'Enviar mensagem',
    description: `Texto (com emoji) e/ou anexos já enviados (\`attachmentIds\`, soltos e do próprio autor). Primeira mensagem pública de agente carimba a 1ª resposta do SLA; resposta do solicitante num chamado RESOLVED reabre (\`reopenOnRequesterReply\`); mensagem pública dispara \`MESSAGE_RECEIVED\`. Avisa responsável, participantes e solicitante (nunca numa nota interna). Solicitantes só enviam \`PUBLIC\`. ${access('CREATE', 'all')}`,
    consent: true,
    params: TICKET_PARAM,
    body: CreateSdTicketMessageSchema,
    responses: {
      201: { description: 'Mensagem enviada.', schema: SdTicketMessageDTO },
    },
    errors: [
      ...ACCESS_ERRORS,
      CLOSED,
      {
        code: 'SD_TICKET_FORBIDDEN',
        when: 'Solicitante tentou escrever nota interna',
      },
      {
        code: 'SD_ATTACHMENT_NOT_FOUND',
        when: 'Anexo inexistente, já usado ou enviado por outra pessoa',
      },
    ],
  },
  {
    method: 'patch',
    path: `${ticket}/messages/{messageId}`,
    tags: [HISTORY],
    summary: 'Editar mensagem',
    description: `Só o autor, em até 15 minutos. ${access('EDIT', 'all')}`,
    consent: true,
    params: { ...TICKET_PARAM, messageId: 'Id da mensagem.' },
    body: UpdateSdTicketMessageSchema,
    responses: {
      200: { description: 'Mensagem editada.', schema: SdTicketMessageDTO },
    },
    errors: [
      ...ACCESS_ERRORS,
      CLOSED,
      'SD_MESSAGE_NOT_FOUND',
      {
        code: 'SD_MESSAGE_FORBIDDEN',
        when: 'Não é o autor ou passou a janela de 15 minutos',
      },
    ],
  },
  {
    method: 'delete',
    path: `${ticket}/messages/{messageId}`,
    tags: [HISTORY],
    summary: 'Excluir mensagem',
    description: `Exclusão lógica (com os anexos), só o autor em até 15 minutos. ${access('EDIT', 'all')}`,
    consent: true,
    params: { ...TICKET_PARAM, messageId: 'Id da mensagem.' },
    responses: { 200: { description: 'Excluída.', schema: null } },
    errors: [
      ...ACCESS_ERRORS,
      CLOSED,
      'SD_MESSAGE_NOT_FOUND',
      {
        code: 'SD_MESSAGE_FORBIDDEN',
        when: 'Não é o autor ou passou a janela de 15 minutos',
      },
    ],
  },
  {
    method: 'get',
    path: `${ticket}/attachments`,
    tags: [HISTORY],
    summary: 'Listar anexos do chamado',
    description: `Anexos vivos, mais novos primeiro. Solicitantes veem só os de mensagens públicas e os próprios ainda soltos. ${access('VIEW', 'all')}`,
    params: TICKET_PARAM,
    responses: {
      200: { description: 'Anexos.', schema: z.array(SdTicketAttachmentDTO) },
    },
    errors: ACCESS_ERRORS,
  },
  {
    method: 'post',
    path: `${ticket}/attachments`,
    tags: [HISTORY],
    summary: 'Enviar anexo',
    description: `Multipart, campo \`file\`, até 25 MB. Tipos: imagens (png, jpeg, gif, webp, heic), vídeo (mp4, webm, mov), áudio (mp3, m4a, aac, wav, ogg, webm), documentos (pdf, txt, csv, Office, OpenDocument) e zip. Grava no bucket privado \`servicedesk\` (\`<ws>/tickets/<ticketId>/<cuid>-<nome>\`) e fica solto até uma mensagem usá-lo. ${access('CREATE', 'all')}`,
    rateLimit: 'upload',
    consent: true,
    params: TICKET_PARAM,
    body: {
      contentType: 'multipart/form-data',
      schema: {
        type: 'object',
        properties: { file: { type: 'string', format: 'binary' } },
        required: ['file'],
      },
    },
    responses: {
      201: { description: 'Anexo enviado.', schema: SdTicketAttachmentDTO },
    },
    errors: [
      ...ACCESS_ERRORS,
      CLOSED,
      'SD_ATTACHMENT_INVALID',
      {
        code: 'BAD_REQUEST',
        when: 'Sem o campo `file` ou corpo grande demais',
      },
      'STORAGE_ERROR',
    ],
  },
  {
    method: 'get',
    path: `${ticket}/attachments/{attachmentId}`,
    tags: [HISTORY],
    summary: 'Baixar anexo',
    description: `Arquivo como enviado, conferindo o acesso a cada pedido. \`?download=1\` força \`Content-Disposition: attachment\`; senão abre inline. ${access('VIEW', 'all')}`,
    params: { ...TICKET_PARAM, attachmentId: 'Id do anexo.' },
    query: {
      type: 'object',
      properties: {
        download: {
          type: 'string',
          enum: ['1', 'true', '0', 'false'],
          description: 'Força o download.',
        },
      },
    },
    queryValidationError: false,
    responses: {
      200: {
        description: 'Arquivo.',
        contentType: 'application/octet-stream',
        ...BINARY,
      },
    },
    errors: [
      ...ACCESS_ERRORS,
      {
        code: 'SD_ATTACHMENT_NOT_FOUND',
        when: 'Inexistente, de outro chamado ou de nota interna (solicitante)',
      },
    ],
  },
  {
    method: 'delete',
    path: `${ticket}/attachments/{attachmentId}`,
    tags: [HISTORY],
    summary: 'Remover anexo',
    description: `Agentes removem qualquer anexo; solicitantes só os próprios ainda soltos. ${access('EDIT', 'all')}`,
    consent: true,
    params: { ...TICKET_PARAM, attachmentId: 'Id do anexo.' },
    responses: { 200: { description: 'Removido.', schema: null } },
    errors: [
      ...ACCESS_ERRORS,
      CLOSED,
      'SD_ATTACHMENT_NOT_FOUND',
      {
        code: 'SD_TICKET_FORBIDDEN',
        when: 'Solicitante tentou remover anexo já enviado numa mensagem',
      },
    ],
  },
]

/* ------------------------ tarefas, custos, peças ------------------------ */

interface CrudSpec {
  folder: string
  idParam: string
  label: string
  notFound: ErrorEntry
  list: { schema: z.ZodType; summary: string; description: string }
  item: z.ZodType
  create: { schema: z.ZodType; summary: string; description: string }
  update: {
    schema: z.ZodType
    summary: string
    description: string
    errors?: ErrorEntry[]
  }
  remove: { summary: string; description: string; errors?: ErrorEntry[] }
  createErrors?: ErrorEntry[]
}

function crud(spec: CrudSpec): RouteConfig[] {
  const one = `${ticket}/${spec.folder}/{${spec.idParam}}`
  const params = { ...TICKET_PARAM, [spec.idParam]: `Id ${spec.label}.` }
  return [
    {
      method: 'get',
      path: `${ticket}/${spec.folder}`,
      tags: [WORK],
      summary: spec.list.summary,
      description: `${spec.list.description} ${access('VIEW', 'agent')}`,
      params: TICKET_PARAM,
      responses: { 200: { description: 'Lista.', schema: spec.list.schema } },
      errors: AGENT_ERRORS,
    },
    {
      method: 'post',
      path: `${ticket}/${spec.folder}`,
      tags: [WORK],
      summary: spec.create.summary,
      description: `${spec.create.description} ${access('CREATE', 'agent')}`,
      consent: true,
      params: TICKET_PARAM,
      body: spec.create.schema,
      responses: { 201: { description: 'Criado.', schema: spec.item } },
      errors: [...AGENT_ERRORS, CLOSED, ...(spec.createErrors ?? [])],
    },
    {
      method: 'patch',
      path: one,
      tags: [WORK],
      summary: spec.update.summary,
      description: `${spec.update.description} ${access('EDIT', 'agent')}`,
      consent: true,
      params,
      body: spec.update.schema,
      responses: { 200: { description: 'Atualizado.', schema: spec.item } },
      errors: [
        ...AGENT_ERRORS,
        CLOSED,
        spec.notFound,
        ...(spec.update.errors ?? []),
      ],
    },
    {
      method: 'delete',
      path: one,
      tags: [WORK],
      summary: spec.remove.summary,
      description: `${spec.remove.description} ${access('DELETE', 'agent')}`,
      consent: true,
      params,
      responses: { 200: { description: 'Excluído.', schema: null } },
      errors: [
        ...AGENT_ERRORS,
        CLOSED,
        spec.notFound,
        ...(spec.remove.errors ?? []),
      ],
    },
  ]
}

const MEMBER_INVALID = (who: string): ErrorEntry => ({
  code: 'VALIDATION_ERROR',
  when: `${who} não é membro do workspace`,
})

const workRoutes: RouteConfig[] = [
  ...crud({
    folder: 'tasks',
    idParam: 'taskId',
    label: 'da tarefa',
    notFound: 'SD_TASK_NOT_FOUND',
    item: SdTicketTaskDTO,
    list: {
      schema: SdTicketTaskListDTO,
      summary: 'Listar tarefas do chamado',
      description:
        'Em ordem (`position`), com `overdue` e o progresso (concluídas / total sem canceladas).',
    },
    create: {
      schema: CreateSdTicketTaskSchema,
      summary: 'Criar tarefa',
      description:
        'Entra no fim da lista; avisa o responsável. Status `DONE` carimba `completedAt`.',
    },
    createErrors: [MEMBER_INVALID('Responsável')],
    update: {
      schema: UpdateSdTicketTaskSchema,
      summary: 'Atualizar tarefa',
      description:
        'Concluir (`DONE`) carimba `completedAt`; reabrir limpa. Novo responsável é avisado.',
      errors: [MEMBER_INVALID('Responsável')],
    },
    remove: { summary: 'Excluir tarefa', description: 'Exclusão definitiva.' },
  }),
  {
    method: 'patch',
    path: `${ticket}/tasks/reorder`,
    tags: [WORK],
    summary: 'Reordenar tarefas',
    description: `Ids das tarefas do chamado na nova ordem (sem repetidos nem ids de outro chamado). ${access('EDIT', 'agent')}`,
    consent: true,
    params: TICKET_PARAM,
    body: ReorderSdTicketTasksSchema,
    responses: {
      200: { description: 'Tarefas reordenadas.', schema: SdTicketTaskListDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      CLOSED,
      {
        code: 'VALIDATION_ERROR',
        when: 'Lista com id repetido ou de outro chamado',
      },
    ],
  },
  ...crud({
    folder: 'costs',
    idParam: 'costId',
    label: 'do custo',
    notFound: 'SD_COST_NOT_FOUND',
    item: SdTicketCostDTO,
    list: {
      schema: SdTicketCostListDTO,
      summary: 'Listar custos do chamado',
      description:
        'Mais recentes primeiro, com totais (geral, faturável, não faturável e por categoria).',
    },
    create: {
      schema: CreateSdTicketCostSchema,
      summary: 'Lançar custo',
      description:
        '`quantity` e `unitCost` aceitam número ou string decimal (vírgula ou ponto) e voltam como string com 2 casas.',
    },
    createErrors: [MEMBER_INVALID('Técnico')],
    update: {
      schema: UpdateSdTicketCostSchema,
      summary: 'Atualizar custo',
      description: 'Campos parciais.',
      errors: [MEMBER_INVALID('Técnico')],
    },
    remove: { summary: 'Excluir custo', description: 'Exclusão definitiva.' },
  }),
  ...crud({
    folder: 'parts',
    idParam: 'ticketPartId',
    label: 'da peça no chamado',
    notFound: 'SD_TICKET_PART_NOT_FOUND',
    item: SdTicketPartDTO,
    list: {
      schema: SdTicketPartListDTO,
      summary: 'Listar peças do chamado',
      description:
        'Com o estoque atual da peça do catálogo, os próximos status permitidos e os totais (ativas e instaladas).',
    },
    create: {
      schema: CreateSdTicketPartSchema,
      summary: 'Adicionar peça',
      description:
        'Do catálogo (`partId` — nome, SKU e custo vêm dele se omitidos) ou texto livre (`name`). Nascendo `INSTALLED`, baixa o estoque do catálogo na mesma transação.',
    },
    createErrors: [
      { code: 'SD_CONFIG_NOT_FOUND', when: 'Peça do catálogo inexistente' },
      { code: 'VALIDATION_ERROR', when: 'Peça inativa no catálogo' },
      { code: 'SD_PART_OUT_OF_STOCK', when: 'Estoque insuficiente' },
    ],
    update: {
      schema: UpdateSdTicketPartSchema,
      summary: 'Atualizar peça',
      description:
        'Fluxo: REQUESTED → RESERVED/INSTALLED/CANCELED; RESERVED → REQUESTED/INSTALLED/CANCELED; INSTALLED → RETURNED. Entrar em INSTALLED baixa o estoque; INSTALLED → RETURNED devolve. Peça instalada não muda de quantidade.',
      errors: [
        'SD_PART_STATUS_INVALID',
        { code: 'SD_PART_OUT_OF_STOCK', when: 'Estoque insuficiente' },
        {
          code: 'VALIDATION_ERROR',
          when: 'Quantidade alterada numa peça instalada',
        },
      ],
    },
    remove: {
      summary: 'Remover peça',
      description: 'Remover peça instalada devolve a quantidade ao estoque.',
    },
  }),
]

/* ------------------------ aprovações e assinaturas ---------------------- */

const APPROVAL_PARAM = { ...TICKET_PARAM, approvalId: 'Id do pedido.' }
const TOKEN_PARAM = {
  token: {
    description: 'Token do link do e-mail (32 bytes em base64url).',
    example: 'q8Zr4m2XoV0n1bQ5d7T3k9Wc6yLpA2sHjE4uR8tN0fG',
  },
}
const SIGNATURE_PARAM = { ...TICKET_PARAM, signatureId: 'Id da assinatura.' }

const approvalRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: `${ticket}/approvals`,
    tags: [APPROVALS],
    summary: 'Listar aprovações do chamado',
    description: `Mais recentes primeiro. Pedidos pendentes vencidos viram \`EXPIRED\` na leitura (expiração lazy). ${access('VIEW', 'agent')}`,
    params: TICKET_PARAM,
    responses: {
      200: { description: 'Aprovações.', schema: z.array(SdTicketApprovalDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: `${ticket}/approvals`,
    tags: [APPROVALS],
    summary: 'Pedir aprovação',
    description: `Um pedido por aprovador (usuário do workspace ou e-mail externo, sem repetir e-mail), com mensagem e validade (padrão 7 dias). Cada um recebe por e-mail um link próprio para \`/servicedesk/approval/<token>\` (só o SHA-256 do token é guardado). **A primeira resposta decide** e cancela os demais pendentes — é o que o motor lê para fases com \`requiresApproval\`. ${access('CREATE', 'agent')}`,
    consent: true,
    params: TICKET_PARAM,
    body: RequestSdTicketApprovalSchema,
    responses: {
      201: {
        description: 'Pedidos criados (`sentAt` nulo se o e-mail falhou).',
        schema: z.array(SdTicketApprovalDTO),
      },
    },
    errors: [
      ...AGENT_ERRORS,
      CLOSED,
      {
        code: 'VALIDATION_ERROR',
        when: 'Aprovador não é membro do workspace ou não tem e-mail',
      },
    ],
  },
  {
    method: 'post',
    path: `${ticket}/approvals/{approvalId}/cancel`,
    tags: [APPROVALS],
    summary: 'Cancelar pedido de aprovação',
    description: `Só pedidos ainda pendentes. ${access('EDIT', 'agent')}`,
    consent: true,
    params: APPROVAL_PARAM,
    responses: {
      200: { description: 'Pedido cancelado.', schema: SdTicketApprovalDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      'SD_APPROVAL_NOT_FOUND',
      'SD_APPROVAL_NOT_PENDING',
    ],
  },
  {
    method: 'post',
    path: `${ticket}/approvals/{approvalId}/resend`,
    tags: [APPROVALS],
    summary: 'Reenviar pedido de aprovação',
    description: `Gera um token novo (o link anterior deixa de valer), renova a validade e reenvia o e-mail. Para pedidos pendentes ou expirados. Corpo opcional. ${access('EDIT', 'agent')}`,
    consent: true,
    params: APPROVAL_PARAM,
    body: { schema: ResendSdTicketApprovalSchema, required: false },
    responses: {
      200: { description: 'Pedido reenviado.', schema: SdTicketApprovalDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      CLOSED,
      'SD_APPROVAL_NOT_FOUND',
      {
        code: 'SD_APPROVAL_NOT_PENDING',
        when: 'Pedido já respondido ou cancelado',
      },
    ],
  },
  {
    method: 'get',
    path: '/servicedesk/approvals/{token}',
    tags: [APPROVALS],
    auth: 'public',
    rateLimit: 'ip',
    summary: 'Ver pedido de aprovação (público)',
    description:
      'Sem sessão — o token do e-mail é o acesso. Resumo do chamado (código, título, tipo, fase e descrição em texto, sem dados internos) e o estado do pedido; pendente vencido volta como `EXPIRED`.',
    params: TOKEN_PARAM,
    responses: {
      200: { description: 'Pedido.', schema: SdPublicApprovalDTO },
    },
    errors: [
      { code: 'SD_APPROVAL_NOT_FOUND', when: 'Token inválido ou desconhecido' },
    ],
  },
  {
    method: 'post',
    path: '/servicedesk/approvals/{token}',
    tags: [APPROVALS],
    auth: 'public',
    rateLimit: 'ip',
    summary: 'Responder pedido de aprovação (público)',
    description:
      'Aprova ou reprova com comentário opcional. Cancela os outros pedidos pendentes do chamado, avisa quem pediu e o responsável (`SD_APPROVAL_RESPONDED`) e dispara as automações `APPROVAL_RESPONDED`.',
    params: TOKEN_PARAM,
    body: RespondSdApprovalSchema,
    responses: {
      200: { description: 'Pedido respondido.', schema: SdPublicApprovalDTO },
    },
    errors: [
      { code: 'SD_APPROVAL_NOT_FOUND', when: 'Token inválido ou desconhecido' },
      {
        code: 'SD_APPROVAL_NOT_PENDING',
        when: 'Já respondido ou cancelado',
      },
      'SD_APPROVAL_EXPIRED',
    ],
  },
  {
    method: 'get',
    path: `${ticket}/signatures`,
    tags: [APPROVALS],
    summary: 'Listar assinaturas do chamado',
    description: `Mais recentes primeiro. ${access('VIEW', 'all')}`,
    params: TICKET_PARAM,
    responses: {
      200: {
        description: 'Assinaturas.',
        schema: z.array(SdTicketSignatureDTO),
      },
    },
    errors: ACCESS_ERRORS,
  },
  {
    method: 'post',
    path: `${ticket}/signatures`,
    tags: [APPROVALS],
    summary: 'Registrar assinatura',
    description: `PNG do canvas em data URL (até ~1,5 MB). Guarda a imagem no bucket privado \`servicedesk\` com o SHA-256 dela e o SHA-256 de um snapshot canônico do chamado (id, número, título, fase, solução, totais de custos e peças, \`updatedAt\`). O solicitante assina os próprios chamados pelo portal. ${access('CREATE', 'all')}`,
    consent: true,
    params: TICKET_PARAM,
    body: CreateSdTicketSignatureSchema,
    responses: {
      201: {
        description: 'Assinatura registrada.',
        schema: SdTicketSignatureDTO,
      },
    },
    errors: [
      ...ACCESS_ERRORS,
      { code: 'VALIDATION_ERROR', when: 'A imagem não é um PNG válido' },
      'STORAGE_ERROR',
    ],
  },
  {
    method: 'get',
    path: `${ticket}/signatures/{signatureId}/image`,
    tags: [APPROVALS],
    summary: 'Imagem da assinatura',
    description: `PNG armazenado, conferindo o acesso ao chamado. ${access('VIEW', 'all')}`,
    params: SIGNATURE_PARAM,
    responses: {
      200: { description: 'PNG.', contentType: 'image/png', ...BINARY },
    },
    errors: [...ACCESS_ERRORS, 'SD_SIGNATURE_NOT_FOUND'],
  },
  {
    method: 'get',
    path: `${ticket}/signatures/{signatureId}/verify`,
    tags: [APPROVALS],
    summary: 'Verificar integridade da assinatura',
    description: `Recalcula o SHA-256 do PNG armazenado (\`imageIntact\`) e do snapshot atual do chamado (\`ticketUnchanged\` — qualquer atividade depois da assinatura altera o snapshot). ${access('VIEW', 'all')}`,
    params: SIGNATURE_PARAM,
    responses: {
      200: {
        description: 'Resultado da verificação.',
        schema: SdTicketSignatureVerificationDTO,
      },
    },
    errors: [...ACCESS_ERRORS, 'SD_SIGNATURE_NOT_FOUND'],
  },
]

export const sdTicketTabRoutes: RouteConfig[] = [
  ...historyRoutes,
  ...workRoutes,
  ...approvalRoutes,
]
