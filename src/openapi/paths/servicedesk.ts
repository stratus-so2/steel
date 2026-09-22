import type { OpenApiRegistry, RouteConfig } from '../registry'
import { sdConfigRoutes } from './servicedesk/config'
import { sdDirectoryRoutes } from './servicedesk/directory'

/**
 * ServiceDesk — `app/api/workspaces/[id]/servicedesk/**` (sessão + membro +
 * módulo SERVICE_DESK; admin × agente × solicitante no service). Uma lista
 * de rotas por fatia em `./servicedesk/*.ts`; DTOs em
 * `../schemas/servicedesk-*.ts`.
 */
const routes: RouteConfig[] = [...sdConfigRoutes, ...sdDirectoryRoutes]

export function registerServiceDeskPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
