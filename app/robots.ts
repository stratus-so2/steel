import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/src/lib/seo/site'

// No private paths listed here on purpose: a Disallow line is a public map
// of where the app lives. The session gate (proxy.ts) protects them; this
// only keeps crawlers off what has no value in an index.
const DISALLOWED_PATHS = ['/api/', '/onboarding', '/upgrade']

// Business decision (not just technical): the AI crawlers below are allowed
// on purpose. Steel's public content (changelog, manifesto, status) exists
// to be found, and being cited by ChatGPT, Claude, Perplexity and AI
// Overviews is the point of the AEO/GEO work. Revisit if this stance changes.
const AI_CRAWLER_USER_AGENTS = [
  'GPTBot', // OpenAI / ChatGPT training
  'OAI-SearchBot', // ChatGPT search
  'ChatGPT-User', // ChatGPT browsing on a user's behalf
  'ClaudeBot', // Anthropic / Claude
  'Claude-SearchBot', // Claude search
  'Claude-User', // Claude browsing on a user's behalf
  'PerplexityBot', // Perplexity
  'Google-Extended', // Gemini / AI Overviews (search Googlebot is always allowed)
  'Applebot-Extended', // Apple Intelligence
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOWED_PATHS },
      ...AI_CRAWLER_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: DISALLOWED_PATHS,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
