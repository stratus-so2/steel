import { wikiDisabled } from '../errors'
import { err, type Result } from '../lib/result'
import { WikiSettingsRepository } from '../repositories/wiki-settings.repository'
import { assertMember, type MembershipContext } from './authz'

/**
 * Entry gate of every wiki page/comment/media operation: workspace membership
 * first (a non-member never learns whether the wiki is on), then the
 * workspace toggle in Ajustes > Wiki.
 */
export async function assertWikiMember(
  actorId: string,
  workspaceId: string,
): Promise<Result<MembershipContext>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const enabled = await WikiSettingsRepository.isEnabled(workspaceId)
  if (!enabled.ok) return enabled
  if (!enabled.value) return err(wikiDisabled())

  return membership
}
