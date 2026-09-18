import type { NextConfig } from "next";

// Headers estáticos aplicados a toda resposta (inclusive rotas fora do matcher
// do proxy). CSP com nonce continua no proxy.ts; HSTS também é enviado lá, mas
// fica aqui como defesa em profundidade caso o proxy não rode.
// X-Frame-Options duplica o `frame-ancestors 'none'` da CSP para navegadores
// antigos e scanners (job de headers do Security DAST).
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
]

const staticAssetCsp =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none';"

const staticAssetHeaders = [
  ...securityHeaders,
  { key: 'Content-Security-Policy', value: staticAssetCsp },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  serverExternalPackages: ['@prisma/client'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'steel.stratustelecom.com.br'
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/{avatars,user-covers}/**',
      }
    ],
  },
  cacheComponents: true,
  experimental: {
    webpackMemoryOptimizations: true,
    // O runner de build self-hosted tem ~3.8GB de RAM total; sem controle o
    // Turbopack cresce até o OOM killer matar o processo (visto em duas runs
    // de CD). O Next 16.3 removeu o turbopackMemoryLimit. 'full' fez o
    // Turbopack dar segfault/panic no docker build; 'auto' é estável e o pico
    // de memória real vinha dos workers de page data (limitados abaixo).
    turbopackMemoryEviction: 'auto',
    // "Collecting page data" abre um worker por CPU (9 no runner) e cada um
    // carrega o app inteiro: foi aí que o build do CD levou OOM kill. Dois
    // workers cabem na RAM do runner sem alongar muito o build.
    cpus: 2,
    memoryBasedWorkersCount: true,
  },
  typescript: {
    ignoreBuildErrors: true
  },
  headers: async () => [
    {
      source: '/_next/static/:path*',
      headers: staticAssetHeaders,
    },
    {
      source: '/favicon.ico',
      headers: staticAssetHeaders,
    },
    {
      source: '/:path*\\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)',
      headers: staticAssetHeaders,
    },
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
