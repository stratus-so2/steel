import { getAllEntriesMeta } from '@/src/lib/changelog/entries'
import { buildLlmsTxt } from '@/src/lib/seo/llms'

// llmstxt.org convention: a markdown summary for LLMs and answer engines. A
// route (not public/llms.txt) so the links follow NEXT_PUBLIC_URL and the
// changelog stays current without editing a static file.
export async function GET() {
  const entries = await getAllEntriesMeta()
  return new Response(buildLlmsTxt(entries), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
