import { CalendarCheck, CalendarPlus, Check, ExternalLink, MapPin, Pencil, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import type { AppState, EventLink, JourneyEvent, PlanItem } from "./types"
import { Button, formatDate, today, uid } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

// Gentle framing: a nervous event is time to prepare, not a clock running down.
export const countdown = (date: string, feeling?: JourneyEvent["feeling"]) => {
  const days = Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) / 86400000)
  if (days < 0) return "passed"
  if (days === 0) return "today"
  const span = days < 14 ? `${days} day${days === 1 ? "" : "s"}` : `${Math.round(days / 7)} weeks`
  if (feeling === "nervous") return `${span} to prepare`
  return `${span} away`
}

const FEELINGS: [NonNullable<JourneyEvent["feeling"]>, string][] = [
  ["excited", "Excited"],
  ["nervous", "Nervous"],
  ["mixed", "Mixed"],
  ["not-sure", "Not sure"],
]

const when = (event: JourneyEvent) =>
  event.dateTBC || !event.date
    ? "Date TBC"
    : event.endDate && event.endDate !== event.date
      ? `${formatDate(event.date, { day: "numeric", month: "short" })} – ${formatDate(event.endDate, { day: "numeric", month: "short", year: "numeric" })}`
      : formatDate(event.date, { weekday: "short", day: "numeric", month: "long", year: "numeric" })

