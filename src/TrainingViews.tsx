import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Mic,
  MoveRight,
  Pause,
  Play,
  Plus,
  Repeat,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Square,
  TriangleAlert,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { listen, speechSupported } from "./speech"
import {
  acceptWeek,
  addDays,
  addRestartFortnight,
  buildIntroSession,
  buildRestartFortnight,
  checkPlacement,
  EXERCISES,
  FAIRPLAY_REPORTED,
  HACKNEY_LABEL,
  lastPerformance,
  mondayOf,
  nextMonday,
  nextUsefulAction,
  PHASES,
  RESTART_START,
  SOURCES,
  STRENGTH_GOAL,
  WARM_UP,
  WHY_THIS_PLAN,
  type Exercise,
} from "./training"
import type {
  ActivityLog,
  AppState,
  Effort,
  LoggedSet,
  PlanItem,
  TrainingProfile,
  WorkoutRecord,
} from "./types"
import { Button, formatDate, Modal, today, uid } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void
export type ActivityMode = "start" | "short" | "move"

const EFFORTS: [Effort, string][] = [
  ["easy", "Easy"],
  ["comfortable", "Comfortable"],
  ["hard", "Hard"],
  ["very-hard", "Very hard"],
]

const timeLabel = (item: PlanItem) =>
  [item.time ?? "Anytime", item.duration ? `${item.duration} min` : ""]
    .filter(Boolean)
    .join(" · ")

const statusLabel = (item: PlanItem) =>
  item.status === "proposed"
    ? "Proposed"
    : item.status === "planned"
      ? "Accepted"
      : item.status === "complete"
        ? "Done"
        : "Skipped"

