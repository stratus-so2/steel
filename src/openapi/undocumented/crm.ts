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
  'DELETE /workspaces/{id}/crm/hook-vault/{itemId}',
  'GET /workspaces/{id}/crm/ai/conversations',
  'GET /workspaces/{id}/crm/ai/conversations/{conversationId}',
  'GET /workspaces/{id}/crm/hook-vault',
  'PATCH /workspaces/{id}/crm/hook-vault/reorder',
  'PATCH /workspaces/{id}/crm/hook-vault/{itemId}',
  'POST /workspaces/{id}/crm/ai/conversations',
  'POST /workspaces/{id}/crm/ai/conversations/{conversationId}/attachments',
  'POST /workspaces/{id}/crm/ai/conversations/{conversationId}/messages',
  'POST /workspaces/{id}/crm/hook-vault',
]