const safeUrl = (value: string) => {
  const url = value.trim()
  if (!url) return ""
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

// The calendar entry for an event: a fixed plan on its start date, carrying its links.
const calendarItem = (event: JourneyEvent, existing?: PlanItem): PlanItem => ({
  id: existing?.id ?? uid(),
  title: event.title,
  area: existing?.area ?? "connect",
  date: event.date!,
  mode: "fixed",
  status: existing?.status === "complete" ? "complete" : "planned",
  eventId: event.id,
  goalId: event.goalId,
  links: event.links,
  note: [event.location, event.endDate && event.endDate !== event.date ? `Until ${formatDate(event.endDate, { weekday: "short", day: "numeric", month: "short" })}` : "", event.note]
    .filter(Boolean)
    .join(" · ") || undefined,
})

function EventForm({
  initial,
  state,
  defaultGoalId,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: JourneyEvent
  defaultGoalId?: string
  state: AppState
  onSave: (event: JourneyEvent, addToCalendar: boolean) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? "")
  const [tbc, setTbc] = useState(initial?.dateTBC ?? false)
  const [date, setDate] = useState(initial?.date ?? "")
  const [endDate, setEndDate] = useState(initial?.endDate ?? "")
  const [location, setLocation] = useState(initial?.location ?? "")
  const [note, setNote] = useState(initial?.note ?? "")
  const [booked, setBooked] = useState(initial?.booked ?? false)
  const [goalId, setGoalId] = useState(initial?.goalId ?? defaultGoalId ?? "")
  const [links, setLinks] = useState<EventLink[]>(initial?.links ?? [])
  const [linkLabel, setLinkLabel] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [calendar, setCalendar] = useState(initial ? !!initial.planItemId : true)
  const [feeling, setFeeling] = useState<JourneyEvent["feeling"]>(initial?.feeling)
  const [hideCountdown, setHideCountdown] = useState(initial?.hideCountdown ?? false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const addLink = () => {
    const url = safeUrl(linkUrl)
    if (!url) return
    setLinks([...links, { label: linkLabel.trim() || new URL(url).hostname.replace(/^www\./, ""), url }])
    setLinkLabel("")
    setLinkUrl("")
  }
  return (
    <form
      className="plan-edit event-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        const pending = safeUrl(linkUrl)
        onSave(
          {
            id: initial?.id ?? uid(),
            title: title.trim(),
            date: tbc ? undefined : date || undefined,
            endDate: tbc ? undefined : endDate || undefined,
            dateTBC: tbc || !date,
            location: location.trim() || undefined,
            note: note.trim() || undefined,
            booked,
            goalId: goalId || undefined,
            links: pending ? [...links, { label: linkLabel.trim() || new URL(pending).hostname.replace(/^www\./, ""), url: pending }] : links,
            planItemId: initial?.planItemId,
            feeling,
            hideCountdown,
          },
          calendar && !tbc && !!date,
        )
      }}
    >
      <label>
        <span>What’s happening?</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus={!initial} placeholder="e.g. Concert at the Roundhouse" />
      </label>
      <label className="sync-replace">
        <input type="checkbox" checked={tbc} onChange={(event) => setTbc(event.target.checked)} />
        <span>Date to be confirmed</span>
      </label>
      {!tbc && (
        <div className="plan-edit__row">
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            <span>Ends (optional)</span>
            <input type="date" value={endDate} min={date || undefined} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
      )}
      <label>
        <span>Where (optional)</span>
        <input value={location} onChange={(event) => setLocation(event.target.value)} />
      </label>
      <div className="event-form__links">
        <span className="project-form__label">Links (tickets, official site…)</span>
        {links.map((link, index) => (
          <div className="event-form__link" key={`${link.url}-${index}`}>
            <a href={link.url} target="_blank" rel="noreferrer">
              {link.label} <ExternalLink size={12} />
            </a>
            <button type="button" className="icon-button" aria-label={`Remove link ${link.label}`} onClick={() => setLinks(links.filter((_, position) => position !== index))}>
              <X size={16} />
            </button>
          </div>
        ))}
        <div className="plan-edit__row">
          <label>
            <span>Link</span>
            <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://…" inputMode="url" />
          </label>
          <label>
            <span>Name (optional)</span>
            <input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Tickets" />
          </label>
        </div>
        <Button variant="secondary" icon={Plus} onClick={addLink} disabled={!linkUrl.trim()}>
          Add link
        </Button>
      </div>
      <label>
        <span>Part of a goal? (optional)</span>
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
        <span>Note (optional)</span>
        <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <fieldset className="chip-group">
        <legend>How do you feel about it? (optional)</legend>
        <div>
          {FEELINGS.map(([key, label]) => (
            <button type="button" key={key} className={feeling === key ? "is-selected" : ""} aria-pressed={feeling === key} onClick={() => setFeeling(feeling === key ? "not-sure" : key)}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="sync-replace">
        <input type="checkbox" checked={hideCountdown} onChange={(event) => setHideCountdown(event.target.checked)} />
        <span>Hide the countdown</span>
      </label>
      <label className="sync-replace">
        <input type="checkbox" checked={booked} onChange={(event) => setBooked(event.target.checked)} />
        <span>Booked / I have a ticket</span>
      </label>
      {!tbc && (
        <label className="sync-replace">
          <input type="checkbox" checked={calendar} onChange={(event) => setCalendar(event.target.checked)} />
          <span>
            Put it in my calendar
            <small>It shows in Plan and on Today on the day, with its links.</small>
          </span>
        </label>
      )}
      <div className="inline-actions">
        <Button type="submit" icon={Check}>
          {initial ? "Save event" : "Add event"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {onDelete &&
        (confirmDelete ? (
          <div className="plan-edit__delete">
            <p>Delete this event? Its calendar entry is removed too.</p>
            <Button variant="danger" icon={Trash2} onClick={onDelete}>
              Delete event
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <button type="button" className="text-link plan-edit__delete-link" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} /> Delete event
          </button>
        ))}
    </form>
  )
}

// Events inside a goal (goalId given), or standalone things to look forward to.
export function EventsList({ state, update, goalId }: { state: AppState; update: Update; goalId?: string }) {
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const goalIds = new Set(state.goals.filter((goal) => goal.status !== "complete").map((goal) => goal.id))
  const events = [...(state.journeyEvents ?? [])]
    .filter((event) => (goalId ? event.goalId === goalId : !event.goalId || !goalIds.has(event.goalId)))
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
  const upcoming = events.filter((event) => !event.date || (event.endDate ?? event.date) >= today())
  const past = events.filter((event) => event.date && (event.endDate ?? event.date) < today())

  const save = (event: JourneyEvent, addToCalendar: boolean) => {
    update((current) => {
      let plan = current.plan
      let planItemId = event.planItemId
      const existing = plan.find((item) => item.id === planItemId)
      if (addToCalendar && event.date) {
        const item = calendarItem(event, existing)
        planItemId = item.id
        plan = existing ? plan.map((candidate) => (candidate.id === item.id ? { ...candidate, ...item } : candidate)) : [...plan, item]
      } else if (existing) {
        plan = plan.filter((candidate) => candidate.id !== existing.id)
        planItemId = undefined
      }
      const saved = { ...event, planItemId }
      const list = current.journeyEvents ?? []
      return {
        ...current,
        plan,
        journeyEvents: list.some((item) => item.id === event.id) ? list.map((item) => (item.id === event.id ? saved : item)) : [...list, saved],
      }
    }, addToCalendar ? "Event saved and in your calendar." : "Event saved.")
    setEditing(null)
  }

  return (
    <div className={`events ${goalId ? "events--in-goal" : ""}`}>
      {!goalId && (
        <div className="events__head">
          <p className="eyebrow">Coming up</p>
          {editing === null && (
            <Button variant="secondary" icon={Plus} onClick={() => setEditing("new")}>
              Add event
            </Button>
          )}
        </div>
      )}
      {editing === "new" && <EventForm state={state} defaultGoalId={goalId} onCancel={() => setEditing(null)} onSave={save} />}
      {!goalId && upcoming.length === 0 && editing === null && (
        <p className="capture-disclaimer">Nothing yet. Add a trip, a gig, a race, anything with a date.</p>
      )}
      <ul className="events__list">
        {upcoming.map((event) =>
          editing === event.id ? (
            <li key={event.id} className="events__editing">
              <EventForm
                initial={event}
                state={state}
                onCancel={() => setEditing(null)}
                onSave={save}
                onDelete={() => {
                  update(
                    (current) => ({
                      ...current,
                      journeyEvents: (current.journeyEvents ?? []).filter((item) => item.id !== event.id),
                      plan: current.plan.filter((item) => item.id !== event.planItemId),
                    }),
                    "Event deleted.",
                  )
                  setEditing(null)
                }}
              />
            </li>
          ) : (
            <li key={event.id}>
              <div className="events__top">
                <div>
                  <strong>{event.title}</strong>
                  <small>{when(event)}</small>
                  {event.location && (
                    <small className="events__where">
                      <MapPin size={12} /> {event.location}
                    </small>
                  )}
                </div>
                {!event.hideCountdown && (
                  <span className={`roadmap__countdown ${event.date ? "" : "is-tbc"} ${event.feeling === "nervous" ? "is-gentle" : ""}`}>
                    {event.date ? countdown(event.date, event.feeling) : "TBC"}
                  </span>
                )}
              </div>
              {event.feeling === "nervous" && (
                <p className="events__reassure">
                  It’s fine to feel nervous. Your plan builds gradually, and you can reassess or change your mind any time.
                </p>
              )}
              {event.note && <p className="events__note">{event.note}</p>}
              <div className="events__meta">
                {event.feeling && <span className="status-badge">{FEELINGS.find(([key]) => key === event.feeling)?.[1]}</span>}
                {event.booked ? <span className="status-badge is-planned">Booked</span> : <span className="status-badge">Not booked</span>}
                {event.planItemId && (
                  <span className="status-badge is-planned">
                    <CalendarCheck size={12} /> In your calendar
                  </span>
                )}
                {!goalId && event.goalId && state.goals.some((goal) => goal.id === event.goalId) && (
                  <span className="events__goal">Part of: {state.goals.find((goal) => goal.id === event.goalId)?.title}</span>
                )}
              </div>
              {event.links.length > 0 && (
                <div className="events__links">
                  {event.links.map((link) => (
                    <a href={link.url} target="_blank" rel="noreferrer" key={link.url}>
                      {link.label} <ExternalLink size={12} />
                    </a>
                  ))}
                </div>
              )}
              <div className="inline-actions">
                {!event.planItemId && event.date && (
                  <Button variant="secondary" icon={CalendarPlus} onClick={() => save(event, true)}>
                    Put in calendar
                  </Button>
                )}
                <button type="button" className="text-link" onClick={() => setEditing(event.id)}>
                  <Pencil size={14} /> Edit
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {goalId && editing === null && (
        <button type="button" className="text-link" onClick={() => setEditing("new")}>
          <Plus size={14} /> Add an event to this goal
        </button>
      )}
      {past.length > 0 && (
        <details className="events__past">
          <summary>Past events ({past.length})</summary>
          <ul>
            {past.map((event) => (
              <li key={event.id}>
                <strong>{event.title}</strong> <small>{when(event)}</small>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
