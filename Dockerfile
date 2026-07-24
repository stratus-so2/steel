FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./

RUN --mount=type=secret,id=hugeicons_token \
    corepack enable pnpm && \
    if [ -f /run/secrets/hugeicons_token ]; then \
      echo "@hugeicons-pro:registry=https://npm.hugeicons.com" > .npmrc && \
      echo "//npm.hugeicons.com/:_authToken=$(cat /run/secrets/hugeicons_token)" >> .npmrc; \
    fi && \
    pnpm install --frozen-lockfile && \
    rm -f .npmrc

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_URL=https://steel.stratustelecom.com.br
ENV NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL

ARG NEXT_PUBLIC_AXIOM_TOKEN
ENV NEXT_PUBLIC_AXIOM_TOKEN=$NEXT_PUBLIC_AXIOM_TOKEN

ARG NEXT_PUBLIC_AXIOM_DATASET
ENV NEXT_PUBLIC_AXIOM_DATASET=$NEXT_PUBLIC_AXIOM_DATASET

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV SKIP_ENV_VALIDATION="true"

# O runner de build self-hosted tem ~3.8GB de RAM total — sem um teto no heap
# do V8, prisma generate/esbuild podem crescer até o OOM killer matar o
# processo (o teto do Turbopack em si vem de `turbopackMemoryLimit` no
# next.config.ts).
ENV NODE_OPTIONS="--max-old-space-size=2048"

RUN corepack enable pnpm && \
    pnpm prisma:generate && \
    pnpm build && \
    pnpm worker:build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# node:20-alpine bundles npm (and its vendored tar dependency) even though
# this stage only ever runs `node server.js` directly — strip the unused
# npm/corepack/npx toolchain so a vulnerable transitive tar version doesn't
# show up in image scans for a binary we never invoke here.
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
