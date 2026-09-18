import { workbench } from '@getworkbench/next'
import { REDIS_URL, WORKBENCH_PASS, WORKBENCH_USER } from '@/lib/env/server'

export const { GET, POST, PUT, PATCH, DELETE } = workbench({
  redis: REDIS_URL ?? 'redis://localhost:6379',
  basePath: '/jobs',
  auth: {
    username: WORKBENCH_USER ?? '',
    password: WORKBENCH_PASS ?? '',
  },
})
