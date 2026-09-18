import type { OpenApiRegistry, RouteConfig } from '../registry'

/**
 * CRM interno — `app/api/workspaces/[id]/crm/**` (sessão + membro do
 * workspace + módulo CRM habilitado; use `MODULE_MEMBER_ERRORS` de
 * `../common`). As APIs públicas do CRM (`/crm/*`) ficam em `./public.ts`.
 *
 * Ainda a documentar: as operações pendentes estão em
 * `../undocumented/crm.ts`. Ao registrar uma rota aqui, remova a linha
 * correspondente de lá (o teste de cobertura falha se ela ficar nos dois
 * lugares) e rode `pnpm openapi:generate`. Tags `CRM · ...` em `../tags.ts`.
 *
 * Exemplo:
 *
 *   {
 *     method: 'get',
 *     path: '/workspaces/{id}/crm/leads',
 *     tags: ['CRM · Leads'],
 *     summary: 'Listar leads',
 *     query: ListCrmLeadsQuerySchema,
 *     responses: { 200: { description: 'Leads.', schema: z.array(CrmLeadDTO) } },
 *     errors: MODULE_MEMBER_ERRORS,
 *   },
 */
const routes: RouteConfig[] = []

export function registerCrmPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
