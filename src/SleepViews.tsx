import { Moon, Plus, Sun, Trash2 } from "lucide-react"
import { useState } from "react"
import type { AppState, SleepEntry } from "./types"
import { Button, formatDate, Modal, SwipeRow, today, uid, useRemove } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const FEELINGS: [NonNullable<SleepEntry["feeling"]>, string][] = [
  ["rough", "Rough"],
  ["okay", "Okay"],
  ["rested", "Rested"],
]

const HOUR = 3600000

// The night a sleep belongs to: lights out at 00:30 on Tuesday is Monday night.
export const nightOf = (entry: SleepEntry) => {
  const date = new Date(new Date(entry.lightsOut).getTime() - 12 * HOUR)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const sleepMinutes = (entry: SleepEntry) =>
  entry.lightsOn ? Math.max(0, Math.round((new Date(entry.lightsOn).getTime() - new Date(entry.lightsOut).getTime()) / 60000)) : 0

export const hoursLabel = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })

// Still asleep: the latest entry with no lights on yet (from the last 18 hours).
export const openSleep = (state: AppState) => {
  const latest = [...(state.sleep ?? [])].sort((a, b) => b.lightsOut.localeCompare(a.lightsOut))[0]
  return latest && !latest.lightsOn && Date.now() - new Date(latest.lightsOut).getTime() < 18 * HOUR ? latest : undefined
}

const nights = (state: AppState) =>
  [...(state.sleep ?? [])].filter((entry) => entry.lightsOn).sort((a, b) => b.lightsOut.localeCompare(a.lightsOut))

// Averages over the last two weeks. Bedtimes are measured from 18:00 so midnight doesn't break them.
export function sleepStats(state: AppState, days = 14) {
  const from = new Date(Date.now() - days * 24 * HOUR).toISOString()
  const recent = nights(state).filter((entry) => entry.lightsOut >= from && sleepMinutes(entry) > 0 && sleepMinutes(entry) < 16 * 60)
  if (!recent.length) return null
  const sinceSix = (iso: string) => {
    const date = new Date(iso)
    return (((date.getHours() - 18 + 24) % 24) * 60 + date.getMinutes())
  }
  const ofDay = (iso: string) => new Date(iso).getHours() * 60 + new Date(iso).getMinutes()
  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  const asTime = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
  const bed = average(recent.map((entry) => sinceSix(entry.lightsOut)))
  return {
    count: recent.length,
    duration: average(recent.map(sleepMinutes)),
    lightsOut: asTime(bed + 18 * 60),
    lightsOn: asTime(average(recent.map((entry) => ofDay(entry.lightsOn!)))),
    lastNight: recent[0],
  }
}

// What Studio sees: the last week of sleep, so plans can go lighter after a short or rough night.
export const sleepContext = (state: AppState) => {
  const stats = sleepStats(state, 7)
  if (!stats) return undefined
  return {
    averageLast7: hoursLabel(stats.duration),
    usualLightsOut: stats.lightsOut,
    usualLightsOn: stats.lightsOn,
    lastNight: { night: nightOf(stats.lastNight), slept: hoursLabel(sleepMinutes(stats.lastNight)), feeling: stats.lastNight.feeling ?? null },
  }
}

const NIGHT_LINES = [
  "The samoyed’s already asleep. Your turn.",
  "Phone down, lights low. Tomorrow can wait.",
  "Tuck the day in. You did enough.",
  "Cosy o’clock.",
  "The day is done. Off you pop.",
]
const MORNING_LINES = [
  "Rise and shine (or rise and squint).",
  "Morning! The kettle’s calling.",
  "Good morning, sleepyhead.",
  "A brand new day, freshly unwrapped.",
  "Up you get. Slowly is fine.",
]
const FEELING_FACES: Record<NonNullable<SleepEntry["feeling"]>, string> = { rough: "😵‍💫", okay: "🙂", rested: "✨" }
const lineFor = (lines: string[]) => lines[Number(today().replace(/-/g, "")) % lines.length]

