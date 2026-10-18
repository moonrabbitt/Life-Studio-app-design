import {
  ArrowLeft,
  CalendarPlus,
  Check,
  ChevronRight,
  Coffee,
  Footprints,
  Home,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { celebrate } from "./GoalProjectViews"
import { addDays, checkPlacement } from "./training"
import type { AppState, Person, PlanItem } from "./types"
import { Art, Button, formatDate, Modal, SwipeRow, today, uid, useRemove } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const KINDS: { key: string; label: string; icon: LucideIcon; title: (name: string) => string; minutes: number; mode: PlanItem["mode"] }[] = [
  { key: "message", label: "Message", icon: MessageCircle, title: (name) => `Message ${name}`, minutes: 10, mode: "maybe" },
  { key: "call", label: "Call", icon: Phone, title: (name) => `Call ${name}`, minutes: 30, mode: "flexible" },
  { key: "coffee", label: "Coffee", icon: Coffee, title: (name) => `Coffee with ${name}`, minutes: 60, mode: "fixed" },
  { key: "meal", label: "Meal", icon: UtensilsCrossed, title: (name) => `Dinner with ${name}`, minutes: 120, mode: "fixed" },
  { key: "walk", label: "Walk", icon: Footprints, title: (name) => `Walk with ${name}`, minutes: 60, mode: "fixed" },
  { key: "visit", label: "Visit", icon: Home, title: (name) => `See ${name}`, minutes: 120, mode: "fixed" },
  { key: "other", label: "Something else", icon: Plus, title: (name) => `Time with ${name}`, minutes: 60, mode: "flexible" },
]

const dayLabel = (date: string) =>
  date === today()
    ? "today"
    : date === addDays(today(), 1)
      ? "tomorrow"
      : formatDate(date, { weekday: "long", day: "numeric", month: "short" })

// Plans with a person: linked by id, or older plans that mention their name.
const plansWith = (state: AppState, person: Person) =>
  state.plan.filter(
    (item) =>
      item.personId === person.id ||
      (!item.personId && item.area === "connect" && item.title.toLowerCase().includes(person.name.toLowerCase())),
  )

const sortByDate = (a: PlanItem, b: PlanItem) =>
  `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`)

