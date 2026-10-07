import { SearchQuerySchema } from '@/src/schemas/search.schema'
import { WORKSPACE_MEMBER_ERRORS } from '../common'
import type { OpenApiRegistry, RouteConfig } from '../registry'
import { SearchResponseDTO } from '../schemas/search'

/** Busca global (`/workspaces/{id}/search`). */

const routes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/search',
    tags: ['Busca global'],
    summary: 'Buscar no workspace',
    description:
      'Busca por relevância, sem varredura `LIKE`: código/número exato (`INC-000123`, `123`, telefone, e-mail) primeiro, depois prefixo e frase no título, texto completo em português (sem acento, com radical) e, por fim, semelhança por trigramas para erros de digitação. Registros recentes e atribuídos ao usuário sobem um pouco. Só entram tipos de módulos habilitados com permissão `VIEW`; no ServiceDesk, solicitantes veem apenas os próprios chamados e os artigos do portal. `types` (separados por vírgula) restringe os tipos.',
    query: SearchQuerySchema,
    responses: {
      200: {
        description: 'Resultados em ordem global de relevância.',
        schema: SearchResponseDTO,
      },
    },
    errors: [...WORKSPACE_MEMBER_ERRORS, 'RATE_LIMITED'],
  },
]

export function registerSearchPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
