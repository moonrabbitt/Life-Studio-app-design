import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarPlus,
  Check,
  ChevronRight,
  Music2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  TriangleAlert,
  WandSparkles,
} from "lucide-react"
import { useEffect, useState } from "react"
import { suggestProjectSteps } from "./ai"
import { projectSteps } from "./projects"
import { addDays, checkPlacement } from "./training"
import type { AppState, Goal, PlanItem, Project, ProjectStep } from "./types"
import { Art, Button, formatDate, IconButton, Modal, today, uid } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

export const GOAL_VS_PROJECT =
  "A goal changes something about you or your life. A project makes something."

const formatMoney = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)

// ---------------------------------------------------------------------------
// Celebrations
// ---------------------------------------------------------------------------

export type CelebrationMessage = { title: string; body: string; big?: boolean }

// Celebrate from anywhere; the app shell shows it.
export const celebrate = (message: CelebrationMessage) =>
  window.dispatchEvent(new CustomEvent<CelebrationMessage>("studio:celebrate", { detail: message }))

const AREA_CHEERS: Record<string, string> = {
  connect: "Time with people you care about counts.",
  create: "Making progress on something of your own.",
  move: "Your body thanks you.",
  reflect: "A little more clarity.",
  money: "Future you is grateful.",
  home: "One less thing on your mind.",
}

export const celebrateDone = (title: string, area: string) =>
  celebrate({ title, body: AREA_CHEERS[area] ?? "Nicely done." })

