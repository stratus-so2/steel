import {
  badRequest,
  crmSocialOauthFailed,
  crmSocialScopeMissing,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import type {
  CrmPublishTiktokVideoInput,
  CrmPublishTiktokVideoResult,
  CrmTiktokCreatorOverview,
  CrmTiktokVideos,
  CrmTiktokWeeklyEngagement,
} from '@/src/schemas/crm-social-tiktok.schema'
import { assertMember } from './authz'
import { getFreshAccessToken } from './crm-social-token'

const API = 'https://open.tiktokapis.com/v2'

/** Limite de um upload em chunk único (a Content Posting API aceita até 64 MiB). */
export const TIKTOK_SINGLE_CHUNK_MAX_BYTES = 64 * 1024 * 1024

type TikTokEnvelope<T> = {
  data?: T
  error?: { code?: string; message?: string; log_id?: string }
}

const REQUIRED_SCOPES = {
  stats: 'user.info.stats',
  videos: 'video.list',
  publish: 'video.publish',
} as const

function hasScope(scope: string | null, needle: string): boolean {
  return (scope ?? '').includes(needle)
}

/** `error.code` ausente ou "ok" = sucesso; qualquer outro é falha de domínio. */
function isTikTokError(error: TikTokEnvelope<unknown>['error']): boolean {
  return Boolean(error?.code && error.code !== 'ok')
}

function logFailure(
  label: string,
  status: number,
  envelope: TikTokEnvelope<unknown>,
): void {
  console.error(
    `[tiktok] ${label} falhou`,
    status,
    JSON.stringify(envelope.error ?? {}).slice(0, 500),
  )
}

function toInt(value: unknown): number {
  const n =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

async function fetchCreatorOverview(
  accessToken: string,
): Promise<Result<CrmTiktokCreatorOverview>> {
  const fields = [
    'open_id',
    'avatar_url',
    'display_name',
    'bio_description',
    'profile_deep_link',
    'is_verified',
    'follower_count',
    'following_count',
    'likes_count',
    'video_count',
  ].join(',')

  try {
    const response = await fetch(`${API}/user/info/?fields=${fields}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })
    const json = (await response.json().catch(() => ({}))) as TikTokEnvelope<{
      user?: {
        open_id?: string
        avatar_url?: string
        display_name?: string
        bio_description?: string
        profile_deep_link?: string
        is_verified?: boolean
        follower_count?: number
        following_count?: number
        likes_count?: number
        video_count?: number
      }
    }>
    if (!response.ok || isTikTokError(json.error)) {
      logFailure('user/info', response.status, json)
      return err(crmSocialOauthFailed())
    }

    const user = json.data?.user ?? {}
    return ok({
      openId: user.open_id ?? 'unknown',
      displayName: user.display_name || 'Conta TikTok',
      bio: user.bio_description || null,
      avatarUrl: user.avatar_url || null,
      profileLink: user.profile_deep_link || null,
      isVerified: Boolean(user.is_verified),
      followerCount: toInt(user.follower_count),
      followingCount: toInt(user.following_count),
      likesCount: toInt(user.likes_count),
      videoCount: toInt(user.video_count),
    })
  } catch (error) {
    console.error('[tiktok] user/info erro de rede', error)
    return err(crmSocialOauthFailed())
  }
}

async function fetchVideos(
  accessToken: string,
  maxCount = 20,
): Promise<Result<CrmTiktokVideos>> {
  const fields = [
    'id',
    'title',
    'video_description',
    'duration',
    'cover_image_url',
    'share_url',
    'embed_link',
    'view_count',
    'like_count',
    'comment_count',
    'share_count',
    'create_time',
  ].join(',')

  try {
    const response = await fetch(`${API}/video/list/?fields=${fields}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ max_count: maxCount }),
    })
    const json = (await response.json().catch(() => ({}))) as TikTokEnvelope<{
      videos?: {
        id?: string | number
        title?: string
        video_description?: string
        duration?: number
        cover_image_url?: string
        share_url?: string
        embed_link?: string
        view_count?: number
        like_count?: number
        comment_count?: number
        share_count?: number
        create_time?: number
      }[]
    }>
    if (!response.ok || isTikTokError(json.error)) {
      logFailure('video/list', response.status, json)
      return err(crmSocialOauthFailed())
    }

    const videos = (json.data?.videos ?? []).map((v) => ({
      id: String(v.id ?? ''),
      title: v.title || v.video_description || 'Sem título',
      coverImageUrl: v.cover_image_url || null,
      shareUrl: v.share_url || null,
      embedLink: v.embed_link || null,
      duration: toInt(v.duration),
      createdAt: v.create_time
        ? new Date(v.create_time * 1000).toISOString()
        : '',
      viewCount: toInt(v.view_count),
      likeCount: toInt(v.like_count),
      commentCount: toInt(v.comment_count),
      shareCount: toInt(v.share_count),
    }))

    const totals = videos.reduce(
      (acc, v) => ({
        views: acc.views + v.viewCount,
        likes: acc.likes + v.likeCount,
        comments: acc.comments + v.commentCount,
        shares: acc.shares + v.shareCount,
      }),
      { views: 0, likes: 0, comments: 0, shares: 0 },
    )

    return ok({ totals, videos })
  } catch (error) {
    console.error('[tiktok] video/list erro de rede', error)
    return err(crmSocialOauthFailed())
  }
}

