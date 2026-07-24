import { crmSocialOauthFailed, crmSocialScopeMissing } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { getJson } from '@/src/lib/social/providers/http'
import type {
  CrmPublishTweetInput,
  CrmPublishTweetResult,
  CrmTweets,
  CrmTwitterProfileOverview,
} from '@/src/schemas/crm-social-twitter.schema'
import { assertMember } from './authz'
import { getFreshAccessToken } from './crm-social-token'

const API = 'https://api.twitter.com/2'
const UPLOAD_API = 'https://api.x.com/2/media/upload'

/** Escopos exigidos por capacidade — detecta conexões antigas (sem reconsentir). */
const REQUIRED_SCOPES = {
  overview: 'users.read',
  read: 'tweet.read',
  publish: 'tweet.write',
} as const

function hasScope(scope: string | null, needle: string): boolean {
  return (scope ?? '').includes(needle)
}

async function logFailure(label: string, response: Response): Promise<void> {
  console.error(
    `[twitter] ${label} falhou`,
    response.status,
    (await response.text().catch(() => '')).slice(0, 500),
  )
}

async function fetchProfileOverview(
  accessToken: string,
): Promise<Result<CrmTwitterProfileOverview>> {
  const fields = ['profile_image_url', 'username', 'name'].join(',')
  const result = await getJson<{
    data?: {
      id?: string
      username?: string
      name?: string
      profile_image_url?: string
    }
  }>(`${API}/users/me?user.fields=${fields}`, accessToken)
  if (!result.ok) return result

  const user = result.value.data ?? {}
  return ok({
    id: user.id ?? 'unknown',
    username: user.username ?? '',
    name: user.name || null,
    profileImageUrl: user.profile_image_url || null,
  })
}

/** Upload de imagem → `media_id`, usado depois em `media.media_ids` do tweet. */
async function uploadMedia(
  accessToken: string,
  image: { bytes: ArrayBuffer; contentType: string },
): Promise<Result<string>> {
  try {
    const form = new FormData()
    form.append(
      'media',
      new Blob([image.bytes], { type: image.contentType || 'image/jpeg' }),
    )
    form.append('media_category', 'tweet_image')

    const response = await fetch(UPLOAD_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    })
    if (!response.ok) {
      await logFailure('media/upload', response)
      return err(crmSocialOauthFailed())
    }
    const json = (await response.json().catch(() => ({}))) as {
      data?: { id?: string }
      media_id_string?: string
    }
    const mediaId = json.data?.id ?? json.media_id_string
    if (!mediaId) return err(crmSocialOauthFailed())
    return ok(mediaId)
  } catch (error) {
    console.error('[twitter] media/upload erro de rede', error)
    return err(crmSocialOauthFailed())
  }
}

async function publishTweet(
  accessToken: string,
  args: {
    text: string
    image?: { bytes: ArrayBuffer; contentType: string } | null
  },
): Promise<Result<CrmPublishTweetResult>> {
  let mediaId: string | null = null
  if (args.image) {
    const uploaded = await uploadMedia(accessToken, args.image)
    if (!uploaded.ok) return uploaded
    mediaId = uploaded.value
  }

  try {
    const response = await fetch(`${API}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        text: args.text,
        ...(mediaId && { media: { media_ids: [mediaId] } }),
      }),
    })
    if (!response.ok) {
      await logFailure('tweets', response)
      return err(crmSocialOauthFailed())
    }
    const json = (await response.json().catch(() => ({}))) as {
      data?: { id?: string }
    }
    const tweetId = json.data?.id
    if (!tweetId) return err(crmSocialOauthFailed())
    return ok({
      tweetId,
      permalink: `https://twitter.com/i/web/status/${tweetId}`,
    })
  } catch (error) {
    console.error('[twitter] tweets erro de rede', error)
    return err(crmSocialOauthFailed())
  }
}

async function fetchRecentTweets(
  accessToken: string,
  userId: string,
): Promise<Result<CrmTweets>> {
  const params = new URLSearchParams({
    'tweet.fields': 'created_at,public_metrics',
    max_results: '10',
    exclude: 'retweets,replies',
  })
  const result = await getJson<{
    data?: {
      id?: string
      text?: string
      created_at?: string
      public_metrics?: {
        like_count?: number
        retweet_count?: number
        reply_count?: number
        impression_count?: number
      }
    }[]
  }>(`${API}/users/${userId}/tweets?${params.toString()}`, accessToken)
  if (!result.ok) return result

  const tweets = (result.value.data ?? []).map((t) => ({
    id: t.id ?? '',
    text: t.text ?? '',
    createdAt: t.created_at ?? null,
    url: t.id ? `https://twitter.com/i/web/status/${t.id}` : '',
    metrics: t.public_metrics
      ? {
          likeCount: t.public_metrics.like_count ?? 0,
          retweetCount: t.public_metrics.retweet_count ?? 0,
          replyCount: t.public_metrics.reply_count ?? 0,
          impressionCount: t.public_metrics.impression_count ?? 0,
        }
      : null,
  }))

  return ok({ tweets })
}

/** Visão do perfil: só identidade (métricas exigem plano pago do X). */
export async function getOverview(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmTwitterProfileOverview>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'TWITTER')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.overview)) {
    return err(crmSocialScopeMissing())
  }
  return fetchProfileOverview(fresh.value.accessToken)
}

/** Tweets recentes do perfil (requer `tweet.read`). */
export async function getRecentTweets(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmTweets>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'TWITTER')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.read)) {
    return err(crmSocialScopeMissing())
  }
  return fetchRecentTweets(
    fresh.value.accessToken,
    fresh.value.connection.externalAccountId,
  )
}

/** Publica um tweet (texto + imagem opcional). */
export async function publishTweetPost(
  actorId: string,
  workspaceId: string,
  input: CrmPublishTweetInput,
  image: { bytes: ArrayBuffer; contentType: string } | null,
): Promise<Result<CrmPublishTweetResult>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'TWITTER')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.publish)) {
    return err(crmSocialScopeMissing())
  }
  return publishTweet(fresh.value.accessToken, { text: input.text, image })
}
