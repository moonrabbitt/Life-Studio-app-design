import type {
  ActivityKind,
  AppState,
  Goal,
  PlanItem,
  PastPlan,
  PlanWeekSession,
  PlannedExercise,
  TrainingPhaseDef,
  TrainingPlan,
  TrainingProfile,
  WorkoutRecord,
} from "./types"

// ---------------------------------------------------------------------------
// Dates (local time; the app is used in Europe/London)
// ---------------------------------------------------------------------------

export const RESTART_START = "2026-10-19"

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  const offset = value.getTimezoneOffset() * 60000
  return new Date(value.getTime() - offset).toISOString().slice(0, 10)
}

export function mondayOf(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay()
  return addDays(date, -((day + 6) % 7))
}

export function nextMonday(date: string) {
  const monday = mondayOf(date)
  return monday === date ? date : addDays(monday, 7)
}

// ---------------------------------------------------------------------------
// Restart phase: the starter fortnight
// ---------------------------------------------------------------------------

type Draft = Omit<PlanItem, "id" | "date" | "status" | "phase" | "batch"> & {
  day: number
  slug: string
}

function weekDrafts(week: 1 | 2): Draft[] {
  const first = week === 1
  return [
    {
      day: 0,
      slug: "gym",
      kind: "gym",
      title: first ? "Gym restart" : "Gym restart · repeat",
      area: "move",
      time: "19:00",
      duration: 30,
      mode: "flexible",
      intensity: "moderate",
      goalId: "goal-strength",
      details: first
        ? [
            "Easy warm-up, then a short full-body strength session.",
            "Familiar movements at a comfortable effort. Finish with energy left.",
            "Learn the logging flow; there is no target to hit.",
            "Allow longer than 30 minutes if you need it.",
          ]
        : [
            "Repeat the introductory session, guided by what you logged last week.",
            "Only change things that felt too easy or too much.",
          ],
      shortVersion: {
        duration: 15,
        note: "Full warm-up, then two movements for one comfortable set each.",
      },
    },
    {
      day: 0,
      slug: "journal",
      kind: "journal",
      title: first
        ? "How do I want this week to feel?"
        : "What made last week easier?",
      area: "reflect",
      time: "19:35",
      duration: 5,
      mode: "maybe",
      optional: true,
      details: ["Five minutes, written or spoken. Optional."],
    },
    {
      day: 1,
      slug: "walk",
      kind: "walk",
      title: "Easy walk",
      area: "move",
      time: "18:30",
      duration: 20,
      mode: "flexible",
      intensity: "light",
      goalId: "goal-race",
      details: [
        "15–20 minutes at a comfortable, conversational pace.",
        "Shorter is fine, and two short walks count too.",
      ],
      shortVersion: { duration: 10, note: "One easy ten-minute walk." },
    },
    {
      day: 1,
      slug: "invest",
      kind: "money",
      title: first
        ? "Investing: save two small goals"
        : "Investing: revenue, profit and cash flow",
      area: "money",
      time: "19:30",
      duration: 15,
      mode: "flexible",
      goalId: "goal-money-confidence",
      details: first
        ? [
            "Save one investing goal and one learning goal.",
            "Deeper work lives in Investing Lab.",
          ]
        : [
            "A short lesson: how revenue, profit and cash flow differ.",
            "Note one question to explore next time.",
          ],
    },
    {
      day: 2,
      slug: "dance",
      kind: "dance",
      title: "Dance practice",
      area: "move",
      time: "19:00",
      duration: 20,
      mode: "flexible",
      intensity: "light",
      goalId: "goal-dance",
      details: [
        "15–20 minutes of comfortable home practice.",
        "Going to a class instead? Log it as a class with its real time and length.",
        "A class can be much harder than home practice, so keep the next day gentle.",
        "Afterwards, note something you enjoyed or want to practise (optional).",
      ],
      shortVersion: { duration: 10, note: "Ten minutes of the moves you enjoy most." },
    },
    {
      day: 3,
      slug: "recovery",
      kind: "recovery",
      title: "Recovery day",
      area: "move",
      mode: "maybe",
      intensity: "light",
      optional: true,
      details: ["No required exercise. Rest counts as part of the plan."],
    },
    {
      day: 3,
      slug: "create",
      kind: "create",
      title: first ? "Creative time: one tiny output" : "Creative time: continue the idea",
      area: "create",
      time: "19:30",
      duration: 20,
      mode: "flexible",
      details: first
        ? [
            "Writing, music or film: choose one idea.",
            "Make one tiny output: a rough paragraph, a music sketch or a film idea.",
          ]
        : ["Continue last week’s idea with one more tiny output."],
    },
    {
      day: 4,
      slug: "friends",
      kind: "social",
      title: "Friends or free time",
      area: "connect",
      mode: "maybe",
      optional: true,
      details: [
        "Exercise stays unscheduled tonight.",
        "Optional: message a friend to suggest something. Nothing is booked for you.",
      ],
    },
    {
      day: 5,
      slug: "outdoor-walk",
      kind: "walk",
      title: "Outdoor walk",
      area: "move",
      time: "10:30",
      duration: 25,
      mode: "flexible",
      intensity: "light",
      goalId: "goal-race",
      details: [
        "20–30 minutes outdoors; shorten to suit how you feel.",
        "This sets up a regular endurance slot. It is not a long run yet.",
        "The rest of the day stays open.",
      ],
      shortVersion: { duration: 15, note: "A fifteen-minute walk outside." },
    },
    {
      day: 6,
      slug: "reset",
      kind: "reset",
      title: first ? "Weekly reset" : "Fortnight review",
      area: "reflect",
      time: "17:00",
      duration: 10,
      mode: "flexible",
      details: first
        ? [
            "Look back at what happened, energy, recovery and practical barriers.",
            "Choose or adjust next week’s times.",
          ]
        : [
            "Reflect on the fortnight.",
            "Decide whether to repeat, reduce, or begin the next phase.",
          ],
    },
    {
      day: 6,
      slug: "money-reflection",
      kind: "money",
      title: "Money reflection",
      area: "money",
      time: "17:15",
      duration: 10,
      mode: "maybe",
      optional: true,
      details: ["Optional: one thing you noticed about money this week."],
    },
  ]
}