function PlanWithPerson({
  person,
  state,
  onSave,
  onCancel,
}: {
  person: Person
  state: AppState
  onSave: (item: PlanItem) => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState(KINDS[0])
  const [title, setTitle] = useState(KINDS[0].title(person.name))
  const [date, setDate] = useState(today())
  const [time, setTime] = useState("")
  const [duration, setDuration] = useState(String(KINDS[0].minutes))
  const [where, setWhere] = useState("")
  const days = Array.from({ length: 21 }, (_, index) => addDays(today(), index))
  const { conflicts } = checkPlacement(
    state.plan,
    { id: "new", title, area: "connect", date, mode: kind.mode, status: "planned", duration: Number(duration) || kind.minutes },
    date,
    time || undefined,
  )
  return (
    <form
      className="people-plan"
      onSubmit={(event) => {
        event.preventDefault()
        onSave({
          id: uid(),
          title: title.trim() || kind.title(person.name),
          area: "connect",
          date,
          time: time || undefined,
          duration: Number(duration) || kind.minutes,
          mode: kind.mode,
          status: "planned",
          personId: person.id,
          note: where.trim() || undefined,
        })
      }}
    >
      <fieldset className="chip-group">
        <legend>What would you like to do with {person.name}?</legend>
        <div>
          {KINDS.map((option) => {
            const Icon = option.icon
            return (
              <button
                type="button"
                key={option.key}
                className={kind.key === option.key ? "is-selected" : ""}
                aria-pressed={kind.key === option.key}
                onClick={() => {
                  setKind(option)
                  setTitle(option.title(person.name))
                  setDuration(String(option.minutes))
                }}
              >
                <Icon size={15} /> {option.label}
              </button>
            )
          })}
        </div>
      </fieldset>
      <label>
        <span>Name it</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
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
      <div className="plan-edit__row">
        <label>
          <span>Time (optional)</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label>
          <span>Minutes</span>
          <input type="number" min={5} step={5} inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} />
        </label>
      </div>
      {kind.key !== "message" && kind.key !== "call" && (
        <label>
          <span>Where or notes (optional)</span>
          <input value={where} onChange={(event) => setWhere(event.target.value)} placeholder="e.g. The café on Broadway Market" />
        </label>
      )}
      {conflicts.map((other) => (
        <p className="move-sheet__warn" key={other.id}>
          <TriangleAlert size={15} /> Overlaps {other.title} at {other.time}
        </p>
      ))}
      <p className="capture-disclaimer">
        This goes in your Plan for {dayLabel(date)}. Nothing is sent or booked for you.
      </p>
      <div className="inline-actions">
        <Button type="submit" icon={CalendarPlus}>
          {conflicts.length ? "Add anyway" : `Add to ${dayLabel(date)}`}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function PersonForm({
  person,
  onSave,
  onCancel,
  onDelete,
}: {
  person?: Person
  onSave: (values: { name: string; note: string; nextTouch: string }) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(person?.name ?? "")
  const [note, setNote] = useState(person?.note ?? "")
  const [nextTouch, setNextTouch] = useState(
    person?.nextTouch && person.nextTouch !== "When it feels right" ? person.nextTouch : "",
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <form
      className="plan-edit"
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return
        onSave({ name: name.trim(), note: note.trim(), nextTouch: nextTouch.trim() })
      }}
    >
      <label>
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus={!person} />
      </label>
      <label>
        <span>What to remember (optional)</span>
        <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Ask about the new studio. Loves Thai food." />
      </label>
      <label>
        <span>Next time I’d like to… (optional)</span>
        <input value={nextTouch} onChange={(event) => setNextTouch(event.target.value)} placeholder="e.g. Go to an exhibition together" />
      </label>
      <div className="inline-actions">
        <Button type="submit" icon={Check}>
          {person ? "Save changes" : "Add person"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {onDelete &&
        (confirmDelete ? (
          <div className="plan-edit__delete">
            <p>
              Remove {person?.name}? Plans with them stay in your Plan, just no longer linked.
            </p>
            <Button variant="danger" icon={Trash2} onClick={onDelete}>
              Remove
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <button type="button" className="text-link plan-edit__delete-link" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} /> Remove person
          </button>
        ))}
    </form>
  )
}

export function PeopleSpace({
  state,
  update,
  close,
  onGoPlan,
}: {
  state: AppState
  update: Update
  close: () => void
  onGoPlan: (date: string) => void
}) {
  const [view, setView] = useState<
    | { kind: "list" }
    | { kind: "add" }
    | { kind: "person"; id: string }
    | { kind: "edit"; id: string }
    | { kind: "plan"; id: string; back: "list" | "person" }
    | { kind: "added"; id: string; item: PlanItem }
  >({ kind: "list" })
  const person = "id" in view ? state.people.find((candidate) => candidate.id === view.id) : undefined
  const [confirmRemove, setConfirmRemove] = useState(false)
  const remove = useRemove()
  const removePerson = (target: Person) => {
    remove(
      (current) => ({
        ...current,
        people: current.people.filter((candidate) => candidate.id !== target.id),
        plan: current.plan.map((item) => (item.personId === target.id ? { ...item, personId: undefined } : item)),
      }),
      `Removed ${target.name}.`,
    )
    setConfirmRemove(false)
    setView({ kind: "list" })
  }

  const savePlan = (item: PlanItem) => {
    update((current) => ({ ...current, plan: [...current.plan, item] }))
    setView({ kind: "added", id: item.personId!, item })
  }
  const markConnected = (target: Person) => {
    update((current) => ({
      ...current,
      people: current.people.map((candidate) =>
        candidate.id === target.id ? { ...candidate, lastConnected: today() } : candidate,
      ),
    }))
    celebrate({ title: `Connected with ${target.name}`, body: "Time with people you care about counts." })
  }

  let body
  if (view.kind === "add") {
    body = (
      <PersonForm
        onCancel={() => setView({ kind: "list" })}
        onSave={(values) => {
          const id = uid()
          update(
            (current) => ({
              ...current,
              people: [{ id, name: values.name, note: values.note, nextTouch: values.nextTouch || undefined }, ...current.people],
            }),
            `${values.name} added.`,
          )
          setView({ kind: "person", id })
        }}
      />
    )
  } else if (view.kind === "edit" && person) {
    body = (
      <PersonForm
        person={person}
        onCancel={() => setView({ kind: "person", id: person.id })}
        onSave={(values) => {
          update(
            (current) => ({
              ...current,
              people: current.people.map((candidate) =>
                candidate.id === person.id
                  ? { ...candidate, name: values.name, note: values.note, nextTouch: values.nextTouch || undefined }
                  : candidate,
              ),
            }),
            "Saved.",
          )
          setView({ kind: "person", id: person.id })
        }}
        onDelete={() => removePerson(person)}
      />
    )
  } else if (view.kind === "plan" && person) {
    body = (
      <>
        <button type="button" className="back-link" onClick={() => setView(view.back === "person" ? { kind: "person", id: person.id } : { kind: "list" })}>
          <ArrowLeft size={17} /> Back
        </button>
        <PlanWithPerson
          person={person}
          state={state}
          onCancel={() => setView(view.back === "person" ? { kind: "person", id: person.id } : { kind: "list" })}
          onSave={savePlan}
        />
      </>
    )
  } else if (view.kind === "added" && person) {
    body = (
      <div className="assistant-saved">
        <span className="assistant-saved__icon">
          <Check size={26} />
        </span>
        <h3>Added to your Plan</h3>
        <p>
          <strong>{view.item.title}</strong>, {dayLabel(view.item.date)}
          {view.item.time ? ` at ${view.item.time}` : ""}.
          <br />
          It shows on Today when the day comes, and on {person.name}’s page.
        </p>
        <div className="inline-actions">
          <Button
            icon={ChevronRight}
            onClick={() => {
              close()
              onGoPlan(view.item.date)
            }}
          >
            See it in Plan
          </Button>
          <Button variant="ghost" onClick={() => setView({ kind: "person", id: person.id })}>
            Back to {person.name}
          </Button>
        </div>
      </div>
    )
  } else if (view.kind === "person" && person) {
    const plans = plansWith(state, person)
    const upcoming = plans.filter((item) => (item.status === "planned" || item.status === "proposed") && item.date >= today()).sort(sortByDate)
    const past = plans.filter((item) => item.status === "complete").sort(sortByDate).reverse()
    body = (
      <div className="person-detail">
        <button type="button" className="back-link" onClick={() => setView({ kind: "list" })}>
          <ArrowLeft size={17} /> Everyone
        </button>
        <div className="person-detail__head">
          <div className="person-card__avatar">{person.name.slice(0, 1)}</div>
          <div>
            <h3>{person.name}</h3>
            <small>
              {person.lastConnected
                ? `Last connected ${dayLabel(person.lastConnected) === "today" ? "today" : formatDate(person.lastConnected, { day: "numeric", month: "long" })}`
                : "No time together noted yet"}
            </small>
          </div>
          <button type="button" className="text-link" onClick={() => setView({ kind: "edit", id: person.id })}>
            <Pencil size={14} /> Edit
          </button>
        </div>
        {person.note && (
          <p className="plan-sheet__purpose">
            <strong>Remember:</strong> {person.note}
          </p>
        )}
        {person.nextTouch && person.nextTouch !== "When it feels right" && (
          <p className="plan-sheet__purpose">
            <strong>Next time:</strong> {person.nextTouch}
          </p>
        )}
        <div className="inline-actions">
          <Button icon={CalendarPlus} onClick={() => setView({ kind: "plan", id: person.id, back: "person" })}>
            Plan something
          </Button>
          <Button variant="secondary" icon={Sparkles} onClick={() => markConnected(person)}>
            We connected today
          </Button>
        </div>
        <section>
          <p className="eyebrow">Coming up</p>
          {upcoming.length ? (
            <ul className="person-detail__list">
              {upcoming.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <small>
                    {dayLabel(item.date)}
                    {item.time ? ` · ${item.time}` : ""}
                    {item.note ? ` · ${item.note}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="capture-disclaimer">Nothing planned. That’s fine too.</p>
          )}
        </section>
        {past.length > 0 && (
          <section>
            <p className="eyebrow">Time together</p>
            <ul className="person-detail__list">
              {past.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <small>
                    {formatDate(item.date, { day: "numeric", month: "short" })}
                    {item.log?.note ? ` · “${item.log.note}”` : ""}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="person-detail__footer">
          {confirmRemove ? (
            <div className="plan-edit__delete">
              <p>Remove {person.name}? Plans with them stay in your Plan, just no longer linked.</p>
              <Button variant="danger" icon={Trash2} onClick={() => removePerson(person)}>
                Remove {person.name}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <div className="inline-actions">
              <Button variant="secondary" icon={Pencil} onClick={() => setView({ kind: "edit", id: person.id })}>
                Edit details
              </Button>
              <Button variant="ghost" icon={Trash2} onClick={() => setConfirmRemove(true)}>
                Remove {person.name}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  } else {
    body = (
      <>
        <Art className="space-banner" src="/assets/friends-cafe.jpg" />
        <div className="feature-topline">
          <p>
            <strong>Connection without obligation.</strong> Notes on the people you care about,
            and plans to see them. Plans go into your Plan and Today; nothing is sent or booked for you.
          </p>
          <Button icon={Plus} onClick={() => setView({ kind: "add" })}>
            Add someone
          </Button>
        </div>
        <div className="people-grid">
          {state.people.map((candidate) => {
            const next = plansWith(state, candidate)
              .filter((item) => (item.status === "planned" || item.status === "proposed") && item.date >= today())
              .sort(sortByDate)[0]
            return (
              <SwipeRow
                key={candidate.id}
                className="swipe--card"
                actions={[{ label: "Remove", icon: Trash2, tone: "danger", onClick: () => removePerson(candidate) }]}
              >
              <article className="person-card">
                <div className="person-card__avatar">{candidate.name.slice(0, 1)}</div>
                <div>
                  <h3>{candidate.name}</h3>
                  {candidate.note && <p>{candidate.note}</p>}
                  <span>
                    {next
                      ? `Planned: ${next.title}, ${dayLabel(next.date)}${next.time ? ` ${next.time}` : ""}`
                      : candidate.lastConnected
                        ? `Last connected ${formatDate(candidate.lastConnected, { day: "numeric", month: "short" })}`
                        : "Nothing planned"}
                  </span>
                </div>
                <div className="person-card__actions">
                  <Button variant="secondary" icon={CalendarPlus} onClick={() => setView({ kind: "plan", id: candidate.id, back: "list" })}>
                    Plan something
                  </Button>
                  <Button variant="ghost" onClick={() => setView({ kind: "person", id: candidate.id })}>
                    Open
                  </Button>
                </div>
              </article>
              </SwipeRow>
            )
          })}
        </div>
        {state.people.length === 0 && <p className="capture-disclaimer">Add the people you want to keep close.</p>}
      </>
    )
  }

  return (
    <Modal title={person && view.kind !== "list" ? person.name : "People"} eyebrow="Connect" onClose={close} wide>
      {body}
    </Modal>
  )
}
