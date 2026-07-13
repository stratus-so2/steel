interface ConnectionParams {
  host: string
  port: number
  username: string
  password: string
  database: string
  sslEnabled: boolean
}

export function buildModuleConnectionString(params: ConnectionParams): string {
  const search = params.sslEnabled ? '?sslmode=require' : ''
  const auth = `${encodeURIComponent(params.username)}:${encodeURIComponent(params.password)}`

  return `postgresql://${auth}@${params.host}:${params.port}/${params.database}${search}`
}
