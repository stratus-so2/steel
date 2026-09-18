import type { OpenApiRegistry, RouteConfig } from '../registry'

/**
 * Comunicação (WhatsApp) — `app/api/workspaces/[id]/whatsapp/**` (sessão +
 * membro + módulo COMMUNICATION; use `MODULE_MEMBER_ERRORS` de `../common`),
 * o SSE `app/api/whatsapp/events` e os webhooks de entrada
 * `app/api/whatsapp/webhook/{meta,zapi}` (`auth: 'metaWebhook'` /
 * `'zapiWebhook'`; a verificação `GET` da Meta usa `hub.*` na query).
 *
 * Ainda a documentar: as operações pendentes estão em
 * `../undocumented/whatsapp.ts`. Ao registrar uma rota aqui, remova a linha
 * correspondente de lá e rode `pnpm openapi:generate`. Tags
 * `Comunicação · ...` em `../tags.ts`.
 */
const routes: RouteConfig[] = []

export function registerWhatsAppPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