export function buildRestartFortnight(start: string): PlanItem[] {
  return ([1, 2] as const).flatMap((week) =>
    weekDrafts(week).map(({ day, slug, ...draft }) => {
      const date = addDays(start, (week - 1) * 7 + day)
      return {
        ...draft,
        id: `restart-${date}-${slug}`,
        date,
        status: "proposed" as const,
        phase: "restart" as const,
        batch: `restart-${addDays(start, (week - 1) * 7)}`,
      }
    }),
  )
}

// Older plans wrote gym exercises as text ("Seated chest press: 2 sets of 8–10 reps."). Turn those
// lines into a real, editable exercise list, and keep any other lines as notes.
export function exercisesFromDetails(details: string[] = []): { workout: PlannedExercise[]; rest: string[] } {
  const workout: PlannedExercise[] = []
  const rest: string[] = []
  for (const line of details) {
    const reps = String.raw`(\d+(?:\s*[–-]\s*\d+)?(?:\s*(?:seconds?|secs?|s|min))?)(?:\s*reps?)?((?:\s*(?:per|each)\s+(?:side|leg|arm))?)`
    const colon = line.match(new RegExp(String.raw`^\s*([^:]{3,80}?)\s*:\s*(\d+)(?:\s*[–-]\s*\d+)?\s*sets?\s+of\s+` + reps + String.raw`(.*)$`, "i"))
    const times = line.match(new RegExp(String.raw`^\s*(\d+)\s*[×x]\s*` + reps + String.raw`\s+(?:of\s+)?([a-z][^,.;]{2,60})(.*)$`, "i"))
    const load = (name: string, extra: string) =>
      /dead bug|bird dog|plank|bridge|push-?up|clam|crunch|bodyweight|sit-to-stand/i.test(`${name} ${extra}`)
        ? "Bodyweight"
        : /very light|light/i.test(extra)
          ? "Very light"
          : "A weight you could lift 3-4 more times"
    const tidy = (text: string) => text.replace(/^[\s,.;]+|[\s.]+$/g, "")
    if (colon) {
      const [, rawName, sets, count, side, tail] = colon
      const [name, ...notes] = rawName.split(",")
      const extra = [notes.join(",").trim(), tidy(tail)].filter(Boolean).join("; ")
      workout.push({ name: name.trim(), sets: Number(sets), reps: `${count.replace(/\s+/g, "")}${side}`.trim(), rest: "60-90 seconds", load: load(name, extra), why: extra || "Part of this session", ...(extra ? { cue: extra } : {}) })
    } else if (times) {
      const [, sets, count, side, name, tail] = times
      workout.push({ name: name.trim().replace(/^\w/, (c) => c.toUpperCase()), sets: Number(sets), reps: `${count.replace(/\s+/g, "")}${side}`.trim(), rest: "60-90 seconds", load: load(name, tail), why: tidy(tail) || "Part of this session" })
    } else rest.push(line)
  }
  return workout.length >= 2 ? { workout, rest } : { workout: [], rest: details }
}

// Tidy a drafted week: one entry per kind per day (prefer the one with exercises), and no rest
// or recovery entry on a day that already has a regular commitment.
export function cleanWeek<T extends { dayOffset: number; kind: string; workout?: unknown[] }>(week: T[], commitmentDays: number[] = []): T[] {
  const kept: T[] = []
  for (const session of [...week].sort((a, b) => (b.workout?.length ?? 0) - (a.workout?.length ?? 0))) {
    if (session.kind === "recovery" && commitmentDays.includes(session.dayOffset)) continue
    if (kept.some((other) => other.dayOffset === session.dayOffset && other.kind === session.kind)) continue
    kept.push(session)
  }
  return kept.sort((a, b) => a.dayOffset - b.dayOffset)
}

// Adds one week of your plan's sessions as proposals, from the Monday given (skipping duplicates).
export function addPlanWeek(state: AppState, monday: string): AppState {
  const plan = state.trainingPlan
  if (!plan) return state
  const existing = new Set(state.plan.map((item) => item.id))
  // Each session says where it fits: the phase week, and the goal it builds towards.
  const { current } = phaseTimeline(state)
  const weekNumber = current.start ? Math.max(1, Math.floor((new Date(`${monday}T12:00:00`).getTime() - new Date(`${mondayOf(current.start)}T12:00:00`).getTime()) / (7 * 86400000)) + 1) : 1
  const goal = state.goals.find((item) => item.id === plan.goalId)
  const fits = `Week ${weekNumber} of ${current.title}${goal ? ` → ${goal.title}` : ""}`
  const items: PlanItem[] = plan.week
    .map((session, index) => {
      const date = addDays(monday, Math.max(0, Math.min(6, session.dayOffset)))
      return {
        id: `plan-${plan.id}${plan.lastReview ? `-${plan.lastReview.at.replace(/\D/g, "").slice(8, 14)}` : ""}-${date}-${index}`,
        title: session.title,
        area: AREA_OF[session.kind] ?? "move",
        kind: session.kind,
        date,
        time: session.time || undefined,
        duration: session.duration,
        intensity: session.intensity,
        details: session.kind === "recovery" || session.kind === "journal" ? session.details : [fits, ...session.details],
        workout: session.kind === "gym" && session.workout?.length ? session.workout : undefined,
        optional: session.optional || undefined,
        mode: session.optional ? "maybe" : "flexible",
        status: "proposed",
        phase: "plan",
        batch: `plan-${monday}`,
        goalId: plan.goalId,
      } satisfies PlanItem
    })
    // Skip anything you already accepted or did that day (same kind), so a re-plan never doubles up.
    .filter(
      (item) =>
        item.date >= today() &&
        !existing.has(item.id) &&
        !state.plan.some((other) => other.phase === "plan" && other.date === item.date && other.kind === item.kind && other.status !== "proposed"),
    )
  return { ...state, plan: [...state.plan, ...items] }
}

