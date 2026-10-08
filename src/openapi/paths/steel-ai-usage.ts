import {
  AiUsageAnalyticsQuerySchema,
  AiUsageExportQuerySchema,
} from '@/src/schemas/ai-usage.schema'
import { WORKSPACE_MEMBER_ERRORS } from '../common'
import type { ErrorEntry, OpenApiRegistry, RouteConfig } from '../registry'
import {
  AiUsageAnalyticsDTO,
  AiUsageOverviewDTO,
} from '../schemas/steel-ai-usage'

/** Steel AI — Uso e Análises (`/workspaces/{id}/ai/usage/**`). */

const TAG = 'Steel AI' as const

const CLOCK =
  'Valores em US$ pelo custo real congelado no razão `ai_usage` (ADR 0019); dias, semanas (segunda a domingo) e meses em **UTC**, o mesmo relógio da cota.'

const SCOPE_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro, ou pediu `scope=workspace` sem ser OWNER/ADMIN',
  },
  'WORKSPACE_SUSPENDED',
]

const routes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/ai/usage',
    tags: [TAG],
    summary: 'Uso de IA do usuário',
    description: `Gasto acumulado do usuário e do espaço de trabalho no mês e na semana atuais, contra a cota mensal (compartilhada — não há limite por pessoa) e a parcela semanal (cota × 7 ÷ dias do mês); comparação com o período anterior no mesmo ponto e projeção linear. Qualquer membro. ${CLOCK}`,
    responses: {
      200: { description: 'Uso do usuário.', schema: AiUsageOverviewDTO },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/ai/usage/analytics',
    tags: [TAG],
    summary: 'Análises de uso de IA',
    description: `Totais e quebras por modelo, recurso (\`AiUsage.feature\`) e escopo (módulo) de um período; \`scope=workspace\` (OWNER/ADMIN) soma todo o espaço e acrescenta a quebra por usuário. ${CLOCK}`,
    query: AiUsageAnalyticsQuerySchema,
    responses: {
      200: { description: 'Análises.', schema: AiUsageAnalyticsDTO },
    },
    errors: SCOPE_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/ai/usage/export',
    tags: [TAG],
    summary: 'Exportar uso de IA (CSV)',
    description: `CSV em UTF-8 com BOM, transmitido em partes. \`view=rows\`: uma linha por chamada (\`data_utc, usuario, email, recurso, codigo_recurso, provedor, modelo, escopo, tokens_entrada, tokens_saida, custo_usd\`), mais antigas primeiro. Demais \`view\`: totais agregados (\`chave, nome, detalhe, chamadas, tokens_entrada, tokens_saida, custo_usd, participacao_percentual\`). Células de texto que começam com \`=\`, \`+\`, \`-\` ou \`@\` ganham \`'\` na frente (proteção contra fórmulas). Erros antes do primeiro byte voltam no envelope JSON; falha no meio interrompe o download. Auditado. ${CLOCK}`,
    query: AiUsageExportQuerySchema,
    responses: {
      200: {
        description: 'Arquivo CSV.',
        envelope: false,
        contentType: 'text/csv',
        schema: { type: 'string' },
        example:
          'data_utc,usuario,email,recurso,codigo_recurso,provedor,modelo,escopo,tokens_entrada,tokens_saida,custo_usd\r\n2026-10-02T10:00:00.000Z,Ana,ana@exemplo.com,Steel AI (assistente),STEEL_ASSISTANT,openai,GPT-4o mini,CRM,3200,450,0.00075\r\n',
        headers: {
          'Content-Disposition': {
            description:
              '`attachment; filename="steel-ai-uso-<pessoal|workspace>-<view>-<de>_<até>.csv"`',
          },
        },
      },
    },
    errors: [
      ...SCOPE_ERRORS,
      {
        code: 'VALIDATION_ERROR',
        when: '`view=user` fora do escopo `workspace`',
      },
    ],
  },
]

export function registerSteelAiUsagePaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
