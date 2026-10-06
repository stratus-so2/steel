/** @type {import('@lhci/cli').UserConfig} */
module.exports = {
  ci: {
    collect: {
      // `pnpm start` runs the standalone build: it listens on $PORT (default
      // 3000) and only serves CSS/JS/images once `public` and `.next/static`
      // are copied next to server.js, like the Dockerfile does.
      startServerCommand:
        'cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/ && PORT=3001 pnpm start',
      startServerReadyPattern: 'Ready in',
      url: [
        'http://localhost:3001/',
        'http://localhost:3001/sign-in',
        'http://localhost:3001/sign-up',
        'http://localhost:3001/contact',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
        interactive: ['warn', { maxNumericValue: 3800 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