const AREA_OF: Partial<Record<ActivityKind, PlanItem["area"]>> = {
  money: "money",
  create: "create",
  social: "connect",
  reset: "home",
  journal: "reflect",
}

// Use Studio's next week: it becomes the typical week from now on (so progress builds), and replaces
// any untouched suggestions already in that week.
export function applyNextWeek(
  state: AppState,
  weekStart: string,
  draft: { review: string; phaseReady: boolean; phaseNote: string; week: (Omit<PlanWeekSession, "time"> & { time?: string | null })[] },
  // Refreshing after About me changes: also replace sessions you'd accepted but not done yet.
  replaceAccepted = false,
): AppState {
  const plan = state.trainingPlan
  if (!plan) return state
  const commitmentDays = state.plan
    .filter((item) => item.seriesId && item.mode === "fixed" && item.date >= weekStart && item.date <= addDays(weekStart, 6))
    .map((item) => (new Date(`${item.date}T12:00:00`).getDay() + 6) % 7)
  const week = cleanWeek(
    draft.week.map((session) => ({
      ...session,
      time: session.time && /^\d{2}:\d{2}$/.test(session.time) ? session.time : undefined,
      duration: Math.max(5, Math.min(240, session.duration || 30)),
    })),
    commitmentDays,
  )
  const next: AppState = {
    ...state,
    trainingPlan: {
      ...plan,
      week,
      lastReview: { weekStart, text: draft.review, phaseReady: draft.phaseReady, phaseNote: draft.phaseNote, at: new Date().toISOString() },
    },
    plan: state.plan.filter(
      (item) =>
        !(
          item.batch === `plan-${weekStart}` &&
          (item.status === "proposed" || (replaceAccepted && item.status === "planned" && item.date >= today()))
        ),
    ),
  }
  return addPlanWeek(next, weekStart)
}

// Switch to a new plan: archive the current one, clear future training proposals, start at phase 1.
// Your logs, done sessions and story are untouched.
export function startNewPlan(state: AppState, plan: TrainingPlan | null, reason: string, restore?: PastPlan): AppState {
  const now = today()
  const past: PastPlan = {
    plan: state.trainingPlan ?? null,
    phase: state.trainingPhase ?? 1,
    endedAt: now,
    reason,
    phaseWeeks: state.roadmap?.phaseWeeks,
    phaseDates: state.roadmap?.phaseDates,
  }
  const isTraining = (item: PlanItem) => item.phase === "restart" || item.phase === "plan"
  let next: AppState = {
    ...state,
    trainingPlan: plan ?? undefined,
    trainingPhase: restore?.phase ?? 1,
    pastPlans: [past, ...(state.pastPlans ?? []).filter((item) => item !== restore)].slice(0, 10),
    plan: state.plan.filter(
      (item) => !(isTraining(item) && item.date >= now && (item.status === "proposed" || item.status === "planned")),
    ),
    roadmap: {
      ...state.roadmap,
      phaseWeeks: restore?.phaseWeeks ?? {},
      phaseDates: restore?.phaseDates ?? { "1": now },
      // Name past phase changes now, while we still know which plan they belonged to.
      phaseLog: [
        ...(state.roadmap?.phaseLog ?? []).map((entry) => ({
          ...entry,
          title: entry.title ?? `Started phase ${entry.phase}: ${phasesOf(state).find((phase) => phase.id === entry.phase)?.title ?? ""}`,
        })),
        {
          phase: restore?.phase ?? 1,
          date: now,
          title: plan ? `New direction: ${plan.purpose}` : "Back to the original training plan",
        },
      ],
    },
  }
  if (plan) {
    next = addPlanWeek(next, mondayOf(now))
    next = addPlanWeek(next, nextMonday(now))
  }
  return next
}

export const STRENGTH_GOAL: Goal = {
  id: "goal-strength",
  title: "Restart gym and build a sustainable strength routine",
  area: "move",
  scale: "big",
  status: "tending",
  nextStep: "Find a week I can comfortably repeat",
  milestones: [
    { id: "strength-repeatable", title: "I found a week I can comfortably repeat." },
    { id: "strength-intro", title: "Complete the introductory session twice" },
    { id: "strength-two-days", title: "Strength on two days in most weeks" },
  ],
}

export const HACKNEY_LABEL =
  "Sun 16 May 2027 · date confirmed on the official site · entry not booked"
export const FAIRPLAY_REPORTED =
  "Reported 1–8 Aug 2027, Kraków · not yet verified · not booked"

// Adds the fortnight as proposals (skipping any already present) and the goals it supports.
export function addRestartFortnight(state: AppState, start: string): AppState {
  const existing = new Set(state.plan.map((item) => item.id))
  const items = buildRestartFortnight(start).filter((item) => !existing.has(item.id))
  const hasStrength = state.goals.some((goal) => goal.id === STRENGTH_GOAL.id)
  return {
    ...state,
    restartOffer: "added",
    trainingPhase: state.trainingPhase ?? 1,
    plan: [...state.plan, ...items],
    goals: (hasStrength ? state.goals : [STRENGTH_GOAL, ...state.goals]).map((goal) =>
      goal.id === "goal-race" && !state.events?.hackneyBooked
        ? { ...goal, date: "2027-05-16", dateLabel: HACKNEY_LABEL }
        : goal.id === "goal-dance" && !state.events?.fairplayConfirmed
          ? { ...goal, dateLabel: FAIRPLAY_REPORTED }
          : goal,
    ),
  }
}

export function acceptWeek(state: AppState, batch: string): AppState {
  return {
    ...state,
    plan: state.plan.map((item) =>
      item.batch === batch && item.status === "proposed"
        ? { ...item, status: "planned" }
        : item,
    ),
  }
}

// ---------------------------------------------------------------------------
// Today's next useful action
// ---------------------------------------------------------------------------

const open = (item: PlanItem) =>
  item.status === "planned" || item.status === "proposed"

// A planned rest day: part of the plan, nothing to start.
export const isRestDay = (item: PlanItem) => item.kind === "recovery" && /^rest( day)?\b/i.test(item.title.trim())