export function Celebration({ message, onDone }: { message: CelebrationMessage; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, message.big ? 3200 : 2000)
    return () => window.clearTimeout(timer)
  }, [message, onDone])
  return (
    <div
      className={`milestone-celebration ${message.big ? "" : "milestone-celebration--small"}`}
      role="status"
      aria-live="polite"
      onClick={onDone}
    >
      <div className="milestone-celebration__sparkles" aria-hidden="true">
        {Array.from({ length: message.big ? 10 : 6 }, (_, index) => (
          <Sparkles key={index} size={16 + (index % 3) * 4} />
        ))}
      </div>
      <div className="milestone-celebration__card">
        <span>
          <Sparkles size={28} />
        </span>
        <p className="eyebrow">{message.big ? "You did it" : "One step closer"}</p>
        <h3>{message.title}</h3>
        <p>{message.body}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Send a step to a day (with clash check)
// ---------------------------------------------------------------------------

function StepScheduler({
  title,
  plan,
  onSchedule,
  onCancel,
}: {
  title: string
  plan: PlanItem[]
  onSchedule: (date: string, time: string | undefined, duration: number) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(today())
  const [time, setTime] = useState("")
  const [duration, setDuration] = useState("25")
  const days = Array.from({ length: 14 }, (_, index) => addDays(today(), index))
  const { conflicts } = checkPlacement(
    plan,
    { id: "new", title, area: "create", date, mode: "flexible", status: "planned", duration: Number(duration) || 25 },
    date,
    time || undefined,
  )
  return (
    <div className="step-scheduler">
      <div className="day-chips">
        {days.map((day) => (
          <button
            type="button"
            className={date === day ? "is-selected" : ""}
            aria-pressed={date === day}
            onClick={() => setDate(day)}
            key={day}
          >
            <span>{day === today() ? "Today" : formatDate(day, { weekday: "short" })}</span>
            <strong>{formatDate(day, { day: "numeric" })}</strong>
          </button>
        ))}
      </div>
      <div className="step-scheduler__row">
        <label>
          <span>Time (optional)</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label>
          <span>Minutes</span>
          <input
            type="number"
            min={5}
            step={5}
            inputMode="numeric"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </label>
      </div>
      {conflicts.map((other) => (
        <p className="move-sheet__warn" key={other.id}>
          <TriangleAlert size={15} /> Overlaps {other.title} at {other.time}
        </p>
      ))}
      <div className="inline-actions">
        <Button
          icon={CalendarPlus}
          onClick={() => onSchedule(date, time || undefined, Number(duration) || 25)}
        >
          {conflicts.length ? "Add anyway" : `Add to ${date === today() ? "today" : formatDate(date, { weekday: "long" })}`}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// A list of small steps: tick, reorder, remove, send to a day
// ---------------------------------------------------------------------------

type StepRow = { id: string; title: string; done: boolean; doneAt?: string }

function StepList({
  steps,
  scheduled,
  plan,
  onToggle,
  onAdd,
  onRemove,
  onMove,
  onSchedule,
  addPlaceholder,
}: {
  steps: StepRow[]
  scheduled: (stepId: string) => PlanItem | undefined
  plan: PlanItem[]
  onToggle: (step: StepRow) => void
  onAdd: (title: string) => void
  onRemove: (stepId: string) => void
  onMove: (stepId: string, direction: -1 | 1) => void
  onSchedule: (step: StepRow, date: string, time: string | undefined, duration: number) => void
  addPlaceholder: string
}) {
  const [draft, setDraft] = useState("")
  const [scheduling, setScheduling] = useState<string | null>(null)
  return (
    <div className="step-list">
      {steps.length === 0 && (
        <p className="capture-disclaimer">No steps yet. Add the smallest first one.</p>
      )}
      <ol>
        {steps.map((step, index) => {
          const planned = scheduled(step.id)
          return (
            <li key={step.id} className={step.done ? "is-done" : ""}>
              <div className="step-list__row">
                <button
                  type="button"
                  className="step-list__check"
                  aria-pressed={step.done}
                  aria-label={step.done ? `Mark “${step.title}” not done` : `Mark “${step.title}” done`}
                  onClick={() => onToggle(step)}
                >
                  {step.done ? <Check size={17} /> : index + 1}
                </button>
                <div className="step-list__text">
                  <strong>{step.title}</strong>
                  {step.done && step.doneAt && (
                    <small>Done {formatDate(step.doneAt.slice(0, 10), { day: "numeric", month: "short" })}</small>
                  )}
                  {!step.done && planned && (
                    <small className="step-list__planned">
                      <CalendarPlus size={13} /> Planned{" "}
                      {planned.date === today() ? "today" : formatDate(planned.date, { weekday: "short", day: "numeric", month: "short" })}
                      {planned.time ? ` · ${planned.time}` : ""}
                    </small>
                  )}
                </div>
                {!step.done && !planned && (
                  <button
                    type="button"
                    className="step-list__schedule"
                    onClick={() => setScheduling(scheduling === step.id ? null : step.id)}
                  >
                    <CalendarPlus size={15} /> Add to day
                  </button>
                )}
                <div className="step-list__tools">
                  <IconButton label="Move up" icon={ArrowUp} onClick={() => onMove(step.id, -1)} />
                  <IconButton label="Move down" icon={ArrowDown} onClick={() => onMove(step.id, 1)} />
                  <IconButton label={`Remove “${step.title}”`} icon={Trash2} onClick={() => onRemove(step.id)} />
                </div>
              </div>
              {scheduling === step.id && (
                <StepScheduler
                  title={step.title}
                  plan={plan}
                  onCancel={() => setScheduling(null)}
                  onSchedule={(date, time, duration) => {
                    onSchedule(step, date, time, duration)
                    setScheduling(null)
                  }}
                />
              )}
            </li>
          )
        })}
      </ol>
      <form
        className="step-list__add"
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.trim()) return
          onAdd(draft.trim())
          setDraft("")
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={addPlaceholder}
          aria-label="New step"
        />
        <Button type="submit" variant="secondary" icon={Plus}>
          Add step
        </Button>
      </form>
    </div>
  )
}

const move = <T extends { id: string }>(items: T[], id: string, direction: -1 | 1) => {
  const index = items.findIndex((item) => item.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

// Ticking a step also completes (or reopens) the plan item made from it.
const syncPlan = (plan: PlanItem[], match: (item: PlanItem) => boolean, done: boolean, summary: string) =>
  plan.map((item) => {
    if (!match(item)) return item
    if (done && (item.status === "planned" || item.status === "proposed"))
      return { ...item, status: "complete" as const, log: { completedAt: new Date().toISOString(), summary } }
    if (!done && item.status === "complete") return { ...item, status: "planned" as const, log: undefined }
    return item
  })

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

// Picks artwork from what the project is about; falls back gracefully if a file is missing.
function ProjectVisual({ project }: { project: Project }) {
  const lower = `${project.title} ${project.note}`.toLowerCase()
  const art = /film|video|shoot|camera|director|london light/.test(lower)
    ? "/assets/film-director.jpg"
    : /song|music|melod|beat|keyboard|piano|album/.test(lower)
      ? "/assets/making-music.jpg"
      : /writ|story|poem|journal|essay|zine|book/.test(lower)
        ? "/assets/writing-nook.jpg"
        : /tech|code|light|install|interactive|app|digital|art/.test(lower)
          ? "/assets/creative-tech.jpg"
          : "/assets/creative-room.jpg"
  return (
    <div className="project-card__visual">
      <Music2 size={35} aria-hidden="true" />
      <Art src={art} fallback="/assets/life-studio-room.jpg" />
    </div>
  )
}

function ProjectForm({ state, onSave, onCancel }: { state: AppState; onSave: (project: Project) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [steps, setSteps] = useState<string[]>([])
  const [stepDraft, setStepDraft] = useState("")
  const [goalId, setGoalId] = useState("")
  const [cost, setCost] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  return (
    <form
      className="project-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        const all = [...steps, ...(stepDraft.trim() ? [stepDraft.trim()] : [])]
        onSave({
          id: uid(),
          title: title.trim(),
          note: note.trim(),
          stage: "Seed",
          estimatedCost: cost ? Math.round(Number(cost) * 100) : undefined,
          goalId: goalId || undefined,
          steps: all.map((step) => ({ id: uid(), title: step, done: false })),
        })
      }}
    >
      <label>
        <span>What are you making?</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus placeholder="e.g. A short river film" />
      </label>
      <label>
        <span>What will exist when it’s finished? (optional)</span>
        <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. A two-minute film I can share with friends" />
      </label>
      <div className="project-form__steps">
        <span className="project-form__label">First small steps</span>
        {steps.map((step, index) => (
          <div className="project-form__step" key={`${step}-${index}`}>
            <span>{index + 1}.</span>
            <p>{step}</p>
            <IconButton label={`Remove “${step}”`} icon={Trash2} onClick={() => setSteps(steps.filter((_, i) => i !== index))} />
          </div>
        ))}
        <div className="project-form__add">
          <input
            value={stepDraft}
            onChange={(event) => setStepDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                if (stepDraft.trim()) {
                  setSteps([...steps, stepDraft.trim()])
                  setStepDraft("")
                }
              }
            }}
            placeholder="e.g. Collect five reference shots"
            aria-label="New step"
          />
          <Button
            variant="secondary"
            icon={Plus}
            onClick={() => {
              if (!stepDraft.trim()) return
              setSteps([...steps, stepDraft.trim()])
              setStepDraft("")
            }}
          >
            Add
          </Button>
        </div>
        <Button
          variant="ghost"
          icon={WandSparkles}
          disabled={!title.trim() || loading}
          onClick={async () => {
            setLoading(true)
            setError("")
            try {
              const suggested = await suggestProjectSteps({ title, note, existing: steps })
              setSteps([...steps, ...suggested.map((step) => step.title)])
            } catch (failure) {
              setError((failure as Error).message)
            }
            setLoading(false)
          }}
        >
          {loading ? "Thinking…" : "Suggest steps with AI"}
        </Button>
        {error && <p className="capture-disclaimer" role="alert">{error}</p>}
      </div>
      <label>
        <span>Does it feed a goal? (optional)</span>
        <select value={goalId} onChange={(event) => setGoalId(event.target.value)}>
          <option value="">No linked goal</option>
          {state.goals
            .filter((goal) => goal.status !== "complete")
            .map((goal) => (
              <option value={goal.id} key={goal.id}>
                {goal.title}
              </option>
            ))}
        </select>
      </label>
      <label>
        <span>Estimated cost, £ (optional)</span>
        <input type="number" min={0} step={0.01} inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
      </label>
      <div className="inline-actions">
        <Button type="submit" icon={Plus}>
          Create project
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function ProjectDetail({
  project,
  state,
  update,
  onBack,
  celebrate,
}: {
  project: Project
  state: AppState
  update: Update
  onBack: () => void
  celebrate: (message: CelebrationMessage) => void
}) {
  const steps = projectSteps(project)
  const doneCount = steps.filter((step) => step.done).length
  const goal = state.goals.find((item) => item.id === project.goalId)
  const [finishing, setFinishing] = useState(false)
  const [made, setMade] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
  const finished = project.stage === "Complete"

  const setSteps = (recipe: (steps: ProjectStep[]) => ProjectStep[], message?: string) =>
    update(
      (current) => ({
        ...current,
        projects: current.projects.map((item) =>
          item.id === project.id ? { ...item, steps: recipe(projectSteps(item)) } : item,
        ),
      }),
      message,
    )
  const scheduled = (stepId: string) =>
    state.plan.find(
      (item) =>
        item.projectId === project.id &&
        item.stepId === stepId &&
        (item.status === "planned" || item.status === "proposed"),
    )

  return (
    <div className="project-detail">
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft size={17} /> All projects
      </button>
      <section className="project-detail__head">
        <span className="stage-pill">{finished ? "Finished" : project.stage}</span>
        <h3>{project.title}</h3>
        {project.note && <p>{project.note}</p>}
        {goal && (
          <p className="coach-goal">
            <Sparkles size={15} /> Feeds your goal: {goal.title}
          </p>
        )}
        <div className="goal-progress">
          <div>
            <span>Steps</span>
            <strong>
              {doneCount} of {steps.length} done
            </strong>
          </div>
          <div className="goal-progress__track" role="progressbar" aria-label="Steps done" aria-valuemin={0} aria-valuemax={100} aria-valuenow={steps.length ? Math.round((doneCount / steps.length) * 100) : 0}>
            <span style={{ width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%` }} />
          </div>
        </div>
      </section>

      {!finished && (
        <label className="project-detail__stage">
          <span>Stage</span>
          <select
            value={project.stage}
            onChange={(event) =>
              update((current) => ({
                ...current,
                projects: current.projects.map((item) =>
                  item.id === project.id ? { ...item, stage: event.target.value as Project["stage"] } : item,
                ),
              }))
            }
          >
            <option>Seed</option>
            <option>Exploring</option>
            <option>Making</option>
            <option>Resting</option>
          </select>
        </label>
      )}

      <section>
        <p className="eyebrow">Small steps towards the finished thing</p>
        <StepList
          steps={steps}
          scheduled={scheduled}
          plan={state.plan}
          addPlaceholder="Add a small step (one sitting)"
          onToggle={(step) => {
            const done = !step.done
            update((current) => ({
              ...current,
              projects: current.projects.map((item) =>
                item.id === project.id
                  ? {
                      ...item,
                      stage: done && item.stage === "Seed" ? "Making" : item.stage,
                      steps: projectSteps(item).map((candidate) =>
                        candidate.id === step.id
                          ? { ...candidate, done, doneAt: done ? new Date().toISOString() : undefined }
                          : candidate,
                      ),
                    }
                  : item,
              ),
              plan: syncPlan(current.plan, (item) => item.projectId === project.id && item.stepId === step.id, done, step.title),
            }))
            if (done) {
              const remaining = steps.filter((candidate) => !candidate.done && candidate.id !== step.id).length
              celebrate({
                title: step.title,
                body: remaining
                  ? `${remaining} step${remaining === 1 ? "" : "s"} left on ${project.title}.`
                  : `That was the last step. Ready to call ${project.title} finished?`,
              })
              if (!remaining) setFinishing(true)
            }
          }}
          onAdd={(title) => setSteps((current) => [...current, { id: uid(), title, done: false }], "Step added.")}
          onRemove={(stepId) => setSteps((current) => current.filter((step) => step.id !== stepId))}
          onMove={(stepId, direction) => setSteps((current) => move(current, stepId, direction))}
          onSchedule={(step, date, time, duration) =>
            update(
              (current) => ({
                ...current,
                plan: [
                  ...current.plan,
                  {
                    id: uid(),
                    title: step.title,
                    area: "create",
                    kind: "create",
                    date,
                    time,
                    duration,
                    mode: "flexible",
                    status: "planned",
                    projectId: project.id,
                    stepId: step.id,
                    goalId: project.goalId,
                    details: [`A step of ${project.title}. Ticking it off here ticks it in the project too.`],
                  },
                ],
              }),
              `Added to ${date === today() ? "today" : formatDate(date, { weekday: "long" })}.`,
            )
          }
        />
        {!finished && (
          <Button
            variant="ghost"
            icon={WandSparkles}
            disabled={aiLoading}
            onClick={async () => {
              setAiLoading(true)
              setAiError("")
              try {
                const suggested = await suggestProjectSteps({
                  title: project.title,
                  note: project.note,
                  existing: steps.map((step) => step.title),
                })
                if (suggested.length)
                  setSteps(
                    (current) => [...current, ...suggested.map((item) => ({ id: uid(), title: item.title, done: false }))],
                    `${suggested.length} steps suggested. Edit or remove any you don’t want.`,
                  )
              } catch (failure) {
                setAiError((failure as Error).message)
              }
              setAiLoading(false)
            }}
          >
            {aiLoading ? "Thinking…" : "Suggest next steps with AI"}
          </Button>
        )}
        {aiError && <p className="capture-disclaimer" role="alert">{aiError}</p>}
      </section>

      {finished ? (
        <section className="finished-note">
          <p className="eyebrow">Finished {project.finishedAt ? formatDate(project.finishedAt.slice(0, 10), { day: "numeric", month: "long", year: "numeric" }) : ""}</p>
          {project.madeNote && <p>{project.madeNote}</p>}
          <Button
            variant="ghost"
            icon={RotateCcw}
            onClick={() =>
              update(
                (current) => ({
                  ...current,
                  projects: current.projects.map((item) =>
                    item.id === project.id ? { ...item, stage: "Making", finishedAt: undefined } : item,
                  ),
                }),
                "Project reopened.",
              )
            }
          >
            Reopen
          </Button>
        </section>
      ) : finishing ? (
        <form
          className="finished-note"
          onSubmit={(event) => {
            event.preventDefault()
            update((current) => ({
              ...current,
              projects: current.projects.map((item) =>
                item.id === project.id
                  ? { ...item, stage: "Complete", finishedAt: new Date().toISOString(), madeNote: made.trim() || undefined }
                  : item,
              ),
            }))
            celebrate({ title: `${project.title} is finished`, body: "It now lives on your Finished shelf.", big: true })
            onBack()
          }}
        >
          <label>
            <span>What did you make? (optional)</span>
            <textarea rows={3} value={made} onChange={(event) => setMade(event.target.value)} placeholder="A sentence to remember it by, or a link" />
          </label>
          <div className="inline-actions">
            <Button type="submit" icon={Sparkles}>
              Finish and celebrate
            </Button>
            <Button variant="ghost" onClick={() => setFinishing(false)}>
              Not yet
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" icon={Sparkles} onClick={() => setFinishing(true)}>
          Mark project finished
        </Button>
      )}
    </div>
  )
}

export function ProjectsSpace({ state, update, close }: { state: AppState; update: Update; close: () => void }) {
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [celebration, setCelebration] = useState<CelebrationMessage | null>(null)
  const open = state.projects.find((project) => project.id === openId)
  const active = state.projects.filter((project) => project.stage !== "Complete")
  const finished = state.projects.filter((project) => project.stage === "Complete")

  const addToDay = (project: Project, step: ProjectStep) =>
    update(
      (current) => ({
        ...current,
        plan: [
          ...current.plan,
          {
            id: uid(),
            title: step.title,
            area: "create",
            kind: "create",
            date: today(),
            duration: 25,
            mode: "flexible",
            status: "planned",
            projectId: project.id,
            stepId: step.id,
            goalId: project.goalId,
            details: [`A step of ${project.title}. Ticking it off here ticks it in the project too.`],
          },
        ],
      }),
      "Next step added to today.",
    )

  return (
    <Modal title={open ? open.title : "Projects"} eyebrow="Create · things you’re making" onClose={close} wide>
      {open ? (
        <ProjectDetail project={open} state={state} update={update} onBack={() => setOpenId(null)} celebrate={setCelebration} />
      ) : adding ? (
        <ProjectForm
          state={state}
          onCancel={() => setAdding(false)}
          onSave={(project) => {
            update((current) => ({ ...current, projects: [project, ...current.projects] }), "Project created.")
            setAdding(false)
            setOpenId(project.id)
          }}
        />
      ) : (
        <>
          <div className="feature-topline">
            <p>
              <strong>Projects are things you make</strong>, a film, a song, a piece of writing.
              Break one into small steps, send a step to your day, and finish it with a celebration.
              <small className="feature-topline__hint">{GOAL_VS_PROJECT}</small>
            </p>
            <Button icon={Plus} onClick={() => setAdding(true)}>
              New project
            </Button>
          </div>
          <div className="project-grid">
            {active.map((project) => {
              const steps = projectSteps(project)
              const done = steps.filter((step) => step.done).length
              const next = steps.find((step) => !step.done)
              const planned =
                next &&
                state.plan.find(
                  (item) => item.projectId === project.id && item.stepId === next.id && (item.status === "planned" || item.status === "proposed"),
                )
              const goal = state.goals.find((item) => item.id === project.goalId)
              return (
                <article className="project-card" key={project.id}>
                  <ProjectVisual project={project} />
                  <div className="project-card__body">
                    <span className="stage-pill">{project.stage}</span>
                    <h3>{project.title}</h3>
                    {project.note && <p>{project.note}</p>}
                    {goal && <small className="project-card__goal">Feeds: {goal.title}</small>}
                    <div className="project-card__progress">
                      <div className="goal-progress__track" aria-hidden="true">
                        <span style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }} />
                      </div>
                      <small>
                        {done} of {steps.length} step{steps.length === 1 ? "" : "s"}
                      </small>
                    </div>
                    {next ? (
                      <div className="next-step">
                        <span>Next step</span>
                        <strong>{next.title}</strong>
                        {planned && (
                          <small>
                            Planned {planned.date === today() ? "today" : formatDate(planned.date, { weekday: "short", day: "numeric" })}
                            {planned.time ? ` · ${planned.time}` : ""}
                          </small>
                        )}
                      </div>
                    ) : (
                      <div className="next-step">
                        <span>All steps done</span>
                        <strong>Ready to finish?</strong>
                      </div>
                    )}
                    <div className="project-card__footer">
                      <span>{project.estimatedCost ? `${formatMoney(project.estimatedCost)} estimate` : ""}</span>
                      <div className="inline-actions">
                        {next && !planned && (
                          <Button variant="secondary" icon={CalendarPlus} onClick={() => addToDay(project, next)}>
                            Add to today
                          </Button>
                        )}
                        <Button variant="ghost" onClick={() => setOpenId(project.id)}>
                          Open <ChevronRight size={15} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          {active.length === 0 && (
            <p className="capture-disclaimer">No projects yet. What would you like to make?</p>
          )}
          {finished.length > 0 && (
            <section className="finished-shelf">
              <p className="eyebrow">Finished shelf</p>
              <ul>
                {finished.map((project) => (
                  <li key={project.id}>
                    <button type="button" onClick={() => setOpenId(project.id)}>
                      <Sparkles size={16} />
                      <span>
                        <strong>{project.title}</strong>
                        <small>
                          {project.finishedAt ? formatDate(project.finishedAt.slice(0, 10), { day: "numeric", month: "short", year: "numeric" }) : ""}
                          {project.madeNote ? ` · ${project.madeNote}` : ""}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {celebration && <Celebration message={celebration} onDone={() => setCelebration(null)} />}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export function GoalDetail({
  goal,
  state,
  update,
  onClose,
}: {
  goal: Goal
  state: AppState
  update: Update
  onClose: () => void
}) {
  const [celebration, setCelebration] = useState<CelebrationMessage | null>(null)
  const big = goal.scale === "big"
  const steps: StepRow[] = goal.milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    done: !!milestone.completedAt,
    doneAt: milestone.completedAt,
  }))
  const doneCount = steps.filter((step) => step.done).length
  const sessions = state.plan.filter((item) => item.goalId === goal.id && item.status === "complete" && !item.milestoneId)
  const projects = state.projects.filter((project) => project.goalId === goal.id)
  const reached = goal.status === "complete"
  const setMilestones = (recipe: (milestones: Goal["milestones"]) => Goal["milestones"], message?: string) =>
    update(
      (current) => ({
        ...current,
        goals: current.goals.map((item) => (item.id === goal.id ? { ...item, milestones: recipe(item.milestones) } : item)),
      }),
      message,
    )
  const scheduled = (stepId: string) =>
    state.plan.find(
      (item) => item.goalId === goal.id && item.milestoneId === stepId && (item.status === "planned" || item.status === "proposed"),
    )
  const word = big ? "milestone" : "step"

  return (
    <Modal title={goal.title} eyebrow={big ? "Bigger goal · months" : "Smaller goal · days or weeks"} onClose={onClose} wide>
      <div className="goal-detail">
        <p className="goal-detail__purpose">
          {big
            ? "A bigger goal is a change you grow into over months. Milestones mark the way, and every session you log towards it counts."
            : "A smaller goal is something you want to reach soon. Tick off a few small steps, then mark it reached."}{" "}
          <small>{GOAL_VS_PROJECT}</small>
        </p>
        {goal.dateLabel && <p className="goal-card__date">{goal.dateLabel}</p>}
        <div className="goal-detail__stats">
          <p>
            <strong>{doneCount}/{steps.length}</strong> {word}s
          </p>
          {big && (
            <p>
              <strong>{sessions.length}</strong> sessions logged
            </p>
          )}
          {projects.length > 0 && (
            <p>
              <strong>{projects.length}</strong> feeding project{projects.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <section>
          <p className="eyebrow">{big ? "Milestones" : "Small steps"}</p>
          <StepList
            steps={steps}
            scheduled={scheduled}
            plan={state.plan}
            addPlaceholder={big ? "Add a milestone" : "Add a small step"}
            onToggle={(step) => {
              const done = !step.done
              update((current) => ({
                ...current,
                goals: current.goals.map((item) =>
                  item.id === goal.id
                    ? {
                        ...item,
                        milestones: item.milestones.map((milestone) =>
                          milestone.id === step.id
                            ? { ...milestone, completedAt: done ? new Date().toISOString() : undefined }
                            : milestone,
                        ),
                      }
                    : item,
                ),
                plan: syncPlan(current.plan, (item) => item.goalId === goal.id && item.milestoneId === step.id, done, step.title),
              }))
              if (done) {
                const remaining = steps.filter((candidate) => !candidate.done && candidate.id !== step.id).length
                setCelebration({
                  title: step.title,
                  body: remaining ? `${remaining} ${word}${remaining === 1 ? "" : "s"} to go.` : `Every ${word} done. Ready to mark this goal reached?`,
                })
              }
            }}
            onAdd={(title) => setMilestones((current) => [...current, { id: uid(), title }], `${big ? "Milestone" : "Step"} added.`)}
            onRemove={(stepId) => setMilestones((current) => current.filter((milestone) => milestone.id !== stepId))}
            onMove={(stepId, direction) => setMilestones((current) => move(current, stepId, direction))}
            onSchedule={(step, date, time, duration) =>
              update(
                (current) => ({
                  ...current,
                  plan: [
                    ...current.plan,
                    {
                      id: uid(),
                      title: step.title,
                      area: goal.area,
                      date,
                      time,
                      duration,
                      mode: "flexible",
                      status: "planned",
                      goalId: goal.id,
                      milestoneId: step.id,
                      details: [`Towards your goal: ${goal.title}.`],
                    },
                  ],
                }),
                `Added to ${date === today() ? "today" : formatDate(date, { weekday: "long" })}.`,
              )
            }
          />
        </section>

        {projects.length > 0 && (
          <section>
            <p className="eyebrow">Projects feeding this goal</p>
            <ul className="goal-detail__projects">
              {projects.map((project) => (
                <li key={project.id}>
                  <strong>{project.title}</strong>
                  <small>
                    {projectSteps(project).filter((step) => step.done).length} of {projectSteps(project).length} steps · {project.stage === "Complete" ? "Finished" : project.stage}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="goal-detail__finish">
          {reached ? (
            <>
              <p>
                <Sparkles size={16} /> Reached. Well done.
              </p>
              <Button
                variant="ghost"
                icon={RotateCcw}
                onClick={() =>
                  update(
                    (current) => ({
                      ...current,
                      goals: current.goals.map((item) => (item.id === goal.id ? { ...item, status: "tending" } : item)),
                    }),
                    "Goal reopened.",
                  )
                }
              >
                Reopen
              </Button>
            </>
          ) : (
            <Button
              icon={Sparkles}
              variant={doneCount === steps.length && steps.length > 0 ? "primary" : "secondary"}
              onClick={() => {
                update((current) => ({
                  ...current,
                  goals: current.goals.map((item) => (item.id === goal.id ? { ...item, status: "complete" } : item)),
                }))
                setCelebration({ title: `${goal.title}: reached`, body: "It’s part of your story now, on your Reached shelf.", big: true })
              }}
            >
              I’ve reached this goal
            </Button>
          )}
        </div>
      </div>
      {celebration && <Celebration message={celebration} onDone={() => setCelebration(null)} />}
    </Modal>
  )
}
