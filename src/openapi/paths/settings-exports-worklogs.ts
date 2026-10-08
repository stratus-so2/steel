import {
  ProductivityQuerySchema,
  WorklogExportQuerySchema,
  WorklogListQuerySchema,
} from '@/src/schemas/worklog.schema'
import { CreateWorkspaceExportSchema } from '@/src/schemas/workspace-export.schema'
import { WORKSPACE_MEMBER_ERRORS, WORKSPACE_PRIVILEGED_ERRORS } from '../common'
import type { ErrorEntry, OpenApiRegistry, RouteConfig } from '../registry'
import {
  ProductivityDTO,
  WorklogListDTO,
  WorkspaceExportDTO,
  WorkspaceExportOverviewDTO,
} from '../schemas/settings-exports-worklogs'

/**
 * Ajustes › Exportações (`/workspaces/{id}/exports/**`) e Ajustes ›
 * Registros de trabalho (`/workspaces/{id}/worklogs/**`).
 */

const TAG = 'Configurações do workspace' as const

const SCOPE_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro, ou pediu `userId` de outra pessoa sem ser OWNER/ADMIN',
  },
  'WORKSPACE_SUSPENDED',
]

const DAYS =
  'Dias no fuso do calendário de expediente padrão do ServiceDesk (sem calendário: `America/Sao_Paulo`).'

const routes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/exports',
    tags: [TAG],
    summary: 'Exportações do workspace',
    description:
      'Histórico das exportações (quem pediu, quando, tipo, situação, tamanho e link enquanto válido) e o que pode ser pedido hoje: cada tipo uma vez por dia (dia civil em São Paulo). Só OWNER/ADMIN.',
    responses: {
      200: { description: 'Exportações.', schema: WorkspaceExportOverviewDTO },
    },
    errors: WORKSPACE_PRIVILEGED_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/exports',
    tags: [TAG],
    summary: 'Pedir exportação',
    description:
      '`DATA`: todas as tabelas do workspace (um JSON e um CSV por tabela, num ZIP; credenciais e tokens removidos). `LOGS`: os eventos do workspace no Axiom (requisições e auditoria) dos últimos 1, 7 ou 30 dias, em CSV e NDJSON. O arquivo é montado pela fila `workspace-export`, fica 7 dias no armazenamento e o solicitante recebe notificação e e-mail. Uma de cada tipo por dia por workspace; falha libera o dia. Auditado. Só OWNER/ADMIN.',
    body: { schema: CreateWorkspaceExportSchema, example: { kind: 'DATA' } },
    responses: {
      202: { description: 'Exportação na fila.', schema: WorkspaceExportDTO },
    },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      {
        code: 'WORKSPACE_EXPORT_LIMIT_REACHED',
        when: 'Já houve uma exportação desse tipo hoje; `details.nextAvailableAt` diz quando libera',
      },
      {
        code: 'WORKSPACE_EXPORT_LOGS_UNAVAILABLE',
        when: '`LOGS` sem `AXIOM_QUERY_TOKEN` configurado no servidor',
      },
      {
        code: 'WORKSPACE_EXPORT_NOT_READY',
        when: 'A fila não aceitou o job (o dia fica livre)',
      },
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/exports/{exportId}/download',
    tags: [TAG],
    summary: 'Baixar exportação',
    description:
      'Transmite o ZIP do armazenamento (a API do MinIO não é pública). Só OWNER/ADMIN e só enquanto não expirou. Auditado.',
    params: { exportId: 'ID da exportação.' },
    responses: {
      200: {
        description: 'Arquivo ZIP (`Content-Disposition: attachment`).',
        envelope: false,
        contentType: 'application/zip',
        schema: { type: 'string', format: 'binary' },
      },
    },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      'WORKSPACE_EXPORT_NOT_FOUND',
      {
        code: 'WORKSPACE_EXPORT_NOT_READY',
        when: 'Ainda em andamento, falhou ou expirou',
      },
      { code: 'STORAGE_ERROR', message: 'Arquivo da exportação indisponível' },
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/worklogs',
    tags: [TAG],
    summary: 'Registros de trabalho',
    description: `Apontamentos de horas fechados do ServiceDesk, com filtros (período, pessoa, chamado, faturável, origem), totais e paginação. OWNER/ADMIN veem todos; os demais só os próprios. Com o ServiceDesk desligado responde a lista vazia e \`serviceDeskEnabled: false\`. ${DAYS}`,
    query: WorklogListQuerySchema,
    responses: { 200: { description: 'Registros.', schema: WorklogListDTO } },
    errors: [
      ...SCOPE_ERRORS,
      { code: 'VALIDATION_ERROR', when: 'Código de chamado ilegível' },
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/worklogs/export',
    tags: [TAG],
    summary: 'Exportar registros de trabalho (CSV)',
    description: `CSV em UTF-8 com BOM do conjunto filtrado, transmitido em partes (\`inicio, fim, minutos, horas, pessoa, email, chamado, titulo_chamado, faturavel, origem, valor, descricao\`), datas no fuso do expediente. Células que começam com \`=\`, \`+\`, \`-\` ou \`@\` ganham \`'\`. Auditado. ${DAYS}`,
    query: WorklogExportQuerySchema,
    responses: {
      200: {
        description: 'Arquivo CSV.',
        envelope: false,
        contentType: 'text/csv',
        schema: { type: 'string' },
      },
    },
    errors: [...SCOPE_ERRORS, 'MODULE_DISABLED'],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/worklogs/productivity',
    tags: [TAG],
    summary: 'Indicadores de produtividade',
    description: `Indicadores **separados** — sem nota combinada e sem ranking (pessoas em ordem alfabética) — do período e do período anterior de mesma duração, mais a tendência semanal: esforço (horas, utilização sobre o expediente), faturamento, volume (chamados resolvidos, tarefas concluídas e negócios ganhos no CRM, conversas atendidas no WhatsApp), eficiência (horas por chamado, primeira resposta e resolução em minutos úteis), qualidade (SLA cumprido, reabertura) e confiabilidade (horas por cronômetro, dias úteis sem registro). Só entram os módulos habilitados. OWNER/ADMIN veem a equipe e cada pessoa; os demais só a si mesmos. ${DAYS}`,
    query: ProductivityQuerySchema,
    responses: {
      200: { description: 'Indicadores.', schema: ProductivityDTO },
    },
    errors: [
      ...SCOPE_ERRORS,
      { code: 'VALIDATION_ERROR', when: '`userId` não é membro do workspace' },
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/worklogs/productivity/export',
    tags: [TAG],
    summary: 'Exportar indicadores de produtividade (CSV)',
    description:
      'Os mesmos indicadores em CSV (UTF-8 com BOM): uma linha por pessoa (e pela equipe) para o período atual e outra para o anterior; percentuais × 100. Auditado.',
    query: ProductivityQuerySchema,
    responses: {
      200: {
        description: 'Arquivo CSV.',
        envelope: false,
        contentType: 'text/csv',
        schema: { type: 'string' },
      },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      { code: 'VALIDATION_ERROR', when: '`userId` não é membro do workspace' },
    ],
  },
]

export function registerSettingsExportsWorklogsPaths(
  registry: OpenApiRegistry,
): void {
  for (const route of routes) registry.registerRoute(route)
}