/**
 * Publica via Direct Post (Content Posting API) em dois passos: inicia o post
 * com os metadados (recebendo `publish_id`/`upload_url`) e envia os bytes num
 * único chunk. Processamento é assíncrono — devolvemos o `publish_id`.
 *
 * Restrição de app não auditado: só aceita `SELF_ONLY`, e a conta precisa
 * estar Privada no app TikTok no momento da publicação.
 */
async function publishVideoToTiktok(
  accessToken: string,
  args: {
    file: { bytes: ArrayBuffer; contentType: string }
    title: string
    privacyLevel: string
    disableComment: boolean
    disableDuet: boolean
    disableStitch: boolean
  },
): Promise<Result<CrmPublishTiktokVideoResult>> {
  const videoSize = args.file.bytes.byteLength

  try {
    const init = await fetch(`${API}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: args.title,
          privacy_level: args.privacyLevel,
          disable_comment: args.disableComment,
          disable_duet: args.disableDuet,
          disable_stitch: args.disableStitch,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    })
    const initJson = (await init.json().catch(() => ({}))) as TikTokEnvelope<{
      publish_id?: string
      upload_url?: string
    }>
    if (!init.ok || isTikTokError(initJson.error)) {
      logFailure('publish/init', init.status, initJson)
      if (
        initJson.error?.code ===
        'unaudited_client_can_only_post_to_private_accounts'
      ) {
        return err(
          badRequest(
            'App TikTok não auditado: a conta precisa estar como Privada no app da TikTok no momento da publicação. Deixe a conta privada e tente de novo, ou submeta o app à auditoria da TikTok para liberar contas públicas.',
          ),
        )
      }
      return err(crmSocialOauthFailed())
    }

    const publishId = initJson.data?.publish_id
    const uploadUrl = initJson.data?.upload_url
    if (!publishId || !uploadUrl) return err(crmSocialOauthFailed())

    const upload = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': args.file.contentType || 'video/mp4',
        'Content-Length': String(videoSize),
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: args.file.bytes,
    })
    if (!upload.ok) {
      console.error(
        '[tiktok] publish/upload falhou',
        upload.status,
        (await upload.text().catch(() => '')).slice(0, 500),
      )
      return err(crmSocialOauthFailed())
    }

    return ok({ publishId, status: 'PROCESSING_UPLOAD' })
  } catch (error) {
    console.error('[tiktok] publish erro de rede', error)
    return err(crmSocialOauthFailed())
  }
}

export async function getOverview(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmTiktokCreatorOverview>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'TIKTOK')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.stats)) {
    return err(crmSocialScopeMissing())
  }
  return fetchCreatorOverview(fresh.value.accessToken)
}

export async function getVideos(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmTiktokVideos>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'TIKTOK')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.videos)) {
    return err(crmSocialScopeMissing())
  }
  return fetchVideos(fresh.value.accessToken)
}

/**
 * Resumo semanal: views (7d) + top 5 por engajamento. Reaproveita `getVideos`
 * — sem chamada extra à API.
 */
export async function getWeeklyEngagement(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmTiktokWeeklyEngagement>> {
  const videos = await getVideos(actorId, workspaceId)
  if (!videos.ok) return videos

  const cutoff = Date.now() - 7 * 86_400_000
  const recent = videos.value.videos.filter((v) => {
    if (!v.createdAt) return false
    const t = new Date(v.createdAt).getTime()
    return Number.isFinite(t) && t >= cutoff
  })

  const views7d = recent.reduce((sum, v) => sum + v.viewCount, 0)
  const top5 = recent
    .map((v) => ({
      ...v,
      engagementScore:
        v.viewCount + v.likeCount + v.commentCount + v.shareCount,
    }))
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 5)

  return ok({ views7d, top5 })
}

export async function publishVideo(
  actorId: string,
  workspaceId: string,
  input: CrmPublishTiktokVideoInput,
  file: { bytes: ArrayBuffer; contentType: string },
): Promise<Result<CrmPublishTiktokVideoResult>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'TIKTOK')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.publish)) {
    return err(crmSocialScopeMissing())
  }
  return publishVideoToTiktok(fresh.value.accessToken, {
    file,
    title: input.title,
    privacyLevel: input.privacyLevel,
    disableComment: input.disableComment,
    disableDuet: input.disableDuet,
    disableStitch: input.disableStitch,
  })
}