export function nextUsefulAction(plan: PlanItem[], todayDate: string, now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes()
  const toMinutes = (time?: string) =>
    time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : null
  const byTime = (a: PlanItem, b: PlanItem) =>
    `${a.date}${a.time ?? "99"}`.localeCompare(`${b.date}${b.time ?? "99"}`)
  // Structured activities only; other plans stay in Today's list below.
  const candidates = plan.filter(
    (item) => open(item) && !!item.kind && item.kind !== "recovery",
  )
  const todays = candidates.filter((item) => item.date === todayDate).sort(byTime)
  const pick = (items: PlanItem[]) =>
    items.find((item) => !item.optional) ?? items[0]
  const upcoming = todays.filter((item) => {
    const start = toMinutes(item.time)
    return start === null || start + (item.duration ?? 30) + 60 >= minutes
  })
  const today = pick(upcoming) ?? pick(todays)
  if (today) return { item: today, when: "today" as const }
  const later = candidates
    .filter((item) => item.date > todayDate && item.date <= addDays(todayDate, 7))
    .sort(byTime)
  const next = pick(later)
  return next ? { item: next, when: "later" as const } : null
}

// ---------------------------------------------------------------------------
// Moving: conflicts, combined load and recovery
// ---------------------------------------------------------------------------

const EXERCISE: ActivityKind[] = ["gym", "walk", "run", "dance"]

export function effectiveIntensity(item: PlanItem) {
  if (item.log?.wasClass) return "hard"
  return item.intensity ?? (item.kind && EXERCISE.includes(item.kind) ? "moderate" : undefined)
}

export function checkPlacement(
  plan: PlanItem[],
  item: PlanItem,
  date: string,
  time?: string,
) {
  const others = plan.filter(
    (other) => other.id !== item.id && other.status !== "let-go",
  )
  const toMinutes = (value: string) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
  const conflicts = time
    ? others.filter((other) => {
        if (other.date !== date || !other.time || other.status === "complete") return false
        const a = toMinutes(time)
        const b = toMinutes(other.time)
        return a < b + (other.duration ?? 30) && b < a + (item.duration ?? 30)
      })
    : []
  const warnings: string[] = []
  const intensity = effectiveIntensity(item)
  const isExercise = !!item.kind && EXERCISE.includes(item.kind)
  if (isExercise) {
    const sameDay = others.filter(
      (other) =>
        other.date === date &&
        other.kind &&
        EXERCISE.includes(other.kind) &&
        effectiveIntensity(other) !== "light",
    )
    if (intensity !== "light" && sameDay.length)
      warnings.push(
        `There is already ${sameDay[0].title.toLowerCase()} that day. Two harder sessions together add up.`,
      )
    const recovery = others.find((other) => other.date === date && other.kind === "recovery")
    if (recovery && intensity !== "light")
      warnings.push("That is a recovery day. Something light would fit better.")
    const hardNeighbour = others.find(
      (other) =>
        (other.date === addDays(date, -1) || other.date === addDays(date, 1)) &&
        effectiveIntensity(other) === "hard",
    )
    if (hardNeighbour && intensity !== "light")
      warnings.push(
        `${hardNeighbour.log?.summary ?? hardNeighbour.title} is next to that day and may be demanding. Consider the short version.`,
      )
  }
  return { conflicts, warnings }
}

// ---------------------------------------------------------------------------
// Exercise library (curated; demo links verified)
// ---------------------------------------------------------------------------

export type Category = "squat" | "hinge" | "push" | "pull" | "calf" | "trunk"

export type Exercise = {
  id: string
  name: string
  category: Category
  equipment: string
  track: "reps" | "seconds"
  reps: string
  setup: string[]
  technique: string[]
  rest: string
  demo?: { label: string; url: string }
  alternatives: string[]
  load?: string
  why?: string
  sets?: number
}

const NHS_STRENGTH = {
  label: "NHS strength exercises (step-by-step pictures)",
  url: "https://www.nhs.uk/live-well/exercise/strength-exercises/",
}
const ace = (path: string) => ({
  label: "ACE exercise library",
  url: `https://www.acefitness.org/resources/everyone/exercise-library/${path}/`,
})

