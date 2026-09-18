import type { OpenApiRegistry, RouteConfig } from '../registry'
import { crmIntegrationsRoutes } from './crm/integrations'
import { crmPeopleRoutes } from './crm/people'
import { crmProductsRoutes } from './crm/products'
import { crmSettingsRoutes } from './crm/settings'

/**
 * CRM interno — `app/api/workspaces/[id]/crm/**` (sessão + membro do
 * workspace + módulo CRM habilitado + permissão recurso × ação; peças comuns
 * em `./crm/shared.ts`). As APIs públicas do CRM (`/crm/*`) ficam em
 * `./public.ts`. Cada grupo de tags tem seu arquivo em `./crm/`; os DTOs de
 * resposta ficam em `../schemas/crm/`.
 */
const routes: RouteConfig[] = [
  ...crmIntegrationsRoutes,
  ...crmSettingsRoutes,
  ...crmPeopleRoutes,
]

export function registerCrmPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
