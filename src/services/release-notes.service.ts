import { logger } from '@/lib/axiom/logger'
import { releaseNotesUnavailable } from '@/src/errors'
import {
  fetchCompareCommitMessages,
  fetchLatestRelease,
  GithubReleasesError,
  releasesRepo,
} from '@/src/lib/github-releases'
import {
  commitMessagesToMarkdown,
  parseCompareRange,
  releaseNotesToDraft,
} from '@/src/lib/release-notes'
import { err, ok, type Result } from '@/src/lib/result'
import type { ReleaseDraftRequest } from '@/src/schemas/release-notes.schema'
import type { ChangelogReleaseDraftDTO } from '@/types/changelog'
import { assertPlatformAdmin } from './authz'

function githubFailure(cause: unknown) {
  const status = cause instanceof GithubReleasesError ? cause.status : undefined
  logger.warn('release_notes.github_failed', {
    repo: releasesRepo(),
    status,
    message: cause instanceof Error ? cause.message : String(cause),
  })
  if (status === 404) {
    return releaseNotesUnavailable(
      'Nenhuma release encontrada (ou o token não tem acesso ao repositório).',
    )
  }
  if (status === 401 || status === 403) {
    return releaseNotesUnavailable(
      'O GitHub recusou o acesso (token ausente, inválido ou limite de requisições).',
    )
  }
  return releaseNotesUnavailable()
}

export const ReleaseNotesService = {
  /**
   * Rascunho do e-mail de novidades para o composer do admin. Nada é gravado:
   * o admin revisa/edita e só então cria o changelog (fluxo normal).
   */
  async draft(
    actorId: string,
    input: ReleaseDraftRequest,
  ): Promise<Result<ChangelogReleaseDraftDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    if (input.source === 'manual') {
      return ok({ ...releaseNotesToDraft(input.markdown), release: null })
    }

    try {
      const release = await fetchLatestRelease()
      let draft = releaseNotesToDraft(release.body, release)
      let fromCommits = false

      // O CD usa `--generate-notes`, que sem PRs só traz o link "Full
      // Changelog" — nesse caso monta as notas a partir dos commits do range.
      const range = parseCompareRange(release.body)
      if (draft.items.length === 0 && range) {
        const messages = await fetchCompareCommitMessages(
          range.base,
          range.head,
        )
        draft = releaseNotesToDraft(commitMessagesToMarkdown(messages), release)
        fromCommits = true
      }

      logger.info('release_notes.draft_built', {
        actorId,
        tag: release.tag,
        items: draft.items.length,
        skipped: draft.skipped,
        fromCommits,
      })

      return ok({
        ...draft,
        release: {
          tag: release.tag,
          name: release.name,
          url: release.url,
          publishedAt: release.publishedAt,
          fromCommits,
        },
      })
    } catch (cause) {
      return err(githubFailure(cause))
    }
  },
}
