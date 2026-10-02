import { z } from 'zod'
import {
  ConnectSdGithubSchema,
  CreateSdGithubIssueSchema,
  LinkSdGithubItemSchema,
  ListSdIntegrationLinksSchema,
  UpdateSdGithubConfigSchema,
  UpdateSdSlackConfigSchema,
} from '@/src/schemas/sd-integration.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdGithubWebhookDTO,
  SdGithubWebhookPayload,
  SdIntegrationDTO,
  SdIntegrationLinkDTO,
  SdIntegrationsOverviewDTO,
  SdSlackChannelOptionDTO,
  SdSlackInboundDTO,
  SdSlackWebhookPayload,
} from '../../schemas/servicedesk/integrations'

/**
 * ServiceDesk · integrações — configuração (`app/api/workspaces/[id]/
 * servicedesk/integrations/**`, só admin), o callback OAuth do Slack e os
 * dois webhooks públicos (`app/api/servicedesk/integrations/{slack,github}`),
 * verificados por assinatura.
 */

const TAG = 'ServiceDesk · Integrações' as const
const BASE = '/workspaces/{id}/servicedesk/integrations'

const AGENT =
  'Acesso: sessão + módulo **ServiceDesk** habilitado; só **agentes** (membros de um departamento) e admins do módulo.'
const ADMIN =
  'Acesso: sessão + módulo **ServiceDesk** habilitado; só **admins do módulo** (OWNER/ADMIN ou perfil com `sd-settings` × `EDIT`).'

const SECRECY =
  'O token do app e o segredo do webhook **nunca** voltam em resposta nenhuma — nem mascarados: o DTO só diz se existe segredo (`hasWebhookSecret`).'

const MEMBER_ERRORS: ErrorEntry[] = [
  { code: 'FORBIDDEN', when: 'Não é membro do workspace' },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]
const AGENT_ERRORS: ErrorEntry[] = [
  ...MEMBER_ERRORS,
  { code: 'SD_NOT_AGENT', when: 'Solicitante (sem departamento)' },
]
const ADMIN_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    message:
      'Apenas administradores do ServiceDesk podem alterar a configuração',
    when: 'Não é membro ou não é admin do módulo',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]

const NOT_CONNECTED: ErrorEntry = {
  code: 'SD_INTEGRATION_NOT_FOUND',
  when: 'Integração não conectada neste workspace',
}
const NOT_CONFIGURED: ErrorEntry = {
  code: 'SD_INTEGRATION_NOT_CONFIGURED',
  when: 'App do Slack sem credenciais no servidor, ou integração sem token/segredo legível',
}
const REQUEST_FAILED: ErrorEntry = {
  code: 'SD_INTEGRATION_REQUEST_FAILED',
  when: 'O Slack ou o GitHub recusou a chamada (token sem acesso, repositório inexistente, serviço fora do ar)',
}
const SIGNATURE_INVALID: ErrorEntry = {
  code: 'SD_INTEGRATION_SIGNATURE_INVALID',
  when: 'Assinatura ausente/inválida, ou timestamp fora da janela de 5 minutos (Slack)',
}

