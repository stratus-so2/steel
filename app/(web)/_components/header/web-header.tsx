import { getAllEntriesMeta } from '@/src/lib/changelog/entries'
import { formatChangelogDate } from '@/src/lib/changelog/labels'
import { WebHeaderBar } from './web-header-bar'

/**
 * Server half of the public header: reads the latest changelog entry for the
 * "Novidade" strip of the Produto menu and hands it to the client bar.
 */
export async function WebHeader() {
  const [latest] = await getAllEntriesMeta()

  return (
    <WebHeaderBar
      latest={
        latest
          ? {
              title: latest.title,
              slug: latest.slug,
              date: formatChangelogDate(latest.date),
            }
          : null
      }
    />
  )
}
