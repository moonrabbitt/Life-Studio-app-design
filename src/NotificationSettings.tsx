import { Bell, BellOff, Pause, Play, Send } from "lucide-react"
import { useEffect, useState } from "react"
import { disablePush, enablePush, hasThisDevice, isStandalone, prefsOf, pushSupported, sendTestPush } from "./notifications"
import type { AppState, NotificationPrefs } from "./types"
import { Button, formatDate, today } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return value.toISOString().slice(0, 10)
}

// Gentle notifications: a few that matter, each skipped when there's no need. Never guilt.
export function NotificationSettings({ state, update }: { state: AppState; update: Update }) {
  const prefs = prefsOf(state.notifications)
  const [device, setDevice] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const set = (patch: Partial<NotificationPrefs>, message?: string) =>
    update((current) => ({ ...current, notifications: { ...prefsOf(current.notifications), ...patch } }), message)

  useEffect(() => {
    hasThisDevice().then(setDevice).catch(() => setDevice(false))
  }, [])

  const run = async (task: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setNote("")
    try {
      await task()
      setNote(done)
    } catch (failure) {
      setNote((failure as Error).message)
    }
    setBusy(false)
  }

  if (!pushSupported() || !isStandalone())
    return (
      <div className="notif-settings">
        <p className="capture-disclaimer">
          {!isStandalone()
            ? "On iPhone, notifications only work for apps on your Home Screen. Open Life Studio from its Home Screen icon (Share → Add to Home Screen if it isn’t there), then turn them on here."
            : "This browser can’t show notifications."}
        </p>
      </div>
    )

  const paused = prefs.pausedUntil && prefs.pausedUntil >= today()
  const on = prefs.enabled && device

  return (
    <div className="notif-settings">
      {!on ? (
        <>
          <p className="capture-disclaimer">
            A few gentle nudges, each skipped when there’s no need (no happiness nudge if you’ve already kept one, no Lights out if
            you already tapped it). At most {prefs.dailyMax} a day, nothing in quiet hours.
          </p>
          <Button
            icon={Bell}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await enablePush()
                setDevice(true)
                set({ enabled: true })
              }, "Notifications are on for this phone.")
            }
          >
            {busy ? "Turning on…" : "Turn on notifications"}
          </Button>
        </>
      ) : (
        <>
          <div className="notif-settings__status">
            <span>
              <Bell size={16} /> {paused ? `Paused until ${formatDate(prefs.pausedUntil!, { weekday: "short", day: "numeric", month: "short" })}` : "On for this phone"}
            </span>
            <button type="button" className="text-link" disabled={busy} onClick={() => run(() => sendTestPush(), "Test sent. It should appear in a moment.")}>
              <Send size={14} /> Send a test
            </button>
          </div>

          <ul className="notif-settings__list">
            <li>
              <label className="check-row">
                <input type="checkbox" checked={prefs.morning.on} onChange={(event) => set({ morning: { ...prefs.morning, on: event.target.checked } })} />
                <span>
                  <strong>Morning: your day</strong>
                  <small>Only if something’s planned</small>
                </span>
              </label>
              <input type="time" aria-label="Morning time" value={prefs.morning.time} onChange={(event) => event.target.value && set({ morning: { ...prefs.morning, time: event.target.value } })} />
            </li>
            <li>
              <label className="check-row">
                <input type="checkbox" checked={prefs.happiness.on} onChange={(event) => set({ happiness: { ...prefs.happiness, on: event.target.checked } })} />
                <span>
                  <strong>Pocket of happiness</strong>
                  <small>Only if you haven’t kept one yet</small>
                </span>
              </label>
              <input type="time" aria-label="Happiness time" value={prefs.happiness.time} onChange={(event) => event.target.value && set({ happiness: { ...prefs.happiness, time: event.target.value } })} />
            </li>
            <li>
              <label className="check-row">
                <input type="checkbox" checked={prefs.lightsOut.on} onChange={(event) => set({ lightsOut: { ...prefs.lightsOut, on: event.target.checked } })} />
                <span>
                  <strong>Lights out</strong>
                  <small>{prefs.lightsOut.time ? "At the time you chose" : "At your usual bedtime (or 22:30 until it knows)"}</small>
                </span>
              </label>
              <input
                type="time"
                aria-label="Lights out time"
                value={prefs.lightsOut.time ?? ""}
                onChange={(event) => set({ lightsOut: { ...prefs.lightsOut, time: event.target.value || undefined } })}
              />
            </li>
            <li>
              <label className="check-row">
                <input type="checkbox" checked={prefs.sessions.on} onChange={(event) => set({ sessions: { ...prefs.sessions, on: event.target.checked } })} />
                <span>
                  <strong>Before timed sessions and fixed plans</strong>
                  <small>Or turn on “Remind me” on just the ones that matter</small>
                </span>
              </label>
              <select aria-label="How long before" value={prefs.sessions.minutesBefore} onChange={(event) => set({ sessions: { ...prefs.sessions, minutesBefore: Number(event.target.value) } })}>
                {[15, 30, 45, 60].map((minutes) => (
                  <option value={minutes} key={minutes}>
                    {minutes} min before
                  </option>
                ))}
              </select>
            </li>
            <li>
              <label className="check-row">
                <input type="checkbox" checked={prefs.weekly.on} onChange={(event) => set({ weekly: { on: event.target.checked } })} />
                <span>
                  <strong>Plan next week</strong>
                  <small>Sunday 18:00, only if next week isn’t planned</small>
                </span>
              </label>
            </li>
            <li>
              <label className="check-row">
                <input type="checkbox" checked={prefs.dates.on} onChange={(event) => set({ dates: { on: event.target.checked } })} />
                <span>
                  <strong>Dates coming up</strong>
                  <small>The morning before race day, a camp, a booking</small>
                </span>
              </label>
            </li>
          </ul>

          <div className="form-row">
            <label>
              <span>At most</span>
              <select value={prefs.dailyMax} onChange={(event) => set({ dailyMax: Number(event.target.value) })}>
                {[1, 2, 3, 4, 5].map((count) => (
                  <option value={count} key={count}>
                    {count} a day
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Quiet from</span>
              <input type="time" value={prefs.quiet.from} onChange={(event) => event.target.value && set({ quiet: { ...prefs.quiet, from: event.target.value } })} />
            </label>
            <label>
              <span>Until</span>
              <input type="time" value={prefs.quiet.to} onChange={(event) => event.target.value && set({ quiet: { ...prefs.quiet, to: event.target.value } })} />
            </label>
          </div>

          <div className="inline-actions">
            {paused ? (
              <Button variant="secondary" icon={Play} onClick={() => set({ pausedUntil: undefined }, "Notifications are back on.")}>
                Resume
              </Button>
            ) : (
              <>
                <Button variant="secondary" icon={Pause} onClick={() => set({ pausedUntil: today() }, "Paused for today.")}>
                  Pause for today
                </Button>
                <Button variant="ghost" onClick={() => set({ pausedUntil: addDays(today(), 6) }, "Paused for a week.")}>
                  Pause for a week
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              icon={BellOff}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await disablePush()
                  setDevice(false)
                  set({ enabled: false })
                }, "Notifications are off.")
              }
            >
              Turn off
            </Button>
          </div>
        </>
      )}
      {note && <p className="capture-disclaimer">{note}</p>}
    </div>
  )
}
