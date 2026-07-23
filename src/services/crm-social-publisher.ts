import type { CrmSocialPlatformDTO } from '@/types/crm-social'

export type CrmSocialPublishResult =
  | { ok: true; externalPostId: string }
  | { ok: false; error: string }

// Nenhuma plataforma tem client OAuth real configurado — publicar aqui
// exigiria credenciais de app da Meta/TikTok/YouTube/X/LinkedIn que não
// foram fornecidas para este módulo. Mantido como um ponto de extensão
// único: trocar este stub por chamadas reais por plataforma quando as
// credenciais existirem, sem tocar no restante do fluxo de agendamento.
export async function publishToSocialPlatform(
  platform: CrmSocialPlatformDTO,
): Promise<CrmSocialPublishResult> {
  return {
    ok: false,
    error: `Publicação real em ${platform} não está configurada — requer credenciais de app OAuth desta plataforma.`,
  }
}