export const EXERCISES: Record<string, Exercise> = {
  "goblet-squat": {
    id: "goblet-squat",
    name: "Goblet squat",
    category: "squat",
    equipment: "One dumbbell",
    track: "reps",
    reps: "8–10 reps",
    setup: [
      "Hold one dumbbell upright against your chest with both hands.",
      "Feet about shoulder-width apart, toes turned out slightly.",
    ],
    technique: [
      "Sit your hips down and back, keeping your chest tall.",
      "Let your knees follow the direction of your toes.",
      "Go only as deep as feels comfortable, then press through your whole foot to stand.",
    ],
    rest: "60–90 seconds between sets",
    demo: ace("362/goblet-squat"),
    alternatives: ["sit-to-stand", "leg-press"],
  },
  "sit-to-stand": {
    id: "sit-to-stand",
    name: "Sit-to-stand",
    category: "squat",
    equipment: "A sturdy chair or bench",
    track: "reps",
    reps: "8–10 reps",
    setup: ["Sit near the front of the chair, feet flat and hip-width apart."],
    technique: [
      "Lean forward slightly and stand up, without your hands if you can.",
      "Sit back down slowly and with control.",
    ],
    rest: "About 60 seconds between sets",
    demo: NHS_STRENGTH,
    alternatives: ["goblet-squat"],
  },
  "leg-press": {
    id: "leg-press",
    name: "Leg press machine",
    category: "squat",
    equipment: "Leg press machine",
    track: "reps",
    reps: "8–10 reps",
    setup: [
      "Adjust the seat so your knees bend comfortably at the start.",
      "Feet hip-width apart, flat in the middle of the platform.",
    ],
    technique: [
      "Push the platform away through your whole foot without locking your knees.",
      "Lower slowly to a comfortable depth, keeping your lower back on the pad.",
    ],
    rest: "60–90 seconds between sets",
    alternatives: ["sit-to-stand", "goblet-squat"],
  },
  "hip-hinge": {
    id: "hip-hinge",
    name: "Hip hinge",
    category: "hinge",
    equipment: "A broomstick or light dumbbells (optional)",
    track: "reps",
    reps: "8–10 reps",
    setup: [
      "Stand with feet hip-width apart and knees softly bent.",
      "Hold a stick along your back, or light dumbbells in front of your thighs.",
    ],
    technique: [
      "Push your hips back as if closing a door behind you, keeping your back long.",
      "Lower until you feel a stretch in the back of your legs, usually around knee height.",
      "Squeeze your glutes to stand tall. Don’t round your back to reach lower.",
    ],
    rest: "60–90 seconds between sets",
    demo: ace("33/hip-hinge"),
    alternatives: ["glute-bridge"],
  },
  "glute-bridge": {
    id: "glute-bridge",
    name: "Glute bridge",
    category: "hinge",
    equipment: "Mat or floor",
    track: "reps",
    reps: "10 reps",
    setup: ["Lie on your back with knees bent and feet flat, hip-width apart."],
    technique: [
      "Gently brace your stomach and lift your hips by squeezing your glutes.",
      "Stop when your body forms a line from shoulders to knees, without arching your back.",
      "Lower slowly.",
    ],
    rest: "About 60 seconds between sets",
    demo: ace("49/glute-bridge"),
    alternatives: ["hip-hinge"],
  },
  "incline-chest-press": {
    id: "incline-chest-press",
    name: "Incline dumbbell chest press",
    category: "push",
    equipment: "Dumbbells and an adjustable bench",
    track: "reps",
    reps: "8–10 reps",
    setup: [
      "Set the bench to a moderate incline and lie back with a dumbbell in each hand.",
      "Feet flat on the floor, back resting naturally on the bench.",
    ],
    technique: [
      "Press the dumbbells up over your chest until your arms are almost straight.",
      "Lower slowly until your elbows are slightly below the bench line, or less if that is uncomfortable.",
    ],
    rest: "60–90 seconds between sets",
    demo: ace("25/incline-chest-press"),
    alternatives: ["wall-press-up", "machine-chest-press"],
  },
  "machine-chest-press": {
    id: "machine-chest-press",
    name: "Machine chest press",
    category: "push",
    equipment: "Chest press machine",
    track: "reps",
    reps: "8–10 reps",
    setup: [
      "Adjust the seat so the handles line up with the middle of your chest.",
      "Sit tall with your back against the pad.",
    ],
    technique: [
      "Press the handles forward without locking your elbows.",
      "Return slowly until you feel a gentle stretch across your chest.",
    ],
    rest: "60–90 seconds between sets",
    alternatives: ["wall-press-up", "incline-chest-press"],
  },
  "wall-press-up": {
    id: "wall-press-up",
    name: "Wall press-up",
    category: "push",
    equipment: "A wall (or a sturdy counter to make it harder)",
    track: "reps",
    reps: "8–12 reps",
    setup: ["Stand an arm’s length from a wall with your hands flat on it at shoulder height."],
    technique: [
      "Bend your elbows to bring your chest towards the wall, keeping your body straight.",
      "Push back to the start. Step further back to make it harder.",
    ],
    rest: "About 60 seconds between sets",
    demo: NHS_STRENGTH,
    alternatives: ["incline-chest-press"],
  },
  "seated-row": {
    id: "seated-row",
    name: "Seated cable row",
    category: "pull",
    equipment: "Cable row machine (or a resistance band)",
    track: "reps",
    reps: "10 reps",
    setup: [
      "Sit tall with your feet braced and a slight bend in your knees.",
      "Hold the handle with arms extended and shoulders relaxed.",
    ],
    technique: [
      "Pull your elbows back towards your ribs, squeezing your shoulder blades together.",
      "Return slowly without letting your shoulders round forward.",
    ],
    rest: "60–90 seconds between sets",
    demo: ace("48/seated-row"),
    alternatives: ["lat-pulldown", "band-row"],
  },
  "lat-pulldown": {
    id: "lat-pulldown",
    name: "Seated lat pulldown",
    category: "pull",
    equipment: "Lat pulldown machine",
    track: "reps",
    reps: "10 reps",
    setup: [
      "Adjust the knee pad so you feel secure, and hold the bar a little wider than your shoulders.",
    ],
    technique: [
      "Pull the bar towards your upper chest, leading with your elbows.",
      "Avoid arching your lower back. Return slowly.",
    ],
    rest: "60–90 seconds between sets",
    demo: ace("158/seated-lat-pulldown"),
    alternatives: ["seated-row", "band-row"],
  },
  "band-row": {
    id: "band-row",
    name: "Resistance band row",
    category: "pull",
    equipment: "A resistance band",
    track: "reps",
    reps: "10–12 reps",
    setup: [
      "Sit tall with legs extended and loop the band around your feet.",
      "Hold one end in each hand with arms straight.",
    ],
    technique: [
      "Pull your elbows back past your ribs and squeeze your shoulder blades.",
      "Return slowly. Use a lighter band if your shoulders hunch.",
    ],
    rest: "About 60 seconds between sets",
    demo: ace("48/seated-row"),
    alternatives: ["seated-row"],
  },
  "calf-raise": {
    id: "calf-raise",
    name: "Calf raise",
    category: "calf",
    equipment: "A wall for balance",
    track: "reps",
    reps: "10–12 reps",
    setup: ["Stand facing a wall with your feet hip-width apart, fingertips on the wall for balance."],
    technique: [
      "Rise up onto the balls of your feet as high as is comfortable.",
      "Lower slowly. Useful support for walking and running.",
    ],
    rest: "About 45 seconds between sets",
    demo: ace("73/standing-calf-raises-wall"),
    alternatives: [],
  },
  "bird-dog": {
    id: "bird-dog",
    name: "Bird dog",
    category: "trunk",
    equipment: "Mat or floor",
    track: "reps",
    reps: "5 each side",
    setup: ["Kneel on all fours, hands under shoulders and knees under hips."],
    technique: [
      "Slowly reach one arm forward and the opposite leg back.",
      "Only lift as high as you can keep your lower back still. Alternate sides.",
    ],
    rest: "About 45 seconds between sets",
    demo: ace("14/bird-dog"),
    alternatives: ["front-plank", "dead-bug"],
  },
  "front-plank": {
    id: "front-plank",
    name: "Front plank",
    category: "trunk",
    equipment: "Mat or floor",
    track: "seconds",
    reps: "15–20 seconds",
    setup: ["Lie face down with elbows under your shoulders. Start on your knees if that suits you."],
    technique: [
      "Lift your hips so your body forms a straight line.",
      "Avoid sagging or hiking your hips. Breathe steadily and stop before your form fades.",
    ],
    rest: "About 45 seconds between sets",
    demo: ace("32/front-plank"),
    alternatives: ["bird-dog"],
  },
  "dead-bug": {
    id: "dead-bug",
    name: "Dead bug",
    category: "trunk",
    equipment: "Mat or floor",
    track: "reps",
    reps: "5 each side",
    setup: ["Lie on your back with arms pointing up and knees bent over your hips."],
    technique: [
      "Slowly lower one arm and the opposite leg towards the floor while your lower back stays still.",
      "Return and switch sides. Make the movement smaller if your back lifts.",
    ],
    rest: "About 45 seconds between sets",
    alternatives: ["bird-dog"],
  },
}

