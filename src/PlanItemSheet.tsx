import {
  BookOpen,
  Check,
  Dumbbell,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { areaMeta } from "./data"
import { celebrateDone } from "./GoalProjectViews"
import { projectSteps } from "./projects"
import {
  createSeries,
  editFuture,
  endSeriesBefore,
  REPEAT_LABELS,
  seriesOf,
  skipOccurrence,
} from "./series"
import { checkPlacement } from "./training"
import {
  ActivityButtons,
  DictateButton,
  PlannedWorkoutList,
  skipItem,
  StatusBadge,
  type ActivityMode,
} from "./TrainingViews"
import type { ActivityKind, AppState, Area, PlanItem, RepeatFrequency, Series } from "./types"
import { Button, formatDate, Modal, today, uid } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const PURPOSE: Record<Area, string> = {
  connect: "Time with people. Note who it’s with; marking it done remembers when you last connected.",
  create: "Making something. Link it to a project so it counts as one of its steps.",
  move: "Movement. Start it, take the short version, or log what you actually did.",
  reflect: "A moment to reflect. Write a few lines here and they’re saved to your journal.",
  money: "A money task. Deeper learning lives in Investing Lab.",
  home: "Life admin and home. Break it into small steps if that helps.",
}

const EXERCISE: ActivityKind[] = ["gym", "walk", "run", "dance"]

type SaveOptions = { scope: "this" | "future"; repeat: RepeatFrequency | ""; until?: string }

function EditForm({ item, plan, series, onSave, onCancel, onDelete }: {
  item: PlanItem
  plan: PlanItem[]
  series?: Series
  onSave: (patch: Partial<PlanItem>, options: SaveOptions) => void
  onCancel: () => void
  onDelete: (scope: "this" | "future") => void
}) {
  const [repeat, setRepeat] = useState<RepeatFrequency | "">(series?.frequency ?? "")
  const [until, setUntil] = useState(series?.until ?? "")
  const [scope, setScope] = useState<"this" | "future">("this")
  const [title, setTitle] = useState(item.title)
  const [date, setDate] = useState(item.date)
  const [time, setTime] = useState(item.time ?? "")
  const [duration, setDuration] = useState(item.duration ? String(item.duration) : "")
  const [mode, setMode] = useState(item.mode)
  const [area, setArea] = useState(item.area)
  const [note, setNote] = useState(item.note ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const preview = checkPlacement(plan, { ...item, duration: Number(duration) || item.duration }, date, time || undefined)
  return (
    <form
      className="plan-edit"
      onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        onSave({
          title: title.trim(),
          date,
          time: time || undefined,
          duration: Number(duration) || undefined,
          mode,
          area,
          note: note.trim() || undefined,
        }, { scope, repeat, until: until || undefined })
      }}
    >
      <label>
        <span>Name</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <div className="plan-edit__row">
        <label>
          <span>Day</span>
          <input type="date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} />
        </label>
        <label>
          <span>Time</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label>
          <span>Minutes</span>
          <input type="number" min={5} step={5} inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} />
        </label>
      </div>
      <div className="plan-edit__row">
        <label>
          <span>How fixed</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as PlanItem["mode"])}>
            <option value="fixed">Fixed commitment</option>
            <option value="flexible">Flexible</option>
            <option value="maybe">Maybe</option>
          </select>
        </label>
        {!item.kind && (
          <label>
            <span>Part of life</span>
            <select value={area} onChange={(event) => setArea(event.target.value as Area)}>
              {(Object.keys(areaMeta) as Area[]).map((key) => (
                <option value={key} key={key}>
                  {areaMeta[key].label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label>
        <span>Notes</span>
        <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="plan-edit__row">
        <label>
          <span>Repeats</span>
          <select
            value={repeat}
            onChange={(event) => {
              setRepeat(event.target.value as RepeatFrequency | "")
              if (series) setScope("future")
            }}
          >
            <option value="">Doesn’t repeat</option>
            {(Object.keys(REPEAT_LABELS) as RepeatFrequency[]).map((key) => (
              <option value={key} key={key}>
                {REPEAT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        {repeat && (
          <label>
            <span>Until (optional)</span>
            <input type="date" min={date} value={until} onChange={(event) => setUntil(event.target.value)} />
          </label>
        )}
      </div>
      {series && (
        <fieldset className="chip-group">
          <legend>Apply changes to</legend>
          <div>
            <button type="button" className={scope === "this" ? "is-selected" : ""} aria-pressed={scope === "this"} onClick={() => setScope("this")}>
              Only this one
            </button>
            <button type="button" className={scope === "future" ? "is-selected" : ""} aria-pressed={scope === "future"} onClick={() => setScope("future")}>
              This and future
            </button>
          </div>
        </fieldset>
      )}
      {(preview.conflicts.length > 0 || preview.warnings.length > 0) && (
        <div className="move-sheet__preview">
          {preview.conflicts.map((other) => (
            <p className="move-sheet__warn" key={other.id}>
              <TriangleAlert size={15} /> Overlaps {other.title} at {other.time}
            </p>
          ))}
          {preview.warnings.map((warning) => (
            <p className="move-sheet__warn" key={warning}>
              <TriangleAlert size={15} /> {warning}
            </p>
          ))}
        </div>
      )}
      <div className="inline-actions">
        <Button type="submit" icon={Check}>
          Save changes
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {confirmDelete ? (
        <div className="plan-edit__delete">
          <p>Delete “{item.title}” from your plan?</p>
          {series ? (
            <>
              <Button variant="danger" icon={Trash2} onClick={() => onDelete("this")}>
                Only this one
              </Button>
              <Button variant="danger" icon={Trash2} onClick={() => onDelete("future")}>
                This and all future
              </Button>
            </>
          ) : (
            <Button variant="danger" icon={Trash2} onClick={() => onDelete("this")}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <button type="button" className="text-link plan-edit__delete-link" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} /> Delete from plan
        </button>
      )}
    </form>
  )
}

export function PlanItemSheet({
  itemId,
  state,
  update,
  onClose,
  onActivity,
  onOpenSpace,
}: {
  itemId: string
  state: AppState
  update: Update
  onClose: () => void
  onActivity: (id: string, mode: ActivityMode) => void
  onOpenSpace: (space: Area) => void
}) {
  const item = state.plan.find((candidate) => candidate.id === itemId)
  const [editing, setEditing] = useState(false)
  const [journal, setJournal] = useState("")
  const [howItWent, setHowItWent] = useState("")
  const [stepTitle, setStepTitle] = useState("")
  if (!item) return null

  const open = item.status === "planned" || item.status === "proposed"
  const series = seriesOf(state, item)
  const goal = state.goals.find((candidate) => candidate.id === item.goalId)
  const project = state.projects.find((candidate) => candidate.id === item.projectId)
  const person = state.people.find((candidate) => candidate.id === item.personId)
  const patch = (changes: Partial<PlanItem>, message?: string) =>
    update(
      (current) => ({
        ...current,
        plan: current.plan.map((candidate) => (candidate.id === item.id ? { ...candidate, ...changes } : candidate)),
      }),
      message,
    )

  // Marking done: each category records what makes sense for it, then celebrates.
  const markDone = () => {
    const completedAt = new Date().toISOString()
    update((current) => {
      let next: AppState = {
        ...current,
        plan: current.plan.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                status: "complete" as const,
                log: { completedAt, summary: candidate.title, note: howItWent.trim() || undefined },
              }
            : candidate,
        ),
      }
      if (item.area === "connect" && item.personId)
        next = {
          ...next,
          people: next.people.map((candidate) =>
            candidate.id === item.personId ? { ...candidate, lastConnected: today() } : candidate,
          ),
        }
      if (item.area === "reflect" && journal.trim())
        next = {
          ...next,
          journal: [{ id: uid(), title: item.title, body: journal.trim(), date: today() }, ...next.journal],
        }
      return next
    })
    celebrateDone(
      item.area === "connect" && person ? `Time with ${person.name}` : item.title,
      item.area,
    )
    onClose()
  }

  let body: ReactNode = null
  if (item.kind) {
    body = (
      <>
        {(item.details ?? []).length > 0 && (
          <ul className="plan-sheet__details">
            {item.details!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {item.workout?.length ? <PlannedWorkoutList workout={item.workout} /> : null}
        {open && (
          <ActivityButtons
            item={item}
            onActivity={(id, mode) => {
              onClose()
              onActivity(id, mode)
            }}
            onSkip={(id) => {
              skipItem(update, id)
              onClose()
            }}
          />
        )}
      </>
    )
  } else if (item.area === "connect") {
    body = (
      <>
        <label className="plan-sheet__field">
          <span>
            <Users size={15} /> Who is it with?
          </span>
          <select value={item.personId ?? ""} onChange={(event) => patch({ personId: event.target.value || undefined })}>
            <option value="">Not linked</option>
            {state.people.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        {person?.note && <p className="capture-disclaimer">Remember: {person.note}</p>}
        {open && (
          <label className="plan-sheet__field">
            <span>How was it? (optional)</span>
            <input value={howItWent} onChange={(event) => setHowItWent(event.target.value)} placeholder="A line to remember it by" />
          </label>
        )}
      </>
    )
  } else if (item.area === "reflect") {
    body = open ? (
      <>
        <label className="plan-sheet__field">
          <span>A few lines (optional, saved to your journal)</span>
          <textarea rows={4} value={journal} onChange={(event) => setJournal(event.target.value)} />
        </label>
        <DictateButton onText={(text) => setJournal((current) => (current ? `${current} ${text}` : text))} />
      </>
    ) : null
  } else if (item.area === "create") {
    body = project ? (
      <div className="plan-sheet__link">
        <p>
          A step of <strong>{project.title}</strong>
          {" · "}
          {projectSteps(project).filter((step) => step.done).length} of {projectSteps(project).length} steps done
        </p>
        <Button variant="secondary" onClick={() => { onClose(); onOpenSpace("create") }}>
          Open project
        </Button>
      </div>
    ) : state.projects.some((candidate) => candidate.stage !== "Complete") ? (
      <label className="plan-sheet__field">
        <span>Is this part of something you’re making?</span>
        <select
          value=""
          onChange={(event) => {
            const projectId = event.target.value
            if (!projectId) return
            const stepId = uid()
            update(
              (current) => ({
                ...current,
                projects: current.projects.map((candidate) =>
                  candidate.id === projectId
                    ? { ...candidate, steps: [...projectSteps(candidate), { id: stepId, title: item.title, done: item.status === "complete" }] }
                    : candidate,
                ),
                plan: current.plan.map((candidate) =>
                  candidate.id === item.id ? { ...candidate, projectId, stepId } : candidate,
                ),
              }),
              "Linked. It now counts as a step of that project.",
            )
          }}
        >
          <option value="">Link to a project…</option>
          {state.projects
            .filter((candidate) => candidate.stage !== "Complete")
            .map((candidate) => (
              <option value={candidate.id} key={candidate.id}>
                {candidate.title}
              </option>
            ))}
        </select>
      </label>
    ) : null
  } else if (item.area === "money") {
    body = (
      <Button variant="secondary" icon={BookOpen} onClick={() => { onClose(); onOpenSpace("money") }}>
        Open Investing Lab
      </Button>
    )
  } else if (item.area === "home") {
    const steps = item.steps ?? []
    body = (
      <div className="step-list">
        <ol>
          {steps.map((step, index) => (
            <li key={step.id} className={step.complete ? "is-done" : ""}>
              <div className="step-list__row">
                <button
                  type="button"
                  className="step-list__check"
                  aria-pressed={step.complete}
                  aria-label={`Mark “${step.title}” ${step.complete ? "not done" : "done"}`}
                  onClick={() =>
                    patch({ steps: steps.map((candidate) => (candidate.id === step.id ? { ...candidate, complete: !candidate.complete } : candidate)) })
                  }
                >
                  {step.complete ? <Check size={17} /> : index + 1}
                </button>
                <div className="step-list__text">
                  <strong>{step.title}</strong>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <form
          className="step-list__add"
          onSubmit={(event) => {
            event.preventDefault()
            if (!stepTitle.trim()) return
            patch({ steps: [...steps, { id: uid(), title: stepTitle.trim(), complete: false }] })
            setStepTitle("")
          }}
        >
          <input value={stepTitle} onChange={(event) => setStepTitle(event.target.value)} placeholder="Add a small step (optional)" aria-label="New step" />
          <Button type="submit" variant="secondary" icon={Plus}>
            Add
          </Button>
        </form>
      </div>
    )
  } else if (item.area === "move" && open) {
    body = (
      <div className="plan-sheet__field">
        <span>
          <Dumbbell size={15} /> What kind of movement is it?
        </span>
        <div className="chip-group">
          <div>
            {EXERCISE.map((kind) => (
              <button
                type="button"
                key={kind}
                onClick={() =>
                  patch(
                    { kind, intensity: kind === "walk" ? "light" : "moderate" },
                    "Set up as a movement session. Start it when you’re ready.",
                  )
                }
              >
                {kind === "gym" ? "Gym / strength" : kind[0].toUpperCase() + kind.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Modal
      title={editing ? `Edit: ${item.title}` : item.title}
      eyebrow={`${areaMeta[item.area].label} · ${formatDate(item.date, { weekday: "long", day: "numeric", month: "short" })}${item.time ? ` · ${item.time}` : ""}`}
      onClose={onClose}
    >
      {editing ? (
        <EditForm
          item={item}
          plan={state.plan}
          series={series}
          onCancel={() => setEditing(false)}
          onSave={(changes, options) => {
            const repeatChanged =
              options.repeat !== (series?.frequency ?? "") || (options.until ?? "") !== (series?.until ?? "")
            const template = (from: PlanItem) => {
              const { id: _id, date: _date, status: _status, log: _log, seriesId: _seriesId, ...rest } = { ...from, ...changes }
              return rest
            }
            const start = changes.date ?? item.date
            if (!series && options.repeat) {
              // Turn a one-off into a repeating plan starting from this one.
              update(
                (current) =>
                  createSeries(
                    { ...current, plan: current.plan.filter((candidate) => candidate.id !== item.id) },
                    template(item),
                    options.repeat as RepeatFrequency,
                    start,
                    options.until,
                  ).state,
                `Now repeats ${REPEAT_LABELS[options.repeat].toLowerCase()}.`,
              )
              onClose()
              return
            }
            if (series && options.scope === "future") {
              if (repeatChanged) {
                update((current) => {
                  const ended = endSeriesBefore(current, series.id, item.date)
                  if (!options.repeat)
                    return { ...ended, plan: [...ended.plan, { ...item, ...changes, seriesId: undefined, date: start }] }
                  return createSeries(ended, template(item), options.repeat, start, options.until, { routineId: series.routineId }).state
                }, options.repeat ? "Repeat updated from this one on." : "No longer repeats after this.")
                onClose()
                return
              }
              update((current) => editFuture(current, item, changes), "Updated this and future ones.")
              setEditing(false)
              return
            }
            patch(changes, "Changes saved.")
            setEditing(false)
          }}
          onDelete={(scope) => {
            update(
              (current) =>
                series
                  ? scope === "future"
                    ? endSeriesBefore(current, series.id, item.date)
                    : skipOccurrence(current, item)
                  : { ...current, plan: current.plan.filter((candidate) => candidate.id !== item.id) },
              scope === "future" ? "Removed this and future ones." : "Removed from your plan.",
            )
            onClose()
          }}
        />
      ) : (
        <div className="plan-sheet">
          <div className="plan-sheet__meta">
            <StatusBadge item={item} />
            {item.duration && <span>{item.duration} min</span>}
            {series && <span className="repeat-badge">↻ {REPEAT_LABELS[series.frequency]}</span>}
            <span>{item.mode === "fixed" ? "Fixed" : item.mode === "maybe" ? "Optional" : "Flexible"}</span>
            <button type="button" className="text-link" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit
            </button>
          </div>
          <p className="plan-sheet__purpose">{PURPOSE[item.area]}</p>
          {goal && (
            <p className="coach-goal">
              <Sparkles size={15} /> Towards: {goal.title}
            </p>
          )}
          {item.note && <p className="plan-sheet__note">{item.note}</p>}
          {item.log && (
            <div className="plan-sheet__log">
              <Check size={16} />
              <span>
                <strong>{item.log.summary}</strong>
                <small>
                  {formatDate(item.log.completedAt.slice(0, 10), { day: "numeric", month: "short" })}
                  {item.log.duration ? ` · ${item.log.duration} min` : ""}
                  {item.log.note ? ` · ${item.log.note}` : ""}
                </small>
              </span>
            </div>
          )}
          {body}
          <div className="plan-sheet__actions">
            {open && !item.kind && (
              <>
                <Button icon={Check} onClick={markDone}>
                  Done
                </Button>
                <Button
                  variant="ghost"
                  icon={X}
                  onClick={() => {
                    patch({ status: "let-go" }, "Let go. Nothing needs to be made up.")
                    onClose()
                  }}
                >
                  Let it go
                </Button>
              </>
            )}
            {!open && (
              <Button
                variant="ghost"
                icon={RotateCcw}
                onClick={() => patch({ status: "planned", log: undefined }, "Reopened.")}
              >
                Reopen
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
