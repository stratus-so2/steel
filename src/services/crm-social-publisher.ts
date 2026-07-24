import type { CrmSocialPlatformDTO } from '@/types/crm-social'
import * as CrmSocialFacebookService from './crm-social-facebook.service'
import * as CrmSocialLinkedinService from './crm-social-linkedin.service'
import { publishTweetPost } from './crm-social-twitter.service'

export type CrmSocialPublishResult =
  | { ok: true; externalPostId: string }
  | { ok: false; error: string }

/**
 * Publica um post agendado na plataforma. Só plataformas cujo publish não
 * exige mídia (Facebook, X, LinkedIn) são suportadas aqui — o agendador do
 * Steel (`CrmScheduledPost`) guarda só texto/título, sem upload de arquivo,
 * então Instagram/TikTok/YouTube (que exigem imagem/vídeo para publicar)
 * ficam de fora até o composer ganhar suporte a mídia. Publicar com mídia já
 * funciona nos studios dedicados de cada plataforma, que fazem upload direto.
 */
export async function publishToSocialPlatform(
  actorId: string,
  workspaceId: string,
  platform: CrmSocialPlatformDTO,
  content: string,
): Promise<CrmSocialPublishResult> {
  switch (platform) {
    case 'FACEBOOK': {
      const result = await CrmSocialFacebookService.publishPost(
        actorId,
        workspaceId,
        { message: content, link: null },
        null,
      )
      if (!result.ok) return { ok: false, error: result.error.message }
      return { ok: true, externalPostId: result.value.postId }
    }
    case 'TWITTER': {
      const result = await publishTweetPost(
        actorId,
        workspaceId,
        { text: content },
        null,
      )
      if (!result.ok) return { ok: false, error: result.error.message }
      return { ok: true, externalPostId: result.value.tweetId }
    }
    case 'LINKEDIN': {
      const result = await CrmSocialLinkedinService.publishPost(
        actorId,
        workspaceId,
        { text: content },
        null,
      )
      if (!result.ok) return { ok: false, error: result.error.message }
      return { ok: true, externalPostId: result.value.postUrn }
    }
    default:
      return {
        ok: false,
        error: `Publicação agendada em ${platform} exige mídia (imagem/vídeo) — use o studio dedicado da plataforma para publicar diretamente.`,
      }
  }
}
