/*
 * Runtime configuration (FR7.3, FR7.4, NFR2).
 * The deployed stack writes /config.json next to index.html; for local development
 * copy public/config.example.json to public/config.json. Only public identifiers live
 * here: no secrets, no hard-coded environment values.
 */
export interface AppConfig {
  apiUrl: string
  region: string
  userPoolId: string
  userPoolClientId: string
  agentRuntimeArn: string
}

export class ConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ConfigError'
  }
}

const REQUIRED_KEYS: readonly (keyof AppConfig)[] = [
  'apiUrl',
  'region',
  'userPoolId',
  'userPoolClientId',
  'agentRuntimeArn',
]

function requireString(raw: Record<string, unknown>, key: keyof AppConfig): string {
  const value = raw[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigError(`config.json is missing "${key}".`)
  }
  return value.trim()
}

function isAllowedApiUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    return url.protocol === 'https:' || (isLocal && url.protocol === 'http:')
  } catch {
    return false
  }
}

/** Validates the parsed JSON and returns a typed config, or throws ConfigError. */
export function parseConfig(raw: unknown): AppConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ConfigError('config.json must be a JSON object.')
  }
  const record = raw as Record<string, unknown>
  const [apiUrl, region, userPoolId, userPoolClientId, agentRuntimeArn] = REQUIRED_KEYS.map(
    (key) => requireString(record, key),
  )
  if (!isAllowedApiUrl(apiUrl)) {
    throw new ConfigError('config.json "apiUrl" must be an https URL.')
  }
  if (!agentRuntimeArn.startsWith('arn:')) {
    throw new ConfigError('config.json "agentRuntimeArn" must be an ARN.')
  }
  return { apiUrl, region, userPoolId, userPoolClientId, agentRuntimeArn }
}

/** Fetches and validates /config.json. Every failure becomes a ConfigError. */
export async function loadConfig(fetchImpl: typeof fetch = fetch): Promise<AppConfig> {
  let response: Response
  try {
    response = await fetchImpl('/config.json', { cache: 'no-store' })
  } catch (error) {
    throw new ConfigError('Could not download config.json.', { cause: error })
  }
  if (!response.ok) {
    throw new ConfigError(`config.json could not be loaded (HTTP ${response.status}).`)
  }
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    throw new ConfigError('config.json is not valid JSON.', { cause: error })
  }
  return parseConfig(body)
}

let currentConfig: AppConfig | null = null

export function setConfig(config: AppConfig): void {
  currentConfig = config
}

export function getConfig(): AppConfig {
  if (!currentConfig) {
    throw new ConfigError('The app configuration has not been loaded.')
  }
  return currentConfig
}
