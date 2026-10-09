import { getAllEntries } from '@/src/lib/changelog/entries'
import { getAllDocs } from '@/src/lib/docs/pages'
import { buildLlmsFullTxt } from '@/src/lib/seo/llms'

export async function GET() {
  const [entries, docs] = await Promise.all([getAllEntries(), getAllDocs()])
  return new Response(buildLlmsFullTxt(entries, docs), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
