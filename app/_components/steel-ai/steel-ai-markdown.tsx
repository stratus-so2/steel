import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const PROSE = [
  'min-w-0 max-w-none text-sm leading-relaxed [overflow-wrap:anywhere]',
  '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-2',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li]:pl-0.5 [&_li>ul]:my-1 [&_li>ol]:my-1',
  '[&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:font-semibold [&_h1]:text-lg [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-base [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:font-medium',
  '[&_strong]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
  '[&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs [&_pre]:leading-relaxed [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[1em]',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_hr]:my-4 [&_hr]:border-border',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_thead]:bg-muted/60 [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2',
].join(' ')

/** Assistant markdown (GFM). Memoized: deltas only re-render the live reply. */
export const SteelAiMarkdown = memo(function SteelAiMarkdown({
  content,
}: {
  content: string
}) {
  return (
    <div className={PROSE}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const external = !!href && /^https?:\/\//.test(href)
            return (
              <a
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
              >
                {children}
              </a>
            )
          },
          table: ({ children }) => (
            <div className='my-3 max-w-full overflow-x-auto rounded-lg border border-border/80'>
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
