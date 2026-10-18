import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronRight,
  Mic,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  WandSparkles,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { askStudio, type ChatTurn, type StudioAction } from "./ai"
import {
  actionWarnings,
  applyAction,
  destinationOf,
  isDate,
  isValidAction,
  offlineProposal,
  type Destination,
} from "./assistant"
import { listen, speechSupported } from "./speech"
import { PlannedWorkoutList } from "./TrainingViews"
import type { AppState, ChatMessage } from "./types"
import { Button, formatDate, Modal, uid } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const MAX_MESSAGES = 60

// Quick prompts: some send straight away, others need a detail, so they hint instead of pre-filling.
const QUICK: { label: string; send?: string; hint?: string }[] = [
  { label: "Plan my day", send: "Help me plan a balanced day with what I already have." },
  { label: "What’s next?", send: "What would be the most useful thing to do next?" },
  { label: "Log what I did", hint: "e.g. walked 25 minutes, felt easy" },
  { label: "Move something", hint: "e.g. move tonight’s gym to Thursday" },
  { label: "Plan a gym session", send: "Plan a gentle gym session for this week that supports my goals." },
  { label: "Add a goal", hint: "e.g. a goal to run 5k by March" },
  { label: "Inspire me", send: "Give me one small creative prompt for this week and save it as a project idea." },
  { label: "Check in", hint: "How are you feeling today?" },
]