// Lights out at night, Lights on in the morning, then "how did you sleep?". Featured = big, with a picture.
export function SleepToggle({ state, update, onOpen, featured = false }: { state: AppState; update: Update; onOpen: () => void; featured?: boolean }) {
  const asleep = openSleep(state)
  const [justWoke, setJustWoke] = useState<string | null>(null)
  const woke = justWoke ? (state.sleep ?? []).find((entry) => entry.id === justWoke) : undefined
  const last = nights(state)[0]
  const hour = new Date().getHours()
  const evening = hour >= 18 || hour < 4
  const recentLast = last && nightOf(last) >= new Date(Date.now() - 36 * HOUR).toISOString().slice(0, 10) ? last : undefined
  // In the morning, ask how you slept if you haven't said yet.
  const unrated = !evening && recentLast && !recentLast.feeling ? recentLast : undefined
  const rating = woke ?? unrated

  const lightsOut = () =>
    update((current) => ({ ...current, sleep: [...(current.sleep ?? []), { id: uid(), lightsOut: new Date().toISOString() }] }), "Night night. 🌙")
  const lightsOn = (entry: SleepEntry) => {
    update((current) => ({
      ...current,
      sleep: (current.sleep ?? []).map((item) => (item.id === entry.id ? { ...item, lightsOn: new Date().toISOString() } : item)),
    }))
    setJustWoke(entry.id)
  }
  const rate = (entry: SleepEntry, value: NonNullable<SleepEntry["feeling"]>) => {
    update((current) => ({ ...current, sleep: (current.sleep ?? []).map((item) => (item.id === entry.id ? { ...item, feeling: value } : item)) }))
    setJustWoke(null)
  }

  const art = (night: boolean) =>
    featured ? (
      <>
        <img className={`sleep-moment__art ${night ? "" : "is-samoyed"}`} src={night ? "/assets/writing-nook.jpg" : "/assets/samoyed.png"} alt="" />
        <div className="sleep-moment__veil" />
      </>
    ) : null
  const wrap = (night: boolean, children: React.ReactNode) => (
    <section className={`sleep-toggle ${featured ? `sleep-moment ${night ? "is-night-art" : "is-morning-art"}` : ""} ${!featured && night ? "is-night" : ""}`}>
      {art(night)}
      <div className="sleep-moment__content">{children}</div>
    </section>
  )

  if (rating)
    return wrap(
      false,
      <>
        <Sun size={featured ? 26 : 20} />
        <div className="sleep-moment__text">
          {featured && <p className="eyebrow eyebrow--light">{lineFor(MORNING_LINES)}</p>}
          <strong>You slept {hoursLabel(sleepMinutes(rating))}.</strong>
          <small>How did you sleep?</small>
        </div>
        <div className="sleep-toggle__feelings">
          {FEELINGS.map(([value, label]) => (
            <button type="button" key={value} onClick={() => rate(rating, value)}>
              <span aria-hidden="true">{FEELING_FACES[value]}</span> {label}
            </button>
          ))}
        </div>
      </>,
    )

  if (asleep)
    return wrap(
      evening,
      <>
        {evening ? <Moon size={featured ? 26 : 20} /> : <Sun size={featured ? 26 : 20} />}
        <div className="sleep-moment__text">
          {featured && <p className="eyebrow eyebrow--light">{evening ? "Night night" : lineFor(MORNING_LINES)}</p>}
          <strong>Lights out at {clock(asleep.lightsOut)}</strong>
          <small>{evening ? "Sleep well. Tap Lights on when you’re up." : "Tap when you’re up."}</small>
        </div>
        <Button icon={Sun} onClick={() => lightsOn(asleep)}>
          Lights on
        </Button>
      </>,
    )

  return wrap(
    evening,
    <>
      <Moon size={featured ? 26 : 20} />
      <button type="button" className="sleep-toggle__summary sleep-moment__text" onClick={onOpen}>
        {featured && evening && <span className="eyebrow eyebrow--light">{lineFor(NIGHT_LINES)}</span>}
        {recentLast ? (
          <>
            <strong>
              Last night {hoursLabel(sleepMinutes(recentLast))}
              {recentLast.feeling ? ` · ${FEELING_FACES[recentLast.feeling]} ${recentLast.feeling}` : ""}
            </strong>
            <small>See your sleep</small>
          </>
        ) : (
          <>
            <strong>Sleep</strong>
            <small>Tap Lights out when you go to bed.</small>
          </>
        )}
      </button>
      <Button variant={evening ? "primary" : "secondary"} icon={Moon} onClick={lightsOut}>
        Lights out
      </Button>
    </>,
  )
}

const toLocalInput = (iso?: string) => {
  if (!iso) return ""
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : undefined)

