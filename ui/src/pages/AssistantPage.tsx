import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { isAbortError, newSessionId, streamAgentReply } from '../agent/agentClient'
import { describeError } from '../api/errors'
import { validatePrompt } from '../lib/validation'

/*
 * Streaming chat with the hrAgent (FR5.1-FR5.7, NFR5).
 * One session id per conversation; "New conversation" starts a fresh one. Text is
 * appended as it streams; sending is disabled while a reply streams and Stop cancels it.
 */

type MessageStatus = 'streaming' | 'done' | 'stopped' | 'failed'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  status: MessageStatus
}

interface FailedTurn {
  prompt: string
  message: string
}

function AssistantNotice() {
  return (
    <div className="alert alert-notice" data-testid="assistant-notice">
      <p>
        The assistant can create, change and delete employee and leave records, and can send email to HR. Check what
        it proposes before you confirm. It asks before deleting an employee.
      </p>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const label = message.role === 'user' ? 'You' : 'Assistant'
  const suffix = message.status === 'stopped' ? ' (stopped)' : message.status === 'failed' ? ' (no reply)' : ''
  return (
    <div className={`chat-message chat-message-${message.role}`} data-testid={`assistant-message-${message.role}`}>
      <span className="chat-message-role">
        {label}
        {suffix}
      </span>
      {message.text || (message.status === 'streaming' ? 'Thinking' : '')}
    </div>
  )
}

/** /assistant */
export function AssistantPage() {
  const [sessionId, setSessionId] = useState(newSessionId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [failed, setFailed] = useState<FailedTurn | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo?.({ top: logRef.current.scrollHeight })
  }, [messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  const updateMessage = (id: string, change: (message: ChatMessage) => ChatMessage) => {
    setMessages((current) => current.map((message) => (message.id === id ? change(message) : message)))
  }

  const send = async (prompt: string) => {
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: prompt, status: 'done' }
    const replyId = crypto.randomUUID()
    setMessages((current) => [...current, userMessage, { id: replyId, role: 'assistant', text: '', status: 'streaming' }])
    setFailed(null)
    setIsStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamAgentReply({
        prompt,
        sessionId,
        signal: controller.signal,
        onText: (text) => updateMessage(replyId, (message) => ({ ...message, text: message.text + text })),
      })
      updateMessage(replyId, (message) => ({ ...message, status: 'done' }))
    } catch (error) {
      if (isAbortError(error)) {
        updateMessage(replyId, (message) => ({ ...message, status: 'stopped' }))
      } else {
        updateMessage(replyId, (message) => ({ ...message, status: 'failed' }))
        setFailed({ prompt, message: describeError(error) })
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      setIsStreaming(false)
    }
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (isStreaming) {
      return
    }
    const problem = validatePrompt(input)
    setInputError(problem)
    if (problem) {
      return
    }
    const prompt = input.trim()
    setInput('')
    void send(prompt)
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const stop = () => abortRef.current?.abort()

  const newConversation = () => {
    abortRef.current?.abort()
    setSessionId(newSessionId())
    setMessages([])
    setFailed(null)
    setInput('')
    setInputError(null)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">HR assistant</span>
          <h1>Assistant</h1>
        </div>
        <button type="button" className="btn btn-secondary" onClick={newConversation} data-testid="assistant-new-conversation-button">
          New conversation
        </button>
      </div>

      <AssistantNotice />

      <div className="chat">
        <div
          ref={logRef}
          className="chat-log"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          data-testid="assistant-message-list"
        >
          {messages.length === 0 && <p className="muted">Ask about employees, leave or HR emails.</p>}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>

        {failed && (
          <div className="alert alert-error" role="alert" data-testid="assistant-error">
            <p>{failed.message}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void send(failed.prompt)}
              disabled={isStreaming}
              data-testid="assistant-error-retry-button"
            >
              Retry
            </button>
          </div>
        )}

        <form className="chat-form" onSubmit={submit} noValidate data-testid="assistant-form">
          <div className="field">
            <label htmlFor="assistant-input">Message</label>
            <textarea
              id="assistant-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              disabled={isStreaming}
              aria-invalid={inputError ? true : undefined}
              aria-describedby={inputError ? 'assistant-input-error' : 'assistant-input-hint'}
              data-testid="assistant-input"
            />
            {inputError ? (
              <span id="assistant-input-error" className="field-error">{inputError}</span>
            ) : (
              <span id="assistant-input-hint" className="field-hint">Press Enter to send, Shift and Enter for a new line.</span>
            )}
          </div>
          <div className="button-row">
            <button type="submit" className="btn btn-primary" disabled={isStreaming} data-testid="assistant-send-button">
              Send
            </button>
            {isStreaming && (
              <button type="button" className="btn btn-secondary" onClick={stop} data-testid="assistant-stop-button">
                Stop
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  )
}