const IGNORED = new Set(["machine", "seated", "standing", "the", "a", "with", "and", "or"])
const words = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .replace(/[^a-z ]/g, " ")
      .split(" ")
      .filter((word) => word && !IGNORED.has(word)),
  )

// Finds the verified library entry for an AI-named exercise, for its demo link and steps.
export function matchExercise(name: string) {
  const target = words(name)
  let best: { exercise: Exercise; score: number } | null = null
  for (const exercise of Object.values(EXERCISES)) {
    const candidate = words(exercise.name)
    const shared = [...target].filter((word) => candidate.has(word)).length
    const score = shared / new Set([...target, ...candidate]).size
    if (score >= 0.5 && (!best || score > best.score)) best = { exercise, score }
  }
  return best?.exercise
}

export function fromPlanned(planned: PlannedExercise, index: number): Exercise {
  const match = matchExercise(planned.name)
  return {
    id: match?.id ?? `custom-${index}-${planned.name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
    name: planned.name,
    category: match?.category ?? "squat",
    equipment: match?.equipment ?? "",
    track: /sec|second|min/i.test(planned.reps) ? "seconds" : "reps",
    reps: planned.reps,
    setup: match?.setup ?? [],
    technique: [...(planned.cue ? [planned.cue] : []), ...(match?.technique ?? [])],
    rest: planned.rest,
    demo: match?.demo,
    alternatives: [],
    load: planned.load,
    why: planned.why,
    sets: planned.sets,
  }
}

export const WARM_UP = {
  title: "Warm-up · about 5 minutes",
  steps: [
    "Easy cardio such as a bike, cross-trainer or brisk walk, gradually warming up.",
    "Then one light practice set of your first exercise.",
  ],
  demo: {
    label: "NHS: how to warm up",
    url: "https://www.nhs.uk/live-well/exercise/how-to-warm-up-before-exercising/",
  },
}

export type SessionPlan = {
  blocked: boolean
  sets: number
  setsLabel: string
  exercises: Exercise[]
  notes: string[]
}

const PICKS: Record<TrainingProfile["equipment"], Record<Category, string>> = {
  gym: {
    squat: "goblet-squat",
    hinge: "hip-hinge",
    push: "incline-chest-press",
    pull: "seated-row",
    calf: "calf-raise",
    trunk: "bird-dog",
  },
  machines: {
    squat: "leg-press",
    hinge: "glute-bridge",
    push: "machine-chest-press",
    pull: "lat-pulldown",
    calf: "calf-raise",
    trunk: "bird-dog",
  },
  dumbbells: {
    squat: "goblet-squat",
    hinge: "hip-hinge",
    push: "incline-chest-press",
    pull: "band-row",
    calf: "calf-raise",
    trunk: "bird-dog",
  },
  home: {
    squat: "sit-to-stand",
    hinge: "glute-bridge",
    push: "wall-press-up",
    pull: "band-row",
    calf: "calf-raise",
    trunk: "bird-dog",
  },
  "not-sure": {
    squat: "sit-to-stand",
    hinge: "glute-bridge",
    push: "wall-press-up",
    pull: "seated-row",
    calf: "calf-raise",
    trunk: "bird-dog",
  },
}

// An introductory full-body session from the intake answers. No weights are suggested.
export function buildIntroSession(
  profile: TrainingProfile,
  short = false,
): SessionPlan {
  if (profile.concern === "yes")
    return { blocked: true, sets: 0, setsLabel: "", exercises: [], notes: [] }
  const cautious =
    profile.concern === "not-sure" ||
    profile.gymExperience === "new" ||
    profile.gymExperience === "not-sure"
  const picks = { ...PICKS[cautious && profile.equipment === "not-sure" ? "home" : profile.equipment] }
  if (cautious && picks.squat === "goblet-squat" && !profile.familiar.includes("squat"))
    picks.squat = "sit-to-stand"
  if (profile.familiar.includes("leg-press") && profile.equipment !== "home") picks.squat = "leg-press"
  const order: Category[] =
    profile.minutes === "20"
      ? ["squat", "push", "pull"]
      : profile.minutes === "45"
        ? ["squat", "hinge", "push", "pull", "trunk", "calf"]
        : ["squat", "hinge", "push", "pull"]
  const chosen = (short ? order.slice(0, 2) : order).map((category) => EXERCISES[picks[category]])
  const sets = short || cautious ? 1 : 2
  return {
    blocked: false,
    sets,
    setsLabel: short ? "1 comfortable set" : cautious ? "1–2 comfortable sets" : "2 comfortable sets",
    exercises: chosen,
    notes: [
      "Choose a weight you could lift 3–4 more times. No starting weights are suggested; your first log becomes your reference.",
      "Comfortable effort. Stop any exercise that causes pain.",
      "It’s fine to take longer than the estimated time.",
    ],
  }
}

export function lastPerformance(
  history: WorkoutRecord[],
  current: { id: string; name: string },
) {
  const name = current.name.toLowerCase()
  for (const record of history) {
    const match = record.exercises.find(
      (exercise) => exercise.id === current.id || exercise.name.toLowerCase() === name,
    )
    const done = match?.sets.filter((set) => set.done)
    if (done?.length) {
      const set = done[done.length - 1]
      const amount = set.seconds ? `${set.seconds}s` : `${set.reps ?? "?"} reps`
      return `Last time: ${done.length} set${done.length === 1 ? "" : "s"} · ${amount}${set.weight ? ` · ${set.weight} kg` : ""}`
    }
  }
  return ""
}

// ---------------------------------------------------------------------------
// Roadmap and research basis
// ---------------------------------------------------------------------------

export const PHASES = [
  {
    id: 1,
    weeks: 2,
    title: "Restart phase",
    body: "Establish comfortable, repeatable activity: one gym session, walks, dance and recovery.",
    ready: "Move on when you have found a week you can comfortably repeat, without pain.",
  },
  {
    id: 2,
    weeks: 6,
    title: "Base building",
    body: "Build a walking and running base, and develop strength gradually towards two sessions a week.",
    ready: "Move on when walks feel easy and strength sessions are routine.",
  },
  {
    id: 3,
    weeks: 9,
    title: "Beginner running",
    body: "Introduce a beginner running programme such as NHS Couch to 5K. Its three runs a week replace walks in the shared week rather than being added on top, with recovery days between.",
    ready: "Finishing Couch to 5K is a milestone, not proof of half-marathon readiness.",
  },
  {
    id: 4,
    weeks: 12,
    title: "Half-marathon build",
    body: "Move to a suitable half-marathon programme once current fitness and the time left support it, alongside strength and dance.",
    ready: "If preparation falls behind, reassess the race or plan rather than squeezing training.",
  },
  {
    id: 5,
    weeks: 3,
    title: "Taper, race and dance camp",
    body: "Plan a taper and recovery around 16 May 2027, then dance-camp preparation around its confirmed dates.",
    ready: "Dance-camp planning waits until the dates are confirmed.",
  },
]

export const WHY_THIS_PLAN = [
  "Gradual progression and recovery days, so your body adapts without being rushed.",
  "Specific times and cues (“Monday at 19:00, gym”) make a habit easier to start.",
  "Habits take weeks to months to feel automatic, so repeating a manageable week matters more than doing more.",
  "Recording what you actually did helps you follow through and adjust honestly.",
  "Activity guidelines (150 minutes a week; strength on two days) are long-term reference points, not first-week quotas.",
  "The exact days, times and durations are practical starting choices, not a scientifically validated personal prescription.",
]

export const SOURCES = [
  {
    label: "NHS: physical activity guidelines for adults",
    url: "https://www.nhs.uk/live-well/exercise/physical-activity-guidelines-for-adults-aged-19-to-64/",
  },
  {
    label: "NHS: how to improve strength and flexibility",
    url: "https://www.nhs.uk/live-well/exercise/how-to-improve-strength-flexibility/",
  },
  {
    label: "NHS: Couch to 5K running plan",
    url: "https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/",
  },
  {
    // The original PDF link now returns 404; IADMS lists it under its resource papers.
    label: "IADMS: “Dance Fitness” resource paper (see Resource Papers)",
    url: "https://iadms.org/",
  },
  {
    label: "Lally et al. (2010): how habits are formed",
    url: "https://doi.org/10.1002/ejsp.674",
  },
  {
    label: "Gollwitzer & Sheeran (2006): implementation intentions",
    url: "https://doi.org/10.1016/S0065-2601(06)38002-1",
  },
  {
    label: "Harkin et al. (2016): monitoring goal progress",
    url: "https://pubmed.ncbi.nlm.nih.gov/26479070/",
  },
]

// ---------------------------------------------------------------------------
// Progression: suggest next time's numbers from your own logs (always editable)
// ---------------------------------------------------------------------------

export type Suggestion = {
  reps?: number
  weight?: number
  seconds?: number
  note: string
}

const range = (reps: string) => {
  const numbers = (reps.match(/\d+/g) ?? []).map(Number)
  return { low: numbers[0], high: numbers[1] ?? numbers[0] }
}

const weightStep = (equipment: string) => (/dumbbell|kettlebell/i.test(equipment) ? 1 : 2.5)

export function suggestNext(
  history: WorkoutRecord[],
  exercise: { id: string; name: string; reps: string; equipment: string; track: "reps" | "seconds" },
): Suggestion | null {
  const name = exercise.name.toLowerCase()
  const record = history.find((item) =>
    item.exercises.some(
      (candidate) => (candidate.id === exercise.id || candidate.name.toLowerCase() === name) && candidate.sets.some((set) => set.done),
    ),
  )
  if (!record) return null
  const last = record.exercises.find((candidate) => candidate.id === exercise.id || candidate.name.toLowerCase() === name)!
  const done = last.sets.filter((set) => set.done)
  const top = done[done.length - 1]
  const felt = record.effort ?? "comfortable"
  const lastText = top.seconds
    ? `${top.seconds}s`
    : `${top.weight ? `${top.weight} kg × ` : ""}${top.reps ?? "?"}`
  const since = `last time ${lastText}${record.effort ? `, felt ${record.effort.replace("-", " ")}` : ""}`

  if (record.concern) return { reps: top.reps, weight: top.weight, seconds: top.seconds, note: `Same as ${since}, after the concern you noted` }
  if (felt === "hard" || felt === "very-hard") return { reps: top.reps, weight: top.weight, seconds: top.seconds, note: `Same again: ${since}` }

  if (exercise.track === "seconds" || top.seconds) {
    const seconds = (top.seconds ?? 15) + 5
    return { seconds, note: `${seconds}s, a little longer than ${since}` }
  }
  const { low, high } = range(exercise.reps)
  const reps = top.reps ?? low
  const allAtTop = high !== undefined && done.every((set) => (set.reps ?? 0) >= high)
  if (top.weight && allAtTop) {
    const weight = Math.round((top.weight + weightStep(exercise.equipment)) * 2) / 2
    return { reps: low ?? reps, weight, note: `${weight} kg × ${low ?? reps}: a small step up from ${since}` }
  }
  if (!top.weight && allAtTop) {
    return { reps: reps + 2, note: `${reps + 2} reps: you hit the top of the range (${since}). A harder variation could be next.` }
  }
  const nextReps = high ? Math.min(high, reps + 1) : reps + 1
  return { reps: nextReps, weight: top.weight, note: `${top.weight ? `${top.weight} kg × ` : ""}${nextReps}: one more rep than ${since}` }
}

// Walks and runs: suggest a slightly longer time only when the last one felt easy or comfortable.
export function suggestDuration(plan: PlanItem[], item: PlanItem) {
  const last = plan
    .filter((other) => other.id !== item.id && other.kind === item.kind && other.status === "complete" && other.log?.duration)
    .sort((a, b) => (b.log?.completedAt ?? "").localeCompare(a.log?.completedAt ?? ""))[0]
  if (!last?.log?.duration) return null
  const minutes = last.log.duration
  const felt = last.log.effort
  if (last.log.concern || felt === "hard" || felt === "very-hard")
    return { minutes, note: `Same as last time (${minutes} min${felt ? `, felt ${felt.replace("-", " ")}` : ""})` }
  const next = Math.min(minutes + 5, Math.max(minutes + 2, Math.round(minutes * 1.1)))
  return { minutes: next, note: `${next} min: a little longer than last time (${minutes} min${felt ? `, ${felt}` : ""})` }
}

// Best set per session for each exercise, newest first, for the progress view.
export function strengthHistory(history: WorkoutRecord[]) {
  const map = new Map<string, { date: string; text: string }[]>()
  for (const record of history)
    for (const exercise of record.exercises) {
      const done = exercise.sets.filter((set) => set.done)
      if (!done.length) continue
      const best = done.reduce((a, b) => ((b.weight ?? 0) * 100 + (b.reps ?? b.seconds ?? 0) > (a.weight ?? 0) * 100 + (a.reps ?? a.seconds ?? 0) ? b : a))
      const text = best.seconds ? `${best.seconds}s` : `${best.weight ? `${best.weight} kg × ` : ""}${best.reps ?? "?"}`
      const list = map.get(exercise.name) ?? []
      list.push({ date: record.date, text })
      map.set(exercise.name, list)
    }
  return [...map.entries()].map(([name, sessions]) => ({ name, sessions: sessions.slice(0, 5) }))
}

// A logged workout becomes a reusable template, using the numbers you actually did.
export function recordToExercises(exercises: WorkoutRecord["exercises"]): PlannedExercise[] {
  return exercises
    .filter((exercise) => exercise.sets.length)
    .map((exercise) => {
      const done = exercise.sets.filter((set) => set.done)
      const last = done[done.length - 1] ?? exercise.sets[exercise.sets.length - 1]
      return {
        name: exercise.name,
        sets: Math.max(1, done.length || exercise.sets.length),
        reps: last?.seconds ? `${last.seconds} seconds` : `${last?.reps ?? 8}`,
        rest: "60-90 seconds",
        load: last?.weight ? `${last.weight} kg` : "bodyweight or your choice",
        why: "From a workout you logged",
      }
    })
}



const today = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// The phases of whichever plan you're on: one Studio wrote for you, or the built-in one.
export function phasesOf(state: AppState): TrainingPhaseDef[] {
  return state.trainingPlan?.phases?.length ? state.trainingPlan.phases : PHASES
}

// Where you are in the programme: phase, week within it, and the planned timeline ahead.
export function phaseTimeline(state: AppState) {
  const roadmap = state.roadmap ?? {}
  const phases = phasesOf(state)
  const current = Math.min(state.trainingPhase ?? 1, phases.length)
  const weeksOf = (id: number) => roadmap.phaseWeeks?.[String(id)] ?? phases.find((phase) => phase.id === id)!.weeks
  const loggedStart = (id: number) =>
    [...(roadmap.phaseLog ?? [])].reverse().find((entry) => entry.phase === id)?.date
  const restartStart = state.plan.filter((item) => item.phase === "restart").map((item) => item.date).sort()[0]
  const currentStart =
    roadmap.phaseDates?.[String(current)] || loggedStart(current) || (current === 1 ? restartStart : undefined) || today()
  const rows = phases.map((phase) => ({ ...phase, weeks: weeksOf(phase.id), start: "", end: "" }))
  let cursor = currentStart
  for (const row of rows) {
    if (row.id < current) {
      row.start = roadmap.phaseDates?.[String(row.id)] || loggedStart(row.id) || ""
      continue
    }
    row.start = row.id === current ? currentStart : roadmap.phaseDates?.[String(row.id)] && roadmap.phaseDates[String(row.id)] > cursor ? roadmap.phaseDates[String(row.id)] : cursor
    row.end = addDays(row.start, row.weeks * 7 - 1)
    cursor = addDays(row.end, 1)
  }
  const now = rows.find((row) => row.id === current)!
  const elapsed = Math.floor((new Date(`${today()}T12:00:00`).getTime() - new Date(`${now.start}T12:00:00`).getTime()) / 86400000)
  const week = Math.min(now.weeks, Math.max(1, Math.floor(elapsed / 7) + 1))
  // The phase that should be finished by the big day: the build before the taper (or, for
  // a plan Studio wrote, the one before the last).
  const plan = state.trainingPlan
  const raceDate = plan ? plan.targetDate : state.goals.find((goal) => goal.id === "goal-race")?.date
  const build = plan ? rows[Math.max(0, rows.length - 2)] : rows.find((row) => row.id === 4)
  const overRace = !!(raceDate && build?.end && build.end > raceDate)
  return { rows, current: now, week, overRace, raceDate }
}