function NightForm({ initial, onSave, onCancel }: { initial?: SleepEntry; onSave: (entry: SleepEntry) => void; onCancel: () => void }) {
  const yesterday = new Date(Date.now() - 24 * HOUR)
  yesterday.setHours(23, 0, 0, 0)
  const [lightsOut, setLightsOut] = useState(toLocalInput(initial?.lightsOut ?? yesterday.toISOString()))
  const [lightsOn, setLightsOn] = useState(toLocalInput(initial?.lightsOn ?? new Date(yesterday.getTime() + 8 * HOUR).toISOString()))
  const [feeling, setFeeling] = useState(initial?.feeling ?? "")
  const [note, setNote] = useState(initial?.note ?? "")
  const invalid = !lightsOut || (!!lightsOn && lightsOn <= lightsOut)
  return (
    <form
      className="sleep-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (invalid) return
        onSave({
          id: initial?.id ?? uid(),
          lightsOut: fromLocalInput(lightsOut)!,
          lightsOn: fromLocalInput(lightsOn),
          feeling: (feeling || undefined) as SleepEntry["feeling"],
          note: note.trim() || undefined,
        })
      }}
    >
      <div className="form-row">
        <label>
          <span>Lights out</span>
          <input type="datetime-local" value={lightsOut} onChange={(event) => setLightsOut(event.target.value)} required />
        </label>
        <label>
          <span>Lights on</span>
          <input type="datetime-local" value={lightsOn} onChange={(event) => setLightsOn(event.target.value)} />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>How did you sleep?</span>
          <select value={feeling} onChange={(event) => setFeeling(event.target.value)}>
            <option value="">Not sure</option>
            {FEELINGS.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Note (optional)</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. late coffee, woke at 3" />
        </label>
      </div>
      {invalid && lightsOn && <p className="capture-disclaimer">Lights on needs to be after lights out.</p>}
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

// Your sleep over the last couple of weeks: averages, a small chart, and every night (editable).
export function SleepSpace({ state, update, close }: { state: AppState; update: Update; close: () => void }) {
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const remove = useRemove()
  const stats = sleepStats(state)
  const all = [...(state.sleep ?? [])].sort((a, b) => b.lightsOut.localeCompare(a.lightsOut))
  const chart = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(`${today()}T12:00:00`)
    date.setDate(date.getDate() - 14 + index)
    const night = date.toISOString().slice(0, 10)
    const entry = all.find((item) => item.lightsOn && nightOf(item) === night)
    return { night, entry, minutes: entry ? sleepMinutes(entry) : 0 }
  })
  const save = (entry: SleepEntry) => {
    update((current) => {
      const exists = (current.sleep ?? []).some((item) => item.id === entry.id)
      return { ...current, sleep: exists ? (current.sleep ?? []).map((item) => (item.id === entry.id ? entry : item)) : [...(current.sleep ?? []), entry] }
    }, "Sleep saved.")
    setEditing(null)
  }

  return (
    <Modal title="Sleep" eyebrow="Lights out, lights on" onClose={close} wide>
      <div className="sleep-space">
        {stats ? (
          <div className="sleep-stats">
            <div>
              <small>Average sleep</small>
              <strong>{hoursLabel(stats.duration)}</strong>
            </div>
            <div>
              <small>Usual lights out</small>
              <strong>{stats.lightsOut}</strong>
            </div>
            <div>
              <small>Usual lights on</small>
              <strong>{stats.lightsOn}</strong>
            </div>
          </div>
        ) : (
          <p className="capture-disclaimer">
            Tap Lights out on Today when you go to bed, and Lights on when you get up. After a few nights you’ll see your
            pattern here, and Studio will plan lighter days after short nights.
          </p>
        )}
        {stats && (
          <div className="sleep-chart" aria-label="Sleep over the last two weeks">
            {chart.map(({ night, entry, minutes }) => (
              <div key={night} className="sleep-chart__night" title={entry ? `${formatDate(night, { weekday: "short", day: "numeric" })}: ${hoursLabel(minutes)}` : "No record"}>
                <span className={`sleep-chart__bar ${entry ? (entry.feeling ? `is-${entry.feeling}` : "") : "is-empty"}`} style={{ height: `${Math.min(100, (minutes / 600) * 100)}%` }} />
                <small>{formatDate(night, { weekday: "narrow" })}</small>
              </div>
            ))}
          </div>
        )}
        <p className="capture-disclaimer">For noticing patterns, not a medical record. If sleep is a worry, a GP can help.</p>

        <div className="sleep-space__head">
          <h3>Nights</h3>
          {editing !== "new" && (
            <button type="button" className="text-link" onClick={() => setEditing("new")}>
              <Plus size={14} /> Add a night
            </button>
          )}
        </div>
        {editing === "new" && <NightForm onSave={save} onCancel={() => setEditing(null)} />}
        <ul className="sleep-list">
          {all.slice(0, 30).map((entry) =>
            editing === entry.id ? (
              <li key={entry.id}>
                <NightForm initial={entry} onSave={save} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <SwipeRow
                as="li"
                key={entry.id}
                actions={[
                  {
                    label: "Delete",
                    icon: Trash2,
                    tone: "danger",
                    onClick: () => remove((current) => ({ ...current, sleep: (current.sleep ?? []).filter((item) => item.id !== entry.id) }), "Night deleted."),
                  },
                ]}
              >
                <button type="button" className="sleep-list__row" onClick={() => setEditing(entry.id)}>
                  <span>
                    <strong>{formatDate(nightOf(entry), { weekday: "short", day: "numeric", month: "short" })}</strong>
                    <small>
                      {clock(entry.lightsOut)} → {entry.lightsOn ? clock(entry.lightsOn) : "still asleep"}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </small>
                  </span>
                  <span className="sleep-list__right">
                    {entry.lightsOn && <b>{hoursLabel(sleepMinutes(entry))}</b>}
                    {entry.feeling && <small>{entry.feeling}</small>}
                  </span>
                </button>
              </SwipeRow>
            ),
          )}
        </ul>
      </div>
    </Modal>
  )
}
