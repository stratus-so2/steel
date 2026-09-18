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
  'GET /whatsapp/events',
  'GET /whatsapp/webhook/meta',
  'GET /whatsapp/webhook/zapi',
  'POST /whatsapp/webhook/meta',
  'POST /whatsapp/webhook/zapi',
]
