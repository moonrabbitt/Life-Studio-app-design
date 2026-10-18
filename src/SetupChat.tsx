import { ArrowUp, Check, RotateCcw, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { onboardingTurn, setupSpace, type SetupDraft } from "./ai"
import type { SetupChoices } from "./setup"
import { getPasscode, setPasscode } from "./sync"
import type { AboutMe, AppState } from "./types"
import { Button, formatDate } from "./ui"

type Topic = {
  key: keyof Omit<AboutMe, "updatedAt"> | "name" | "areas" | "density"
  question: string
  chips: string[]
  multi?: boolean
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const TOPICS: Topic[] = [
  { key: "name", question: "First, what should I call you?", chips: [] },
  {
    key: "areas",
    question: "What would you like more room for in your life right now? Pick any, or tell me in your own words.",
    chips: ["Moving my body", "Making things", "People I love", "Calm and reflection", "Money", "Home and rest"],
    multi: true,
  },
  {
    key: "workingTowards",
    question: "Is there anything you’re working towards? An event, a date, something you’d love to be able to do.",
    chips: ["A race or event", "Getting stronger", "A dance goal", "A creative project", "Nothing specific yet"],
    multi: true,
  },
  {
    key: "healthGoals",
    question: "Thinking long term, what do you want for your health? What would you like your body to be able to do in ten years?",
    chips: ["Strong as I get older", "More energy", "Heart and lungs", "Better sleep", "Move without pain", "Feel calmer"],
    multi: true,
  },
  {
    key: "body",
    question: "Tell me about your body. Any injuries, conditions or things that hurt? And what tends to feel good?",
    chips: ["Nothing to mention", "Knees", "Lower back", "Shoulders or neck", "Hypermobility", "Recovering from injury"],
    multi: true,
  },
  {
    key: "movementNow",
    question: "How do you move at the moment, and what can you use? A gym, weights at home, classes…",
    chips: ["Hardly at all", "Some walking", "Gym membership", "Dumbbells at home", "Dance classes", "I run a little"],
    multi: true,
  },
  {
    key: "week",
    question: "What does a normal week look like? Your work hours, anything you already do on a set day (like a Tuesday class), and which days could realistically have a session?",
    chips: [...DAYS, "About 30 min", "About 45 min", "An hour"],
    multi: true,
  },
  {
    key: "energy",
    question: "How’s your energy? When are you at your best, and is there anything that changes it?",
    chips: ["Mornings are best", "Evenings are best", "I’m drained after work", "My cycle affects it", "Sleep is patchy"],
    multi: true,
  },
  {
    key: "density",
    question: "Last one: how full should a day feel?",
    chips: ["One thing is plenty", "A few things", "I like full days"],
  },
]

type Message = { from: "studio" | "me"; text: string }

const quick = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))])

const AREA_FROM: Record<string, SetupDraft["priorities"][number]> = {
  "Moving my body": "move",
  "Making things": "create",
  "People I love": "connect",
  "Calm and reflection": "reflect",
  Money: "money",
  "Home and rest": "home",
}

// If Studio can't be reached, still set up the basics from what you said.
function basicDraft(answers: Record<string, string[]>): SetupDraft {
  const said = (key: string) => (answers[key] ?? []).join(". ")
  const density = said("density")
  return {
    welcome: "Here’s a simple start from what you told me. Ask Studio to plan more whenever you like.",
    aboutMe: {
      workingTowards: said("workingTowards"),
      healthGoals: said("healthGoals"),
      body: said("body"),
      movementNow: said("movementNow"),
      equipment: "",
      week: said("week"),
      energy: said("energy"),
      other: "",
    },
    priorities: Object.entries(AREA_FROM)
      .filter(([label]) => said("areas").includes(label))
      .map(([, area]) => area),
    density: /one/i.test(density) ? "one" : /full/i.test(density) ? "full" : "few",
    profile: { equipment: "not-sure", gymExperience: "not-sure", days: DAYS.filter((day) => said("week").includes(day)), minutes: "", concern: /nothing/i.test(said("body")) || !said("body") ? "no" : "not-sure", concernNote: "" },
    goals: [],
    commitments: [],
    training: { include: false, purpose: "", targetDate: null, summary: "", phases: [], week: [] },
    routines: [],
  }
}

