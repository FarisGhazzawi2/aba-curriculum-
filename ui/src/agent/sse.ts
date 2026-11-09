/*
 * Parser for the hrAgent's text/event-stream reply (FR5.4).
 *
 * Each `data:` line carries a Strands raw event, for example
 *   data: {"event": {"contentBlockDelta": {"delta": {"text": "Hello"}, "contentBlockIndex": 0}}}
 * Only contentBlockDelta.delta.text is rendered. Tool-use deltas, metadata and other
 * events are ignored. A messageStop ends the reply unless its stopReason is "tool_use",
 * because the agent then calls a tool and starts another message in the same stream.
 * The AgentCore runtime reports a failure inside the stream as {"error": "..."}.
 */

export interface SseParseResult {
  /** Text deltas in arrival order. */
  texts: string[]
  /** True once the final messageStop has been seen. */
  done: boolean
  /** An incomplete trailing line, to be prepended to the next chunk. */
  rest: string
  /** Set when the stream carried an error event. */
  error?: string
}

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonObject) : null
}

function interpretEvent(payload: unknown, result: SseParseResult): void {
  const root = asObject(payload)
  if (!root) {
    return
  }
  if (typeof root.error === 'string') {
    result.error = root.error
    return
  }
  const event = asObject(root.event)
  if (!event) {
    return
  }
  const delta = asObject(asObject(event.contentBlockDelta)?.delta)
  if (delta && typeof delta.text === 'string') {
    result.texts.push(delta.text)
    return
  }
  const messageStop = asObject(event.messageStop)
  if (messageStop && messageStop.stopReason !== 'tool_use') {
    result.done = true
  }
}

/**
 * Parses every complete line in `buffer`. Lines that are not `data:` lines, and data
 * lines that are not valid JSON, are skipped. Parsing stops at the first error or done.
 */
export function parseSseChunk(buffer: string): SseParseResult {
  const lines = buffer.split('\n')
  const result: SseParseResult = { texts: [], done: false, rest: lines.pop() ?? '' }

  for (const rawLine of lines) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (!line.startsWith('data:')) {
      continue
    }
    const data = line.slice('data:'.length).trim()
    if (data === '') {
      continue
    }
    let payload: unknown
    try {
      payload = JSON.parse(data)
    } catch {
      continue
    }
    interpretEvent(payload, result)
    if (result.done || result.error !== undefined) {
      break
    }
  }
  return result
}
