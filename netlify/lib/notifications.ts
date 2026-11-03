// Decides which gentle notifications are due right now. Pure, so it can be tested directly.
import type { AppState, NotificationPrefs, PlanItem } from "../../src/types"

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  morning: { on: true, time: "08:00" },
  happiness: { on: true, time: "20:00" },
  lightsOut: { on: true },
  sessions: { on: false, minutesBefore: 30 },
  weekly: { on: false },
  dates: { on: false },
  dailyMax: 3,
  quiet: { from: "22:45", to: "07:30" },
}

export type Due = { key: string; priority: number; title: string; body: string; url: string; quietOk?: boolean; capExempt?: boolean }

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const hhmm = (minutes: number) => `${String(Math.floor(((minutes % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((minutes % 60) + 60) % 60).padStart(2, "0")}`

// Europe/London wall-clock date and minutes for a moment.
export function londonNow(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday: parts.weekday as string }
}

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

const open = (item: PlanItem) => item.status === "planned" || item.status === "proposed"
const isRest = (item: PlanItem) => item.kind === "recovery" && /^rest\b/i.test(item.title.trim())

const inQuiet = (minutes: number, quiet: NotificationPrefs["quiet"]) => {
  const from = minutesOf(quiet.from)
  const to = minutesOf(quiet.to)
  return from > to ? minutes >= from || minutes < to : minutes >= from && minutes < to
}

// Usual bedtime from the last fortnight of lights out (measured from 18:00 so midnight works).
export function usualBedtime(state: AppState, nowMs: number) {
  const from = nowMs - 14 * 86400000
  const times = (state.sleep ?? [])
    .filter((entry) => new Date(entry.lightsOut).getTime() >= from)
    .map((entry) => londonNow(new Date(entry.lightsOut)).minutes)
    .map((minutes) => (minutes - 18 * 60 + 1440) % 1440)
  if (times.length < 3) return null
  return hhmm(Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) + 18 * 60)
}

// `window` = how long after its time something can still go out (the job runs every 15 minutes).
const WINDOW = 15

export function dueNotifications(state: AppState, prefsIn: Partial<NotificationPrefs> | undefined, now: Date, sentToday: Set<string>, seenAt?: number): Due[] {
  const prefs = { ...DEFAULT_PREFS, ...prefsIn } as NotificationPrefs
  if (!prefs.enabled) return []
  const { date, minutes, weekday } = londonNow(now)
  if (prefs.pausedUntil && prefs.pausedUntil >= date) return []
  // If you're in the app right now, there's nothing to tell you.
  if (seenAt && now.getTime() - seenAt < 20 * 60000) return []
  const within = (time: string) => minutes >= minutesOf(time) && minutes < minutesOf(time) + WINDOW
  const today = state.plan.filter((item) => item.date === date && open(item) && !isRest(item)).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"))
  const due: Due[] = []

  // Things at a time: before a session or fixed plan (if on), or anything marked "remind me".
  for (const item of today) {
    if (!item.time) continue
    const wanted = item.remind || (prefs.sessions.on && (item.mode === "fixed" || !!item.kind))
    if (!wanted) continue
    const before = prefs.sessions.minutesBefore || 30
    if (within(hhmm(minutesOf(item.time) - before)))
      due.push({ key: `session-${item.id}`, priority: 1, title: `${item.title} at ${item.time}`, body: before >= 60 ? "In about an hour." : `In ${before} minutes. You’ve got this.`, url: "/", quietOk: !!item.remind, capExempt: !!item.remind })
  }

  // Morning: a one-line look at the day, only if something's planned.
  if (prefs.morning.on && within(prefs.morning.time) && today.length) {
    const lines = today.slice(0, 3).map((item) => `${item.time ? `${item.time} ` : ""}${item.title}`)
    due.push({ key: "morning", priority: 2, title: "Good morning ☀️", body: `Today: ${lines.join(" · ")}${today.length > 3 ? ` and ${today.length - 3} more` : ""}`, url: "/" })
  }

  // Pocket of happiness: only if none kept yet today.
  if (prefs.happiness.on && within(prefs.happiness.time) && !(state.happiness ?? []).some((pocket) => pocket.date === date))
    due.push({ key: "happiness", priority: 3, title: "A little pocket of happiness? 🐾", body: "Anything small that made you smile today? One line is plenty.", url: "/?do=happiness" })

  // Lights out: at your usual bedtime, only if you haven't tapped it.
  if (prefs.lightsOut.on) {
    const bedtime = prefs.lightsOut.time || usualBedtime(state, now.getTime()) || "22:30"
    const alreadyOut = (state.sleep ?? []).some((entry) => !entry.lightsOn && now.getTime() - new Date(entry.lightsOut).getTime() < 6 * 3600000)
    if (within(bedtime) && !alreadyOut)
      due.push({ key: "lights-out", priority: 3, title: "Cosy o’clock 🌙", body: "Ready for lights out? Tap and I’ll note it.", url: "/?do=lights-out", quietOk: true })
  }

  // Sunday evening: plan next week (only if there's a plan and next week is empty).
  if (prefs.weekly.on && weekday === "Sun" && within("18:00") && state.trainingPlan) {
    const monday = addDays(date, 1)
    if (!state.plan.some((item) => item.batch === `plan-${monday}`))
      due.push({ key: "weekly", priority: 4, title: "Plan next week?", body: "Studio can build next week from how this one went.", url: "/?do=plan-week" })
  }

  // The day before something with a date (race day, camp, a booking).
  if (prefs.dates.on && within("09:00")) {
    const tomorrow = addDays(date, 1)
    const dated = [
      ...state.goals.flatMap((goal) => goal.milestones.filter((milestone) => milestone.event?.date === tomorrow).map((milestone) => milestone.title)),
      ...(state.journeyEvents ?? []).filter((event) => event.date === tomorrow).map((event) => event.title),
    ]
    if (dated.length) due.push({ key: `date-${tomorrow}`, priority: 4, title: "Tomorrow", body: `${dated[0]} is tomorrow. Anything you’d like ready tonight?`, url: "/journey" })
  }

  // Quiet hours, once each, highest priority first, within the daily limit.
  let budget = Math.max(0, (prefs.dailyMax || 3) - sentToday.size)
  return due
    .filter((item) => !sentToday.has(item.key))
    .filter((item) => item.quietOk || !inQuiet(minutes, prefs.quiet))
    .sort((a, b) => a.priority - b.priority)
    .filter((item) => {
      if (item.capExempt) return true
      if (budget <= 0) return false
      budget -= 1
      return true
    })
    .slice(0, 2)
}