export function StudioChat({
  state,
  update,
  onClose,
  onGo,
  onVoiceNotes,
}: {
  state: AppState
  update: Update
  onClose: () => void
  onGo: (to: Destination) => void
  onVoiceNotes: () => void
}) {
  const chat = state.chat ?? []
  const [input, setInput] = useState("")
  const [hint, setHint] = useState("")
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState<{ text: string; error: string } | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean[]>>({})
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState("")
  const [keyboardHint, setKeyboardHint] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const listener = useRef<ReturnType<typeof listen> | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [chat.length, loading, failed])
  useEffect(() => () => listener.current?.cancel(), [])

  const pushMessage = (message: ChatMessage) =>
    update((current) => ({ ...current, chat: [...(current.chat ?? []), message].slice(-MAX_MESSAGES) }))

  const history = (): ChatTurn[] =>
    chat.slice(-12).map((message) => ({
      role: message.role,
      text: message.text,
      suggested: (message.actions as StudioAction[] | undefined)?.map((action) => action.summary),
      outcome: message.actions?.length ? message.status : undefined,
    }))

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || loading) return
    setInput("")
    setHint("")
    setKeyboardHint(false)
    setFailed(null)
    const turns = history()
    pushMessage({ id: uid(), role: "user", text, at: new Date().toISOString() })
    setLoading(true)
    try {
      const result = await askStudio(text, state, turns)
      const actions = Array.isArray(result.actions) ? result.actions : []
      pushMessage({
        id: uid(),
        role: "studio",
        text: result.reply || (actions.length ? "Here’s what I’d suggest." : "Noted."),
        at: new Date().toISOString(),
        actions,
        status: actions.length ? "pending" : undefined,
      })
    } catch (error) {
      setFailed({ text, error: (error as Error).message })
    }
    setLoading(false)
  }

  const useOffline = () => {
    if (!failed) return
    const result = offlineProposal(failed.text, state)
    pushMessage({
      id: uid(),
      role: "studio",
      text: result.reply,
      at: new Date().toISOString(),
      actions: result.actions,
      status: result.actions.length ? "pending" : undefined,
    })
    setFailed(null)
  }

  const confirm = (message: ChatMessage) => {
    const actions = (message.actions ?? []) as StudioAction[]
    const picks = selected[message.id] ?? actions.map(() => true)
    const chosen = actions.filter((action, index) => picks[index] && isValidAction(state, action))
    if (!chosen.length) return
    const saved = chosen.map((action) => ({ summary: action.summary, ...destinationOf(action, state) }))
    update((current) => ({
      ...chosen.reduce(applyAction, current),
      chat: (current.chat ?? []).map((item) => (item.id === message.id ? { ...item, status: "saved" as const, saved } : item)),
    }))
  }

  const dismiss = (message: ChatMessage) =>
    update((current) => ({
      ...current,
      chat: (current.chat ?? []).map((item) => (item.id === message.id ? { ...item, status: "dismissed" as const } : item)),
    }))

  // Speech where it works; otherwise the keyboard's own dictation (iPhone home-screen apps).
  const startVoice = () => {
    if (listening) {
      listener.current?.stop()
      return
    }
    if (!speechSupported()) {
      flushSync(() => setKeyboardHint(true))
      inputRef.current?.focus()
      return
    }
    setLive("")
    setListening(true)
    listener.current = listen({
      onText: setLive,
      onDone: (text) => {
        setListening(false)
        setLive("")
        listener.current = null
        if (text.trim()) send(text)
      },
      onError: () => {
        setListening(false)
        setLive("")
        listener.current = null
        flushSync(() => setKeyboardHint(true))
        inputRef.current?.focus()
      },
    })
  }

  return (
    <Modal title="Studio" eyebrow="Plan, move, log and capture by chatting" onClose={onClose} wide>
      <div className="studio-chat">
        <div className="studio-chat__toolbar">
          <button type="button" className="text-link" onClick={onVoiceNotes}>
            <AudioLines size={15} /> Voice notes
          </button>
          {chat.length > 0 && (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                if (window.confirm("Start a new chat? Saved changes stay in your plan."))
                  update((current) => ({ ...current, chat: [] }))
              }}
            >
              <RotateCcw size={15} /> New chat
            </button>
          )}
        </div>

        <div className="studio-chat__messages" aria-live="polite">
          {chat.length === 0 && (
            <div className="assistant-welcome">
              <span className="assistant-welcome__pet">
                <img src="/assets/samoyed.png" alt="" />
              </span>
              <div>
                <h3>Hi {state.name}, what’s on your mind?</h3>
                <p>Ask me to plan, move, log or capture anything. I’ll suggest changes; nothing is saved until you confirm.</p>
              </div>
            </div>
          )}
          {chat.map((message) => {
            const actions = (message.actions ?? []) as StudioAction[]
            const picks = selected[message.id] ?? actions.map(() => true)
            return (
              <div className={`chat-bubble chat-bubble--${message.role}`} key={message.id}>
                <p>{message.text}</p>
                {actions.length > 0 && message.status === "pending" && (
                  <div className="chat-proposal">
                    {actions.map((action, index) => {
                      const valid = isValidAction(state, action)
                      const goal = state.goals.find((item) => item.id === action.goalId)
                      return (
                        <label className="proposal-action" key={index}>
                          <input
                            type="checkbox"
                            checked={picks[index] ?? false}
                            disabled={!valid}
                            onChange={(event) =>
                              setSelected((current) => ({
                                ...current,
                                [message.id]: picks.map((value, position) => (position === index ? event.target.checked : value)),
                              }))
                            }
                          />
                          <WandSparkles size={18} />
                          <span>
                            <strong>{action.summary}</strong>
                            <small>
                              {[action.title, isDate(action.date) && formatDate(action.date), action.time, action.amount != null && `£${action.amount}`, !valid && "Already done or not found"]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                            {actionWarnings(state, action).map((warning) => (
                              <small className="proposal-action__warn" key={warning}>
                                ⚠ {warning}
                              </small>
                            ))}
                            {goal && <small className="proposal-action__goal">Supports {goal.title}</small>}
                            {action.why && <small className="proposal-action__why">{action.why}</small>}
                            {(action.details ?? []).map((line) => (
                              <small className="proposal-action__detail" key={line}>
                                {line}
                              </small>
                            ))}
                            {(action.workout ?? []).length > 0 && <PlannedWorkoutList workout={action.workout ?? []} />}
                          </span>
                        </label>
                      )
                    })}
                    <div className="inline-actions">
                      <Button icon={Check} onClick={() => confirm(message)} disabled={!actions.some((action, index) => picks[index] && isValidAction(state, action))}>
                        Confirm
                      </Button>
                      <Button variant="ghost" onClick={() => dismiss(message)}>
                        Not now
                      </Button>
                    </div>
                  </div>
                )}
                {message.status === "saved" && (
                  <ul className="chat-saved">
                    {(message.saved ?? []).map((entry, index) => (
                      <li key={index}>
                        <Check size={15} />
                        <span>
                          <strong>{entry.summary}</strong>
                          <small>{entry.label}</small>
                        </span>
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => {
                            onClose()
                            onGo(entry.to as Destination)
                          }}
                        >
                          Go there <ChevronRight size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {message.status === "dismissed" && <small className="chat-bubble__note">Not saved</small>}
              </div>
            )
          })}
          {loading && (
            <div className="chat-bubble chat-bubble--studio chat-bubble--typing" aria-label="Studio is thinking">
              <span />
              <span />
              <span />
            </div>
          )}
          {failed && (
            <div className="chat-error" role="alert">
              <p>{failed.error}</p>
              <div className="inline-actions">
                <Button variant="secondary" icon={RotateCcw} onClick={() => send(failed.text)}>
                  Try again
                </Button>
                <Button variant="ghost" onClick={useOffline}>
                  Simple offline suggestion
                </Button>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="studio-chat__footer">
        <div className="studio-chat__quick" role="list">
          {QUICK.map((quick) => (
            <button
              type="button"
              role="listitem"
              key={quick.label}
              disabled={loading}
              onClick={() => {
                if (quick.send) send(quick.send)
                else {
                  flushSync(() => setHint(quick.hint ?? ""))
                  inputRef.current?.focus()
                }
              }}
            >
              {quick.label}
            </button>
          ))}
        </div>

        {keyboardHint && (
          <div className="dictate-hint" role="status">
            <Mic size={18} />
            <p>
              <strong>Tap the 🎤 on your keyboard and speak.</strong>
              <small>iPhone home-screen apps can’t listen directly, but keyboard dictation works.</small>
            </p>
          </div>
        )}

        <form
          className="studio-chat__input"
          onSubmit={(event) => {
            event.preventDefault()
            send(input)
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={listening ? live : input}
            readOnly={listening}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                send(input)
              }
            }}
            placeholder={listening ? "Listening…" : hint || "Message Studio…"}
            aria-label="Message Studio"
          />
          <button
            type="button"
            className={`studio-chat__mic ${listening ? "is-active" : ""}`}
            aria-label={listening ? "Stop and send" : "Speak to Studio"}
            onClick={startVoice}
          >
            {listening ? <Square size={18} /> : <Mic size={20} />}
          </button>
          <button type="submit" className="studio-chat__send" aria-label="Send" disabled={!input.trim() || loading}>
            <ArrowUp size={20} />
          </button>
        </form>
        <p className="studio-chat__boundary">
          <ShieldCheck size={14} /> Studio organises and encourages; it isn’t a therapist or clinician. <Sparkles size={12} /> AI can be wrong, so you confirm every change.
        </p>
        </div>
      </div>
    </Modal>
  )
}
