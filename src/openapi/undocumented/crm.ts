/**
 * Operações de CRM (`/workspaces/{id}/crm/**`) ainda **sem documentação** no OpenAPI.
 *
 * Esta lista só encolhe: ao documentar uma rota (em `../paths/`), remova a
 * linha daqui — o teste `src/openapi/__tests__/openapi.test.ts` falha se a
 * operação estiver documentada e aqui ao mesmo tempo, se a rota não existir
 * mais, ou se uma entrada sair do escopo deste arquivo. Rotas novas devem
 * nascer documentadas, nunca entrar aqui.
 */
export const UNDOCUMENTED_CRM: readonly string[] = [
  'DELETE /workspaces/{id}/crm/ai/conversations/{conversationId}',
  'DELETE /workspaces/{id}/crm/competitors/{competitorId}',
  'DELETE /workspaces/{id}/crm/hook-vault/{itemId}',
  'DELETE /workspaces/{id}/crm/scheduled-posts/{postId}',
  'DELETE /workspaces/{id}/crm/social-connections/{connectionId}',
  'DELETE /workspaces/{id}/crm/social/{platform}/posts/{postId}',
  'GET /workspaces/{id}/crm/ai/conversations',
  'GET /workspaces/{id}/crm/ai/conversations/{conversationId}',
  'GET /workspaces/{id}/crm/competitors',
  'GET /workspaces/{id}/crm/competitors/{competitorId}/metrics',
  'GET /workspaces/{id}/crm/hook-vault',
  'GET /workspaces/{id}/crm/scheduled-posts',
  'GET /workspaces/{id}/crm/scheduled-posts/{postId}',
  'GET /workspaces/{id}/crm/social-connections',
  'GET /workspaces/{id}/crm/social-trending',
  'GET /workspaces/{id}/crm/social/{platform}/connect',
  'GET /workspaces/{id}/crm/social/{platform}/engagement',
  'GET /workspaces/{id}/crm/social/{platform}/insights',
  'GET /workspaces/{id}/crm/social/{platform}/overview',
  'GET /workspaces/{id}/crm/social/{platform}/publish/{jobId}',
  'GET /workspaces/{id}/crm/social/{platform}/stories',
  'GET /workspaces/{id}/crm/social/{platform}/videos',
  'PATCH /workspaces/{id}/crm/competitors/reorder',
  'PATCH /workspaces/{id}/crm/competitors/{competitorId}',
  'PATCH /workspaces/{id}/crm/hook-vault/reorder',
  'PATCH /workspaces/{id}/crm/hook-vault/{itemId}',
  'PATCH /workspaces/{id}/crm/scheduled-posts/{postId}',
  'PATCH /workspaces/{id}/crm/social-connections/{connectionId}/primary',
  'POST /workspaces/{id}/crm/ai/conversations',
  'POST /workspaces/{id}/crm/ai/conversations/{conversationId}/attachments',
  'POST /workspaces/{id}/crm/ai/conversations/{conversationId}/messages',
  'POST /workspaces/{id}/crm/competitors',
  'POST /workspaces/{id}/crm/competitors/preview',
  'POST /workspaces/{id}/crm/competitors/sync',
  'POST /workspaces/{id}/crm/hook-vault',
  'POST /workspaces/{id}/crm/scheduled-posts',
  'POST /workspaces/{id}/crm/scheduled-posts/{postId}/cancel',
  'POST /workspaces/{id}/crm/scheduled-posts/{postId}/publish',
  'POST /workspaces/{id}/crm/scheduled-posts/{postId}/reschedule',
  'POST /workspaces/{id}/crm/social-connections',
  'POST /workspaces/{id}/crm/social/{platform}/publish',
]
