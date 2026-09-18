import type { OpenApiRegistry, RouteConfig } from '../registry'
import { connectionRoutes } from './whatsapp/connections'
import { contactRoutes } from './whatsapp/contacts'
import { conversationRoutes } from './whatsapp/conversations'
import { groupRoutes } from './whatsapp/groups'

/**
 * Comunicação (WhatsApp) — `app/api/workspaces/[id]/whatsapp/**` (sessão +
 * membro + módulo COMMUNICATION; peças comuns em `./whatsapp/shared`), o SSE
 * `app/api/whatsapp/events` e os webhooks de entrada
 * `app/api/whatsapp/webhook/{meta,zapi}`. Uma lista de rotas por tag em
 * `./whatsapp/*.ts`; DTOs em `../schemas/whatsapp`.
 */
const routes: RouteConfig[] = [
  ...connectionRoutes,
  ...conversationRoutes,
  ...contactRoutes,
  ...groupRoutes,
]

export function registerWhatsAppPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
