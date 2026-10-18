import { CalendarPlus, Check, Dumbbell, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { StepScheduler } from "./GoalProjectViews"
import { strengthHistory } from "./training"
export { recordToExercises } from "./training"
import { PlannedWorkoutList, WorkoutEditor } from "./TrainingViews"
import type { AppState, Effort, LoggedSet, PlanItem, PlannedExercise, WorkoutRecord, WorkoutTemplate } from "./types"
import { Button, formatDate, Modal, today, uid } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

export function gymPlanItem(template: WorkoutTemplate, date: string, time?: string, duration = 40): PlanItem {
  return {
    id: uid(),
    title: template.name,
    area: "move",
    kind: "gym",
    intensity: "moderate",
    date,
    time,
    duration,
    mode: "flexible",
    status: "planned",
    goalId: "goal-strength",
    workout: template.exercises,
    details: ["One of your workouts. Edit the exercises any time."],
  }
}

// ---------------------------------------------------------------------------
// My workouts: create, edit, delete, and add to a day
// ---------------------------------------------------------------------------

export function MyWorkouts({ state, update }: { state: AppState; update: Update }) {
  const templates = state.workoutTemplates ?? []
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [name, setName] = useState("")
  const [scheduling, setScheduling] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const saveTemplate = (id: string | null, exercises: PlannedExercise[]) => {
    if (!name.trim() || !exercises.length) return
    update(
      (current) => ({
        ...current,
        workoutTemplates: id
          ? (current.workoutTemplates ?? []).map((item) => (item.id === id ? { ...item, name: name.trim(), exercises } : item))
          : [...(current.workoutTemplates ?? []), { id: uid(), name: name.trim(), exercises }],
      }),
      "Workout saved.",
    )
    setEditing(null)
  }

  return (
    <section className="my-workouts">
      <div className="section-heading">
        <div>
          <p className="eyebrow">My workouts</p>
          <h3>Pre-planned sessions you can reuse</h3>
        </div>
        {editing === null && (
          <Button
            variant="secondary"
            icon={Plus}
            onClick={() => {
              setName("")
              setEditing("new")
            }}
          >
            New workout
          </Button>
        )}
      </div>
      {editing !== null && (
        <div className="my-workouts__editor">
          <label>
            <span>Workout name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Lower body A" autoFocus />
          </label>
          <WorkoutEditor
            workout={editing === "new" ? [] : (templates.find((item) => item.id === editing)?.exercises ?? [])}
            onCancel={() => setEditing(null)}
            onSave={(exercises) => saveTemplate(editing === "new" ? null : editing, exercises)}
          />
          {!name.trim() && <p className="capture-disclaimer">Give it a name to save.</p>}
        </div>
      )}
      {templates.length === 0 && editing === null && (
        <p className="capture-disclaimer">
          No saved workouts yet. Create one here, or tick “Save as one of my workouts” after logging a session.
        </p>
      )}
      <ul className="my-workouts__list">
        {templates.map((template) => (
          <li key={template.id}>
            <div className="my-workouts__row">
              <button type="button" className="my-workouts__title" onClick={() => setOpen(open === template.id ? null : template.id)}>
                <Dumbbell size={17} />
                <span>
                  <strong>{template.name}</strong>
                  <small>{template.exercises.map((exercise) => exercise.name).join(", ")}</small>
                </span>
              </button>
              <div className="inline-actions">
                <Button variant="secondary" icon={CalendarPlus} onClick={() => setScheduling(scheduling === template.id ? null : template.id)}>
                  Add to a day
                </Button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setName(template.name)
                    setEditing(template.id)
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  type="button"
                  className="text-link plan-edit__delete-link"
                  onClick={() =>
                    window.confirm(`Delete “${template.name}”? Planned sessions already in your calendar stay.`) &&
                    update(
                      (current) => ({ ...current, workoutTemplates: (current.workoutTemplates ?? []).filter((item) => item.id !== template.id) }),
                      "Workout deleted.",
                    )
                  }
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
            {open === template.id && <PlannedWorkoutList workout={template.exercises} />}
            {scheduling === template.id && (
              <StepScheduler
                title={template.name}
                plan={state.plan}
                onCancel={() => setScheduling(null)}
                onSchedule={(date, time, duration) => {
                  update(
                    (current) => ({ ...current, plan: [...current.plan, gymPlanItem(template, date, time, duration)] }),
                    `${template.name} added to ${date === today() ? "today" : formatDate(date, { weekday: "long" })}.`,
                  )
                  setScheduling(null)
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Edit or delete a log after the fact
// ---------------------------------------------------------------------------

const EFFORTS: [Effort, string][] = [
  ["easy", "Easy"],
  ["comfortable", "Comfortable"],
  ["hard", "Hard"],
  ["very-hard", "Very hard"],
]

export function LogEditor({ itemId, state, update, onClose }: { itemId: string; state: AppState; update: Update; onClose: () => void }) {
  const item = state.plan.find((candidate) => candidate.id === itemId)
  const record = (state.workoutHistory ?? []).find((candidate) => candidate.id === item?.log?.workoutId)
  const [summary, setSummary] = useState(item?.log?.summary ?? "")
  const [duration, setDuration] = useState(item?.log?.duration ? String(item.log.duration) : "")
  const [effort, setEffort] = useState<Effort | "">(item?.log?.effort ?? "")
  const [note, setNote] = useState(item?.log?.note ?? "")
  const [exercises, setExercises] = useState<WorkoutRecord["exercises"]>(record?.exercises ?? [])
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!item?.log) return null
  const setSet = (row: number, index: number, patch: Partial<LoggedSet>) =>
    setExercises((current) =>
      current.map((exercise, position) =>
        position === row ? { ...exercise, sets: exercise.sets.map((set, setIndex) => (setIndex === index ? { ...set, ...patch } : set)) } : exercise,
      ),
    )
  const num = (value: string) => (value === "" ? undefined : Math.max(0, Number(value)))

  return (
    <Modal title="Edit log" eyebrow={`${item.title} · ${formatDate(item.date, { weekday: "short", day: "numeric", month: "short" })}`} onClose={onClose}>
      <form
        className="plan-edit"
        onSubmit={(event) => {
          event.preventDefault()
          update(
            (current) => ({
              ...current,
              plan: current.plan.map((candidate) =>
                candidate.id === item.id
                  ? {
                      ...candidate,
                      log: {
                        ...candidate.log!,
                        summary: summary.trim() || candidate.title,
                        duration: duration ? Number(duration) : undefined,
                        effort: effort || undefined,
                        note: note.trim() || undefined,
                      },
                    }
                  : candidate,
              ),
              workoutHistory: (current.workoutHistory ?? []).map((candidate) =>
                candidate.id === record?.id
                  ? { ...candidate, exercises, effort: effort || undefined, duration: duration ? Number(duration) : undefined, note: note.trim() || undefined }
                  : candidate,
              ),
            }),
            "Log updated.",
          )
          onClose()
        }}
      >
        <label>
          <span>What I did</span>
          <input value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label>
          <span>Minutes</span>
          <input type="number" min={0} inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} />
        </label>
        <fieldset className="chip-group">
          <legend>How hard it felt</legend>
          <div>
            {EFFORTS.map(([key, label]) => (
              <button type="button" key={key} className={effort === key ? "is-selected" : ""} aria-pressed={effort === key} onClick={() => setEffort(key)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        {exercises.map((exercise, row) => (
          <fieldset className="workout-editor__row" key={`${exercise.id}-${row}`}>
            <legend>{exercise.name}</legend>
            {exercise.sets.map((set, index) => (
              <div className="workout__set" key={index}>
                <span>Set {index + 1}</span>
                <label>
                  <input type="number" min={0} inputMode="numeric" value={set.seconds ?? set.reps ?? ""} onChange={(event) => setSet(row, index, set.seconds !== undefined ? { seconds: num(event.target.value) } : { reps: num(event.target.value) })} aria-label={`${exercise.name} set ${index + 1} ${set.seconds !== undefined ? "seconds" : "reps"}`} />
                  {set.seconds !== undefined ? "sec" : "reps"}
                </label>
                <label>
                  <input type="number" min={0} step={0.5} inputMode="decimal" value={set.weight ?? ""} onChange={(event) => setSet(row, index, { weight: num(event.target.value) })} aria-label={`${exercise.name} set ${index + 1} weight in kg`} />
                  kg
                </label>
                <button type="button" className="workout__done" aria-pressed={set.done} aria-label={`Set ${index + 1} done`} onClick={() => setSet(row, index, { done: !set.done })}>
                  <Check size={16} />
                </button>
              </div>
            ))}
          </fieldset>
        ))}
        <label>
          <span>Note</span>
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="inline-actions">
          <Button type="submit" icon={Check}>
            Save log
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {confirmDelete ? (
          <div className="plan-edit__delete">
            <p>Delete this log? The plan goes back to not done.</p>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                update(
                  (current) => ({
                    ...current,
                    plan: current.plan.map((candidate) => (candidate.id === item.id ? { ...candidate, status: "planned" as const, log: undefined } : candidate)),
                    workoutHistory: (current.workoutHistory ?? []).filter((candidate) => candidate.id !== record?.id),
                  }),
                  "Log deleted.",
                )
                onClose()
              }}
            >
              Delete log
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <button type="button" className="text-link plan-edit__delete-link" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} /> Delete log
          </button>
        )}
      </form>
    </Modal>
  )
}

// Best set per session for each exercise, so progress is visible at a glance.
export function StrengthProgress({ state }: { state: AppState }) {
  const rows = strengthHistory(state.workoutHistory ?? [])
  if (!rows.length) return null
  return (
    <section className="strength-progress">
      <p className="eyebrow">Strength progress</p>
      <ul>
        {rows.map((row) => (
          <li key={row.name}>
            <strong>{row.name}</strong>
            <span>
              {[...row.sessions]
                .reverse()
                .map((session) => session.text)
                .join(" → ")}
            </span>
            <small>Last {formatDate(row.sessions[0].date, { day: "numeric", month: "short" })}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}