export const sdIntegrationRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: BASE,
    tags: [TAG],
    summary: 'Estado das integrações',
    description: `O que está conectado (Slack e GitHub) e as URLs a cadastrar nos painéis do Slack e do repositório. ${SECRECY} ${ADMIN}`,
    params: { id: 'Id do workspace.' },
    responses: {
      200: {
        description: 'Integrações do workspace.',
        schema: SdIntegrationsOverviewDTO,
      },
    },
    errors: ADMIN_ERRORS,
  },

  /* ----------------------------------- Slack ----------------------------------- */

  {
    method: 'get',
    path: `${BASE}/slack/connect`,
    tags: [TAG],
    summary: 'Conectar o Slack (iniciar OAuth)',
    description: `Redireciona (\`302\`) para a tela de autorização do Slack. Abra no navegador — não é uma chamada JSON. O workspace viaja num \`state\` assinado por HMAC (10 min), porque o Slack exige redirect URL exata e fixa; o callback é \`GET /servicedesk/integrations/oauth/slack\`. ${ADMIN}`,
    params: { id: 'Id do workspace.' },
    responses: {
      302: {
        description: 'Redirect para a autorização do Slack.',
        envelope: false,
        headers: {
          Location: { description: 'URL de autorização do Slack.' },
        },
      },
    },
    errors: [...ADMIN_ERRORS, NOT_CONFIGURED, NOT_CONNECTED],
  },
  {
    method: 'get',
    path: '/servicedesk/integrations/oauth/slack',
    tags: [TAG],
    summary: 'Callback OAuth do Slack',
    description:
      'Path **fixo** cadastrado no app do Slack. Exige a sessão do admin que autorizou (o workspace vem do `state`); troca o `code` pelo token do bot, cifra com `CONNECTION_SECRETS` e volta para a aba Integrações com `?slack=connected` (ou `?slack=error&reason=…`). A concessão fica na trilha de auditoria (`auth.oauth_grant.servicedesk_slack`).',
    query: z.object({
      code: z.string().optional(),
      state: z.string().optional(),
      error: z.string().optional(),
    }),
    queryValidationError: false,
    responses: {
      302: {
        description:
          'Redirect para `/{slug}/servicedesk/settings?tab=integrations`.',
        envelope: false,
        headers: { Location: { description: 'Destino no Steel.' } },
      },
    },
    autoErrors: false,
  },
  {
    method: 'get',
    path: `${BASE}/slack/channels`,
    tags: [TAG],
    summary: 'Listar canais do Slack',
    description: `Canais (públicos e privados) que o bot enxerga, em ordem alfabética — é a lista do seletor "canal por time". Falha do Slack carimba \`status: ERROR\` na integração. ${ADMIN}`,
    params: { id: 'Id do workspace.' },
    responses: {
      200: {
        description: 'Canais disponíveis.',
        schema: z.array(SdSlackChannelOptionDTO),
      },
    },
    errors: [...ADMIN_ERRORS, NOT_CONNECTED, NOT_CONFIGURED, REQUEST_FAILED],
  },
  {
    method: 'patch',
    path: `${BASE}/slack`,
    tags: [TAG],
    summary: 'Configurar o Slack',
    description: `Canal por time (um canal por departamento, mais o padrão), eventos enviados (chaves de \`SD_NOTIFICATION_EVENTS\`), abertura de chamado por mensagem e espelhamento das respostas da thread. ${ADMIN}`,
    consent: true,
    params: { id: 'Id do workspace.' },
    body: UpdateSdSlackConfigSchema,
    responses: {
      200: { description: 'Integração salva.', schema: SdIntegrationDTO },
    },
    errors: [
      ...ADMIN_ERRORS,
      NOT_CONNECTED,
      {
        code: 'SD_CONFIG_NOT_FOUND',
        when: 'Departamento de outra workspace no mapa de canais',
      },
    ],
  },
  {
    method: 'delete',
    path: `${BASE}/slack`,
    tags: [TAG],
    summary: 'Desconectar o Slack',
    description: `A integração sai da aba, o token é apagado e o webhook deixa de ser aceito. Os vínculos de thread já registrados continuam no histórico dos chamados. ${ADMIN}`,
    consent: true,
    params: { id: 'Id do workspace.' },
    responses: { 200: { description: 'Desconectado.', schema: null } },
    errors: [...ADMIN_ERRORS, NOT_CONNECTED],
  },

  /* ----------------------------------- GitHub ----------------------------------- */

  {
    method: 'post',
    path: `${BASE}/github`,
    tags: [TAG],
    summary: 'Conectar um repositório do GitHub',
    description: `Guarda o repositório (\`owner/repo\` ou a URL), o token do workspace e o segredo do webhook, os dois cifrados com \`CONNECTION_SECRETS\`. O acesso é validado na API do GitHub **antes** de guardar, e o \`externalId\` fica com o nome canônico que o GitHub devolve — é com ele que o \`repository.full_name\` do webhook casa. ${SECRECY} ${ADMIN}`,
    consent: true,
    params: { id: 'Id do workspace.' },
    body: ConnectSdGithubSchema,
    responses: {
      201: { description: 'Repositório conectado.', schema: SdIntegrationDTO },
    },
    errors: [...ADMIN_ERRORS, REQUEST_FAILED],
  },
  {
    method: 'patch',
    path: `${BASE}/github`,
    tags: [TAG],
    summary: 'Configurar o GitHub',
    description: `Troca o token (revalidado no GitHub) ou o segredo do webhook e liga/desliga a sugestão de fase e a abertura de issue a partir do chamado. ${SECRECY} ${ADMIN}`,
    consent: true,
    params: { id: 'Id do workspace.' },
    body: UpdateSdGithubConfigSchema,
    responses: {
      200: { description: 'Integração salva.', schema: SdIntegrationDTO },
    },
    errors: [...ADMIN_ERRORS, NOT_CONNECTED, REQUEST_FAILED],
  },
  {
    method: 'delete',
    path: `${BASE}/github`,
    tags: [TAG],
    summary: 'Desconectar o GitHub',
    description: `O repositório sai da aba, o token é apagado e o webhook deixa de ser aceito. Os vínculos já registrados continuam no histórico dos chamados. ${ADMIN}`,
    consent: true,
    params: { id: 'Id do workspace.' },
    responses: { 200: { description: 'Desconectado.', schema: null } },
    errors: [...ADMIN_ERRORS, NOT_CONNECTED],
  },
  {
    method: 'post',
    path: `${BASE}/github/issues`,
    tags: [TAG],
    summary: 'Abrir issue a partir do chamado',
    description: `Abre a issue no repositório conectado com o título, o contexto (tipo, prioridade) e o link do chamado, e grava o vínculo. Vale para **problema e mudança** — o trabalho técnico de um incidente ou requisição vive no próprio chamado. ${AGENT}`,
    consent: true,
    params: { id: 'Id do workspace.' },
    body: CreateSdGithubIssueSchema,
    responses: {
      201: {
        description: 'Issue aberta e vinculada.',
        schema: SdIntegrationLinkDTO,
      },
    },
    errors: [
      ...AGENT_ERRORS,
      NOT_CONNECTED,
      NOT_CONFIGURED,
      REQUEST_FAILED,
      'SD_TICKET_NOT_FOUND',
      { code: 'SD_TICKET_FORBIDDEN', when: 'Chamado fora do seu alcance' },
      { code: 'SD_TICKET_CLOSED', when: 'Chamado fechado ou cancelado' },
      {
        code: 'VALIDATION_ERROR',
        when: 'Chamado que não é problema nem mudança, ou abertura desligada na configuração',
      },
    ],
  },

  /* ----------------------------------- vínculos ----------------------------------- */

  {
    method: 'get',
    path: `${BASE}/links`,
    tags: [TAG],
    summary: 'Listar vínculos do chamado',
    description: `Thread do Slack e issues/PRs do chamado, com o último estado conhecido e o rótulo em pt-BR. É o bloco "Integrações" da tela do chamado — só agentes. ${AGENT}`,
    params: { id: 'Id do workspace.' },
    query: ListSdIntegrationLinksSchema,
    responses: {
      200: {
        description: 'Vínculos do chamado.',
        schema: z.array(SdIntegrationLinkDTO),
      },
    },
    errors: [
      ...AGENT_ERRORS,
      'SD_TICKET_NOT_FOUND',
      { code: 'SD_TICKET_FORBIDDEN', when: 'Chamado fora do seu alcance' },
    ],
  },
  {
    method: 'post',
    path: `${BASE}/links`,
    tags: [TAG],
    summary: 'Vincular uma issue/PR ao chamado',
    description: `Aceita \`#42\`, \`42\`, \`owner/repo#42\` ou a URL. O tipo (issue × pull request) e o estado vêm da API do GitHub, não do texto. Item de outro repositório é recusado, e um item já vinculado responde \`SD_INTEGRATION_LINK_EXISTS\`. ${AGENT}`,
    consent: true,
    params: { id: 'Id do workspace.' },
    body: LinkSdGithubItemSchema,
    responses: {
      201: { description: 'Vínculo criado.', schema: SdIntegrationLinkDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      NOT_CONNECTED,
      NOT_CONFIGURED,
      REQUEST_FAILED,
      'SD_TICKET_NOT_FOUND',
      { code: 'SD_TICKET_FORBIDDEN', when: 'Chamado fora do seu alcance' },
      { code: 'SD_TICKET_CLOSED', when: 'Chamado fechado ou cancelado' },
      {
        code: 'SD_INTEGRATION_LINK_EXISTS',
        when: 'Item já vinculado a este ou a outro chamado',
      },
      {
        code: 'VALIDATION_ERROR',
        when: 'Referência irreconhecível ou de outro repositório',
      },
    ],
  },
  {
    method: 'delete',
    path: `${BASE}/links/{linkId}`,
    tags: [TAG],
    summary: 'Desvincular',
    description: `Remove o vínculo do chamado. Não mexe na issue/PR do GitHub nem na thread do Slack. ${AGENT}`,
    consent: true,
    params: {
      id: 'Id do workspace.',
      linkId: 'Id do vínculo (`SdIntegrationLink`).',
    },
    responses: { 200: { description: 'Vínculo removido.', schema: null } },
    errors: [
      ...AGENT_ERRORS,
      'SD_INTEGRATION_LINK_NOT_FOUND',
      { code: 'SD_TICKET_FORBIDDEN', when: 'Chamado fora do seu alcance' },
    ],
  },

  /* ----------------------------------- webhooks ----------------------------------- */

  {
    method: 'post',
    path: '/servicedesk/integrations/slack',
    tags: [TAG],
    auth: 'public',
    rateLimit: 'ip',
    summary: 'Receber evento do Slack (público)',
    description: `Endereço único para as três coisas que o Slack manda, reconhecidas pelo \`Content-Type\` e pelo corpo:

1. **url_verification** (JSON): responde o \`challenge\` em texto puro, como o painel do app espera;
2. **event_callback** (JSON): resposta numa thread vinculada vira mensagem **pública** no histórico do chamado. O autor é casado com a conta do Steel pelo e-mail do Slack; sem conta, fica registrado como autor externo (ator de sistema) com o nome no corpo — mesma saída do e-mail e do WhatsApp;
3. **atalho de mensagem / slash command** (\`application/x-www-form-urlencoded\`): abre o chamado com os padrões da integração (tipo, departamento), canal \`API\` e ator de sistema, responde na thread com o código e o link e grava o vínculo \`SLACK_THREAD\`.

Sem sessão: o acesso é a assinatura \`X-Slack-Signature\` + \`X-Slack-Request-Timestamp\` (HMAC-SHA256 do *signing secret* do app sobre \`v0:<timestamp>:<corpo bruto>\`, comparação em tempo constante), conferida **antes** de o corpo ser interpretado; timestamp fora de 5 minutos é recusado. Idempotente por \`event_id\`/\`trigger_id\` (trava de 2 h no Redis): o Slack reentrega.`,
    headers: {
      'X-Slack-Signature': {
        description: '`v0=<hex>` do HMAC-SHA256.',
        required: true,
      },
      'X-Slack-Request-Timestamp': {
        description: 'Segundos desde a época; janela de 5 minutos.',
        required: true,
      },
    },
    body: {
      schema: SdSlackWebhookPayload,
      description:
        'Envelope de eventos do Slack ou o formulário do atalho/comando.',
    },
    responses: {
      200: { description: 'Evento processado.', schema: SdSlackInboundDTO },
    },
    errors: [
      SIGNATURE_INVALID,
      NOT_CONFIGURED,
      { code: 'VALIDATION_ERROR', when: 'Corpo irreconhecível' },
      { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
    ],
  },
  {
    method: 'post',
    path: '/servicedesk/integrations/github',
    tags: [TAG],
    auth: 'public',
    rateLimit: 'ip',
    summary: 'Receber webhook do GitHub (público)',
    description: `Espelha o estado da issue/PR vinculada: \`closed\`, \`reopened\` e \`merged\` atualizam \`externalState\`, registram o evento na rastreabilidade e publicam uma mensagem no chamado. Com \`suggestPhaseOnClose\` (padrão), fechar/mesclar **sugere** avançar a fase — quem move a fase é o agente, porque em ITIL o encerramento exige solução, classificação e às vezes aprovação.

Sem sessão: \`repository.full_name\` serve apenas para achar a integração e o segredo; nada é gravado antes do HMAC \`X-Hub-Signature-256\` fechar sobre o corpo bruto (comparação em tempo constante). Idempotente por \`X-GitHub-Delivery\`. Evento de item não vinculado responde \`unlinked\` sem efeito, e \`ping\` é ignorado.

Além do webhook, o job \`sync-github-state\` reconcilia de hora em hora (cron \`40 * * * *\`) o estado dos vínculos de chamados abertos — a rede de proteção para um webhook perdido.`,
    headers: {
      'X-Hub-Signature-256': {
        description: '`sha256=<hex>` do HMAC com o segredo do repositório.',
        required: true,
      },
      'X-GitHub-Event': {
        description: '`issues`, `pull_request` ou `ping`.',
        required: true,
      },
      'X-GitHub-Delivery': { description: 'Chave de idempotência.' },
    },
    body: {
      schema: SdGithubWebhookPayload,
      description: 'Payload de `issues` ou `pull_request`.',
    },
    responses: {
      200: { description: 'Webhook processado.', schema: SdGithubWebhookDTO },
    },
    errors: [
      SIGNATURE_INVALID,
      NOT_CONFIGURED,
      { code: 'VALIDATION_ERROR', when: 'Corpo inválido ou sem repositório' },
      { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
    ],
  },
]
