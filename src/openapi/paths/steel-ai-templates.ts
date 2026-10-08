import { WORKSPACE_MEMBER_ERRORS } from '../common'
import type { OpenApiRegistry, RouteConfig } from '../registry'
import { AiTemplatesDTO } from '../schemas/steel-ai-templates'

/** Steel AI — modelos prontos para admins (`/workspaces/{id}/ai/templates`). */

const routes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/ai/templates',
    tags: ['Steel AI'],
    summary: 'Listar modelos prontos',
    description:
      'Galeria de modelos de Steel Agents e de skills, definidos no código, para OWNER/ADMIN. Cada modelo diz quais módulos exige e, se algum estiver desligado, vem com `available: false` e o motivo. Usar um modelo só preenche o editor: criar continua sendo `POST /workspaces/{id}/agents` ou `POST /workspaces/{id}/ai/skills`, com as mesmas regras. Membros e visualizadores recebem `canUse: false` e listas vazias.',
    responses: {
      200: { description: 'Modelos.', schema: AiTemplatesDTO },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
]

export function registerSteelAiTemplatesPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
