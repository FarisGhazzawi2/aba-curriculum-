import { getConfig } from '../config'
import { getAccessToken, getUserSub } from '../auth/session'
import { raiseAuthError } from '../api/errors'
import { parseSseChunk } from './sse'

/*
 * Direct browser client for the hrAgent on Bedrock AgentCore Runtime (FR5.1-FR5.6).
 * Sends the Cognito access token as a Bearer token, one session id per conversation,
 * and the user's sub as actorId, then streams the text deltas to onText.
 */

/** AgentCore requires a runtime session id of at least 33 characters. */
export const MIN_SESSION_ID_LENGTH = 33

export class AgentError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AgentError'
    this.status = status
  }
}

export interface StreamAgentReplyOptions {
  prompt: string
  sessionId: string
  onText: (text: string) => void
  signal?: AbortSignal
}

export function buildInvocationUrl(region: string, agentRuntimeArn: string): string {
  return `https://bedrock-agentcore.${region}.amazonaws.com/runtimes/${encodeURIComponent(
    agentRuntimeArn,
  )}/invocations?qualifier=DEFAULT`
}

/** A new conversation id: a 36-character UUID, which meets the 33-character minimum. */
export function newSessionId(): string {
  return crypto.randomUUID()
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function invoke(options: StreamAgentReplyOptions): Promise<Response> {
  if (options.sessionId.length < MIN_SESSION_ID_LENGTH) {
    throw new AgentError('The conversation id is too short. Start a new conversation.')
  }
  const [accessToken, sub] = await Promise.all([getAccessToken(), getUserSub()])
  const { region, agentRuntimeArn } = getConfig()

  try {
    return await fetch(buildInvocationUrl(region, agentRuntimeArn), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': options.sessionId,
      },
      body: JSON.stringify({ prompt: options.prompt, actorId: sub }),
      signal: options.signal,
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new AgentError('Could not reach the HR assistant. Check your connection and try again.', undefined, {
      cause: error,
    })
  }
}

async function readStream(body: ReadableStream<Uint8Array>, onText: (text: string) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handle = (chunk: string): boolean => {
    const result = parseSseChunk(chunk)
    result.texts.forEach(onText)
    if (result.error !== undefined) {
      throw new AgentError(`The HR assistant reported an error: ${result.error}`)
    }
    buffer = result.rest
    return result.done
  }

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        handle(`${buffer}${decoder.decode()}\n`)
        return
      }
      if (handle(buffer + decoder.decode(value, { stream: true }))) {
        await reader.cancel()
        return
      }
    }
  } catch (error) {
    if (error instanceof AgentError || isAbortError(error)) {
      throw error
    }
    throw new AgentError('The reply was interrupted. Please try again.', undefined, { cause: error })
  }
}

/** Sends one prompt and streams the reply text. Rejects with AgentError, AuthError or AbortError. */
export async function streamAgentReply(options: StreamAgentReplyOptions): Promise<void> {
  const response = await invoke(options)

  if (response.status === 401 || response.status === 403) {
    throw raiseAuthError(response.status)
  }
  if (!response.ok) {
    throw new AgentError(`The HR assistant returned an error (HTTP ${response.status}).`, response.status)
  }
  if (!response.body) {
    throw new AgentError('The HR assistant returned no reply.', response.status)
  }
  await readStream(response.body, options.onText)
}
