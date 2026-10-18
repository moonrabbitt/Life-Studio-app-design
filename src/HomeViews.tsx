import { CalendarPlus, Check, Clock3, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { celebrate } from "./GoalProjectViews"
import { createSeries, editFuture, endSeriesBefore, REPEAT_LABELS } from "./series"
import type { AppState, RepeatFrequency, Routine, Series } from "./types"
import { Button, formatDate, IconButton, Modal, SwipeRow, today, uid, useRemove } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

type Draft = {
  title: string
  inCalendar: boolean
  frequency: RepeatFrequency
  start: string
  time: string
  duration: string
}

const describe = (series: Series | undefined, routine: Routine) => {
  if (!series) return routine.cadence || "Whenever it helps"
  const weekday = formatDate(series.start, { weekday: "long" })
  const when =
    series.frequency === "weekly"
      ? `Every ${weekday}`
      : series.frequency === "fortnightly"
        ? `Every other ${weekday}`
        : series.frequency === "monthly"
          ? `Monthly on the ${formatDate(series.start, { day: "numeric" })}`
          : REPEAT_LABELS[series.frequency]
  return `${when}${series.template.time ? ` · ${series.template.time}` : ""} · in your calendar`
}

function RoutineForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Draft
  onSave: (draft: Draft) => void
  onCancel: () => void
  onDelete?: (removeFuture: boolean) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  return (
    <form
      className="plan-edit routine-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (draft.title.trim()) onSave({ ...draft, title: draft.title.trim() })
      }}
    >
      <label>
        <span>Routine</span>
        <input value={draft.title} onChange={(event) => set("title", event.target.value)} required autoFocus placeholder="e.g. Laundry, plants, Sunday admin" />
      </label>
      <label className="sync-replace">
        <input type="checkbox" checked={draft.inCalendar} onChange={(event) => set("inCalendar", event.target.checked)} />
        <span>
          Put it in my calendar on a repeat
          <small>It shows in Plan and Today; ticking it there marks the routine done.</small>
        </span>
      </label>
      {draft.inCalendar && (
        <>
          <div className="plan-edit__row">
            <label>
              <span>Repeats</span>
              <select value={draft.frequency} onChange={(event) => set("frequency", event.target.value as RepeatFrequency)}>
                {(Object.keys(REPEAT_LABELS) as RepeatFrequency[]).map((key) => (
                  <option value={key} key={key}>
                    {REPEAT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Starting</span>
              <input type="date" value={draft.start} min={today()} onChange={(event) => event.target.value && set("start", event.target.value)} />
            </label>
          </div>
          <div className="plan-edit__row">
            <label>
              <span>Time (optional)</span>
              <input type="time" value={draft.time} onChange={(event) => set("time", event.target.value)} />
            </label>
            <label>
              <span>Minutes</span>
              <input type="number" min={5} step={5} inputMode="numeric" value={draft.duration} onChange={(event) => set("duration", event.target.value)} />
            </label>
          </div>
          {(draft.frequency === "weekly" || draft.frequency === "fortnightly") && (
            <p className="capture-disclaimer">Repeats on {formatDate(draft.start, { weekday: "long" })}s.</p>
          )}
        </>
      )}
      <div className="inline-actions">
        <Button type="submit" icon={Check}>
          Save routine
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {onDelete &&
        (confirmDelete ? (
          <div className="plan-edit__delete">
            <p>Delete this routine?</p>
            <Button variant="danger" icon={Trash2} onClick={() => onDelete(true)}>
              Delete and remove from calendar
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <button type="button" className="text-link plan-edit__delete-link" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} /> Delete routine
          </button>
        ))}
    </form>
  )
}

export function HomeSpace({ state, update, close }: { state: AppState; update: Update; close: () => void }) {
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const remove = useRemove()
  const seriesFor = (routine: Routine) => (state.series ?? []).find((series) => series.id === routine.seriesId)
  const blank: Draft = { title: "", inCalendar: true, frequency: "weekly", start: today(), time: "", duration: "20" }

  const save = (routine: Routine | undefined, draft: Draft) => {
    update((current) => {
      const id = routine?.id ?? uid()
      const template = {
        title: draft.title,
        area: "home" as const,
        mode: "flexible" as const,
        time: draft.time || undefined,
        duration: Number(draft.duration) || undefined,
        details: ["A routine. Ticking it here marks it done in Home & routine."],
      }
      let next: AppState = routine
        ? { ...current, routines: current.routines.map((item) => (item.id === id ? { ...item, title: draft.title } : item)) }
        : { ...current, routines: [...current.routines, { id, title: draft.title, cadence: "Whenever it helps", completedDates: [] }] }
      const existing = routine?.seriesId ? (next.series ?? []).find((series) => series.id === routine.seriesId) : undefined
      if (!draft.inCalendar) {
        if (existing) next = endSeriesBefore(next, existing.id, today())
        return { ...next, routines: next.routines.map((item) => (item.id === id ? { ...item, seriesId: undefined } : item)) }
      }
      const rhythmChanged = !existing || existing.frequency !== draft.frequency || existing.start !== draft.start
      if (existing && !rhythmChanged) {
        const first = next.plan.find((item) => item.seriesId === existing.id && item.date >= today())
        return first ? editFuture(next, first, template) : next
      }
      if (existing) next = endSeriesBefore(next, existing.id, draft.start < today() ? today() : draft.start)
      const created = createSeries(next, template, draft.frequency, draft.start, undefined, { routineId: id })
      return {
        ...created.state,
        routines: created.state.routines.map((item) => (item.id === id ? { ...item, seriesId: created.series.id } : item)),
      }
    }, draft.inCalendar ? "Routine saved and repeating in your calendar." : "Routine saved.")
    setEditing(null)
  }

  return (
    <Modal title="Home & routine" eyebrow="Tend to ordinary life" onClose={close} wide>
      <div className="feature-topline">
        <p>
          <strong>Practical care, without a perfect routine.</strong> Put routines in your
          calendar on a repeat, tick them off here or in Plan. There are no streaks.
        </p>
        {editing === null && (
          <Button icon={Plus} onClick={() => setEditing("new")}>
            Add routine
          </Button>
        )}
      </div>
      {editing === "new" && <RoutineForm initial={blank} onCancel={() => setEditing(null)} onSave={(draft) => save(undefined, draft)} />}
      <div className="routine-list">
        {state.routines.map((routine) => {
          const series = seriesFor(routine)
          if (editing === routine.id)
            return (
              <RoutineForm
                key={routine.id}
                initial={{
                  title: routine.title,
                  inCalendar: !!series,
                  frequency: series?.frequency ?? "weekly",
                  start: series && series.start >= today() ? series.start : today(),
                  time: series?.template.time ?? "",
                  duration: String(series?.template.duration ?? 20),
                }}
                onCancel={() => setEditing(null)}
                onSave={(draft) => save(routine, draft)}
                onDelete={() => {
                  update((current) => {
                    const next = series ? endSeriesBefore(current, series.id, today()) : current
                    return { ...next, routines: next.routines.filter((item) => item.id !== routine.id) }
                  }, "Routine deleted.")
                  setEditing(null)
                }}
              />
            )
          const done = routine.completedDates.includes(today())
          const todays = series && state.plan.find((item) => item.seriesId === series.id && item.date === today())
          return (
            <SwipeRow
              key={routine.id}
              className="swipe--card"
              actions={[
                {
                  label: "Delete",
                  icon: Trash2,
                  tone: "danger",
                  onClick: () =>
                    remove((current) => {
                      const next = series ? endSeriesBefore(current, series.id, today()) : current
                      return { ...next, routines: next.routines.filter((item) => item.id !== routine.id) }
                    }, `Deleted “${routine.title}”${series ? " and its future calendar entries" : ""}.`),
                },
              ]}
            >
            <article className={done ? "is-complete" : ""}>
              <button
                type="button"
                className="routine-check"
                aria-label={done ? `Mark “${routine.title}” not done today` : `Mark “${routine.title}” done today`}
                aria-pressed={done}
                onClick={() => {
                  update((current) => ({
                    ...current,
                    routines: current.routines.map((item) =>
                      item.id === routine.id
                        ? { ...item, completedDates: done ? item.completedDates.filter((date) => date !== today()) : [...item.completedDates, today()] }
                        : item,
                    ),
                    plan: todays
                      ? current.plan.map((item) =>
                          item.id === todays.id
                            ? done
                              ? { ...item, status: "planned" as const, log: undefined }
                              : { ...item, status: "complete" as const, log: { completedAt: new Date().toISOString(), summary: item.title } }
                            : item,
                        )
                      : current.plan,
                  }))
                  if (!done) celebrate({ title: routine.title, body: "One less thing on your mind." })
                }}
              >
                {done && <Check size={18} />}
              </button>
              <div>
                <h3>{routine.title}</h3>
                <p>{describe(series, routine)}</p>
              </div>
              <IconButton label={`Edit “${routine.title}”`} icon={Pencil} onClick={() => setEditing(routine.id)} />
            </article>
            </SwipeRow>
          )
        })}
      </div>
      <div className="ten-minute-card">
        <Clock3 size={24} />
        <div>
          <h3>Need a ten-minute reset?</h3>
          <p>Clear one surface, collect what belongs elsewhere, then stop.</p>
        </div>
        <Button
          variant="secondary"
          icon={CalendarPlus}
          onClick={() =>
            update(
              (current) => ({
                ...current,
                plan: [
                  ...current.plan,
                  { id: uid(), title: "Ten-minute home reset", area: "home", date: today(), mode: "maybe", duration: 10, status: "planned" },
                ],
              }),
              "A ten-minute reset is on Today.",
            )
          }
        >
          Add to Today
        </Button>
      </div>
    </Modal>
  )
}
