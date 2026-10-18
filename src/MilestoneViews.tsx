import { CalendarCheck, CalendarPlus, Check, ExternalLink, MapPin, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { countdown, FEELINGS, safeUrl, when } from "./EventsViews"
import { celebrate, StepScheduler } from "./GoalProjectViews"
import type { AppState, EventLink, Goal, Milestone, MilestoneEvent, PlanItem } from "./types"
import { Button, formatDate, IconButton, today, uid } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

// The next date a goal is heading for: its own date, or its next dated milestone.
export function goalDate(goal: Goal) {
  if (goal.date) return goal.date
  return goal.milestones
    .filter((milestone) => !milestone.completedAt && milestone.event?.date && milestone.event.date >= today())
    .map((milestone) => milestone.event!.date!)
    .sort()[0]
}

export const goalFeeling = (goal: Goal) => goal.milestones.find((milestone) => milestone.event?.feeling && !milestone.completedAt)?.event?.feeling

// A dated milestone's calendar entry; completing it ticks the milestone.
const calendarEntry = (goal: Goal, milestone: Milestone, existing?: PlanItem): PlanItem => {
  const event = milestone.event!
  return {
    id: existing?.id ?? uid(),
    title: milestone.title === goal.title ? milestone.title : `${milestone.title} · ${goal.title}`,
    area: goal.area,
    date: event.date!,
    mode: "fixed",
    status: existing?.status ?? "planned",
    goalId: goal.id,
    milestoneId: milestone.id,
    links: event.links,
    note:
      [event.location, event.endDate && event.endDate !== event.date ? `Until ${formatDate(event.endDate, { weekday: "short", day: "numeric", month: "short" })}` : "", event.note]
        .filter(Boolean)
        .join(" · ") || undefined,
  }
}

function MilestoneForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Milestone
  onSave: (milestone: Milestone, addToCalendar: boolean) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const event = initial?.event
  const [title, setTitle] = useState(initial?.title ?? "")
  const [isEvent, setIsEvent] = useState(!!event)
  const [tbc, setTbc] = useState(event?.dateTBC ?? false)
  const [date, setDate] = useState(event?.date ?? "")
  const [endDate, setEndDate] = useState(event?.endDate ?? "")
  const [location, setLocation] = useState(event?.location ?? "")
  const [note, setNote] = useState(event?.note ?? "")
  const [booked, setBooked] = useState(event?.booked ?? false)
  const [feeling, setFeeling] = useState<MilestoneEvent["feeling"]>(event?.feeling)
  const [hideCountdown, setHideCountdown] = useState(event?.hideCountdown ?? false)
  const [links, setLinks] = useState<EventLink[]>(event?.links ?? [])
  const [linkUrl, setLinkUrl] = useState("")
  const [linkLabel, setLinkLabel] = useState("")
  const [calendar, setCalendar] = useState(event ? !!event.planItemId : true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pendingLink = () => {
    const url = safeUrl(linkUrl)
    return url ? [{ label: linkLabel.trim() || new URL(url).hostname.replace(/^www\./, ""), url }] : []
  }
  return (
    <form
      className="plan-edit milestone-form"
      onSubmit={(submit) => {
        submit.preventDefault()
        if (!title.trim()) return
        onSave(
          {
            id: initial?.id ?? uid(),
            title: title.trim(),
            completedAt: initial?.completedAt,
            event: isEvent
              ? {
                  date: tbc ? undefined : date || undefined,
                  endDate: tbc ? undefined : endDate || undefined,
                  dateTBC: tbc || !date,
                  location: location.trim() || undefined,
                  note: note.trim() || undefined,
                  booked,
                  feeling,
                  hideCountdown,
                  links: [...links, ...pendingLink()],
                  planItemId: event?.planItemId,
                }
              : undefined,
          },
          isEvent && calendar && !tbc && !!date,
        )
      }}
    >
      <label>
        <span>Milestone</span>
        <input value={title} onChange={(change) => setTitle(change.target.value)} required autoFocus={!initial} placeholder="e.g. Run 5k without stopping" />
      </label>
      <label className="sync-replace">
        <input type="checkbox" checked={isEvent} onChange={(change) => setIsEvent(change.target.checked)} />
        <span>
          This happens on a date (an event)
          <small>Race day, the camp, a performance… adds date, place, links and your calendar.</small>
        </span>
      </label>
      {isEvent && (
        <div className="milestone-form__event">
          <label className="sync-replace">
            <input type="checkbox" checked={tbc} onChange={(change) => setTbc(change.target.checked)} />
            <span>Date to be confirmed</span>
          </label>
          {!tbc && (
            <div className="plan-edit__row">
              <label>
                <span>Date</span>
                <input type="date" value={date} onChange={(change) => setDate(change.target.value)} />
              </label>
              <label>
                <span>Ends (optional)</span>
                <input type="date" value={endDate} min={date || undefined} onChange={(change) => setEndDate(change.target.value)} />
              </label>
            </div>
          )}
          <label>
            <span>Where (optional)</span>
            <input value={location} onChange={(change) => setLocation(change.target.value)} />
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
                <input value={linkUrl} onChange={(change) => setLinkUrl(change.target.value)} placeholder="https://…" inputMode="url" />
              </label>
              <label>
                <span>Name (optional)</span>
                <input value={linkLabel} onChange={(change) => setLinkLabel(change.target.value)} placeholder="Tickets" />
              </label>
            </div>
            <Button
              variant="secondary"
              icon={Plus}
              disabled={!linkUrl.trim()}
              onClick={() => {
                setLinks([...links, ...pendingLink()])
                setLinkUrl("")
                setLinkLabel("")
              }}
            >
              Add link
            </Button>
          </div>
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
          <label>
            <span>Note (optional)</span>
            <textarea rows={2} value={note} onChange={(change) => setNote(change.target.value)} />
          </label>
          <label className="sync-replace">
            <input type="checkbox" checked={booked} onChange={(change) => setBooked(change.target.checked)} />
            <span>Booked / I have a ticket</span>
          </label>
          <label className="sync-replace">
            <input type="checkbox" checked={hideCountdown} onChange={(change) => setHideCountdown(change.target.checked)} />
            <span>Hide the countdown</span>
          </label>
          {!tbc && (
            <label className="sync-replace">
              <input type="checkbox" checked={calendar} onChange={(change) => setCalendar(change.target.checked)} />
              <span>
                Put it in my calendar
                <small>Ticking it in Plan on the day ticks this milestone too.</small>
              </span>
            </label>
          )}
        </div>
      )}
      <div className="inline-actions">
        <Button type="submit" icon={Check}>
          {initial ? "Save milestone" : "Add milestone"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {onDelete &&
        (confirmDelete ? (
          <div className="plan-edit__delete">
            <p>Delete this milestone?</p>
            <Button variant="danger" icon={Trash2} onClick={onDelete}>
              Delete milestone
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <button type="button" className="text-link plan-edit__delete-link" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} /> Delete milestone
          </button>
        ))}
    </form>
  )
}

// A goal's milestones: tick to celebrate, add (optionally as an event), edit, delete, add to a day.
export function GoalMilestones({
  goal,
  state,
  update,
  limit,
  onSeeAll,
}: {
  goal: Goal
  state: AppState
  update: Update
  limit?: number
  onSeeAll?: () => void
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [scheduling, setScheduling] = useState<string | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const milestones = goal.milestones
  const shown = limit ? milestones.slice(0, limit) : milestones
  const word = goal.scale === "big" ? "milestone" : "step"

  const setGoal = (recipe: (goal: Goal) => Goal, plan?: (plan: PlanItem[]) => PlanItem[], message?: string) =>
    update(
      (current) => ({
        ...current,
        goals: current.goals.map((item) => (item.id === goal.id ? recipe(item) : item)),
        plan: plan ? plan(current.plan) : current.plan,
      }),
      message,
    )

  const save = (milestone: Milestone, addToCalendar: boolean) => {
    update((current) => {
      const currentGoal = current.goals.find((item) => item.id === goal.id)!
      let plan = current.plan
      let saved = milestone
      const existing = plan.find((item) => item.id === milestone.event?.planItemId)
      if (addToCalendar && milestone.event?.date) {
        const entry = calendarEntry(currentGoal, milestone, existing)
        plan = existing ? plan.map((item) => (item.id === entry.id ? { ...item, ...entry } : item)) : [...plan, entry]
        saved = { ...milestone, event: { ...milestone.event, planItemId: entry.id } }
      } else if (existing) {
        plan = plan.filter((item) => item.id !== existing.id)
        if (saved.event) saved = { ...saved, event: { ...saved.event, planItemId: undefined } }
      }
      const list = currentGoal.milestones
      return {
        ...current,
        plan,
        goals: current.goals.map((item) =>
          item.id === goal.id
            ? { ...item, milestones: list.some((m) => m.id === saved.id) ? list.map((m) => (m.id === saved.id ? saved : m)) : [...list, saved] }
            : item,
        ),
      }
    }, addToCalendar ? "Milestone saved and in your calendar." : "Milestone saved.")
    setEditing(null)
  }

  const toggle = (milestone: Milestone) => {
    const done = !milestone.completedAt
    setGoal(
      (item) => ({
        ...item,
        milestones: item.milestones.map((m) => (m.id === milestone.id ? { ...m, completedAt: done ? new Date().toISOString() : undefined } : m)),
      }),
      (plan) =>
        plan.map((item) =>
          item.goalId === goal.id && item.milestoneId === milestone.id
            ? done && item.status !== "complete"
              ? { ...item, status: "complete", log: { completedAt: new Date().toISOString(), summary: item.title } }
              : !done && item.status === "complete"
                ? { ...item, status: "planned", log: undefined }
                : item
            : item,
        ),
    )
    if (done) {
      const remaining = milestones.filter((m) => !m.completedAt && m.id !== milestone.id).length
      celebrate({
        title: milestone.title,
        body: milestone.event ? "You showed up for it. That takes courage." : remaining ? `${remaining} ${word}${remaining === 1 ? "" : "s"} to go on ${goal.title}.` : `Every ${word} of ${goal.title} done.`,
        big: !!milestone.event || !remaining,
      })
    }
  }

  return (
    <div className="goal-milestones">
      {milestones.length === 0 && editing !== "new" && <p className="capture-disclaimer">No {word}s yet. Add the first one, however small.</p>}
      <ol>
        {shown.map((milestone, index) => {
          const event = milestone.event
          const planned = state.plan.find(
            (item) => item.goalId === goal.id && item.milestoneId === milestone.id && (item.status === "planned" || item.status === "proposed"),
          )
          if (editing === milestone.id)
            return (
              <li key={milestone.id} className="goal-milestones__editing">
                <MilestoneForm
                  initial={milestone}
                  onCancel={() => setEditing(null)}
                  onSave={save}
                  onDelete={() => {
                    setGoal(
                      (item) => ({ ...item, milestones: item.milestones.filter((m) => m.id !== milestone.id) }),
                      (plan) => plan.filter((item) => item.id !== milestone.event?.planItemId),
                      "Milestone deleted.",
                    )
                    setEditing(null)
                  }}
                />
              </li>
            )
          return (
            <li key={milestone.id} className={`${milestone.completedAt ? "is-done" : ""} ${event ? "is-event" : ""}`}>
              <div className="step-list__row">
                <button
                  type="button"
                  className="step-list__check"
                  aria-pressed={!!milestone.completedAt}
                  aria-label={milestone.completedAt ? `Mark “${milestone.title}” not done` : `Mark “${milestone.title}” done`}
                  onClick={() => toggle(milestone)}
                >
                  {milestone.completedAt ? <Check size={17} /> : index + 1}
                </button>
                <div className="step-list__text">
                  <strong>{milestone.title}</strong>
                  {milestone.completedAt && (
                    <small>Celebrated {formatDate(milestone.completedAt.slice(0, 10), { day: "numeric", month: "short" })}</small>
                  )}
                  {event && (
                    <small className="goal-milestones__when">
                      {when(event)}
                      {event.location && (
                        <>
                          {" · "}
                          <MapPin size={11} /> {event.location}
                        </>
                      )}
                    </small>
                  )}
                  {event?.date && !event.hideCountdown && !milestone.completedAt && (
                    <span className={`roadmap__countdown goal-milestones__countdown ${event.feeling === "nervous" ? "is-gentle" : ""}`}>
                      {countdown(event.date, event.feeling)}
                    </span>
                  )}
                </div>
                <IconButton label={menu === milestone.id ? "Hide options" : `Options for “${milestone.title}”`} icon={MoreHorizontal} active={menu === milestone.id} onClick={() => setMenu(menu === milestone.id ? null : milestone.id)} />
              </div>
              {event && !milestone.completedAt && (
                <div className="goal-milestones__event">
                  {event.feeling === "nervous" && <p className="events__reassure">It’s fine to feel nervous. You’ll build up to it gradually, and you can reassess any time.</p>}
                  <div className="events__meta">
                    {event.feeling && <span className="status-badge">{FEELINGS.find(([key]) => key === event.feeling)?.[1]}</span>}
                    <span className={`status-badge ${event.booked ? "is-planned" : ""}`}>{event.booked ? "Booked" : "Not booked"}</span>
                    {event.planItemId && (
                      <span className="status-badge is-planned">
                        <CalendarCheck size={12} /> In your calendar
                      </span>
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
                  {event.note && <p className="events__note">{event.note}</p>}
                </div>
              )}
              {(menu === milestone.id || (!milestone.completedAt && !event)) && (
                <div className="step-list__actions">
                  {!milestone.completedAt && !event && !planned && (
                    <button type="button" className="step-list__schedule" onClick={() => setScheduling(scheduling === milestone.id ? null : milestone.id)}>
                      <CalendarPlus size={15} /> Add to day
                    </button>
                  )}
                  {!milestone.completedAt && planned && !event && (
                    <small className="step-list__planned">
                      <CalendarPlus size={13} /> Planned {planned.date === today() ? "today" : formatDate(planned.date, { weekday: "short", day: "numeric", month: "short" })}
                    </small>
                  )}
                  {menu === milestone.id && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setMenu(null)
                        setEditing(milestone.id)
                      }}
                    >
                      <Pencil size={14} /> Edit{event ? " event details" : " or make it an event"}
                    </button>
                  )}
                </div>
              )}
              {scheduling === milestone.id && (
                <StepScheduler
                  title={milestone.title}
                  plan={state.plan}
                  onCancel={() => setScheduling(null)}
                  onSchedule={(date, time, duration) => {
                    update(
                      (current) => ({
                        ...current,
                        plan: [
                          ...current.plan,
                          { id: uid(), title: milestone.title, area: goal.area, date, time, duration, mode: "flexible", status: "planned", goalId: goal.id, milestoneId: milestone.id, details: [`Towards your goal: ${goal.title}.`] },
                        ],
                      }),
                      `Added to ${date === today() ? "today" : formatDate(date, { weekday: "long" })}.`,
                    )
                    setScheduling(null)
                  }}
                />
              )}
            </li>
          )
        })}
      </ol>
      {limit && milestones.length > limit && onSeeAll && (
        <button type="button" className="text-link" onClick={onSeeAll}>
          See all {milestones.length} {word}s
        </button>
      )}
      {editing === "new" ? (
        <MilestoneForm onCancel={() => setEditing(null)} onSave={save} />
      ) : (
        <button type="button" className="text-link goal-milestones__add" onClick={() => setEditing("new")}>
          <Plus size={15} /> Add a {word}
        </button>
      )}
    </div>
  )
}
