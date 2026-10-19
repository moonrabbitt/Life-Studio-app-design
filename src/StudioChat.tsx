import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronRight,
  ExternalLink,
  Globe,
  Mic,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  WandSparkles,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { askStudio, planProgression, type ChatTurn, type ProgressionDraft, type StudioAction } from "./ai"
import { applyProgression, mondayOf, nextMonday } from "./training"
import { ProgressionPreview } from "./NextWeek"
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
import { Button, formatDate, Modal, today, uid } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const MAX_MESSAGES = 60

// Quick prompts: some send straight away, others need a detail, so they hint instead of pre-filling.
const QUICK: { label: string; send?: string; hint?: string }[] = [
  { label: "Plan my day", send: "Help me plan a balanced day with what I already have." },
  { label: "What’s next?", send: "What would be the most useful thing to do next?" },
  { label: "Log what I did", hint: "e.g. walked 25 minutes, felt easy" },
  { label: "Something came up", hint: "e.g. I’m working late Thursday and away Saturday" },
  { label: "Move something", hint: "e.g. move tonight’s gym to Thursday" },
  { label: "Plan a gym session", send: "Plan a gentle gym session for this week that supports my goals." },
  { label: "Add a goal", hint: "e.g. a goal to run 5k by March" },
  { label: "Inspire me", send: "Give me one small creative prompt for this week and save it as a project idea." },
  { label: "Check in", hint: "How are you feeling today?" },
]

// When you come from Movement: Studio as your coach (same memory, same chat).
const MOVE_QUICK: { label: string; send?: string; hint?: string }[] = [
  { label: "A gym session today", send: "Plan a gym session for today that suits my body, energy and goals, with exact exercises, sets, reps and weights." },
  { label: "Low energy, something gentle", send: "My energy is low. Suggest something gentle for today that still helps my long-term health." },
  { label: "Progress my weights", send: "Look at my recent workouts and suggest what to progress next time: weights, reps or sets." },
  { label: "Plan my training week", send: "Plan my movement for this week around my calendar, energy and recovery." },
  { label: "Something hurts", hint: "e.g. my left knee aches after squats" },
  { label: "Log a workout", hint: "e.g. gym 40 min: goblet squats 3×8 at 12 kg, felt good" },
]

