import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Server responsiveness is asserted on TTFB (`timings.waiting`): it measures
// the app, not the pipe. Full `http_req_duration` also includes the body
// transfer, which for a remote target is dominated by runner <-> host distance
// (GitHub runners are in the US, homologação is in BR): the landing page `/`
// (~70KB gzip) needs several extra TCP round trips and lands at ~850ms even
// with a ~40ms server time. So the end-to-end budget is configurable —
// 500ms locally, relaxed via DURATION_P95_MS for remote runs.
const DURATION_P95_MS = Number(__ENV.DURATION_P95_MS || 500);
const TTFB_BUDGET_MS = Number(__ENV.TTFB_BUDGET_MS || 500);

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_waiting: [`p(95)<${TTFB_BUDGET_MS}`],
    http_req_duration: [`p(95)<${DURATION_P95_MS}`],
    http_req_failed: ['rate<0.01'],
  },
};

// Public pages only. `/contact` no longer exists (it rendered a soft 404 and,
// with the proxy active, redirects to /sign-in) — the public contact page is
// `/talk-to-sales`.
const pages = ['/', '/sign-in', '/sign-up', '/talk-to-sales'];

export default function () {
  for (const page of pages) {
    const res = http.get(`${BASE_URL}${page}`, { redirects: 0 });
    check(res, {
      [`${page} returns 200`]: (r) => r.status === 200,
      [`${page} TTFB under ${TTFB_BUDGET_MS}ms`]: (r) =>
        r.timings.waiting < TTFB_BUDGET_MS,
    });
    sleep(1);
  }
}
