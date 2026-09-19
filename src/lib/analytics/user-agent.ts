/**
 * Família de navegador/SO/dispositivo a partir do User-Agent — só o
 * suficiente para os gráficos de acesso. O UA cru não vai para o log.
 * A ordem das regras importa: Edge/Opera/Samsung se identificam também como
 * Chrome, e o Chrome se identifica também como Safari.
 */

export interface ClientInfo {
  browser: string
  os: string
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
}

const BROWSERS: [RegExp, string][] = [
  [/\bEdg(e|A|iOS)?\//, 'Edge'],
  [/\b(OPR|Opera)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(Firefox|FxiOS)\//, 'Firefox'],
  [/\b(Chrome|CriOS|Chromium)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*Safari\//, 'Safari'],
]

const OS: [RegExp, string][] = [
  [/\b(iPhone|iPad|iPod)\b/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bWindows\b/, 'Windows'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
]

const BOT =
  /bot|crawler|spider|crawling|curl\/|wget\/|headless|python-requests|node-fetch|axios\/|undici|postman/i

export function parseUserAgent(ua: string | null | undefined): ClientInfo {
  if (!ua)
    return { browser: 'Desconhecido', os: 'Desconhecido', device: 'unknown' }
  if (BOT.test(ua)) {
    return { browser: 'Bot/Script', os: matchOs(ua), device: 'bot' }
  }
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? 'Outro'
  const os = matchOs(ua)
  let device: ClientInfo['device'] = 'desktop'
  if (
    /\biPad\b|\bTablet\b/.test(ua) ||
    (/\bAndroid\b/.test(ua) && !/\bMobile\b/.test(ua))
  ) {
    device = 'tablet'
  } else if (/\bMobi|\biPhone\b|\biPod\b/.test(ua)) {
    device = 'mobile'
  }
  return { browser, os, device }
}

function matchOs(ua: string): string {
  return OS.find(([re]) => re.test(ua))?.[1] ?? 'Outro'
}
