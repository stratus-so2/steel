import {
  crmSocialConnectionNotFound,
  crmSocialOauthFailed,
  crmSocialScopeMissing,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import type {
  CrmLinkedinOverview,
  CrmLinkedinPublishInput,
  CrmLinkedinPublishResult,
} from '@/src/schemas/crm-social-linkedin.schema'
import { assertMember } from './authz'
import { getFreshAccessToken } from './crm-social-token'

const BASE = 'https://api.linkedin.com'
const REST = `${BASE}/rest`

const REQUIRED_SCOPES = {
  read: 'profile',
  write: 'w_member_social',
} as const

function hasScope(scope: string | null, needle: string): boolean {
  return (scope ?? '').includes(needle)
}

async function logFailure(label: string, response: Response): Promise<void> {
  const body = await response.text().catch(() => '')
  console.error(
    `[linkedin] ${label} falhou`,
    response.status,
    body.slice(0, 500),
  )
}

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': '202404',
    'X-RestLi-Protocol-Version': '2.0.0',
  }
}

/**
 * O campo `commentary` da Posts API usa o "Little text format": alguns
 * caracteres são reservados e precisam ser escapados com `\`.
 */
function escapeCommentary(text: string): string {
  return text.replace(/([\\|{}()[\]<>@~_*#])/g, '\\$1')
}

async function fetchProfile(
  accessToken: string,
): Promise<Result<CrmLinkedinOverview>> {
  const response = await fetch(`${BASE}/v2/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  }).catch((e) => {
    console.error('[linkedin] fetchProfile erro de rede', e)
    return null
  })

  if (!response) return err(crmSocialOauthFailed())
  if (!response.ok) {
    await logFailure('fetchProfile', response)
    return err(crmSocialOauthFailed())
  }

  const data = (await response.json()) as {
    sub?: string
    name?: string
    email?: string
    picture?: string
  }

  return ok({
    personId: data.sub ?? 'unknown',
    name: data.name ?? null,
    headline: null,
    email: data.email ?? null,
    picture: data.picture ?? null,
  })
}

/**
 * Sobe uma imagem via Images API e devolve o URN (`urn:li:image:…`). Fluxo em
 * dois passos: `initializeUpload` reserva a URL/URN, depois um `PUT` binário.
 */
async function uploadImage(
  accessToken: string,
  ownerUrn: string,
  image: { bytes: ArrayBuffer; contentType: string },
): Promise<Result<string>> {
  const init = await fetch(`${REST}/images?action=initializeUpload`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  }).catch((e) => {
    console.error('[linkedin] initializeUpload erro de rede', e)
    return null
  })

  if (!init) return err(crmSocialOauthFailed())
  if (!init.ok) {
    await logFailure('initializeUpload', init)
    return err(crmSocialOauthFailed())
  }

  const data = (await init.json().catch(() => ({}))) as {
    value?: { uploadUrl?: string; image?: string }
  }
  const uploadUrl = data.value?.uploadUrl
  const imageUrn = data.value?.image
  if (!uploadUrl || !imageUrn) return err(crmSocialOauthFailed())

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': image.contentType || 'application/octet-stream',
    },
    body: image.bytes,
  }).catch((e) => {
    console.error('[linkedin] upload da imagem erro de rede', e)
    return null
  })

  if (!upload) return err(crmSocialOauthFailed())
  if (!upload.ok) {
    await logFailure('upload da imagem', upload)
    return err(crmSocialOauthFailed())
  }

  return ok(imageUrn)
}

async function publishPostToLinkedin(
  accessToken: string,
  authorUrn: string,
  text: string,
  image?: { bytes: ArrayBuffer; contentType: string } | null,
): Promise<Result<CrmLinkedinPublishResult>> {
  let imageUrn: string | null = null
  if (image) {
    const uploaded = await uploadImage(accessToken, authorUrn, image)
    if (!uploaded.ok) return uploaded
    imageUrn = uploaded.value
  }

  const body = JSON.stringify({
    author: authorUrn,
    commentary: escapeCommentary(text),
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
    ...(imageUrn ? { content: { media: { id: imageUrn, altText: '' } } } : {}),
  })

  const response = await fetch(`${REST}/posts`, {
    method: 'POST',
    headers: headers(accessToken),
    body,
  }).catch((e) => {
    console.error('[linkedin] publishPost erro de rede', e)
    return null
  })

  if (!response) return err(crmSocialOauthFailed())
  if (!response.ok) {
    await logFailure('publishPost', response)
    return err(crmSocialOauthFailed())
  }

  const postUrn =
    response.headers.get('x-restli-id') ??
    response.headers.get('X-RestLi-Id') ??
    'unknown'

  return ok({ postUrn })
}

export async function getOverview(
  actorId: string,
  workspaceId: string,
): Promise<Result<CrmLinkedinOverview>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'LINKEDIN')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.read)) {
    return err(crmSocialScopeMissing())
  }
  return fetchProfile(fresh.value.accessToken)
}

export async function publishPost(
  actorId: string,
  workspaceId: string,
  input: CrmLinkedinPublishInput,
  image?: { bytes: ArrayBuffer; contentType: string } | null,
): Promise<Result<CrmLinkedinPublishResult>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const fresh = await getFreshAccessToken(workspaceId, 'LINKEDIN')
  if (!fresh.ok) return fresh
  if (!hasScope(fresh.value.connection.scope, REQUIRED_SCOPES.write)) {
    return err(crmSocialScopeMissing())
  }

  const personId = fresh.value.connection.externalAccountId
  if (!personId || personId === 'unknown') {
    return err(crmSocialConnectionNotFound())
  }

  const authorUrn = `urn:li:person:${personId}`
  return publishPostToLinkedin(
    fresh.value.accessToken,
    authorUrn,
    input.text,
    image,
  )
}
