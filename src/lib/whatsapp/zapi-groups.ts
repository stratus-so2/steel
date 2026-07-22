import 'server-only'
import { type ZapiCredentials, zapiRequest } from './zapi-client'

// Group management has no equivalent in the Meta Cloud API — Meta simply
// doesn't expose group endpoints, so this only ever runs against a Z-API
// (unofficial, WhatsApp-Web-backed) connection. Callers must check
// `connection.provider === 'ZAPI'` before reaching this module.

export interface ZapiGroupParticipant {
  phone: string
  isAdmin: boolean
}

export interface ZapiGroupMetadata {
  phone: string
  name: string
  description?: string
  participants: ZapiGroupParticipant[]
}

export async function createZapiGroup(
  credentials: ZapiCredentials,
  input: { name: string; phones: string[] },
): Promise<{ groupJid: string }> {
  const result = await zapiRequest<{ phone: string }>(
    credentials,
    '/create-group',
    {
      method: 'POST',
      body: JSON.stringify({
        groupName: input.name,
        phones: input.phones,
        autoInvite: true,
      }),
    },
  )
  return { groupJid: result.phone }
}

export async function updateZapiGroupName(
  credentials: ZapiCredentials,
  input: { groupJid: string; name: string },
): Promise<void> {
  await zapiRequest(credentials, '/update-group-name', {
    method: 'POST',
    body: JSON.stringify({ groupId: input.groupJid, groupName: input.name }),
  })
}

export async function updateZapiGroupPhoto(
  credentials: ZapiCredentials,
  input: { groupJid: string; imageUrl: string },
): Promise<void> {
  await zapiRequest(credentials, '/update-group-photo', {
    method: 'POST',
    body: JSON.stringify({
      groupId: input.groupJid,
      groupPhoto: input.imageUrl,
    }),
  })
}

export async function updateZapiGroupDescription(
  credentials: ZapiCredentials,
  input: { groupJid: string; description: string },
): Promise<void> {
  await zapiRequest(credentials, '/update-group-description', {
    method: 'POST',
    body: JSON.stringify({
      groupId: input.groupJid,
      groupDescription: input.description,
    }),
  })
}

export async function addZapiGroupParticipants(
  credentials: ZapiCredentials,
  input: { groupJid: string; phones: string[] },
): Promise<void> {
  await zapiRequest(credentials, '/add-participant', {
    method: 'POST',
    body: JSON.stringify({ groupId: input.groupJid, phones: input.phones }),
  })
}

export async function removeZapiGroupParticipants(
  credentials: ZapiCredentials,
  input: { groupJid: string; phones: string[] },
): Promise<void> {
  await zapiRequest(credentials, '/remove-participant', {
    method: 'POST',
    body: JSON.stringify({ groupId: input.groupJid, phones: input.phones }),
  })
}

export async function setZapiGroupAdmin(
  credentials: ZapiCredentials,
  input: { groupJid: string; phone: string; admin: boolean },
): Promise<void> {
  await zapiRequest(credentials, input.admin ? '/add-admin' : '/remove-admin', {
    method: 'POST',
    body: JSON.stringify({ groupId: input.groupJid, phone: input.phone }),
  })
}

export async function leaveZapiGroup(
  credentials: ZapiCredentials,
  input: { groupJid: string },
): Promise<void> {
  await zapiRequest(credentials, '/leave-group', {
    method: 'POST',
    body: JSON.stringify({ groupId: input.groupJid }),
  })
}

export async function getZapiGroupMetadata(
  credentials: ZapiCredentials,
  input: { groupJid: string },
): Promise<ZapiGroupMetadata> {
  return zapiRequest<ZapiGroupMetadata>(
    credentials,
    `/group-metadata/${input.groupJid}`,
  )
}

export async function getZapiGroupInviteLink(
  credentials: ZapiCredentials,
  input: { groupJid: string },
): Promise<string> {
  const result = await zapiRequest<{ link: string }>(
    credentials,
    `/group-invitation-link/${input.groupJid}`,
  )
  return result.link
}
