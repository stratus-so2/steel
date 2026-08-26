import { Font } from 'react-email'

/**
 * Inter variable family via Google CSS `@import`, with static-weight
 * fallbacks for webmail clients that strip `@import` — ported as-is from
 * the react-email starter templates.
 */
export function MarketingFonts() {
  return (
    <>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static Google Fonts @import, no user input
        dangerouslySetInnerHTML={{
          __html:
            "@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');",
        }}
      />
      <Font
        fontFamily='Inter'
        fallbackFontFamily={['Arial', 'sans-serif']}
        webFont={{
          url: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuOKfMZg.ttf',
          format: 'truetype',
        }}
        fontWeight={400}
        fontStyle='normal'
      />
      <Font
        fontFamily='Inter'
        fallbackFontFamily={['Arial', 'sans-serif']}
        webFont={{
          url: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf',
          format: 'truetype',
        }}
        fontWeight={500}
        fontStyle='normal'
      />
      <Font
        fontFamily='Inter'
        fallbackFontFamily={['Arial', 'sans-serif']}
        webFont={{
          url: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf',
          format: 'truetype',
        }}
        fontWeight={600}
        fontStyle='normal'
      />
    </>
  )
}
