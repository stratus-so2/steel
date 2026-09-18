/**
 * Operações de Comunicação (`/workspaces/{id}/whatsapp/**` e `/whatsapp/**`) ainda **sem documentação** no OpenAPI.
 *
 * Esta lista só encolhe: ao documentar uma rota (em `../paths/`), remova a
 * linha daqui — o teste `src/openapi/__tests__/openapi.test.ts` falha se a
 * operação estiver documentada e aqui ao mesmo tempo, se a rota não existir
 * mais, ou se uma entrada sair do escopo deste arquivo. Rotas novas devem
 * nascer documentadas, nunca entrar aqui.
 */
export const UNDOCUMENTED_WHATSAPP: readonly string[] = [
  'DELETE /workspaces/{id}/whatsapp/ai-config/knowledge-documents/{documentId}',
  'DELETE /workspaces/{id}/whatsapp/dashboards/{dashboardId}',
  'DELETE /workspaces/{id}/whatsapp/dashboards/{dashboardId}/widgets/{widgetId}',
  'DELETE /workspaces/{id}/whatsapp/quick-replies/{quickReplyId}',
  'DELETE /workspaces/{id}/whatsapp/reports/{reportId}',
  'GET /whatsapp/events',
  'GET /whatsapp/webhook/meta',
  'GET /whatsapp/webhook/zapi',
  'GET /workspaces/{id}/whatsapp/ai-config',
  'GET /workspaces/{id}/whatsapp/ai-config/knowledge-documents',
  'GET /workspaces/{id}/whatsapp/assignable-members',
  'GET /workspaces/{id}/whatsapp/dashboards',
  'GET /workspaces/{id}/whatsapp/dashboards/{dashboardId}/widgets',
  'GET /workspaces/{id}/whatsapp/quick-replies',
  'GET /workspaces/{id}/whatsapp/reports',
  'GET /workspaces/{id}/whatsapp/reports/{reportId}',
  'GET /workspaces/{id}/whatsapp/reports/{reportId}/data',
  'GET /workspaces/{id}/whatsapp/reports/{reportId}/export',
  'GET /workspaces/{id}/whatsapp/settings',
  'GET /workspaces/{id}/whatsapp/templates',
  'PATCH /workspaces/{id}/whatsapp/ai-config',
  'PATCH /workspaces/{id}/whatsapp/dashboards/{dashboardId}',
  'PATCH /workspaces/{id}/whatsapp/dashboards/{dashboardId}/widgets/{widgetId}',
  'PATCH /workspaces/{id}/whatsapp/quick-replies/{quickReplyId}',
  'PATCH /workspaces/{id}/whatsapp/reports/{reportId}',
  'PATCH /workspaces/{id}/whatsapp/settings',
  'POST /whatsapp/webhook/meta',
  'POST /whatsapp/webhook/zapi',
  'POST /workspaces/{id}/whatsapp/ai-config/knowledge-documents',
  'POST /workspaces/{id}/whatsapp/dashboards',
  'POST /workspaces/{id}/whatsapp/dashboards/{dashboardId}/widgets',
  'POST /workspaces/{id}/whatsapp/dashboards/{dashboardId}/widgets/layout',
  'POST /workspaces/{id}/whatsapp/media/upload',
  'POST /workspaces/{id}/whatsapp/quick-replies',
  'POST /workspaces/{id}/whatsapp/reports',
  'POST /workspaces/{id}/whatsapp/templates',
  'POST /workspaces/{id}/whatsapp/templates/sync',
]
