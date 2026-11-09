import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAuthSession } from 'aws-amplify/auth'
import { setConfig, type AppConfig } from '../config'
import { AuthError } from '../api/errors'
import {
  AgentError,
  MIN_SESSION_ID_LENGTH,
  buildInvocationUrl,
  isAbortError,
  newSessionId,
  streamAgentReply,
} from './agentClient'

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}))

const agentRuntimeArn = 'arn:aws:bedrock-agentcore:us-east-1:111111111111:runtime/hrAgent-TEST'
const testConfig: AppConfig = {
  apiUrl: 'https://abc123.execute-api.us-east-1.amazonaws.com/prod/',
  region: 'us-east-1',
  userPoolId: 'us-east-1_TEST',
  userPoolClientId: 'test-client-id',
  agentRuntimeArn,
}
const sessionId = '0f8e2c1a-77b4-4e61-9d0a-1c2b3d4e5f60'

const fetchMock = vi.fn<typeof fetch>()

function textEvent(text: string): string {
  return `data: ${JSON.stringify({ event: { contentBlockDelta: { delta: { text }, contentBlockIndex: 0 } } })}\n\n`
}

/** A streaming Response whose body is delivered in exactly these chunks. */
function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  })
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } })
}

beforeEach(() => {
  setConfig(testConfig)
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(fetchAuthSession).mockResolvedValue({
    tokens: {
      idToken: { toString: () => 'id-token-test', payload: { sub: 'user-sub-test' } },
      accessToken: { toString: () => 'access-token-test', payload: { sub: 'user-sub-test' } },
    },
  } as unknown as Awaited<ReturnType<typeof fetchAuthSession>>)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildInvocationUrl and newSessionId (FR5.1, FR5.2)', () => {
  it('URL-encodes the runtime ARN and adds qualifier=DEFAULT', () => {
    expect(buildInvocationUrl('us-east-1', agentRuntimeArn)).toBe(
      'https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/arn%3Aaws%3Abedrock-agentcore%3Aus-east-1%3A111111111111%3Aruntime%2FhrAgent-TEST/invocations?qualifier=DEFAULT',
    )
  })

  it('creates session ids of at least 33 characters, unique per conversation', () => {
    const first = newSessionId()
    const second = newSessionId()

    expect(first.length).toBeGreaterThanOrEqual(MIN_SESSION_ID_LENGTH)
    expect(first).not.toBe(second)
  })
})

describe('streamAgentReply (FR5.1-FR5.6, FR1.3)', () => {
  it('sends the bearer access token, session id and actorId', async () => {
    fetchMock.mockResolvedValue(sseResponse([textEvent('Hi')]))

    await streamAgentReply({ prompt: 'List employees', sessionId, onText: () => {} })

    const [url, init] = fetchMock.mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(String(url)).toBe(buildInvocationUrl('us-east-1', agentRuntimeArn))
    expect(init?.method).toBe('POST')
    expect(headers.Authorization).toBe('Bearer access-token-test')
    expect(headers['X-Amzn-Bedrock-AgentCore-Runtime-Session-Id']).toBe(sessionId)
    expect(headers.Accept).toBe('text/event-stream')
    expect(JSON.parse(String(init?.body))).toEqual({ prompt: 'List employees', actorId: 'user-sub-test' })
  })

  it('delivers text deltas in order, including an event split across chunks', async () => {
    const split = textEvent(' world')
    fetchMock.mockResolvedValue(sseResponse([textEvent('Hello'), split.slice(0, 30), split.slice(30)]))
    const received: string[] = []

    await streamAgentReply({ prompt: 'hi', sessionId, onText: (text) => received.push(text) })

    expect(received).toEqual(['Hello', ' world'])
  })

  it('throws AgentError on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"Internal"}', { status: 500 }))

    const error = await streamAgentReply({ prompt: 'hi', sessionId, onText: () => {} }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(AgentError)
    expect(error).toMatchObject({ status: 500 })
  })

  it('throws AuthError on 401', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }))

    await expect(streamAgentReply({ prompt: 'hi', sessionId, onText: () => {} })).rejects.toBeInstanceOf(AuthError)
  })

  it('throws AgentError when the response has no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

    await expect(streamAgentReply({ prompt: 'hi', sessionId, onText: () => {} })).rejects.toThrow(
      'The HR assistant returned no reply.',
    )
  })

  it('throws AgentError on a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(streamAgentReply({ prompt: 'hi', sessionId, onText: () => {} })).rejects.toBeInstanceOf(AgentError)
  })

  it('throws AgentError when the stream carries an error event', async () => {
    fetchMock.mockResolvedValue(sseResponse([textEvent('Partial'), 'data: {"error": "Model throttled"}\n\n']))
    const received: string[] = []

    await expect(
      streamAgentReply({ prompt: 'hi', sessionId, onText: (text) => received.push(text) }),
    ).rejects.toThrow('Model throttled')
    expect(received).toEqual(['Partial'])
  })

  it('passes an abort through as an AbortError', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))

    const error = await streamAgentReply({ prompt: 'hi', sessionId, onText: () => {} }).catch((caught: unknown) => caught)

    expect(isAbortError(error)).toBe(true)
  })

  it('rejects a session id shorter than 33 characters without calling AgentCore', async () => {
    await expect(streamAgentReply({ prompt: 'hi', sessionId: 'too-short', onText: () => {} })).rejects.toBeInstanceOf(
      AgentError,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
