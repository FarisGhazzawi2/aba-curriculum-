import { describe, expect, it } from 'vitest'
import { parseSseChunk } from './sse'

// Events shaped like the Strands raw events hrAgent/app/agent/main.py yields.
function dataLine(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

const textDelta = (text: string) => ({ event: { contentBlockDelta: { delta: { text }, contentBlockIndex: 0 } } })
const toolUseDelta = { event: { contentBlockDelta: { delta: { toolUse: { input: '{"employee_id":' } }, contentBlockIndex: 1 } } }
const messageStart = { event: { messageStart: { role: 'assistant' } } }
const metadata = { event: { metadata: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } } } }
const endTurn = { event: { messageStop: { stopReason: 'end_turn' } } }
const toolUseStop = { event: { messageStop: { stopReason: 'tool_use' } } }

describe('parseSseChunk (FR5.4)', () => {
  it('extracts text deltas in order', () => {
    const result = parseSseChunk(dataLine(textDelta('Hello')) + dataLine(textDelta(', Ada')) + dataLine(textDelta('.')))

    expect(result.texts).toEqual(['Hello', ', Ada', '.'])
    expect(result.done).toBe(false)
    expect(result.rest).toBe('')
  })

  it('reassembles an event split across chunks', () => {
    const full = dataLine(textDelta('Leave approved'))
    const first = parseSseChunk(full.slice(0, 25))

    expect(first.texts).toEqual([])
    expect(first.rest).toBe(full.slice(0, 25))

    const second = parseSseChunk(first.rest + full.slice(25))
    expect(second.texts).toEqual(['Leave approved'])
  })

  it('ignores tool-use deltas, metadata and other events', () => {
    const result = parseSseChunk(
      dataLine(messageStart) + dataLine(toolUseDelta) + dataLine(metadata) + ': keep-alive comment\n' + dataLine(textDelta('Done')),
    )

    expect(result.texts).toEqual(['Done'])
  })

  it('skips malformed JSON lines and keeps going', () => {
    const result = parseSseChunk('data: {not json\n\n' + dataLine(textDelta('still here')))

    expect(result.texts).toEqual(['still here'])
    expect(result.error).toBeUndefined()
  })

  it('marks the reply done on a final messageStop', () => {
    const result = parseSseChunk(dataLine(textDelta('Bye')) + dataLine(endTurn) + dataLine(textDelta('ignored')))

    expect(result.texts).toEqual(['Bye'])
    expect(result.done).toBe(true)
  })

  it('does not end the reply on a tool_use messageStop', () => {
    const result = parseSseChunk(dataLine(toolUseStop) + dataLine(textDelta('After the tool call')))

    expect(result.done).toBe(false)
    expect(result.texts).toEqual(['After the tool call'])
  })

  it('handles CRLF line endings', () => {
    const result = parseSseChunk(`data: ${JSON.stringify(textDelta('crlf'))}\r\n\r\n`)

    expect(result.texts).toEqual(['crlf'])
  })

  it('reports an error event from the runtime', () => {
    const result = parseSseChunk(dataLine({ error: 'Model throttled', error_type: 'ThrottlingException' }))

    expect(result.error).toBe('Model throttled')
  })
})
