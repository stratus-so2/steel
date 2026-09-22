import type { OpenApiRegistry, RouteConfig } from '../registry'
import { sdDirectoryRoutes } from './servicedesk/directory'

/**
 * ServiceDesk — `app/api/workspaces/[id]/servicedesk/**` (sessão + membro +
 * módulo SERVICE_DESK + `SdAccess`). Cada fatia tem seu arquivo em
 * `./servicedesk/`; os DTOs ficam em `../schemas/servicedesk/`.
 */
const routes: RouteConfig[] = [...sdDirectoryRoutes]

export function registerServiceDeskPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
