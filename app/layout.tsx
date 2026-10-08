import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'
import './globals.css'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Suspense } from 'react'
import { JsonLd } from '@/components/seo/json-ld'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  siteJsonLd,
} from '@/src/lib/seo/site'
import { Providers } from './_components/providers'
import { CookieConsentBanner } from './_components/user/cookie-consent/banner'
import { ConsentedTrackers } from './_components/user/cookie-consent/consented-trackers'
import { CookieConsentInit } from './_components/user/cookie-consent/init'
import '@/src/lib/zod-locale'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/twitter-image'],
  },
  alternates: {
    types: { 'application/rss+xml': '/changelog/rss.xml' },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang='pt-BR'
      className={cn('scroll-smooth dark', GeistSans.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* Tema antes da primeira pintura. Arquivo estático (não inline):
            a casca pré-renderizada não recebe o nonce da CSP. */}
        <script src='/theme-init.js' />
        <JsonLd data={siteJsonLd()} />
      </head>
      <body className='root antialiased bg-background text-primary h-screen'>
        <Suspense>
          <NuqsAdapter>
            <Providers>
              <CookieConsentInit>
                <TooltipProvider>
                  {children}
                  <Toaster />
                </TooltipProvider>
                <ConsentedTrackers />
                <CookieConsentBanner />
              </CookieConsentInit>
            </Providers>
          </NuqsAdapter>
        </Suspense>
      </body>
    </html>
  )
}
