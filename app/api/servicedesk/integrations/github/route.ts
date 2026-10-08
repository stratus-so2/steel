/**
 * Legacy GitHub webhook path, kept so the webhooks already registered in the
 * repositories keep working after the move to the workspace level
 * (ADR 0024). Same handler as `/api/integrations/github/webhook`.
 */
export { POST } from '@/app/api/integrations/github/webhook/route'