export const ABOUT_LABELS: [keyof SetupChoices["aboutMe"], string][] = [
  ["workingTowards", "Working towards"],
  ["healthGoals", "Long-term health"],
  ["body", "Your body"],
  ["movementNow", "How you move now"],
  ["equipment", "What you can use"],
  ["week", "Your week"],
  ["energy", "Energy"],
  ["other", "Anything else"],
]

// Setting up your space as a conversation with Studio, then a review before anything is created.
export function SetupChat({
  state,
  again,
  onApply,
}: {
  state: AppState
  again: boolean
  onApply: (draft: SetupDraft, choices: SetupChoices, name: string) => void
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      from: "studio",
      text: again
        ? "Let’s set up your space again from the top. I’ll ask a few questions, about five minutes. Tap an answer, write your own, or skip anything."
        : "Hi, I’m Studio. I’ll ask a few questions to set up your space, about five minutes. Tap an answer, write your own, or skip anything.",
    },
    { from: "studio", text: TOPICS[0].question },
  ])
  const [topic, setTopic] = useState(0)
  const [followUps, setFollowUps] = useState(0)
  const [chips, setChips] = useState<string[]>(state.name ? [state.name] : [])
  const [picked, setPicked] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const [name, setName] = useState(state.name)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [stage, setStage] = useState<"chat" | "drafting" | "review" | "failed">("chat")
  const [draft, setDraft] = useState<SetupDraft | null>(null)
  const [choices, setChoices] = useState<SetupChoices | null>(null)
  const [error, setError] = useState("")
  const [passcode, setPass] = useState("")
  const [hasPasscode, setHasPasscode] = useState(() => !!getPasscode())
  const endRef = useRef<HTMLDivElement>(null)
  const current = TOPICS[Math.min(topic, TOPICS.length - 1)]
  const multi = followUps === 0 && current.multi

  // Scroll whatever holds the conversation (the modal or the page) right to the bottom,
  // so the newest message sits just above the answer box.
  useEffect(() => {
    let node: HTMLElement | null = endRef.current
    while (node && !(node.scrollHeight > node.clientHeight && /(auto|scroll)/.test(getComputedStyle(node).overflowY))) node = node.parentElement
    const target = node ?? document.scrollingElement
    target?.scrollTo({ top: target.scrollHeight, behavior: "smooth" })
  }, [messages, thinking, stage])

  const transcriptOf = (list: Message[]) => list.map((message) => ({ from: message.from === "me" ? "me" : "studio", text: message.text }))

  const draftSpace = async (list: Message[], finalName: string) => {
    setStage("drafting")
    setError("")
    try {
      const result = await setupSpace(transcriptOf(list), finalName)
      if (!result?.aboutMe) throw new Error("Studio couldn’t put your space together this time.")
      review(result)
    } catch (failure) {
      setError((failure as Error).message)
      setStage("failed")
    }
  }

  const review = (result: SetupDraft) => {
    setDraft(result)
    setChoices({
      goals: result.goals.map(() => true),
      commitments: (result.commitments ?? []).map(() => true),
      training: result.training.include,
      routines: result.routines.map(() => true),
      aboutMe: { ...result.aboutMe },
    })
    setStage("review")
  }

  const send = async (raw: string) => {
    const text = raw.trim() || "Skip"
    if (thinking) return
    const asked = [...messages].reverse().find((message) => message.from === "studio")?.text ?? current.question
    const withMine: Message[] = [...messages, { from: "me", text }]
    setMessages(withMine)
    setInput("")
    setPicked([])
    setChips([])
    setAnswers((previous) => ({ ...previous, [current.key]: [...(previous[current.key] ?? []), text] }))
    const finalName = current.key === "name" && text !== "Skip" ? text.split(/[ ,.]/)[0] : name
    if (current.key === "name") setName(finalName)

    let reply = text === "Skip" ? "That’s fine." : "Thank you."
    let followUp: string | null = null
    let followChips: string[] = []
    if (current.key !== "name" && current.key !== "density") {
      setThinking(true)
      try {
        const turn = await quick(onboardingTurn(text, { topic: current.key, question: asked, transcript: transcriptOf(withMine), followUpsAsked: followUps }), 15000)
        if (turn?.reply) reply = turn.reply
        if (turn?.followUp && followUps === 0) {
          followUp = turn.followUp
          followChips = (turn.chips ?? []).slice(0, 4)
        }
      } catch {
        // Offline or no passcode: keep going with a simple acknowledgement.
      }
      setThinking(false)
    } else if (current.key === "name" && text !== "Skip") {
      reply = `Lovely to meet you, ${finalName}.`
    }

    if (followUp) {
      setMessages([...withMine, { from: "studio", text: reply }, { from: "studio", text: followUp }])
      setFollowUps(1)
      setChips(followChips)
      return
    }
    const nextTopic = topic + 1
    if (nextTopic >= TOPICS.length) {
      const done: Message[] = [...withMine, { from: "studio", text: "Thank you, that’s everything I need. Give me a moment to put your space together." }]
      setMessages(done)
      setTopic(nextTopic)
      draftSpace(done, finalName)
      return
    }
    setMessages([...withMine, { from: "studio", text: reply }, { from: "studio", text: TOPICS[nextTopic].question }])
    setTopic(nextTopic)
    setFollowUps(0)
    setChips(TOPICS[nextTopic].chips)
  }

  if (stage === "review" && draft && choices) {
    const toggle = (list: "goals" | "routines", index: number) =>
      setChoices({ ...choices, [list]: choices[list].map((value, position) => (position === index ? !value : value)) })
    return (
      <div className="setup-review">
        <div className="setup-chat__bubble is-studio">{draft.welcome}</div>
        <section>
          <h3>What I’ll remember about you</h3>
          <p className="capture-disclaimer">Studio uses this for every plan and exercise. Edit it now, or any time in My space → About me.</p>
          {ABOUT_LABELS.filter(([key]) => choices.aboutMe[key]).map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <textarea rows={2} value={choices.aboutMe[key]} onChange={(event) => setChoices({ ...choices, aboutMe: { ...choices.aboutMe, [key]: event.target.value } })} />
            </label>
          ))}
        </section>
        {draft.goals.length > 0 && (
          <section>
            <h3>Goals</h3>
            {draft.goals.map((goal, index) => (
              <label className="setup-review__pick" key={index}>
                <input type="checkbox" checked={choices.goals[index]} onChange={() => toggle("goals", index)} />
                <span>
                  <strong>{goal.title}</strong>
                  <small>
                    {goal.scale === "big" ? "Bigger goal" : "Smaller goal"}
                    {goal.date ? ` · ${formatDate(goal.date, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </small>
                  {goal.milestones.length > 0 && <small>Milestones: {goal.milestones.join(" → ")}</small>}
                </span>
              </label>
            ))}
          </section>
        )}
        {(draft.commitments ?? []).length > 0 && (
          <section>
            <h3>Already in your week</h3>
            <p className="capture-disclaimer">These stay on their day every week, and training is planned around them.</p>
            {draft.commitments.map((commitment, index) => (
              <label className="setup-review__pick" key={index}>
                <input
                  type="checkbox"
                  checked={choices.commitments[index]}
                  onChange={() => setChoices({ ...choices, commitments: choices.commitments.map((value, position) => (position === index ? !value : value)) })}
                />
                <span>
                  <strong>{commitment.title}</strong>
                  <small>
                    {commitment.frequency === "fortnightly" ? "Every other" : "Every"} {FULL_DAYS[Math.max(0, Math.min(6, commitment.dayOffset))]}
                    {commitment.time ? ` · ${commitment.time}` : ""} · {commitment.duration} min
                  </small>
                </span>
              </label>
            ))}
          </section>
        )}
        {draft.training.include && draft.training.phases.length > 0 && (
          <section>
            <h3>Training plan</h3>
            <label className="setup-review__pick">
              <input type="checkbox" checked={choices.training} onChange={() => setChoices({ ...choices, training: !choices.training })} />
              <span>
                <strong>{draft.training.purpose}</strong>
                <small>{draft.training.summary}</small>
              </span>
            </label>
            <ol className="setup-review__phases">
              {draft.training.phases.map((phase, index) => (
                <li key={index}>
                  <b>{phase.title}</b> · about {phase.weeks} week{phase.weeks === 1 ? "" : "s"}
                </li>
              ))}
            </ol>
            <p className="eyebrow">Your first week</p>
            <ul className="plan-change__week">
              {[...draft.training.week]
                .sort((a, b) => a.dayOffset - b.dayOffset)
                .map((session, index) => (
                  <li key={index}>
                    <b>{DAYS[Math.max(0, Math.min(6, session.dayOffset))]}</b>
                    <span>
                      {session.title}
                      {session.workout?.length ? <small> · {session.workout.length} exercises</small> : null}
                    </span>
                    <small>{session.duration} min</small>
                  </li>
                ))}
            </ul>
          </section>
        )}
        {draft.routines.length > 0 && (
          <section>
            <h3>Routines</h3>
            {draft.routines.map((routine, index) => (
              <label className="setup-review__pick" key={index}>
                <input type="checkbox" checked={choices.routines[index]} onChange={() => toggle("routines", index)} />
                <span>
                  <strong>{routine.title}</strong>
                  <small>
                    {routine.frequency === "daily" ? "Every day" : routine.frequency === "weekdays" ? "Weekdays" : "Every week"}
                    {routine.time ? ` · ${routine.time}` : ""}
                  </small>
                </span>
              </label>
            ))}
          </section>
        )}
        {again && (
          <p className="events__reassure">
            Starting fresh: your current goals, routines and upcoming plans are put away (you can bring them back
            from About me). Everything you’ve done, your story, journal, people and projects stay.
          </p>
        )}
        <Button icon={Check} onClick={() => onApply(draft, choices, name)}>
          Set up my space
        </Button>
      </div>
    )
  }

  return (
    <div className="setup-chat">
      <div className="setup-chat__log" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={`setup-chat__bubble is-${message.from}`}>
            {message.text}
          </div>
        ))}
        {thinking && <div className="setup-chat__bubble is-studio is-typing" aria-label="Studio is typing"><i /><i /><i /></div>}
        {stage === "drafting" && (
          <p className="setup-chat__status">
            <Sparkles size={15} className="is-spinning" /> Putting your goals, plan and routines together… this can take up to half a minute.
          </p>
        )}
        {stage === "failed" && (
          <div className="setup-chat__failed">
            <p>{error || "Studio couldn’t be reached."} You can try again, or start with the basics and plan more later.</p>
            <div className="inline-actions">
              <Button icon={RotateCcw} onClick={() => draftSpace(messages, name)}>
                Try again
              </Button>
              <Button variant="secondary" onClick={() => review(basicDraft(answers))}>
                Start with the basics
              </Button>
            </div>
          </div>
        )}
        <div ref={endRef} className="setup-chat__end" />
      </div>
      {stage === "chat" && topic < TOPICS.length && (
        <div className="setup-chat__composer">
          {!hasPasscode && topic <= 1 && (
            <form
              className="setup-chat__passcode"
              onSubmit={(event) => {
                event.preventDefault()
                if (!passcode.trim()) return
                setPasscode(passcode.trim())
                setHasPasscode(true)
              }}
            >
              <label>
                <span>Your Studio passcode (lets Studio think, and keeps your space in sync)</span>
                <input type="password" value={passcode} onChange={(event) => setPass(event.target.value)} autoComplete="current-password" />
              </label>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>
          )}
          {chips.length > 0 && (
            <div className="setup-chat__chips">
              {chips.map((chip) => (
                <button
                  type="button"
                  key={chip}
                  className={picked.includes(chip) ? "is-selected" : ""}
                  aria-pressed={multi ? picked.includes(chip) : undefined}
                  disabled={thinking}
                  onClick={() => {
                    if (!multi) send(chip)
                    else setPicked(picked.includes(chip) ? picked.filter((item) => item !== chip) : [...picked, chip])
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
          <form
            className="setup-chat__input"
            onSubmit={(event) => {
              event.preventDefault()
              send([picked.join(", "), input.trim()].filter(Boolean).join(". "))
            }}
          >
            <textarea
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder={picked.length ? "Add anything else (optional)" : "Write your answer"}
              aria-label="Your answer"
              disabled={thinking}
            />
            <button type="submit" className="setup-chat__send" aria-label={input.trim() || picked.length ? "Send" : "Skip"} disabled={thinking}>
              {input.trim() || picked.length ? <ArrowUp size={18} /> : <span>Skip</span>}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
