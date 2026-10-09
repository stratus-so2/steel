import { getAllEntriesMeta } from '@/src/lib/changelog/entries'
import { getAllDocsMeta } from '@/src/lib/docs/pages'
import { buildLlmsTxt } from '@/src/lib/seo/llms'

// llmstxt.org convention: a markdown summary for LLMs and answer engines. A
// route (not public/llms.txt) so the links follow NEXT_PUBLIC_URL and the
// changelog and the manual stay current without editing a static file.
export async function GET() {
  const [entries, docs] = await Promise.all([
    getAllEntriesMeta(),
    getAllDocsMeta(),
  ])
  return new Response(buildLlmsTxt(entries, docs), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
