import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentError, streamAgentReply, type StreamAgentReplyOptions } from '../agent/agentClient'
import { AssistantPage } from './AssistantPage'

vi.mock('../agent/agentClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../agent/agentClient')>()),
  streamAgentReply: vi.fn(),
}))

/** Lets a test push text deltas and end the stream by hand. */
function controllableStream() {
  const calls: StreamAgentReplyOptions[] = []
  let finish: () => void = () => {}
  vi.mocked(streamAgentReply).mockImplementation((options) => {
    calls.push(options)
    return new Promise<void>((resolve) => {
      finish = resolve
    })
  })
  return {
    calls,
    push: (text: string) => act(() => calls.at(-1)?.onText(text)),
    end: () => act(async () => finish()),
  }
}

beforeEach(() => {
  vi.mocked(streamAgentReply).mockReset()
})

describe('AssistantPage (FR5.1-FR5.7)', () => {
  it('says that the assistant can change records and send email', () => {
    render(<AssistantPage />)

    expect(screen.getByTestId('assistant-notice')).toHaveTextContent(
      'can create, change and delete employee and leave records, and can send email to HR',
    )
  })

  it('streams text incrementally and disables sending while streaming', async () => {
    const user = userEvent.setup()
    const stream = controllableStream()
    render(<AssistantPage />)

    await user.type(screen.getByLabelText('Message'), 'How much leave has Ada taken?')
    await user.click(screen.getByTestId('assistant-send-button'))

    expect(stream.calls[0].prompt).toBe('How much leave has Ada taken?')
    expect(screen.getByTestId('assistant-send-button')).toBeDisabled()
    expect(screen.getByLabelText('Message')).toBeDisabled()
    expect(screen.getByTestId('assistant-stop-button')).toBeInTheDocument()

    stream.push('Ada has ')
    expect(screen.getByTestId('assistant-message-assistant')).toHaveTextContent('Ada has')
    stream.push('one leave entry.')
    expect(screen.getByTestId('assistant-message-assistant')).toHaveTextContent('Ada has one leave entry.')

    await stream.end()
    expect(screen.getByTestId('assistant-send-button')).toBeEnabled()
    expect(screen.queryByTestId('assistant-stop-button')).not.toBeInTheDocument()
  })

  it('reuses the session id within a conversation and starts a new one on New conversation', async () => {
    const user = userEvent.setup()
    const stream = controllableStream()
    render(<AssistantPage />)

    await user.type(screen.getByLabelText('Message'), 'First{Enter}')
    await stream.end()
    await user.type(screen.getByLabelText('Message'), 'Second{Enter}')
    await stream.end()
    await user.click(screen.getByTestId('assistant-new-conversation-button'))
    await user.type(screen.getByLabelText('Message'), 'Third{Enter}')
    await stream.end()

    const [first, second, third] = stream.calls.map((call) => call.sessionId)
    expect(first.length).toBeGreaterThanOrEqual(33)
    expect(second).toBe(first)
    expect(third).not.toBe(first)
  })

  it('shows an error, keeps the message and retries it', async () => {
    const user = userEvent.setup()
    vi.mocked(streamAgentReply)
      .mockRejectedValueOnce(new AgentError('The HR assistant returned an error (HTTP 500).', 500))
      .mockResolvedValueOnce(undefined)
    render(<AssistantPage />)

    await user.type(screen.getByLabelText('Message'), 'List employees')
    await user.click(screen.getByTestId('assistant-send-button'))

    expect(await screen.findByTestId('assistant-error')).toHaveTextContent('HTTP 500')
    expect(screen.getByTestId('assistant-message-user')).toHaveTextContent('List employees')

    await user.click(screen.getByTestId('assistant-error-retry-button'))
    expect(streamAgentReply).toHaveBeenCalledTimes(2)
    expect(vi.mocked(streamAgentReply).mock.calls[1][0].prompt).toBe('List employees')
    expect(screen.queryByTestId('assistant-error')).not.toBeInTheDocument()
  })

  it('does not send an empty message', async () => {
    const user = userEvent.setup()
    render(<AssistantPage />)

    await user.type(screen.getByLabelText('Message'), '   ')
    await user.click(screen.getByTestId('assistant-send-button'))

    expect(streamAgentReply).not.toHaveBeenCalled()
    expect(screen.getByText('Please enter a message.')).toBeInTheDocument()
  })

  it('Stop aborts the request through its signal', async () => {
    const user = userEvent.setup()
    const stream = controllableStream()
    render(<AssistantPage />)

    await user.type(screen.getByLabelText('Message'), 'Draft an email{Enter}')
    await user.click(screen.getByTestId('assistant-stop-button'))

    expect(stream.calls[0].signal?.aborted).toBe(true)
  })
})