export function StatusBadge({ item }: { item: PlanItem }) {
  return (
    <span className={`status-badge is-${item.status}`}>{statusLabel(item)}</span>
  )
}

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: [T, string][]
  value: T | ""
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="chip-group">
      <legend>{label}</legend>
      <div>
        {options.map(([key, text]) => (
          <button
            type="button"
            className={value === key ? "is-selected" : ""}
            aria-pressed={value === key}
            onClick={() => onChange(key)}
            key={key}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// Round mic that turns speech into text with live feedback (browser speech, no AI).
export function DictateButton({ onText }: { onText: (text: string) => void }) {
  const [live, setLive] = useState("")
  const [active, setActive] = useState(false)
  const [error, setError] = useState("")
  const session = useRef<ReturnType<typeof listen> | null>(null)
  useEffect(() => () => session.current?.cancel(), [])

  if (!speechSupported()) return null
  return (
    <div className="dictate">
      <button
        type="button"
        className={`dictate__mic ${active ? "is-active" : ""}`}
        aria-label={active ? "Stop dictating" : "Dictate with your voice"}
        onClick={() => {
          if (active) {
            session.current?.stop()
            return
          }
          setError("")
          setLive("")
          setActive(true)
          session.current = listen({
            onText: setLive,
            onDone: (text) => {
              setActive(false)
              setLive("")
              if (text.trim()) onText(text.trim())
            },
            onError: (kind) => {
              setActive(false)
              setError(
                kind === "permission"
                  ? "Allow the microphone to dictate, or type instead."
                  : "Voice isn’t available right now. Type instead.",
              )
            },
          })
        }}
      >
        {active ? <Square size={18} /> : <Mic size={20} />}
      </button>
      <span className="dictate__text" aria-live="polite">
        {error || (active ? live || "Listening… tap to finish" : "Speak instead")}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity buttons: Start · Short version · Move · Skip
// ---------------------------------------------------------------------------

export function ActivityButtons({
  item,
  onActivity,
  onSkip,
}: {
  item: PlanItem
  onActivity: (id: string, mode: ActivityMode) => void
  onSkip: (id: string) => void
}) {
  if (item.status === "complete" || item.status === "let-go") return null
  return (
    <div className="activity-buttons">
      <Button icon={Play} onClick={() => onActivity(item.id, "start")}>
        Start
      </Button>
      {item.shortVersion && (
        <Button
          variant="secondary"
          icon={Zap}
          onClick={() => onActivity(item.id, "short")}
        >
          Short version
        </Button>
      )}
      <Button variant="ghost" icon={MoveRight} onClick={() => onActivity(item.id, "move")}>
        Move
      </Button>
      <Button variant="ghost" icon={SkipForward} onClick={() => onSkip(item.id)}>
        Skip
      </Button>
    </div>
  )
}

export const skipItem = (update: Update, id: string) =>
  update(
    (current) => ({
      ...current,
      plan: current.plan.map((item) =>
        item.id === id ? { ...item, status: "let-go" } : item,
      ),
    }),
    "Skipped. It won’t be added to another day.",
  )

// ---------------------------------------------------------------------------
// Today: next useful action + starter offer
// ---------------------------------------------------------------------------

export function NextActionCard({
  state,
  update,
  onActivity,
  onRoadmap,
  onSetupRestart,
}: {
  state: AppState
  update: Update
  onActivity: (id: string, mode: ActivityMode) => void
  onRoadmap: () => void
  onSetupRestart: () => void
}) {
  const next = nextUsefulAction(state.plan, today())
  const hasRestart = state.plan.some((item) => item.phase === "restart")

  if (!hasRestart && state.restartOffer !== "dismissed") {
    return (
      <section className="today-next today-next--offer">
        <p className="eyebrow">Restart phase · 2 weeks</p>
        <h2>A gentle starter fortnight is ready to review.</h2>
        <p>
          One gym session, easy walks, dance, a recovery day, and small slots
          for investing, creativity and friends. They’re proposals you can edit;
          nothing is booked.
        </p>
        <div className="inline-actions">
          <Button icon={CalendarCheck} onClick={onSetupRestart}>
            Review the fortnight
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              update((current) => ({ ...current, restartOffer: "dismissed" }))
            }
          >
            Not now
          </Button>
        </div>
      </section>
    )
  }

  if (!next) {
    return (
      <section className="today-next">
        <p className="eyebrow">Next useful action</p>
        <h2>Nothing is asking for you right now.</h2>
        <button type="button" className="text-link" onClick={onRoadmap}>
          See the roadmap <ChevronRight size={16} />
        </button>
      </section>
    )
  }

  const { item, when } = next
  const batchProposed = item.batch
    ? state.plan.filter(
        (other) => other.batch === item.batch && other.status === "proposed",
      ).length
    : 0
  return (
    <section className="today-next">
      <div className="today-next__top">
        <p className="eyebrow">
          {item.phase === "restart" ? "Restart phase · " : ""}
          {when === "today"
            ? "Next useful action"
            : `Next up · ${formatDate(item.date, { weekday: "long" })}`}
        </p>
        <StatusBadge item={item} />
      </div>
      <h2>{item.title}</h2>
      <p className="today-next__meta">
        <Clock3 size={15} /> {timeLabel(item)}
      </p>
      {item.details?.[0] && <p>{item.details[0]}</p>}
      <ActivityButtons
        item={item}
        onActivity={onActivity}
        onSkip={(id) => skipItem(update, id)}
      />
      <div className="today-next__links">
        {item.status === "proposed" && item.batch && (
          <button
            type="button"
            className="text-link"
            onClick={() =>
              update(
                (current) => acceptWeek(current, item.batch!),
                `This week’s ${batchProposed} plans are accepted.`,
              )
            }
          >
            <Check size={16} /> Accept this week
          </button>
        )}
        <button type="button" className="text-link" onClick={onRoadmap}>
          Roadmap and why this plan <ChevronRight size={16} />
        </button>
      </div>
    </section>
  )
}

export function RestartSetup({
  state,
  update,
  onClose,
}: {
  state: AppState
  update: Update
  onClose: () => void
}) {
  const passed = today() > RESTART_START
  const [start, setStart] = useState(passed ? nextMonday(today()) : RESTART_START)
  const items = useMemo(() => buildRestartFortnight(start), [start])
  const weeks = [items.slice(0, items.length / 2), items.slice(items.length / 2)]
  const clashes = items.filter(
    (item) => checkPlacement(state.plan, item, item.date, item.time).conflicts.length,
  )

  return (
    <Modal
      title="Restart phase"
      eyebrow="Your starter fortnight · proposed plans"
      onClose={onClose}
      wide
    >
      <div className="restart-setup">
        {passed && (
          <div className="prototype-note">
            <CalendarCheck size={19} />
            <p>
              The original dates (19 Oct–1 Nov 2026) have passed. Choose when
              you’d like to start instead.
            </p>
          </div>
        )}
        <label className="restart-setup__date">
          <span>Start date</span>
          <input
            type="date"
            value={start}
            onChange={(event) => event.target.value && setStart(event.target.value)}
          />
        </label>
        <p className="capture-disclaimer">
          {formatDate(start, { day: "numeric", month: "long" })} –{" "}
          {formatDate(addDays(start, 13), { day: "numeric", month: "long" })} ·
          Europe/London time. Week two repeats week one without adding more
          exercise.
        </p>
        {clashes.length > 0 && (
          <div className="prototype-note">
            <TriangleAlert size={19} />
            <p>
              {clashes.length} proposal{clashes.length === 1 ? "" : "s"} overlap
              existing plans ({clashes.map((item) => item.title).slice(0, 2).join(", ")}
              {clashes.length > 2 ? "…" : ""}). Both stay visible; move either later.
            </p>
          </div>
        )}
        {weeks.map((week, index) => (
          <section className="restart-week" key={index}>
            <h3>Week {index + 1}</h3>
            <ul>
              {week.map((item) => (
                <li key={item.id} className={item.optional ? "is-optional" : ""}>
                  <span>
                    {formatDate(item.date, { weekday: "short" })}{" "}
                    {item.time ?? ""}
                  </span>
                  <strong>{item.title}</strong>
                  {item.optional && <small>optional</small>}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <Button
          icon={Plus}
          onClick={() => {
            update(
              (current) => addRestartFortnight(current, start),
              "Your starter fortnight is in Plan as proposals. Accept a week when it looks right.",
            )
            onClose()
          }}
        >
          Add as proposed plans
        </Button>
        <p className="capture-disclaimer">
          First milestone: “I found a week I can comfortably repeat.”
        </p>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Roadmap and "Why this plan?"
// ---------------------------------------------------------------------------

export function Roadmap({
  state,
  update,
  onClose,
  onSetupRestart,
  onEditProfile,
}: {
  state: AppState
  update: Update
  onClose: () => void
  onSetupRestart: () => void
  onEditProfile: () => void
}) {
  const phase = state.trainingPhase ?? 1
  const events = state.events ?? {}
  const setEvents = (patch: Partial<NonNullable<AppState["events"]>>, message: string) =>
    update((current) => {
      const next = { ...current.events, ...patch }
      return {
        ...current,
        events: next,
        goals: current.goals.map((goal) =>
          goal.id === "goal-race"
            ? {
                ...goal,
                dateLabel: next.hackneyBooked
                  ? "Sun 16 May 2027 · entry booked"
                  : HACKNEY_LABEL,
              }
            : goal.id === "goal-dance"
              ? {
                  ...goal,
                  date: next.fairplayConfirmed ? "2027-08-01" : undefined,
                  dateLabel: next.fairplayConfirmed
                    ? `1–8 Aug 2027, Kraków · dates confirmed by you · ${
                        next.fairplayBooked ? "booked" : "not booked"
                      }`
                    : FAIRPLAY_REPORTED,
                }
              : goal,
        ),
      }
    }, message)

  return (
    <Modal title="Your roadmap" eyebrow="Running, gym and dance as one programme" onClose={onClose} wide>
      <div className="roadmap">
        <ol className="roadmap__phases">
          {PHASES.map((item) => (
            <li
              key={item.id}
              className={item.id === phase ? "is-current" : item.id < phase ? "is-done" : ""}
            >
              <span>{item.id}</span>
              <div>
                <strong>
                  {item.title}
                  {item.id === phase ? " · now" : ""}
                </strong>
                <p>{item.body}</p>
                <small>{item.ready}</small>
              </div>
            </li>
          ))}
        </ol>
        <p className="capture-disclaimer">
          Workload changes only when your logs (what you did, effort, pain,
          fatigue and recovery) support it, never just because another week has
          passed. Missed sessions are never piled onto the next week.
        </p>
        {!state.plan.some((item) => item.phase === "restart") && (
          <Button variant="secondary" icon={CalendarCheck} onClick={onSetupRestart}>
            Set up the starter fortnight
          </Button>
        )}

        <section className="roadmap__events">
          <h3>Events</h3>
          <article>
            <strong>Hackney Half Marathon</strong>
            <p>{events.hackneyBooked ? "Sun 16 May 2027 · entry booked" : HACKNEY_LABEL}</p>
            <a href="https://www.hackneymoves.com/2027" target="_blank" rel="noreferrer">
              Official site <ExternalLink size={13} />
            </a>
            <label className="sync-replace">
              <input
                type="checkbox"
                checked={!!events.hackneyBooked}
                onChange={(event) =>
                  setEvents({ hackneyBooked: event.target.checked }, "Hackney Half updated.")
                }
              />
              <span>I have an entry</span>
            </label>
          </article>
          <article>
            <strong>FairPlay Dance Camp 2027</strong>
            <p>
              {events.fairplayConfirmed
                ? `1–8 Aug 2027, Kraków · confirmed by you`
                : "Dates TBC. Reported as 1–8 Aug 2027 in Kraków, but not yet verified on the official site."}
            </p>
            <a href="https://fpdancecamp.com/en/" target="_blank" rel="noreferrer">
              Official site <ExternalLink size={13} />
            </a>
            <label className="sync-replace">
              <input
                type="checkbox"
                checked={!!events.fairplayConfirmed}
                onChange={(event) =>
                  setEvents(
                    { fairplayConfirmed: event.target.checked },
                    event.target.checked ? "Dance camp dates confirmed." : "Dance camp dates back to TBC.",
                  )
                }
              />
              <span>I’ve checked the official site and these dates are right</span>
            </label>
            {events.fairplayConfirmed && (
              <label className="sync-replace">
                <input
                  type="checkbox"
                  checked={!!events.fairplayBooked}
                  onChange={(event) =>
                    setEvents({ fairplayBooked: event.target.checked }, "Dance camp updated.")
                  }
                />
                <span>I have a ticket</span>
              </label>
            )}
          </article>
        </section>

        <section className="roadmap__why">
          <h3>Why this plan?</h3>
          <ul>
            {WHY_THIS_PLAN.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="capture-disclaimer">
            Thirty minutes of running isn’t necessarily 5 km. No calorie targets
            or weigh-ins. This is general guidance; pain or injury should be
            assessed by a qualified professional.
          </p>
          <details>
            <summary>Sources</summary>
            <ul className="roadmap__sources">
              {SOURCES.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.label} <ExternalLink size={13} />
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section className="roadmap__profile">
          <h3>Your training answers</h3>
          <p>
            {state.trainingProfile
              ? `Saved ${formatDate(state.trainingProfile.completedAt.slice(0, 10))}. They shape your gym session.`
              : "Not answered yet. You’ll be asked before your first gym session."}
          </p>
          <Button variant="secondary" onClick={onEditProfile}>
            {state.trainingProfile ? "Edit answers" : "Answer now"}
          </Button>
        </section>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Gym intake (short, with "not sure" everywhere)
// ---------------------------------------------------------------------------

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function GymIntake({
  initial,
  onSave,
}: {
  initial?: TrainingProfile
  onSave: (profile: TrainingProfile) => void
}) {
  const [profile, setProfile] = useState<Omit<TrainingProfile, "completedAt">>(
    initial ?? {
      activity: "",
      walking: "",
      gymExperience: "",
      familiar: [],
      equipment: "not-sure",
      danceFrequency: "",
      danceIntensity: "",
      concern: "not-sure",
      concernNote: "",
      days: [],
      minutes: "",
    },
  )
  const set = <K extends keyof typeof profile>(key: K, value: (typeof profile)[K]) =>
    setProfile((current) => ({ ...current, [key]: value }))
  const toggle = (key: "familiar" | "days", value: string) =>
    setProfile((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }))

  return (
    <form
      className="intake"
      onSubmit={(event) => {
        event.preventDefault()
        onSave({ ...profile, completedAt: new Date().toISOString() })
      }}
    >
      <p>
        A few quick questions so your first session fits you. Any answer can be
        “Not sure”.
      </p>
      <Chips
        label="How active are you at the moment?"
        value={profile.activity}
        onChange={(value) => set("activity", value)}
        options={[
          ["mostly-inactive", "Mostly inactive"],
          ["some-walking", "Some walking"],
          ["active", "Active most weeks"],
          ["not-sure", "Not sure"],
        ]}
      />
      <Chips
        label="What’s comfortable right now?"
        value={profile.walking}
        onChange={(value) => set("walking", value)}
        options={[
          ["walk-short", "Walk 10–20 min"],
          ["walk-long", "Walk 30+ min"],
          ["run-little", "Run a little"],
          ["not-sure", "Not sure"],
        ]}
      />
      <Chips
        label="Gym experience"
        value={profile.gymExperience}
        onChange={(value) => set("gymExperience", value)}
        options={[
          ["new", "New to it"],
          ["some", "Some, a while ago"],
          ["confident", "Confident with basics"],
          ["not-sure", "Not sure"],
        ]}
      />
      <fieldset className="chip-group">
        <legend>Exercises you know (optional)</legend>
        <div>
          {[
            ["squat", "Squats"],
            ["leg-press", "Leg press"],
            ["hinge", "Deadlift / hinge"],
            ["chest-press", "Chest press"],
            ["row", "Rows"],
            ["pulldown", "Lat pulldown"],
            ["plank", "Plank"],
          ].map(([key, text]) => (
            <button
              type="button"
              className={profile.familiar.includes(key) ? "is-selected" : ""}
              aria-pressed={profile.familiar.includes(key)}
              onClick={() => toggle("familiar", key)}
              key={key}
            >
              {text}
            </button>
          ))}
        </div>
      </fieldset>
      <Chips
        label="Equipment you can use"
        value={profile.equipment}
        onChange={(value) => set("equipment", value)}
        options={[
          ["gym", "Full gym"],
          ["machines", "Mostly machines"],
          ["dumbbells", "Dumbbells and bench"],
          ["home", "Home / bodyweight"],
          ["not-sure", "Not sure"],
        ]}
      />
      <Chips
        label="How often do you dance now?"
        value={profile.danceFrequency}
        onChange={(value) => set("danceFrequency", value)}
        options={[
          ["none", "Not yet"],
          ["home", "Home practice"],
          ["weekly", "About one class a week"],
          ["more", "Two or more"],
          ["not-sure", "Not sure"],
        ]}
      />
      <Chips
        label="How demanding are your classes?"
        value={profile.danceIntensity}
        onChange={(value) => set("danceIntensity", value)}
        options={[
          ["gentle", "Gentle"],
          ["moderate", "Moderate"],
          ["hard", "Hard"],
          ["not-sure", "Not sure"],
        ]}
      />
      <Chips
        label="Is any pain, injury or health concern affecting exercise?"
        value={profile.concern}
        onChange={(value) => set("concern", value)}
        options={[
          ["no", "No"],
          ["yes", "Yes"],
          ["not-sure", "Not sure"],
        ]}
      />
      {profile.concern !== "no" && (
        <label className="intake__note">
          <span>Anything to note? (optional)</span>
          <textarea
            rows={2}
            value={profile.concernNote ?? ""}
            onChange={(event) => set("concernNote", event.target.value)}
          />
        </label>
      )}
      <fieldset className="chip-group">
        <legend>Days that are realistic</legend>
        <div>
          {DAYS.map((day) => (
            <button
              type="button"
              className={profile.days.includes(day) ? "is-selected" : ""}
              aria-pressed={profile.days.includes(day)}
              onClick={() => toggle("days", day)}
              key={day}
            >
              {day}
            </button>
          ))}
        </div>
      </fieldset>
      <Chips
        label="Time for a gym session"
        value={profile.minutes}
        onChange={(value) => set("minutes", value)}
        options={[
          ["20", "About 20 min"],
          ["30", "About 30 min"],
          ["45", "45 min or more"],
          ["not-sure", "Not sure"],
        ]}
      />
      <Button type="submit" icon={Check}>
        Save and continue
      </Button>
    </form>
  )
}

function ConcernNotice({ onEdit, onWalk }: { onEdit: () => void; onWalk: () => void }) {
  return (
    <div className="concern-notice">
      <ShieldCheck size={26} />
      <h3>Let’s hold off on demanding training for now.</h3>
      <p>
        You said pain or a health concern is affecting exercise. Before building
        a strength session, it’s worth getting advice from a GP or
        physiotherapist. Your plan won’t pile anything up meanwhile.
      </p>
      <p>
        If something gentle feels fine, an easy walk at a comfortable pace is an
        option. Stop if it hurts.
      </p>
      <div className="inline-actions">
        <Button variant="secondary" onClick={onWalk}>
          Log an easy walk instead
        </Button>
        <Button variant="ghost" onClick={onEdit}>
          I’ve had guidance · update my answers
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Workout session
// ---------------------------------------------------------------------------

type ExerciseState = { chosen: string; sets: LoggedSet[] }

function WorkoutSession({
  profile,
  short,
  history,
  onFinish,
  onEditProfile,
}: {
  profile: TrainingProfile
  short: boolean
  history: WorkoutRecord[]
  onFinish: (exercises: WorkoutRecord["exercises"], minutes: number) => void
  onEditProfile: () => void
}) {
  const plan = useMemo(() => buildIntroSession(profile, short), [profile, short])
  const started = useRef(Date.now())
  const [warm, setWarm] = useState(false)
  const [rows, setRows] = useState<ExerciseState[]>(() =>
    plan.exercises.map((exercise) => ({
      chosen: exercise.id,
      sets: Array.from({ length: plan.sets }, () => ({ done: false })),
    })),
  )
  const updateSet = (row: number, index: number, patch: Partial<LoggedSet>) =>
    setRows((current) =>
      current.map((item, position) =>
        position === row
          ? {
              ...item,
              sets: item.sets.map((set, setIndex) =>
                setIndex === index ? { ...set, ...patch } : set,
              ),
            }
          : item,
      ),
    )
  const number = (value: string) => (value === "" ? undefined : Math.max(0, Number(value)))

  return (
    <div className="workout">
      <p className="capture-disclaimer">
        {plan.setsLabel} of each · built from your answers ·{" "}
        <button type="button" className="text-link" onClick={onEditProfile}>
          edit answers
        </button>
      </p>
      <section className={`workout__card ${warm ? "is-done" : ""}`}>
        <label className="workout__check">
          <input type="checkbox" checked={warm} onChange={(event) => setWarm(event.target.checked)} />
          <strong>{WARM_UP.title}</strong>
        </label>
        <ul>
          {WARM_UP.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <a href={WARM_UP.demo.url} target="_blank" rel="noreferrer">
          {WARM_UP.demo.label} <ExternalLink size={13} />
        </a>
      </section>
      {rows.map((row, rowIndex) => {
        const exercise: Exercise = EXERCISES[row.chosen]
        const previous = lastPerformance(history, exercise.id)
        return (
          <section className="workout__card" key={rowIndex}>
            <div className="workout__head">
              <span>{rowIndex + 1}</span>
              <div>
                <h3>{exercise.name}</h3>
                <small>
                  {exercise.equipment} · {plan.setsLabel} × {exercise.reps}
                </small>
                {previous && <small className="workout__last">{previous}</small>}
              </div>
            </div>
            <details open={rowIndex === 0}>
              <summary>How to do it</summary>
              <p className="workout__label">Setup</p>
              <ul>
                {exercise.setup.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="workout__label">Technique</p>
              <ul>
                {exercise.technique.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="workout__label">Rest · {exercise.rest}</p>
              {exercise.demo ? (
                <a href={exercise.demo.url} target="_blank" rel="noreferrer">
                  Demonstration: {exercise.demo.label} <ExternalLink size={13} />
                </a>
              ) : (
                <p className="capture-disclaimer">
                  No trusted demonstration link yet. Gym staff can show you the setup.
                </p>
              )}
            </details>
            {exercise.alternatives.length > 0 && (
              <div className="workout__swap">
                <span>Swap for</span>
                {exercise.alternatives.map((id) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() =>
                      setRows((current) =>
                        current.map((item, position) =>
                          position === rowIndex ? { ...item, chosen: id } : item,
                        ),
                      )
                    }
                  >
                    {EXERCISES[id].name}
                  </button>
                ))}
              </div>
            )}
            <div className="workout__sets">
              {row.sets.map((set, setIndex) => (
                <div className={`workout__set ${set.done ? "is-done" : ""}`} key={setIndex}>
                  <span>Set {setIndex + 1}</span>
                  {exercise.track === "seconds" ? (
                    <label>
                      <input
                        inputMode="numeric"
                        type="number"
                        min={0}
                        value={set.seconds ?? ""}
                        onChange={(event) =>
                          updateSet(rowIndex, setIndex, { seconds: number(event.target.value) })
                        }
                        aria-label={`${exercise.name} set ${setIndex + 1} seconds`}
                      />
                      sec
                    </label>
                  ) : (
                    <label>
                      <input
                        inputMode="numeric"
                        type="number"
                        min={0}
                        value={set.reps ?? ""}
                        onChange={(event) =>
                          updateSet(rowIndex, setIndex, { reps: number(event.target.value) })
                        }
                        aria-label={`${exercise.name} set ${setIndex + 1} reps`}
                      />
                      reps
                    </label>
                  )}
                  <label>
                    <input
                      inputMode="decimal"
                      type="number"
                      min={0}
                      step={0.5}
                      value={set.weight ?? ""}
                      onChange={(event) =>
                        updateSet(rowIndex, setIndex, { weight: number(event.target.value) })
                      }
                      aria-label={`${exercise.name} set ${setIndex + 1} weight in kg`}
                    />
                    kg
                  </label>
                  <button
                    type="button"
                    className="workout__done"
                    aria-pressed={set.done}
                    aria-label={`Mark set ${setIndex + 1} done`}
                    onClick={() => updateSet(rowIndex, setIndex, { done: !set.done })}
                  >
                    <Check size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  setRows((current) =>
                    current.map((item, position) =>
                      position === rowIndex
                        ? { ...item, sets: [...item.sets, { done: false }] }
                        : item,
                    ),
                  )
                }
              >
                <Plus size={15} /> Add a set
              </button>
            </div>
          </section>
        )
      })}
      <ul className="workout__notes">
        {plan.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <Button
        icon={Check}
        onClick={() =>
          onFinish(
            rows.map((row) => ({
              id: row.chosen,
              name: EXERCISES[row.chosen].name,
              sets: row.sets,
            })),
            Math.max(1, Math.round((Date.now() - started.current) / 60000)),
          )
        }
      >
        Finish and log
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick log
// ---------------------------------------------------------------------------

function QuickLog({
  item,
  short,
  minutes,
  hasProfile,
  onSave,
}: {
  item: PlanItem
  short: boolean
  minutes?: number
  hasProfile: boolean
  onSave: (log: ActivityLog, pauseTraining: boolean) => void
}) {
  const [summary, setSummary] = useState(
    short ? `${item.title} (short version)` : item.title,
  )
  const [duration, setDuration] = useState(
    String(minutes ?? (short ? item.shortVersion?.duration : item.duration) ?? ""),
  )
  const [effort, setEffort] = useState<Effort | "">("")
  const [note, setNote] = useState("")
  const [concern, setConcern] = useState(false)
  const [pause, setPause] = useState(true)
  const [wasClass, setWasClass] = useState(false)
  const exercise = ["gym", "walk", "run", "dance"].includes(item.kind ?? "")

  return (
    <form
      className="quick-log"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(
          {
            completedAt: new Date().toISOString(),
            summary: summary.trim() || item.title,
            duration: duration ? Number(duration) : undefined,
            effort: effort || undefined,
            note: note.trim() || undefined,
            concern: concern || undefined,
            shortVersion: short || undefined,
            wasClass: wasClass || undefined,
          },
          concern && pause,
        )
      }}
    >
      <label>
        <span>What I actually did</span>
        <input value={summary} onChange={(event) => setSummary(event.target.value)} />
      </label>
      {item.kind === "dance" && (
        <label className="sync-replace">
          <input
            type="checkbox"
            checked={wasClass}
            onChange={(event) => {
              setWasClass(event.target.checked)
              if (event.target.checked && summary === item.title) setSummary("Dance class")
            }}
          />
          <span>
            This was a class
            <small>Classes can be much harder than home practice; tomorrow will be flagged to keep gentle.</small>
          </span>
        </label>
      )}
      <label>
        <span>Duration (minutes)</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
      </label>
      {exercise && (
        <Chips label="How hard did it feel?" value={effort} onChange={setEffort} options={EFFORTS} />
      )}
      <label>
        <span>
          {item.kind === "dance"
            ? "Something you enjoyed or want to practise (optional)"
            : item.kind === "create"
              ? "Your tiny output (optional)"
              : "Note (optional)"}
        </span>
        <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <DictateButton onText={(text) => setNote((current) => (current ? `${current} ${text}` : text))} />
      {exercise && (
        <label className="sync-replace">
          <input type="checkbox" checked={concern} onChange={(event) => setConcern(event.target.checked)} />
          <span>
            Flag pain or a concern
            <small>Nothing extra is scheduled because of this.</small>
          </span>
        </label>
      )}
      {concern && (
        <div className="prototype-note">
          <ShieldCheck size={19} />
          <div>
            <p>
              If something hurts, pause and consider speaking to a GP or
              physiotherapist before demanding training.
            </p>
            {hasProfile && (
              <label className="sync-replace">
                <input type="checkbox" checked={pause} onChange={(event) => setPause(event.target.checked)} />
                <span>Hold off demanding gym sessions until I’ve had guidance</span>
              </label>
            )}
          </div>
        </div>
      )}
      <Button type="submit" icon={Check}>
        Save log
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Simple timer for walks, dance, creative time
// ---------------------------------------------------------------------------

function DoTimer({ item, short, onFinish }: { item: PlanItem; short: boolean; onFinish: (minutes?: number) => void }) {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [running])
  const target = (short ? item.shortVersion?.duration : item.duration) ?? 0

  return (
    <div className="do-timer">
      {short && item.shortVersion && (
        <p className="do-timer__short">
          <Zap size={16} /> Short version: {item.shortVersion.note}
        </p>
      )}
      <ul>
        {(item.details ?? []).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {target > 0 && (
        <>
          <div className="recording-time" aria-live="off">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            <small> / {target} min</small>
          </div>
          <Button
            variant="secondary"
            icon={running ? Pause : Play}
            onClick={() => setRunning(!running)}
          >
            {running ? "Pause timer" : seconds ? "Resume timer" : "Start timer"}
          </Button>
        </>
      )}
      <Button
        icon={Check}
        onClick={() => onFinish(seconds >= 60 ? Math.round(seconds / 60) : undefined)}
      >
        Finish and log
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Move with conflict and load preview
// ---------------------------------------------------------------------------

function MoveSheet({ item, state, onMove }: { item: PlanItem; state: AppState; onMove: (date: string, time?: string) => void }) {
  const [date, setDate] = useState(item.date)
  const [time, setTime] = useState(item.time ?? "")
  const days = Array.from({ length: 14 }, (_, index) => addDays(today(), index))
  const { conflicts, warnings } = checkPlacement(state.plan, item, date, time || undefined)
  const unchanged = date === item.date && (time || undefined) === item.time

  return (
    <div className="move-sheet">
      <div className="day-chips">
        {days.map((day) => (
          <button
            type="button"
            className={date === day ? "is-selected" : ""}
            aria-pressed={date === day}
            onClick={() => setDate(day)}
            key={day}
          >
            <span>{formatDate(day, { weekday: "short" })}</span>
            <strong>{formatDate(day, { day: "numeric" })}</strong>
          </button>
        ))}
      </div>
      <label>
        <span>Time (optional)</span>
        <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      </label>
      <div className="move-sheet__preview">
        <p className="eyebrow">Preview</p>
        <p>
          {formatDate(item.date, { weekday: "short", day: "numeric", month: "short" })}
          {item.time ? ` ${item.time}` : ""} <ArrowRight size={14} />{" "}
          <strong>
            {formatDate(date, { weekday: "short", day: "numeric", month: "short" })}
            {time ? ` ${time}` : ""}
          </strong>
        </p>
        {conflicts.map((other) => (
          <p className="move-sheet__warn" key={other.id}>
            <TriangleAlert size={15} /> Overlaps {other.title} at {other.time}
          </p>
        ))}
        {warnings.map((warning) => (
          <p className="move-sheet__warn" key={warning}>
            <TriangleAlert size={15} /> {warning}
          </p>
        ))}
        {!conflicts.length && !warnings.length && !unchanged && (
          <p className="move-sheet__ok">
            <Check size={15} /> No clashes, and recovery looks fine.
          </p>
        )}
      </div>
      <Button
        icon={MoveRight}
        disabled={unchanged}
        onClick={() => onMove(date, time || undefined)}
      >
        {conflicts.length || warnings.length ? "Move anyway" : "Move"}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly reset / fortnight review
// ---------------------------------------------------------------------------

function WeeklyReset({
  item,
  state,
  onSave,
}: {
  item: PlanItem
  state: AppState
  onSave: (review: { energy: string; recovery: string; barriers: string; adjustments: string; decision?: "repeat" | "reduce" | "next-phase"; repeatable: boolean }) => void
}) {
  const fortnight = item.title.toLowerCase().includes("fortnight")
  const start = fortnight ? addDays(mondayOf(item.date), -7) : mondayOf(item.date)
  const range = state.plan.filter(
    (other) => other.date >= start && other.date <= item.date && other.kind && other.id !== item.id,
  )
  const done = range.filter((other) => other.status === "complete")
  const skipped = range.filter((other) => other.status === "let-go")
  const concerns = done.filter((other) => other.log?.concern)
  const hard = done.filter((other) => other.log?.effort === "hard" || other.log?.effort === "very-hard")
  const [energy, setEnergy] = useState("")
  const [recovery, setRecovery] = useState("")
  const [barriers, setBarriers] = useState("")
  const [adjustments, setAdjustments] = useState("")
  const [decision, setDecision] = useState<"repeat" | "reduce" | "next-phase" | "">("")
  const [repeatable, setRepeatable] = useState(false)

  return (
    <form
      className="weekly-reset"
      onSubmit={(event) => {
        event.preventDefault()
        onSave({ energy, recovery, barriers, adjustments, decision: decision || undefined, repeatable })
      }}
    >
      <div className="weekly-reset__facts">
        <p><strong>{done.length}</strong> done</p>
        <p><strong>{skipped.length}</strong> skipped</p>
        <p><strong>{hard.length}</strong> felt hard</p>
        <p><strong>{concerns.length}</strong> concerns</p>
      </div>
      {concerns.length > 0 && (
        <p className="capture-disclaimer">
          You flagged a concern this {fortnight ? "fortnight" : "week"}. Reducing, or getting
          advice first, is a sensible choice.
        </p>
      )}
      <Chips
        label="Energy"
        value={energy}
        onChange={setEnergy}
        options={[["low", "Low"], ["steady", "Steady"], ["good", "Good"], ["not-sure", "Not sure"]]}
      />
      <Chips
        label="Recovery"
        value={recovery}
        onChange={setRecovery}
        options={[["recovered", "Recovered"], ["bit-tired", "A bit tired"], ["very-tired", "Very tired"]]}
      />
      <label>
        <span>What got in the way? (optional)</span>
        <textarea rows={2} value={barriers} onChange={(event) => setBarriers(event.target.value)} />
      </label>
      <label>
        <span>Times to change next week (optional)</span>
        <input
          value={adjustments}
          onChange={(event) => setAdjustments(event.target.value)}
          placeholder="e.g. gym on Tuesday instead"
        />
      </label>
      <label className="sync-replace">
        <input type="checkbox" checked={repeatable} onChange={(event) => setRepeatable(event.target.checked)} />
        <span>I found a week I can comfortably repeat</span>
      </label>
      {fortnight && (
        <Chips
          label="What next?"
          value={decision}
          onChange={setDecision}
          options={[
            ["repeat", "Repeat the fortnight"],
            ["reduce", "Reduce it"],
            ["next-phase", "Begin the next phase"],
          ]}
        />
      )}
      <Button type="submit" icon={Check}>
        Save review
      </Button>
      <p className="capture-disclaimer">Journaling is optional; this review is enough.</p>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Money tasks (lightweight; deeper work in Investing Lab)
// ---------------------------------------------------------------------------

function MoneyGoals({ onSave }: { onSave: (investing: string, learning: string) => void }) {
  const [investing, setInvesting] = useState("")
  const [learning, setLearning] = useState("")
  return (
    <form
      className="quick-log"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(investing.trim(), learning.trim())
      }}
    >
      <label>
        <span>One investing goal</span>
        <input value={investing} onChange={(event) => setInvesting(event.target.value)} placeholder="e.g. Understand how an index fund works" />
      </label>
      <label>
        <span>One learning goal</span>
        <input value={learning} onChange={(event) => setLearning(event.target.value)} placeholder="e.g. Read one beginner chapter a week" />
      </label>
      <Button type="submit" icon={Check} disabled={!investing.trim() && !learning.trim()}>
        Save goals
      </Button>
      <p className="capture-disclaimer">Educational only, not personal financial advice.</p>
    </form>
  )
}

function CashFlowLesson({ onDone, onOpenLab }: { onDone: () => void; onOpenLab: () => void }) {
  return (
    <div className="lesson-inline">
      <p className="eyebrow">Short lesson · about 10 minutes</p>
      <p>
        <strong>Revenue</strong> is money coming in from sales. A café selling
        £10,000 of coffee in a month has £10,000 revenue.
      </p>
      <p>
        <strong>Profit</strong> is what’s left after costs. If beans, rent and
        wages cost £8,500, profit is £1,500.
      </p>
      <p>
        <strong>Cash flow</strong> is the actual cash moving in and out. A
        profitable café can still run short of cash if customers pay late or
        it buys a new machine this month.
      </p>
      <p>Write down one question this raises for you.</p>
      <div className="inline-actions">
        <Button icon={Check} onClick={onDone}>
          Done
        </Button>
        <Button variant="ghost" icon={BookOpen} onClick={onOpenLab}>
          Open Investing Lab
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The activity flow: start / short version / move for any plan item
// ---------------------------------------------------------------------------

type Step = "do" | "intake" | "log" | "move"

export function ActivityFlow({
  itemId,
  mode,
  state,
  update,
  onClose,
  onOpenSpace,
}: {
  itemId: string
  mode: ActivityMode
  state: AppState
  update: Update
  onClose: () => void
  onOpenSpace: (space: "money" | "reflect") => void
}) {
  const item = state.plan.find((candidate) => candidate.id === itemId)
  const short = mode === "short"
  const [step, setStep] = useState<Step>(
    mode === "move"
      ? "move"
      : item?.kind === "gym" && !state.trainingProfile
        ? "intake"
        : "do",
  )
  const [minutes, setMinutes] = useState<number | undefined>()
  const [workout, setWorkout] = useState<WorkoutRecord["exercises"] | null>(null)
  const [journal, setJournal] = useState("")

  if (!item) return null

  const complete = (log: ActivityLog, message: string, extra?: (current: AppState) => AppState) =>
    update((current) => {
      const target = current.plan.find((candidate) => candidate.id === item.id)
      if (!target || target.status === "complete") return current
      const next = {
        ...current,
        plan: current.plan.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                status: "complete" as const,
                log,
                intensity: log.wasClass ? ("hard" as const) : candidate.intensity,
              }
            : candidate,
        ),
      }
      return extra ? extra(next) : next
    }, message)

  const saveLog = (log: ActivityLog, pauseTraining: boolean) => {
    const workoutId = workout ? uid() : undefined
    complete(
      { ...log, workoutId },
      log.wasClass
        ? "Logged. Classes can be demanding, so keep tomorrow gentle."
        : log.concern
          ? "Logged with your concern noted. Nothing extra has been scheduled."
          : "Logged. That’s real progress.",
      (current) => ({
        ...current,
        trainingProfile:
          pauseTraining && current.trainingProfile
            ? { ...current.trainingProfile, concern: "yes" }
            : current.trainingProfile,
        workoutHistory:
          workout && workoutId
            ? [
                {
                  id: workoutId,
                  planId: item.id,
                  date: today(),
                  title: log.summary,
                  duration: log.duration,
                  effort: log.effort,
                  note: log.note,
                  concern: log.concern,
                  exercises: workout,
                },
                ...(current.workoutHistory ?? []),
              ]
            : current.workoutHistory,
      }),
    )
    onClose()
  }

  const title =
    step === "move"
      ? `Move: ${item.title}`
      : step === "intake"
        ? "Before your first session"
        : step === "log"
          ? "Quick log"
          : item.title
  const eyebrow =
    step === "intake"
      ? "Short setup · about a minute"
      : `${item.phase === "restart" ? "Restart phase · " : ""}${formatDate(item.date, {
          weekday: "long",
          day: "numeric",
          month: "short",
        })}${short ? " · short version" : ""}`

  let body: ReactNode
  if (step === "move") {
    body = (
      <MoveSheet
        item={item}
        state={state}
        onMove={(date, time) => {
          update(
            (current) => ({
              ...current,
              plan: current.plan.map((candidate) =>
                candidate.id === item.id ? { ...candidate, date, time } : candidate,
              ),
            }),
            `Moved to ${formatDate(date, { weekday: "long" })}.`,
          )
          onClose()
        }}
      />
    )
  } else if (step === "intake") {
    body = (
      <GymIntake
        initial={state.trainingProfile}
        onSave={(profile) => {
          update(
            (current) => ({ ...current, trainingProfile: profile }),
            "Thanks. Your session is shaped around your answers.",
          )
          setStep("do")
        }}
      />
    )
  } else if (step === "log") {
    body = (
      <QuickLog
        item={item}
        short={short}
        minutes={minutes}
        hasProfile={!!state.trainingProfile}
        onSave={saveLog}
      />
    )
  } else if (item.kind === "gym" && state.trainingProfile) {
    body =
      state.trainingProfile.concern === "yes" ? (
        <ConcernNotice
          onEdit={() => setStep("intake")}
          onWalk={() => {
            setMinutes(undefined)
            setStep("log")
          }}
        />
      ) : (
        <WorkoutSession
          profile={state.trainingProfile}
          short={short}
          history={state.workoutHistory ?? []}
          onEditProfile={() => setStep("intake")}
          onFinish={(exercises, elapsed) => {
            setWorkout(exercises)
            setMinutes(elapsed)
            setStep("log")
          }}
        />
      )
  } else if (item.kind === "reset") {
    body = (
      <WeeklyReset
        item={item}
        state={state}
        onSave={(review) => {
          const weekStart = mondayOf(item.date)
          complete(
            { completedAt: new Date().toISOString(), summary: item.title, duration: item.duration },
            review.decision === "repeat"
              ? "Review saved. Another fortnight is proposed in Plan."
              : review.decision === "reduce"
                ? "Review saved. A lighter fortnight is proposed in Plan."
                : review.decision === "next-phase"
                  ? "Review saved. Base building is next on your roadmap."
                  : "Review saved.",
            (current) => {
              let next: AppState = {
                ...current,
                weeklyReviews: [
                  {
                    id: uid(),
                    weekStart,
                    date: today(),
                    energy: review.energy,
                    recovery: review.recovery,
                    barriers: review.barriers,
                    adjustments: review.adjustments,
                    decision: review.decision,
                  },
                  ...(current.weeklyReviews ?? []),
                ],
              }
              if (review.repeatable)
                next = {
                  ...next,
                  goals: next.goals.map((goal) =>
                    goal.id === STRENGTH_GOAL.id
                      ? {
                          ...goal,
                          milestones: goal.milestones.map((milestone) =>
                            milestone.id === "strength-repeatable" && !milestone.completedAt
                              ? { ...milestone, completedAt: new Date().toISOString() }
                              : milestone,
                          ),
                        }
                      : goal,
                  ),
                }
              if (review.decision === "repeat" || review.decision === "reduce") {
                const start = nextMonday(addDays(item.date, 1))
                next = addRestartFortnight(next, start)
                if (review.decision === "reduce")
                  next = {
                    ...next,
                    plan: next.plan.map((planItem) =>
                      planItem.batch?.startsWith("restart-") &&
                      planItem.date >= start &&
                      planItem.status === "proposed" &&
                      planItem.shortVersion
                        ? { ...planItem, duration: planItem.shortVersion.duration }
                        : planItem,
                    ),
                  }
              }
              if (review.decision === "next-phase") next = { ...next, trainingPhase: 2 }
              return next
            },
          )
          onClose()
        }}
      />
    )
  } else if (item.kind === "money" && item.title.includes("save two")) {
    body = (
      <MoneyGoals
        onSave={(investing, learning) => {
          complete(
            { completedAt: new Date().toISOString(), summary: "Saved investing and learning goals", duration: item.duration },
            "Goals saved in Money. Deeper work lives in Investing Lab.",
            (current) => ({
              ...current,
              goals: [
                ...[investing, learning]
                  .filter(Boolean)
                  .map((goalTitle) => ({
                    id: uid(),
                    title: goalTitle,
                    area: "money" as const,
                    scale: "small" as const,
                    status: "tending" as const,
                    nextStep: "Take one small step this week",
                    milestones: [],
                  })),
                ...current.goals,
              ],
            }),
          )
          onClose()
        }}
      />
    )
  } else if (item.kind === "money" && item.title.includes("cash flow")) {
    body = (
      <CashFlowLesson
        onDone={() => setStep("log")}
        onOpenLab={() => {
          onClose()
          onOpenSpace("money")
        }}
      />
    )
  } else if (item.kind === "journal") {
    body = (
      <div className="quick-log">
        <label>
          <span>{item.title}</span>
          <textarea rows={5} value={journal} onChange={(event) => setJournal(event.target.value)} />
        </label>
        <DictateButton onText={(text) => setJournal((current) => (current ? `${current} ${text}` : text))} />
        <Button
          icon={Check}
          disabled={!journal.trim()}
          onClick={() => {
            complete(
              { completedAt: new Date().toISOString(), summary: "Journal entry", duration: item.duration },
              "Saved to your journal.",
              (current) => ({
                ...current,
                journal: [
                  { id: uid(), title: item.title, body: journal.trim(), date: today() },
                  ...current.journal,
                ],
              }),
            )
            onClose()
          }}
        >
          Save entry
        </Button>
      </div>
    )
  } else if (item.kind === "social") {
    body = (
      <div className="quick-log">
        <ul>
          {(item.details ?? []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="capture-disclaimer">
          Ideas: suggest a walk, a film, or food together. Life Studio never
          sends messages or books anything for you.
        </p>
        <Button icon={Check} onClick={() => setStep("log")}>
          I reached out or kept it free
        </Button>
      </div>
    )
  } else {
    body = (
      <DoTimer
        item={item}
        short={short}
        onFinish={(elapsed) => {
          setMinutes(elapsed)
          setStep("log")
        }}
      />
    )
  }

  return (
    <Modal title={title} eyebrow={eyebrow} onClose={onClose} wide={item.kind === "gym" && step === "do"}>
      {item.status === "proposed" && step !== "move" && (
        <p className="capture-disclaimer">This is a proposed plan. Logging it counts as doing it.</p>
      )}
      {body}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Plan: accept a whole week in one action
// ---------------------------------------------------------------------------

export function WeekAcceptBanner({ state, date, update }: { state: AppState; date: string; update: Update }) {
  const batch = state.plan.find((item) => item.date === date && item.batch)?.batch
  if (!batch) return null
  const proposed = state.plan.filter((item) => item.batch === batch && item.status === "proposed")
  if (!proposed.length) return null
  const start = batch.replace("restart-", "")
  return (
    <div className="week-accept">
      <div>
        <p className="eyebrow">Restart phase · week of {formatDate(start, { day: "numeric", month: "short" })}</p>
        <strong>{proposed.length} proposed plans</strong>
      </div>
      <Button
        icon={Check}
        onClick={() =>
          update((current) => acceptWeek(current, batch), "This week is accepted. You can still move or skip anything.")
        }
      >
        Accept this week
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress: what actually happened
// ---------------------------------------------------------------------------

export function ActivityHistory({ state }: { state: AppState }) {
  const restart = state.plan.filter((item) => item.phase === "restart")
  const counts = {
    proposed: restart.filter((item) => item.status === "proposed").length,
    planned: restart.filter((item) => item.status === "planned").length,
    complete: restart.filter((item) => item.status === "complete").length,
    skipped: restart.filter((item) => item.status === "let-go").length,
  }
  const logged = state.plan
    .filter((item) => item.status === "complete" && item.log)
    .sort((a, b) => (b.log?.completedAt ?? "").localeCompare(a.log?.completedAt ?? ""))
    .slice(0, 12)
  const workouts = state.workoutHistory ?? []

  return (
    <section className="section-block activity-history">
      <div className="section-heading">
        <div>
          <p className="eyebrow">What actually happened</p>
          <h2>Activity and workout log</h2>
        </div>
        <Repeat size={20} />
      </div>
      {restart.length > 0 && (
        <div className="weekly-reset__facts">
          <p><strong>{counts.proposed}</strong> proposed</p>
          <p><strong>{counts.planned}</strong> accepted</p>
          <p><strong>{counts.complete}</strong> done</p>
          <p><strong>{counts.skipped}</strong> skipped</p>
        </div>
      )}
      {logged.length ? (
        <ul className="activity-history__list">
          {logged.map((item) => {
            const record = workouts.find((workout) => workout.id === item.log?.workoutId)
            return (
              <li key={item.id}>
                <div>
                  <strong>{item.log?.summary}</strong>
                  <small>
                    {formatDate(item.log!.completedAt.slice(0, 10), { weekday: "short", day: "numeric", month: "short" })}
                    {item.log?.duration ? ` · ${item.log.duration} min` : ""}
                    {item.log?.effort ? ` · ${EFFORTS.find(([key]) => key === item.log?.effort)?.[1]}` : ""}
                    {item.log?.shortVersion ? " · short version" : ""}
                  </small>
                  {record && (
                    <small className="activity-history__sets">
                      {record.exercises
                        .map((exercise) => {
                          const done = exercise.sets.filter((set) => set.done)
                          if (!done.length) return ""
                          const last = done[done.length - 1]
                          return `${exercise.name} ${done.length}×${last.seconds ? `${last.seconds}s` : last.reps ?? "?"}${last.weight ? ` @ ${last.weight} kg` : ""}`
                        })
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  )}
                  {item.log?.note && <p>{item.log.note}</p>}
                </div>
                {item.log?.concern && (
                  <span className="status-badge is-concern">
                    <TriangleAlert size={12} /> Concern
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="capture-disclaimer">
          Nothing logged yet. Start any session and it will appear here.
        </p>
      )}
    </section>
  )
}

export function RoadmapLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="text-link" onClick={onClick}>
      <Sparkles size={15} /> Roadmap <ChevronRight size={15} />
    </button>
  )
}

