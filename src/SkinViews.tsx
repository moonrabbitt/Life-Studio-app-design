import { Camera, Check, ChevronRight, Columns2, Moon, Pencil, Plus, Sparkles, Sun, Trash2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { celebrate } from "./GoalProjectViews"
import {
  deletePhotoLocal,
  dueOn,
  FEELS,
  isDone,
  loadPhoto,
  savePhotoLocal,
  scheduleLabel,
  shrinkPhoto,
  skinOf,
  STARTERS,
  timesThisWeek,
  toggleDone,
  uploadPendingPhotos,
  WEEKDAYS,
  whenLabel,
} from "./skin"
import { play } from "./sounds"
import { getPasscode, removePhoto } from "./sync"
import { addDays } from "./training"
import type { AppState, SkinCare, SkinFeel, SkinPhoto, SkinSchedule, SkinStep } from "./types"
import { Button, formatDate, Modal, SwipeRow, today, uid, useRemove } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const withSkin = (current: AppState, change: (skin: SkinCare) => SkinCare): AppState => ({ ...current, skin: change(skinOf(current)) })

// One tick box for a step on a day. Finishing the last one due celebrates, softly.
function StepTick({ state, update, step, date }: { state: AppState; update: Update; step: SkinStep; date: string }) {
  const skin = skinOf(state)
  const done = isDone(skin, step.id, date)
  const weekly = step.schedule.kind === "weekly" ? step.schedule.times : 0
  const tick = () => {
    const next = toggleDone(state, step.id, date)
    update(() => next)
    if (done) return
    const left = dueOn(skinOf(next), date, step.when).filter((other) => !isDone(skinOf(next), other.id, date))
    if (!left.length && date === today())
      celebrate({ title: `${whenLabel(step.when)} skin care done`, body: step.when === "pm" ? "Your skin gets to do its work overnight." : "A good start. Your skin will thank you." })
    else play("done")
  }
  return (
    <button type="button" className={`skin-tick ${done ? "is-done" : ""}`} aria-pressed={done} onClick={tick}>
      <span className="skin-tick__box">{done && <Check size={15} strokeWidth={2.6} />}</span>
      <span className="skin-tick__text">
        <strong>{step.name}</strong>
        {(weekly > 0 || step.note) && (
          <small>
            {weekly > 0 && `${Math.min(timesThisWeek(skin, step.id, date), weekly)} of ${weekly} this week`}
            {weekly > 0 && step.note && " · "}
            {step.note}
          </small>
        )}
      </span>
    </button>
  )
}

// In the evening wind-down: tonight's routine, with a little encouragement. Nothing shows during the day,
// and once it's all done it says so in one line.
const NUDGES = [
  "Five quiet minutes for your skin, then bed.",
  "A small ritual to close the day.",
  "Your skin does its best work while you sleep.",
  "Lights low, kettle on, skin care, done.",
]
export function SkinTonight({ state, update, onOpen }: { state: AppState; update: Update; onOpen: () => void }) {
  const skin = skinOf(state)
  const date = today()
  const steps = dueOn(skin, date, "pm")
  if (!steps.length) return null
  const allDone = steps.every((step) => isDone(skin, step.id, date))
  const nudge = NUDGES[Number(date.slice(8, 10)) % NUDGES.length]
  return (
    <div className="skin-tonight">
      <div className="skin-today__head">
        <p className="eyebrow">
          <Moon size={13} /> Night routine
        </p>
        <button type="button" className="text-link" onClick={onOpen}>
          Skin care <ChevronRight size={15} />
        </button>
      </div>
      {allDone ? (
        <p className="skin-tonight__done">
          <Check size={16} /> Done for tonight. Lovely.
        </p>
      ) : (
        <>
          <p className="skin-tonight__nudge">{nudge}</p>
          <div className="skin-ticks">
            {steps.map((step) => (
              <StepTick key={step.id} state={state} update={update} step={step} date={date} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StepForm({ initial, onSave, onCancel }: { initial?: SkinStep; onSave: (step: SkinStep) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "")
  const [when, setWhen] = useState<"am" | "pm">(initial?.when ?? "pm")
  const [kind, setKind] = useState<SkinSchedule["kind"]>(initial?.schedule.kind ?? "weekly")
  const [days, setDays] = useState<number[]>(initial?.schedule.kind === "days" ? initial.schedule.days : [])
  const [times, setTimes] = useState(initial?.schedule.kind === "weekly" ? initial.schedule.times : 1)
  const [note, setNote] = useState(initial?.note ?? "")
  const invalid = !name.trim() || (kind === "days" && !days.length)
  return (
    <form
      className="sleep-form skin-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (invalid) return
        const schedule: SkinSchedule = kind === "daily" ? { kind } : kind === "days" ? { kind, days } : { kind, times }
        onSave({ id: initial?.id ?? uid(), name: name.trim(), when, schedule, note: note.trim() || undefined })
      }}
    >
      <label>
        <span>What is it?</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Retinol, PDRN serum" autoFocus={!initial} />
      </label>
      <div className="skin-form__row">
        <span>When</span>
        <div className="segmented">
          {(["am", "pm"] as const).map((value) => (
            <button type="button" key={value} className={when === value ? "is-active" : ""} aria-pressed={when === value} onClick={() => setWhen(value)}>
              {whenLabel(value)}
            </button>
          ))}
        </div>
      </div>
      <div className="skin-form__row">
        <span>How often</span>
        <div className="segmented">
          {(
            [
              ["daily", "Every day"],
              ["weekly", "Times a week"],
              ["days", "Set days"],
            ] as const
          ).map(([value, label]) => (
            <button type="button" key={value} className={kind === value ? "is-active" : ""} aria-pressed={kind === value} onClick={() => setKind(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {kind === "weekly" && (
        <div className="skin-form__row">
          <span>Any day, this many times</span>
          <div className="skin-chips">
            {[1, 2, 3, 4, 5].map((value) => (
              <button type="button" key={value} className={`skin-chip ${times === value ? "is-active" : ""}`} aria-pressed={times === value} onClick={() => setTimes(value)}>
                {value === 1 ? "Once" : `${value}×`}
              </button>
            ))}
          </div>
        </div>
      )}
      {kind === "days" && (
        <div className="skin-form__row">
          <span>On</span>
          <div className="skin-chips">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <button
                type="button"
                key={day}
                className={`skin-chip ${days.includes(day) ? "is-active" : ""}`}
                aria-pressed={days.includes(day)}
                onClick={() => setDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]))}
              >
                {WEEKDAYS[day]}
              </button>
            ))}
          </div>
        </div>
      )}
      <label>
        <span>Note (optional)</span>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. not on the same night as acids" />
      </label>
      <div className="inline-actions">
        <Button type="submit" disabled={invalid}>
          Save
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// A photo from the device (or the photo store), loaded when it's shown.
function SkinImage({ id, className = "" }: { id: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    loadPhoto(id).then((blob) => {
      if (!alive) return
      if (!blob) return setMissing(true)
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [id])
  if (missing) return <span className={`skin-photo__missing ${className}`}>On another device</span>
  return url ? <img className={className} src={url} alt="" /> : <span className={`skin-photo__loading ${className}`} />
}

function Photos({ state, update }: { state: AppState; update: Update }) {
  const skin = skinOf(state)
  const photos = [...skin.photos].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  const remove = useRemove()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const [compare, setCompare] = useState(false)
  const oldest = photos[photos.length - 1]
  const [before, setBefore] = useState<string | undefined>(undefined)
  const [after, setAfter] = useState<string | undefined>(undefined)
  const left = before ?? oldest?.id
  const right = after ?? photos[0]?.id

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError("")
    try {
      const added: SkinPhoto[] = []
      for (const file of Array.from(files)) {
        const blob = await shrinkPhoto(file)
        const id = uid()
        await savePhotoLocal(id, blob)
        added.push({ id, date: today() })
      }
      update((current) => withSkin(current, (value) => ({ ...value, photos: [...value.photos, ...added] })), added.length > 1 ? `${added.length} photos saved.` : "Photo saved.")
      play("done")
      const uploaded = await uploadPendingPhotos({ ...skin, photos: [...skin.photos, ...added] })
      if (uploaded.length)
        update((current) => withSkin(current, (value) => ({ ...value, photos: value.photos.map((photo) => (uploaded.includes(photo.id) ? { ...photo, uploaded: true } : photo)) })))
    } catch {
      setError("Couldn’t read that photo. Try another, or take a new one.")
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  const openPhoto = photos.find((photo) => photo.id === open)

  return (
    <section className="skin-section">
      <div className="sleep-space__head">
        <h3>Progress photos</h3>
        <div className="skin-section__actions">
          {photos.length > 1 && (
            <button type="button" className="text-link" onClick={() => setCompare((value) => !value)}>
              <Columns2 size={14} /> {compare ? "Done comparing" : "Compare"}
            </button>
          )}
          <button type="button" className="text-link" onClick={() => input.current?.click()} disabled={busy}>
            <Camera size={14} /> {busy ? "Saving…" : "Add photo"}
          </button>
        </div>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(event) => add(event.target.files)} />
      </div>
      {error && <p className="welcome__bad">{error}</p>}
      {!photos.length && (
        <button type="button" className="skin-photo-empty" onClick={() => input.current?.click()}>
          <Camera size={22} />
          <span>
            <strong>Take a first photo</strong>
            <small>Same spot, same light, no filter, every week or two. Change is slow, so photos show what the mirror can’t.</small>
          </span>
        </button>
      )}
      {compare && left && right && (
        <div className="skin-compare">
          {[
            [left, setBefore, "Then"],
            [right, setAfter, "Now"],
          ].map(([id, set, label]) => (
            <figure key={label as string}>
              <SkinImage id={id as string} className="skin-compare__image" />
              <figcaption>
                <span>{label as string}</span>
                <select value={id as string} onChange={(event) => (set as (value: string) => void)(event.target.value)} aria-label={`${label} photo`}>
                  {photos.map((photo) => (
                    <option key={photo.id} value={photo.id}>
                      {formatDate(photo.date, { day: "numeric", month: "short", year: "2-digit" })}
                    </option>
                  ))}
                </select>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {!compare && photos.length > 0 && (
        <div className="skin-photos">
          {photos.map((photo) => (
            <button type="button" key={photo.id} className="skin-photo" onClick={() => setOpen(photo.id)}>
              <SkinImage id={photo.id} />
              <small>{formatDate(photo.date, { day: "numeric", month: "short" })}</small>
            </button>
          ))}
        </div>
      )}
      {openPhoto && (
        <div className="skin-viewer" role="dialog" aria-label="Photo" onClick={() => setOpen(null)}>
          <div className="skin-viewer__inner" onClick={(event) => event.stopPropagation()}>
            <SkinImage id={openPhoto.id} className="skin-viewer__image" />
            <div className="skin-viewer__bar">
              <strong>{formatDate(openPhoto.date, { weekday: "short", day: "numeric", month: "long" })}</strong>
              <button
                type="button"
                className="text-link text-link--danger"
                onClick={() => {
                  const id = openPhoto.id
                  setOpen(null)
                  remove((current) => withSkin(current, (value) => ({ ...value, photos: value.photos.filter((photo) => photo.id !== id) })), "Photo deleted.")
                  // The file goes a little later, once the undo window has passed and it's still gone.
                  window.setTimeout(() => {
                    const stored = JSON.parse(localStorage.getItem("life-studio:v1") || "{}") as AppState
                    if ((stored.skin?.photos ?? []).some((photo) => photo.id === id)) return
                    deletePhotoLocal(id).catch(() => undefined)
                    if (getPasscode()) removePhoto(id).catch(() => undefined)
                  }, 10000)
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
              <button type="button" className="icon-button" aria-label="Close photo" onClick={() => setOpen(null)}>
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// The last seven days: each step against each day; tap a square to log (or unlog) it.
function Week({ state, update }: { state: AppState; update: Update }) {
  const skin = skinOf(state)
  const dates = Array.from({ length: 7 }, (_, index) => addDays(today(), index - 6))
  if (!skin.steps.length) return null
  return (
    <section className="skin-section">
      <h3>Last 7 days</h3>
      <div className="skin-week" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(7, 2.1rem)` }}>
        <span />
        {dates.map((date) => (
          <small key={date} className={date === today() ? "is-today" : ""}>
            {formatDate(date, { weekday: "narrow" })}
          </small>
        ))}
        {skin.steps.map((step) => (
          <div className="skin-week__row" key={step.id}>
            <span className="skin-week__name">{step.name}</span>
            {dates.map((date) => {
              const done = isDone(skin, step.id, date)
              const scheduled = step.schedule.kind === "days" ? step.schedule.days.includes(new Date(`${date}T12:00:00`).getDay()) : step.schedule.kind === "daily"
              return (
                <button
                  type="button"
                  key={date}
                  className={`skin-week__cell ${done ? "is-done" : scheduled ? "is-due" : ""}`}
                  aria-pressed={done}
                  aria-label={`${step.name}, ${formatDate(date, { weekday: "long", day: "numeric", month: "short" })}: ${done ? "done" : "not done"}`}
                  onClick={() => {
                    update((current) => toggleDone(current, step.id, date))
                    if (!done) play("done")
                  }}
                >
                  {done && <Check size={13} strokeWidth={2.6} />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

export function SkinSpace({ state, update, close }: { state: AppState; update: Update; close: () => void }) {
  const skin = skinOf(state)
  const remove = useRemove()
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const date = today()
  const check = skin.checks.find((item) => item.date === date)
  const morning = dueOn(skin, date, "am")
  const evening = dueOn(skin, date, "pm")

  // Photos taken offline (or before the passcode was added) go up when the space opens.
  useEffect(() => {
    uploadPendingPhotos(skin).then((uploaded) => {
      if (uploaded.length)
        update((current) => withSkin(current, (value) => ({ ...value, photos: value.photos.map((photo) => (uploaded.includes(photo.id) ? { ...photo, uploaded: true } : photo)) })))
    })
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveStep = (step: SkinStep) => {
    update((current) =>
      withSkin(current, (value) => ({
        ...value,
        steps: value.steps.some((item) => item.id === step.id) ? value.steps.map((item) => (item.id === step.id ? step : item)) : [...value.steps, step],
      })),
      "Routine saved.",
    )
    setEditing(null)
  }
  const toggleFeel = (feel: SkinFeel) =>
    update((current) =>
      withSkin(current, (value) => {
        const existing = value.checks.find((item) => item.date === date)
        const feels = existing?.feel.includes(feel) ? existing.feel.filter((item) => item !== feel) : [...(existing?.feel ?? []), feel]
        const others = value.checks.filter((item) => item.date !== date)
        return { ...value, checks: feels.length || existing?.note ? [...others, { date, feel: feels, note: existing?.note }] : others }
      }),
    )
  const unused = STARTERS.filter((starter) => !skin.steps.some((step) => step.name.toLowerCase() === starter.name.toLowerCase()))

  const photos = <Photos state={state} update={update} />
  return (
    <Modal title="Skin care" eyebrow="Your routine, gently kept" onClose={close} wide>
      <div className="sleep-space skin-space">
        {skin.steps.length > 0 && (
          <section className="skin-section">
            <h3>Today</h3>
            <div className="skin-today-grid">
              {[
                ["am", morning],
                ["pm", evening],
              ].map(([when, steps]) => (
                <div key={when as string} className="skin-part">
                  <p className="eyebrow">
                    {when === "am" ? <Sun size={13} /> : <Moon size={13} />} {whenLabel(when as "am" | "pm")}
                  </p>
                  {(steps as SkinStep[]).length ? (
                    <div className="skin-ticks">
                      {(steps as SkinStep[]).map((step) => (
                        <StepTick key={step.id} state={state} update={update} step={step} date={date} />
                      ))}
                    </div>
                  ) : (
                    <p className="skin-part__empty">Nothing {when === "am" ? "this morning" : "tonight"}.</p>
                  )}
                </div>
              ))}
            </div>
            <div className="skin-feel">
              <span>How’s your skin today?</span>
              <div className="skin-chips">
                {FEELS.map(([value, label]) => (
                  <button type="button" key={value} className={`skin-chip ${check?.feel.includes(value) ? "is-active" : ""}`} aria-pressed={!!check?.feel.includes(value)} onClick={() => toggleFeel(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <Week state={state} update={update} />


        {/* Set the routine first; once there is one, photos sit above it (it rarely changes). */}
        {skin.steps.length > 0 && photos}
        <section className="skin-section">
          <div className="sleep-space__head">
            <h3>Your routine</h3>
            {editing !== "new" && skin.steps.length > 0 && (
              <button type="button" className="text-link" onClick={() => setEditing("new")}>
                <Plus size={14} /> Add a step
              </button>
            )}
          </div>
          {!skin.steps.length && editing !== "new" && (
            <p className="capture-disclaimer">
              Add the things you do, and how often. Tap a suggestion to start, then tap it again in the list to change the days.
            </p>
          )}
          {editing === "new" && <StepForm onSave={saveStep} onCancel={() => setEditing(null)} />}
          {skin.steps.length > 0 && (
            <ul className="sleep-list">
              {skin.steps.map((step) =>
                editing === step.id ? (
                  <li key={step.id}>
                    <StepForm initial={step} onSave={saveStep} onCancel={() => setEditing(null)} />
                  </li>
                ) : (
                  <SwipeRow
                    as="li"
                    key={step.id}
                    actions={[
                      {
                        label: "Delete",
                        icon: Trash2,
                        tone: "danger",
                        onClick: () => remove((current) => withSkin(current, (value) => ({ ...value, steps: value.steps.filter((item) => item.id !== step.id) })), `${step.name} removed.`),
                      },
                    ]}
                  >
                    <button type="button" className="sleep-list__row" onClick={() => setEditing(step.id)}>
                      <span>
                        <strong>{step.name}</strong>
                        <small>
                          {whenLabel(step.when)} · {scheduleLabel(step.schedule)}
                          {step.note ? ` · ${step.note}` : ""}
                        </small>
                      </span>
                      <Pencil size={15} />
                    </button>
                  </SwipeRow>
                ),
              )}
            </ul>
          )}
          {unused.length > 0 && editing === null && (
            <div className="skin-starters">
              <small>{skin.steps.length ? "Quick add" : "Suggestions"}</small>
              <div className="skin-chips">
                {unused.map((starter) => (
                  <button
                    type="button"
                    key={starter.name}
                    className="skin-chip skin-chip--add"
                    onClick={() => update((current) => withSkin(current, (value) => ({ ...value, steps: [...value.steps, { ...starter, id: uid() }] })), `${starter.name} added: ${whenLabel(starter.when).toLowerCase()}, ${scheduleLabel(starter.schedule).toLowerCase()}.`)}
                  >
                    <Plus size={13} /> {starter.name}
                  </button>
                ))}
                {skin.steps.length === 0 && (
                  <button type="button" className="skin-chip skin-chip--add" onClick={() => setEditing("new")}>
                    <Sparkles size={13} /> Something else
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
        {!skin.steps.length && photos}
        <p className="capture-disclaimer">For keeping track, not medical advice. If something stings, burns or flares, pause it and ask a pharmacist or GP.</p>
      </div>
    </Modal>
  )
}
