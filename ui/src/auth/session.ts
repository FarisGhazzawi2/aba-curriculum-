import { fetchAuthSession } from 'aws-amplify/auth'
import { raiseAuthError } from '../api/errors'

/*
 * Token access for the API and agent clients (FR1.3, NFR3).
 * Tokens stay in Amplify's default storage; they are never logged or placed in URLs.
 */
type AuthTokens = NonNullable<Awaited<ReturnType<typeof fetchAuthSession>>['tokens']>

async function getTokens(): Promise<AuthTokens> {
  let tokens: AuthTokens | undefined
  try {
    tokens = (await fetchAuthSession()).tokens
  } catch (error) {
    throw raiseAuthError(undefined, { cause: error })
  }
  if (!tokens) {
    throw raiseAuthError()
  }
  return tokens
}

/** The Cognito ID token, sent to the REST API as the Authorization header. */
export async function getIdToken(): Promise<string> {
  const tokens = await getTokens()
  if (!tokens.idToken) {
    throw raiseAuthError()
  }
  return tokens.idToken.toString()
}

/** The Cognito access token, sent to AgentCore as a Bearer token. */
export async function getAccessToken(): Promise<string> {
  const tokens = await getTokens()
  return tokens.accessToken.toString()
}

/** The signed-in user's Cognito sub, used as the agent actorId (FR5.3). */
export async function getUserSub(): Promise<string> {
  const tokens = await getTokens()
  const sub = tokens.accessToken.payload.sub
  if (typeof sub !== 'string' || sub === '') {
    throw raiseAuthError()
  }
  return sub
}
