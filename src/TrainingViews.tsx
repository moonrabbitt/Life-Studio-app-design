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
import { celebrate } from "./GoalProjectViews"
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
  fromPlanned,
  recordToExercises,
  suggestDuration,
  suggestNext,
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
  PlannedExercise,
  AppState,
  Effort,
  LoggedSet,
  PlanItem,
  TrainingProfile,
  WorkoutRecord,
} from "./types"
import { Art, Button, formatDate, Modal, today, uid } from "./ui"

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

  // Where the app can't listen, the keyboard's own mic does the job; no extra button.
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
                  ? "Allow the microphone to dictate, or tap the 🎤 on your keyboard."
                  : "Voice isn’t available here. Tap the 🎤 on your keyboard instead.",
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

// Exact, explained exercises from the coach or assistant.
export function PlannedWorkoutList({ workout }: { workout: PlannedExercise[] }) {
  return (
    <ol className="planned-workout">
      {workout.map((exercise, index) => (
        <li key={`${exercise.name}-${index}`}>
          <span>{index + 1}</span>
          <div>
            <strong>{exercise.name}</strong>
            <small className="planned-workout__dose">
              {exercise.sets} × {exercise.reps} · rest {exercise.rest}
            </small>
            <small>
              <b>Load:</b> {exercise.load}
            </small>
            <small>
              <b>Why:</b> {exercise.why}
            </small>
            {exercise.cue && (
              <small>
                <b>Tip:</b> {exercise.cue}
              </small>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

// Edit a suggested workout: every exercise, its sets, reps, rest and weight.
export function WorkoutEditor({
  workout,
  onSave,
  onCancel,
}: {
  workout: PlannedExercise[]
  onSave: (workout: PlannedExercise[]) => void
  onCancel: () => void
}) {
  const [rows, setRows] = useState<PlannedExercise[]>(workout)
  const set = (index: number, patch: Partial<PlannedExercise>) =>
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)))
  return (
    <div className="workout-editor">
      {rows.map((row, index) => (
        <fieldset key={index} className="workout-editor__row">
          <legend>Exercise {index + 1}</legend>
          <label>
            <span>Exercise</span>
            <input value={row.name} onChange={(event) => set(index, { name: event.target.value })} />
          </label>
          <div className="plan-edit__row">
            <label>
              <span>Sets</span>
              <input type="number" min={1} max={10} inputMode="numeric" value={row.sets} onChange={(event) => set(index, { sets: Math.max(1, Number(event.target.value) || 1) })} />
            </label>
            <label>
              <span>Reps or time</span>
              <input value={row.reps} onChange={(event) => set(index, { reps: event.target.value })} />
            </label>
          </div>
          <div className="plan-edit__row">
            <label>
              <span>Weight / load</span>
              <input value={row.load} onChange={(event) => set(index, { load: event.target.value })} placeholder="e.g. 10 kg or bodyweight" />
            </label>
            <label>
              <span>Rest</span>
              <input value={row.rest} onChange={(event) => set(index, { rest: event.target.value })} />
            </label>
          </div>
          <button type="button" className="text-link plan-edit__delete-link" onClick={() => setRows((current) => current.filter((_, position) => position !== index))}>
            Remove exercise
          </button>
        </fieldset>
      ))}
      <Button
        variant="secondary"
        icon={Plus}
        onClick={() =>
          setRows((current) => [
            ...current,
            { name: "", sets: 2, reps: "8-10", rest: "60-90 seconds", load: "A weight you could lift 3-4 more times", why: "Added by you" },
          ])
        }
      >
        Add exercise
      </Button>
      <div className="inline-actions">
        <Button icon={Check} onClick={() => onSave(rows.filter((row) => row.name.trim()))}>
          Save exercises
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
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
  preferShort = false,
}: {
  item: PlanItem
  onActivity: (id: string, mode: ActivityMode) => void
  onSkip: (id: string) => void
  preferShort?: boolean
}) {
  if (item.status === "complete" || item.status === "let-go") return null
  const shortFirst = preferShort && !!item.shortVersion
  return (
    <div className="activity-buttons">
      {shortFirst && (
        <Button icon={Zap} onClick={() => onActivity(item.id, "short")}>
          Short version
        </Button>
      )}
      <Button variant={shortFirst ? "secondary" : "primary"} icon={Play} onClick={() => onActivity(item.id, "start")}>
        {shortFirst ? "Full version" : "Start"}
      </Button>
      {item.shortVersion && !shortFirst && (
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
    "Set aside. Nothing piles up; bring it back from Plan → Set aside if you want.",
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
  const offer = !hasRestart && state.restartOffer !== "dismissed"

  // The full offer only when there's nothing else to do; otherwise a small link in the card.
  if (offer && !next) {
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
      {state.checkIn === "low" && item.shortVersion && (
        <p className="energy-inline">
          <Zap size={14} /> Keeping it small: {item.shortVersion.note}
        </p>
      )}
      <ActivityButtons
        item={item}
        onActivity={onActivity}
        onSkip={(id) => skipItem(update, id)}
        preferShort={state.checkIn === "low"}
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
        {offer && (
          <button type="button" className="text-link" onClick={onSetupRestart}>
            <CalendarCheck size={16} /> Review the starter fortnight
          </button>
        )}
        <button type="button" className="text-link" onClick={onRoadmap}>
          Your journey <ChevronRight size={16} />
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

type JourneyEntry = { date: string; title: string; detail?: string; kind: string; reflectionId?: string }

const weeksUntil = (date: string) => {
  const days = Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) / 86400000)
  if (days < 0) return "passed"
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} to go`
  return `${Math.round(days / 7)} weeks to go`
}

// Everything that happened, in one story: milestones, reviews, finished projects, reflections…
function journeyEntries(state: AppState): JourneyEntry[] {
  const entries: JourneyEntry[] = []
  for (const goal of state.goals) {
    for (const milestone of goal.milestones)
      if (milestone.completedAt)
        entries.push({ date: milestone.completedAt.slice(0, 10), title: milestone.title, detail: goal.title, kind: "Milestone" })
    if (goal.reachedAt) entries.push({ date: goal.reachedAt.slice(0, 10), title: `Reached: ${goal.title}`, kind: "Goal reached" })
  }
  for (const project of state.projects)
    if (project.finishedAt)
      entries.push({ date: project.finishedAt.slice(0, 10), title: `Finished: ${project.title}`, detail: project.madeNote, kind: "Project" })
  for (const review of state.weeklyReviews ?? [])
    entries.push({
      date: review.date,
      title: review.decision === "next-phase" ? "Review: ready for the next phase" : review.decision ? `Review: ${review.decision} the fortnight` : "Weekly review",
      detail: [review.energy && `Energy ${review.energy}`, review.recovery && `Recovery ${review.recovery.replace("-", " ")}`, review.barriers].filter(Boolean).join(" · "),
      kind: "Review",
    })
  for (const record of state.workoutHistory ?? [])
    entries.push({
      date: record.date,
      title: record.title,
      detail: record.exercises
        .filter((exercise) => exercise.sets.some((set) => set.done))
        .map((exercise) => exercise.name)
        .join(", "),
      kind: "Workout",
    })
  for (const item of state.plan)
    if (item.log?.wasClass) entries.push({ date: item.date, title: item.log.summary, detail: item.log.note, kind: "Dance" })
  for (const reflection of state.roadmap?.reflections ?? [])
    entries.push(
      reflection.title
        ? { date: reflection.date, title: reflection.title, detail: reflection.text, kind: "Moment", reflectionId: reflection.id }
        : { date: reflection.date, title: reflection.text, kind: "Reflection", reflectionId: reflection.id },
    )
  for (const change of state.roadmap?.phaseLog ?? [])
    entries.push({ date: change.date, title: `Started phase ${change.phase}: ${PHASES.find((phase) => phase.id === change.phase)?.title ?? ""}`, kind: "Phase" })
  return entries.sort((a, b) => b.date.localeCompare(a.date))
}

const dateLabelFor = (date: string) =>
  formatDate(date, { weekday: "short", day: "numeric", month: "long", year: "numeric" })

// What's ahead: dated goals counting down, events, and goals still waiting for a date.
export function JourneyAhead({ state, update }: { state: AppState; update: Update }) {
  const events = state.events ?? {}
  const setEvents = (patch: Partial<NonNullable<AppState["events"]>>, message: string) =>
    update((current) => {
      const next = { ...current.events, ...patch }
      return {
        ...current,
        events: next,
        goals: current.goals.map((goal) =>
          goal.id === "goal-race"
            ? { ...goal, dateLabel: next.hackneyBooked ? "Sun 16 May 2027 · entry booked" : HACKNEY_LABEL }
            : goal.id === "goal-dance"
              ? {
                  ...goal,
                  date: next.fairplayConfirmed ? "2027-08-01" : goal.date === "2027-08-01" ? undefined : goal.date,
                  dateLabel: next.fairplayConfirmed
                    ? `1–8 Aug 2027, Kraków · dates confirmed by you · ${next.fairplayBooked ? "booked" : "not booked"}`
                    : FAIRPLAY_REPORTED,
                }
              : goal,
        ),
      }
    }, message)
  const ahead = state.goals
    .filter((goal) => goal.status !== "complete" && goal.date && goal.date >= today())
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
  const undated = state.goals.filter((goal) => goal.status !== "complete" && goal.scale === "big" && !goal.date)
  const [showEvents, setShowEvents] = useState(false)

  return (
    <section className="journey-section">
      <div className="journey-section__head">
        <h2>Ahead</h2>
      </div>
      {ahead.length === 0 && <p className="capture-disclaimer">No dated goals yet. Add a date to a goal below.</p>}
      <ul className="journey-ahead">
        {ahead.map((goal) => {
          const done = goal.milestones.filter((milestone) => milestone.completedAt).length
          return (
            <li key={goal.id}>
              <div>
                <strong>{goal.title}</strong>
                <small>{goal.dateLabel ?? dateLabelFor(goal.date!)}</small>
                {goal.milestones.length > 0 && (
                  <small>
                    {done} of {goal.milestones.length} milestones · next: {goal.milestones.find((milestone) => !milestone.completedAt)?.title ?? "reach it"}
                  </small>
                )}
              </div>
              <span className="roadmap__countdown">{weeksUntil(goal.date!)}</span>
            </li>
          )
        })}
      </ul>
      {undated.length > 0 && (
        <div className="roadmap__undated">
          <p className="eyebrow">Give a bigger goal a date (optional)</p>
          {undated.map((goal) => (
            <label key={goal.id}>
              <span>{goal.title}</span>
              <input
                type="date"
                min={today()}
                aria-label={`Target date for ${goal.title}`}
                onChange={(event) =>
                  event.target.value &&
                  update(
                    (current) => ({
                      ...current,
                      goals: current.goals.map((item) =>
                        item.id === goal.id ? { ...item, date: event.target.value, dateLabel: dateLabelFor(event.target.value) } : item,
                      ),
                    }),
                    "Date added to your journey.",
                  )
                }
              />
            </label>
          ))}
        </div>
      )}
      <button type="button" className="text-link" onClick={() => setShowEvents(!showEvents)}>
        {showEvents ? "Hide event details" : "Event details: Hackney Half and FairPlay"} <ChevronRight size={14} />
      </button>
      {showEvents && (
        <div className="roadmap__events">
          <article>
            <strong>Hackney Half Marathon</strong>
            <p>{events.hackneyBooked ? "Sun 16 May 2027 · entry booked" : HACKNEY_LABEL}</p>
            <a href="https://www.hackneymoves.com/2027" target="_blank" rel="noreferrer">
              Official site <ExternalLink size={13} />
            </a>
            <label className="sync-replace">
              <input type="checkbox" checked={!!events.hackneyBooked} onChange={(event) => setEvents({ hackneyBooked: event.target.checked }, "Hackney Half updated.")} />
              <span>I have an entry</span>
            </label>
          </article>
          <article>
            <strong>FairPlay Dance Camp 2027</strong>
            <p>
              {events.fairplayConfirmed
                ? "1–8 Aug 2027, Kraków · confirmed by you"
                : "Dates TBC. Reported as 1–8 Aug 2027 in Kraków, but not yet verified on the official site."}
            </p>
            <a href="https://fpdancecamp.com/en/" target="_blank" rel="noreferrer">
              Official site <ExternalLink size={13} />
            </a>
            <label className="sync-replace">
              <input
                type="checkbox"
                checked={!!events.fairplayConfirmed}
                onChange={(event) => setEvents({ fairplayConfirmed: event.target.checked }, event.target.checked ? "Dance camp dates confirmed." : "Dance camp dates back to TBC.")}
              />
              <span>I’ve checked the official site and these dates are right</span>
            </label>
            {events.fairplayConfirmed && (
              <label className="sync-replace">
                <input type="checkbox" checked={!!events.fairplayBooked} onChange={(event) => setEvents({ fairplayBooked: event.target.checked }, "Dance camp updated.")} />
                <span>I have a ticket</span>
              </label>
            )}
          </article>
        </div>
      )}
    </section>
  )
}

// Where you are in the training programme.
export function JourneyPhase({ state, onOpenPlan }: { state: AppState; onOpenPlan: () => void }) {
  const phase = PHASES.find((item) => item.id === (state.trainingPhase ?? 1)) ?? PHASES[0]
  const next = PHASES.find((item) => item.id === phase.id + 1)
  return (
    <section className="journey-section journey-phase">
      <div className="journey-section__head">
        <h2>Where you are</h2>
      </div>
      <p className="eyebrow">Phase {phase.id} of {PHASES.length}</p>
      <h3>{phase.title}</h3>
      <p>{phase.body}</p>
      <small>{phase.ready}</small>
      {next && <small className="journey-phase__next">Next: {next.title}</small>}
      <button type="button" className="text-link" onClick={onOpenPlan}>
        Training phases and why this plan <ChevronRight size={14} />
      </button>
    </section>
  )
}

// Your story: everything that happened, plus reflections and moments you add and edit.
export function JourneyStory({ state, update }: { state: AppState; update: Update }) {
  const [mode, setMode] = useState<"reflect" | "moment">("reflect")
  const [text, setText] = useState("")
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(today())
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editDate, setEditDate] = useState("")
  const [showAll, setShowAll] = useState(false)
  const [filter, setFilter] = useState("All")
  const phase = state.trainingPhase ?? 1
  const story = journeyEntries(state)
  const kinds = ["All", ...Array.from(new Set(story.map((entry) => entry.kind)))]
  const shown = story.filter((entry) => filter === "All" || entry.kind === filter)
  const setReflections = (recipe: (items: NonNullable<NonNullable<AppState["roadmap"]>["reflections"]>) => NonNullable<NonNullable<AppState["roadmap"]>["reflections"]>, message?: string) =>
    update((current) => ({ ...current, roadmap: { ...current.roadmap, reflections: recipe(current.roadmap?.reflections ?? []) } }), message)

  return (
    <section className="journey-section">
      <div className="journey-section__head">
        <h2>Your story</h2>
      </div>
      <form
        className="roadmap__reflect"
        onSubmit={(event) => {
          event.preventDefault()
          if (mode === "moment" ? !title.trim() : !text.trim()) return
          setReflections(
            (items) => [
              { id: uid(), date: mode === "moment" ? date : today(), text: text.trim(), phase, title: mode === "moment" ? title.trim() : undefined },
              ...items,
            ],
            mode === "moment" ? "Moment added to your story." : "Reflection added to your story.",
          )
          setText("")
          setTitle("")
          setDate(today())
        }}
      >
        <div className="segmented">
          <button type="button" className={mode === "reflect" ? "is-active" : ""} aria-pressed={mode === "reflect"} onClick={() => setMode("reflect")}>
            Reflect
          </button>
          <button type="button" className={mode === "moment" ? "is-active" : ""} aria-pressed={mode === "moment"} onClick={() => setMode("moment")}>
            Add a moment
          </button>
        </div>
        {mode === "moment" && (
          <div className="plan-edit__row">
            <label>
              <span>What happened</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. First 5k without stopping" />
            </label>
            <label>
              <span>When</span>
              <input type="date" value={date} max={today()} onChange={(event) => event.target.value && setDate(event.target.value)} />
            </label>
          </div>
        )}
        <textarea
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={mode === "moment" ? "A few words about it (optional)" : "How is it going? What’s getting easier, what feels hard, what do you want to change?"}
          aria-label={mode === "moment" ? "About this moment" : "Reflection"}
        />
        <DictateButton onText={(spoken) => setText((current) => (current ? `${current} ${spoken}` : spoken))} />
        <Button type="submit" variant="secondary" icon={Plus} disabled={mode === "moment" ? !title.trim() : !text.trim()}>
          {mode === "moment" ? "Add moment" : "Add reflection"}
        </Button>
      </form>

      {kinds.length > 2 && (
        <div className="journey-filter" role="group" aria-label="Filter your story">
          {kinds.map((kind) => (
            <button type="button" key={kind} className={filter === kind ? "is-selected" : ""} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>
              {kind}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="capture-disclaimer">Milestones, workouts, reviews, finished projects, reflections and moments gather here as you live.</p>
      ) : (
        <ol className="roadmap__story">
          {(showAll ? shown : shown.slice(0, 15)).map((entry, index) => (
            <li key={`${entry.date}-${index}`}>
              <span className="roadmap__story-date">{formatDate(entry.date, { day: "numeric", month: "short" })}</span>
              {editing && editing === entry.reflectionId ? (
                <form
                  className="journey-edit"
                  onSubmit={(event) => {
                    event.preventDefault()
                    setReflections(
                      (items) =>
                        items.map((item) =>
                          item.id === editing ? { ...item, text: editText.trim(), title: item.title !== undefined ? editTitle.trim() || item.title : undefined, date: editDate || item.date } : item,
                        ),
                      "Saved.",
                    )
                    setEditing(null)
                  }}
                >
                  {entry.kind === "Moment" && <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} aria-label="Moment title" />}
                  <textarea rows={2} value={editText} onChange={(event) => setEditText(event.target.value)} aria-label="Text" />
                  <input type="date" value={editDate} max={today()} onChange={(event) => setEditDate(event.target.value)} aria-label="Date" />
                  <div className="inline-actions">
                    <Button type="submit" icon={Check}>
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <button
                      type="button"
                      className="text-link plan-edit__delete-link"
                      onClick={() => {
                        setReflections((items) => items.filter((item) => item.id !== editing), "Removed from your story.")
                        setEditing(null)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <small className="roadmap__story-kind">{entry.kind}</small>
                  <strong>{entry.title}</strong>
                  {entry.detail && <small>{entry.detail}</small>}
                  {entry.reflectionId && (
                    <button
                      type="button"
                      className="text-link journey-edit__link"
                      onClick={() => {
                        const item = (state.roadmap?.reflections ?? []).find((candidate) => candidate.id === entry.reflectionId)
                        if (!item) return
                        setEditing(item.id)
                        setEditText(item.text)
                        setEditTitle(item.title ?? "")
                        setEditDate(item.date)
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {shown.length > 15 && !showAll && (
        <button type="button" className="text-link" onClick={() => setShowAll(true)}>
          Show all {shown.length}
        </button>
      )}
    </section>
  )
}

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
  const [tab, setTab] = useState<"phases" | "why">("phases")
  const [reflection, setReflection] = useState("")
  const [showAll, setShowAll] = useState(false)
  const phase = state.trainingPhase ?? 1
  const events = state.events ?? {}
  const phaseDates = state.roadmap?.phaseDates ?? {}
  const setRoadmap = (recipe: (roadmap: NonNullable<AppState["roadmap"]>) => NonNullable<AppState["roadmap"]>, message?: string) =>
    update((current) => ({ ...current, roadmap: recipe(current.roadmap ?? {}) }), message)
  const setEvents = (patch: Partial<NonNullable<AppState["events"]>>, message: string) =>
    update((current) => {
      const next = { ...current.events, ...patch }
      return {
        ...current,
        events: next,
        goals: current.goals.map((goal) =>
          goal.id === "goal-race"
            ? { ...goal, dateLabel: next.hackneyBooked ? "Sun 16 May 2027 · entry booked" : HACKNEY_LABEL }
            : goal.id === "goal-dance"
              ? {
                  ...goal,
                  date: next.fairplayConfirmed ? "2027-08-01" : goal.date === "2027-08-01" ? undefined : goal.date,
                  dateLabel: next.fairplayConfirmed
                    ? `1–8 Aug 2027, Kraków · dates confirmed by you · ${next.fairplayBooked ? "booked" : "not booked"}`
                    : FAIRPLAY_REPORTED,
                }
              : goal,
        ),
      }
    }, message)

  const ahead = state.goals
    .filter((goal) => goal.status !== "complete" && goal.date && goal.date >= today())
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
  const undated = state.goals.filter((goal) => goal.status !== "complete" && goal.scale === "big" && !goal.date)
  const story = journeyEntries(state)

  return (
    <Modal title="Training plan" eyebrow="Running, gym and dance as one programme" onClose={onClose} wide>
      <div className="roadmap">
        <Art className="roadmap__art" src="/assets/movement-path.jpg" />
        <div className="segmented roadmap__tabs" role="tablist">
          {(
            [
              ["phases", "Training phases"],
              ["why", "Why this plan"],
            ] as const
          ).map(([key, label]) => (
            <button type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)} key={key}>
              {label}
            </button>
          ))}
        </div>

        {tab === "phases" && (
          <>
            <p className="capture-disclaimer">
              Running, gym and dance as one programme. Move to the next phase when your logs say you’re
              ready, not because a week has passed. Missed sessions are never piled onto the next week.
            </p>
            <ol className="roadmap__phases">
              {PHASES.map((item) => (
                <li key={item.id} className={item.id === phase ? "is-current" : item.id < phase ? "is-done" : ""}>
                  <span>{item.id}</span>
                  <div>
                    <strong>
                      {item.title}
                      {item.id === phase ? " · now" : item.id < phase ? " · done" : ""}
                    </strong>
                    <p>{item.body}</p>
                    <small>{item.ready}</small>
                    <div className="roadmap__phase-tools">
                      <label>
                        <span>{item.id <= phase ? "Started" : "Aim to start by"} (optional)</span>
                        <input
                          type="date"
                          value={phaseDates[String(item.id)] ?? ""}
                          onChange={(event) =>
                            setRoadmap((roadmap) => ({
                              ...roadmap,
                              phaseDates: { ...(roadmap.phaseDates ?? {}), [String(item.id)]: event.target.value },
                            }))
                          }
                        />
                      </label>
                      {item.id !== phase && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            update(
                              (current) => ({
                                ...current,
                                trainingPhase: item.id as AppState["trainingPhase"],
                                roadmap: {
                                  ...current.roadmap,
                                  phaseLog: [...(current.roadmap?.phaseLog ?? []), { phase: item.id, date: today() }],
                                },
                              }),
                              `${item.title} is now your current phase.`,
                            )
                          }
                        >
                          Make this my current phase
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {!state.plan.some((item) => item.phase === "restart") && (
              <Button variant="secondary" icon={CalendarCheck} onClick={onSetupRestart}>
                Set up the starter fortnight
              </Button>
            )}
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
          </>
        )}

        {tab === "why" && (
          <section className="roadmap__why">
            <h3>Why this plan?</h3>
            <ul>
              {WHY_THIS_PLAN.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="capture-disclaimer">
              Thirty minutes of running isn’t necessarily 5 km. No calorie targets or weigh-ins. This is
              general guidance; pain or injury should be assessed by a qualified professional.
            </p>
            <p className="eyebrow">Sources</p>
            <ul className="roadmap__sources">
              {SOURCES.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.label} <ExternalLink size={13} />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
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

type ExerciseState = { chosen: string; sets: LoggedSet[]; suggestion?: string }

const prefill = (exercise: Exercise, count: number, history: WorkoutRecord[]) => {
  const next = suggestNext(history, exercise)
  return {
    suggestion: next?.note,
    sets: Array.from({ length: count }, () => ({
      done: false,
      reps: next?.reps,
      weight: next?.weight,
      seconds: next?.seconds,
    })),
  }
}

function WorkoutSession({
  profile,
  short,
  history,
  custom,
  onFinish,
  onEditProfile,
}: {
  profile: TrainingProfile
  short: boolean
  history: WorkoutRecord[]
  custom?: PlannedExercise[]
  onFinish: (exercises: WorkoutRecord["exercises"], minutes: number) => void
  onEditProfile: () => void
}) {
  // A suggested workout (from the coach or assistant) is used as-is; otherwise the intro session.
  const plan = useMemo(() => {
    if (!custom?.length) return buildIntroSession(profile, short)
    const exercises = (short ? custom.slice(0, 2) : custom).map((item, index) => {
      const exercise = fromPlanned(item, index)
      return short ? { ...exercise, sets: 1 } : exercise
    })
    return {
      blocked: false,
      sets: 1,
      setsLabel: short ? "1 comfortable set" : "Suggested sets",
      exercises,
      notes: [
        "Numbers are pre-filled from your last log where there is one; change anything.",
        "Comfortable effort. Stop any exercise that causes pain.",
        "It’s fine to take longer than the estimated time.",
      ],
    }
  }, [profile, short, custom])
  const [extra, setExtra] = useState<Record<string, Exercise>>({})
  const catalog: Record<string, Exercise> = {
    ...EXERCISES,
    ...Object.fromEntries(plan.exercises.map((exercise) => [exercise.id, exercise])),
    ...extra,
  }
  const started = useRef(Date.now())
  const [warm, setWarm] = useState(false)
  const [rows, setRows] = useState<ExerciseState[]>(() =>
    plan.exercises.map((exercise) => ({ chosen: exercise.id, ...prefill(exercise, exercise.sets ?? plan.sets, history) })),
  )
  const [renaming, setRenaming] = useState<number | null>(null)
  const [renameText, setRenameText] = useState("")
  const [adding, setAdding] = useState("")
  const [addCustom, setAddCustom] = useState("")

  const setRow = (index: number, recipe: (row: ExerciseState) => ExerciseState) =>
    setRows((current) => current.map((row, position) => (position === index ? recipe(row) : row)))
  const updateSet = (row: number, index: number, patch: Partial<LoggedSet>) =>
    setRow(row, (item) => ({ ...item, sets: item.sets.map((set, setIndex) => (setIndex === index ? { ...set, ...patch } : set)) }))
  const number = (value: string) => (value === "" ? undefined : Math.max(0, Number(value)))
  const customExercise = (name: string): Exercise => ({
    id: `custom-${name.toLowerCase().replace(/[^a-z]+/g, "-")}-${Date.now()}`,
    name,
    category: "squat",
    equipment: "",
    track: "reps",
    reps: "8-10 reps",
    setup: [],
    technique: [],
    rest: "60-90 seconds",
    alternatives: [],
  })
  const swapTo = (index: number, exercise: Exercise) => {
    setExtra((current) => ({ ...current, [exercise.id]: exercise }))
    setRow(index, (row) => ({ chosen: exercise.id, ...prefill(exercise, row.sets.length, history) }))
  }

  return (
    <div className="workout">
      <p className="capture-disclaimer">
        {custom?.length ? "Your suggested session" : `${plan.setsLabel} of each · built from your answers`}. Change
        anything: swap, rename, add or remove exercises and sets ·{" "}
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
        const exercise: Exercise = catalog[row.chosen]
        const previous = lastPerformance(history, exercise)
        return (
          <section className="workout__card" key={`${row.chosen}-${rowIndex}`}>
            <div className="workout__head">
              <span>{rowIndex + 1}</span>
              <div>
                {renaming === rowIndex ? (
                  <form
                    className="workout__rename"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (renameText.trim()) swapTo(rowIndex, customExercise(renameText.trim()))
                      setRenaming(null)
                    }}
                  >
                    <input value={renameText} onChange={(event) => setRenameText(event.target.value)} autoFocus aria-label="Exercise name" />
                    <Button type="submit" variant="secondary">
                      Save
                    </Button>
                  </form>
                ) : (
                  <h3>{exercise.name}</h3>
                )}
                <small>
                  {[exercise.equipment, `${row.sets.length} × ${exercise.reps}`].filter(Boolean).join(" · ")}
                </small>
                {exercise.load && <small><b>Load:</b> {exercise.load}</small>}
                {exercise.why && <small><b>Why:</b> {exercise.why}</small>}
                {row.suggestion ? (
                  <small className="workout__suggest">
                    <Zap size={12} /> Suggested: {row.suggestion}
                  </small>
                ) : (
                  previous && <small className="workout__last">{previous}</small>
                )}
              </div>
            </div>
            <div className="workout__tools">
              <button type="button" className="text-link" onClick={() => { setRenaming(rowIndex); setRenameText(exercise.name) }}>
                Rename
              </button>
              <button
                type="button"
                className="text-link plan-edit__delete-link"
                onClick={() => setRows((current) => current.filter((_, position) => position !== rowIndex))}
              >
                Remove exercise
              </button>
            </div>
            {(exercise.setup.length > 0 || exercise.technique.length > 0 || exercise.demo) && (
              <details open={rowIndex === 0}>
                <summary>How to do it</summary>
                {exercise.setup.length > 0 && (
                  <>
                    <p className="workout__label">Setup</p>
                    <ul>
                      {exercise.setup.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </>
                )}
                {exercise.technique.length > 0 && (
                  <>
                    <p className="workout__label">Technique</p>
                    <ul>
                      {exercise.technique.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="workout__label">Rest · {exercise.rest}</p>
                {exercise.demo ? (
                  <a href={exercise.demo.url} target="_blank" rel="noreferrer">
                    Demonstration: {exercise.demo.label} <ExternalLink size={13} />
                  </a>
                ) : (
                  <p className="capture-disclaimer">No trusted demonstration link yet. Gym staff can show you the setup.</p>
                )}
              </details>
            )}
            {exercise.alternatives.length > 0 && (
              <div className="workout__swap">
                <span>Swap for</span>
                {exercise.alternatives.map((id) => (
                  <button type="button" key={id} onClick={() => swapTo(rowIndex, EXERCISES[id])}>
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
                      <input inputMode="numeric" type="number" min={0} value={set.seconds ?? ""} onChange={(event) => updateSet(rowIndex, setIndex, { seconds: number(event.target.value) })} aria-label={`${exercise.name} set ${setIndex + 1} seconds`} />
                      sec
                    </label>
                  ) : (
                    <label>
                      <input inputMode="numeric" type="number" min={0} value={set.reps ?? ""} onChange={(event) => updateSet(rowIndex, setIndex, { reps: number(event.target.value) })} aria-label={`${exercise.name} set ${setIndex + 1} reps`} />
                      reps
                    </label>
                  )}
                  <label>
                    <input inputMode="decimal" type="number" min={0} step={0.5} value={set.weight ?? ""} onChange={(event) => updateSet(rowIndex, setIndex, { weight: number(event.target.value) })} aria-label={`${exercise.name} set ${setIndex + 1} weight in kg`} />
                    kg
                  </label>
                  <button type="button" className="workout__done" aria-pressed={set.done} aria-label={`Mark set ${setIndex + 1} done`} onClick={() => updateSet(rowIndex, setIndex, { done: !set.done })}>
                    <Check size={16} />
                  </button>
                </div>
              ))}
              <div className="workout__set-tools">
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    setRow(rowIndex, (item) => {
                      const last = item.sets[item.sets.length - 1]
                      return { ...item, sets: [...item.sets, { done: false, reps: last?.reps, weight: last?.weight, seconds: last?.seconds }] }
                    })
                  }
                >
                  <Plus size={15} /> Add a set
                </button>
                {row.sets.length > 1 && (
                  <button type="button" className="text-link" onClick={() => setRow(rowIndex, (item) => ({ ...item, sets: item.sets.slice(0, -1) }))}>
                    Remove last set
                  </button>
                )}
              </div>
            </div>
          </section>
        )
      })}
      <section className="workout__card workout__add">
        <p className="workout__label">Add an exercise</p>
        <select
          value={adding}
          onChange={(event) => {
            const id = event.target.value
            setAdding("")
            if (!id) return
            const exercise = EXERCISES[id]
            setRows((current) => [...current, { chosen: id, ...prefill(exercise, 2, history) }])
          }}
          aria-label="Add an exercise from the list"
        >
          <option value="">Choose from the list…</option>
          {Object.values(EXERCISES).map((exercise) => (
            <option value={exercise.id} key={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>
        <form
          className="workout__rename"
          onSubmit={(event) => {
            event.preventDefault()
            if (!addCustom.trim()) return
            const exercise = customExercise(addCustom.trim())
            setExtra((current) => ({ ...current, [exercise.id]: exercise }))
            setRows((current) => [...current, { chosen: exercise.id, ...prefill(exercise, 2, history) }])
            setAddCustom("")
          }}
        >
          <input value={addCustom} onChange={(event) => setAddCustom(event.target.value)} placeholder="…or type your own" aria-label="Custom exercise name" />
          <Button type="submit" variant="secondary" icon={Plus}>
            Add
          </Button>
        </form>
      </section>
      <ul className="workout__notes">
        {plan.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <Button
        icon={Check}
        onClick={() =>
          onFinish(
            rows.map((row) => ({ id: row.chosen, name: catalog[row.chosen].name, sets: row.sets })),
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
  canSaveTemplate = false,
  onSave,
}: {
  item: PlanItem
  short: boolean
  minutes?: number
  hasProfile: boolean
  canSaveTemplate?: boolean
  onSave: (log: ActivityLog, pauseTraining: boolean, templateName?: string) => void
}) {
  const [saveTemplate, setSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState(item.title)
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
          canSaveTemplate && saveTemplate && templateName.trim() ? templateName.trim() : undefined,
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
      {canSaveTemplate && (
        <>
          <label className="sync-replace">
            <input type="checkbox" checked={saveTemplate} onChange={(event) => setSaveTemplate(event.target.checked)} />
            <span>
              Save as one of my workouts
              <small>Reuse it any day from Movement → My workouts, with today’s numbers.</small>
            </span>
          </label>
          {saveTemplate && (
            <label>
              <span>Workout name</span>
              <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            </label>
          )}
        </>
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

function DoTimer({ item, short, plan, onFinish }: { item: PlanItem; short: boolean; plan: PlanItem[]; onFinish: (minutes?: number) => void }) {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [running])
  // Walks and runs: suggest a slightly longer time only if the last one felt easy; always editable.
  const suggestion = !short && (item.kind === "walk" || item.kind === "run") ? suggestDuration(plan, item) : null
  const [target, setTarget] = useState(
    suggestion?.minutes ?? (short ? item.shortVersion?.duration : item.duration) ?? 0,
  )

  return (
    <div className="do-timer">
      {item.kind === "dance" && <Art className="space-banner" src="/assets/dance-floor.jpg" />}
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
      {suggestion && (
        <p className="workout__suggest">
          <Zap size={13} /> Suggested: {suggestion.note}
        </p>
      )}
      {(item.kind === "walk" || item.kind === "run" || item.kind === "dance" || target > 0) && (
        <label className="do-timer__target">
          <span>Target minutes</span>
          <input type="number" min={1} inputMode="numeric" value={target || ""} onChange={(event) => setTarget(Number(event.target.value) || 0)} />
        </label>
      )}
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

  const saveLog = (log: ActivityLog, pauseTraining: boolean, templateName?: string) => {
    const workoutId = workout ? uid() : undefined
    if (!log.concern)
      celebrate({
        title: log.summary,
        body: log.wasClass
          ? "A whole class. Keep tomorrow gentle."
          : item.kind === "gym"
            ? "Strength in the bank. Your log makes next time specific."
            : "Logged. That’s real progress.",
      })
    complete(
      { ...log, workoutId },
      log.wasClass
        ? "Logged. Classes can be demanding, so keep tomorrow gentle."
        : log.concern
          ? "Logged with your concern noted. Nothing extra has been scheduled."
          : "Logged. That’s real progress.",
      (current) => ({
        ...current,
        workoutTemplates:
          templateName && workout
            ? [...(current.workoutTemplates ?? []), { id: uid(), name: templateName, exercises: recordToExercises(workout) }]
            : current.workoutTemplates,
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
        canSaveTemplate={!!workout}
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
          custom={item.workout}
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
        plan={state.plan}
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

export function ActivityHistory({ state, onEditLog }: { state: AppState; onEditLog?: (id: string) => void }) {
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
                <div className="activity-history__tools">
                  {item.log?.concern && (
                    <span className="status-badge is-concern">
                      <TriangleAlert size={12} /> Concern
                    </span>
                  )}
                  {onEditLog && (
                    <button type="button" className="text-link" onClick={() => onEditLog(item.id)}>
                      Edit
                    </button>
                  )}
                </div>
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

