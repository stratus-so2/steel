import { getAllEntriesMeta } from '@/src/lib/changelog/entries'
import { CHANGELOG_TAG_LABELS } from '@/src/lib/changelog/labels'
import { SITE_URL } from '@/src/lib/seo/site'
import { escapeXml } from '@/src/lib/seo/xml'

export async function GET() {
  const entries = await getAllEntriesMeta()

  const items = entries
    .map((entry) => {
      const url = `${SITE_URL}/changelog/${entry.slug}`
      const categories = entry.tags
        .map(
          (tag) =>
            `\n      <category>${escapeXml(CHANGELOG_TAG_LABELS[tag])}</category>`,
        )
        .join('')
      return `
    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(entry.date).toUTCString()}</pubDate>
      <description>${escapeXml(entry.summary)}</description>${categories}
    </item>`
    })
    .join('')

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Changelog do Steel</title>
    <link>${SITE_URL}/changelog</link>
    <description>Novidades do Steel: ServiceDesk, CRM, Comunicação e Steel AI.</description>
    <language>pt-BR</language>
    <atom:link href="${SITE_URL}/changelog/rss.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