export function StudioChat({
  state,
  update,
  onClose,
  onGo,
  onVoiceNotes,
  initialHint = "",
  focus,
}: {
  initialHint?: string
  focus?: "move"
  state: AppState
  update: Update
  onClose: () => void
  onGo: (to: Destination) => void
  onVoiceNotes: () => void
}) {
  const chat = state.chat ?? []
  const [input, setInput] = useState("")
  const [hint, setHint] = useState(initialHint)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState<{ text: string; error: string } | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean[]>>({})
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState("")
  const [keyboardHint, setKeyboardHint] = useState(false)
  // "Search the web" for the next message: Studio looks it up and shows its sources.
  const [web, setWeb] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const listener = useRef<ReturnType<typeof listen> | null>(null)
  // The home-screen app can't listen directly; the keyboard's own mic covers it, so no extra button.
  const canListen = speechSupported()

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [chat.length, loading, failed])
  useEffect(() => () => listener.current?.cancel(), [])

  const pushMessage = (message: ChatMessage) =>
    update((current) => ({ ...current, chat: [...(current.chat ?? []), message].slice(-MAX_MESSAGES) }))

  const history = (): ChatTurn[] =>
    chat.slice(-12).map((message) => ({
      role: message.role,
      // A preview's weeks are part of what was said, so "more running" makes sense next turn.
      text: message.preview
        ? `${message.text} [Preview ${message.preview.status}: ${(message.preview.draft as ProgressionDraft).path.map((entry) => `${entry.focus} (${entry.keySession})`).join("; ")}]`
        : message.text,
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
      const result = await askStudio(text, state, turns, web)
      setWeb(false)
      const actions = Array.isArray(result.actions) ? result.actions : []
      pushMessage({
        id: uid(),
        role: "studio",
        text: result.reply || (actions.length ? "Here’s what I’d suggest." : "Noted."),
        at: new Date().toISOString(),
        actions,
        status: actions.length ? "pending" : undefined,
        sources: result.sources?.length ? result.sources.slice(0, 5) : undefined,
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

  const confirm = async (message: ChatMessage) => {
    const actions = (message.actions ?? []) as StudioAction[]
    const picks = selected[message.id] ?? actions.map(() => true)
    const chosen = actions.filter((action, index) => picks[index] && isValidAction(state, action))
    if (!chosen.length) return
    // Multi-week build-ups need Studio to write the weeks first.
    const progressions = chosen.filter((action) => action.type === "plan_progression")
    const simple = chosen.filter((action) => action.type !== "plan_progression")
    let built: { start: string; request: string; draft: ProgressionDraft }[] = []
    if (progressions.length) {
      setLoading(true)
      setFailed(null)
      try {
        const day = new Date(`${today()}T12:00:00`).getDay()
        const start = day >= 1 && day <= 3 ? mondayOf(today()) : nextMonday(today())
        built = await Promise.all(
          progressions.map(async (action) => {
            const request = [action.title, action.body].filter(Boolean).join(". ")
            const draft = await planProgression(state, request || "Build up gradually towards my goal", Math.max(2, Math.min(8, action.weeks ?? 6)), start, history())
            if (!draft?.sessions?.length) throw new Error("Studio couldn’t write those weeks this time. Try again.")
            return { start, request: action.title ?? request, draft }
          }),
        )
      } catch (error) {
        setLoading(false)
        setFailed({ text: "", error: (error as Error).message })
        return
      }
      setLoading(false)
    }
    // Simple changes apply now; multi-week plans come back as a preview to look over first.
    const saved = chosen.map((action) =>
      action.type === "plan_progression"
        ? { summary: action.summary, label: "The weeks are below. Have a look before adding them.", to: { kind: "plan", date: today() } }
        : { summary: action.summary, ...destinationOf(action, state) },
    )
    update((current) => {
      const next = simple.reduce(applyAction, current)
      const previews: ChatMessage[] = built.map(({ start, request, draft }) => ({
        id: uid(),
        role: "studio",
        text: `Here are the ${draft.path.length || "planned"} weeks in detail. Nothing is in your calendar yet.`,
        at: new Date().toISOString(),
        preview: { request, start, draft, status: "pending" },
      }))
      return {
        ...next,
        chat: [...(next.chat ?? []).map((item) => (item.id === message.id ? { ...item, status: "saved" as const, saved } : item)), ...previews].slice(-MAX_MESSAGES),
      }
    })
  }

  const setPreview = (id: string, status: "added" | "dismissed") =>
    update((current) => {
      const target = (current.chat ?? []).find((item) => item.id === id)
      const preview = target?.preview
      if (!preview) return current
      const next = status === "added" ? applyProgression(current, preview.start, preview.request, preview.draft as ProgressionDraft) : current
      return {
        ...next,
        chat: (next.chat ?? []).map((item) => (item.id === id && item.preview ? { ...item, preview: { ...item.preview, status } } : item)),
      }
    }, status === "added" ? "Added to your calendar. The old upcoming sessions are gone." : undefined)

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
    <Modal
      title={focus === "move" ? "Studio · coach" : "Studio"}
      eyebrow={focus === "move" ? "Workouts shaped by your body, energy and goals" : "Plan, move, log and capture by chatting"}
      onClose={onClose}
      wide
    >
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
                {message.preview && (
                  <ProgressionPreview draft={message.preview.draft as ProgressionDraft} start={message.preview.start}>
                    {message.preview.status === "pending" ? (
                      <div className="inline-actions">
                        <Button icon={Check} onClick={() => setPreview(message.id, "added")}>
                          Add to my calendar
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setPreview(message.id, "dismissed")
                            flushSync(() => setHint("What should change? e.g. more running, gym on weekday mornings"))
                            inputRef.current?.focus()
                          }}
                        >
                          Not quite, change it
                        </Button>
                      </div>
                    ) : (
                      <p className="capture-disclaimer">{message.preview.status === "added" ? "Added to your calendar." : "Not added. Tell Studio what to change."}</p>
                    )}
                  </ProgressionPreview>
                )}
                {message.sources && message.sources.length > 0 && (
                  <ul className="chat-sources">
                    {message.sources.map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title} <ExternalLink size={12} />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
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
              {failed.text ? (
                <div className="inline-actions">
                  <Button variant="secondary" icon={RotateCcw} onClick={() => send(failed.text)}>
                    Try again
                  </Button>
                  <Button variant="ghost" onClick={useOffline}>
                    Simple offline suggestion
                  </Button>
                </div>
              ) : (
                <small>Tap Confirm on the suggestion to try again.</small>
              )}
            </div>
          )}
          <div ref={endRef} className="studio-chat__end" />
        </div>

        <div className="studio-chat__footer">
        <div className="studio-chat__quick" role="list">
          {(focus === "move" ? MOVE_QUICK : QUICK).map((quick) => (
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
            placeholder={listening ? "Listening…" : web ? "What should Studio look up?" : hint || "Message Studio…"}
            aria-label="Message Studio"
          />
          <button
            type="button"
            className={`studio-chat__web ${web ? "is-active" : ""}`}
            aria-label={web ? "Web search on for this message" : "Search the web for this message"}
            aria-pressed={web}
            title="Search the web"
            onClick={() => setWeb(!web)}
          >
            <Globe size={19} />
          </button>
          {canListen && (
          <button
            type="button"
            className={`studio-chat__mic ${listening ? "is-active" : ""}`}
            aria-label={listening ? "Stop and send" : "Speak to Studio"}
            onClick={startVoice}
          >
            {listening ? <Square size={18} /> : <Mic size={20} />}
          </button>
          )}
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
