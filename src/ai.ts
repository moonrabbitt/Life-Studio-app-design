import { authHeaders } from "./sync"
import { sleepContext } from "./SleepViews"
import { phaseTimeline } from "./training"
import type { ActivityKind, AppState, Area, PlanMode, PlannedExercise } from "./types"

export type StudioAction = {
  type:
    | "add_plan"
    | "move_plan"
    | "complete_plan"
    | "set_aside_plan"
    | "plan_progression"
    | "add_journal"
    | "add_project"
    | "add_goal"
    | "add_transaction"
    | "add_gym_session"
    | "log_activity"
  summary: string
  title: string | null
  body: string | null
  date: string | null
  time: string | null
  duration: number | null
  area: Area | null
  mode: PlanMode | null
  planId: string | null
  amount: number | null
  category: string | null
  scale: "small" | "big" | null
  milestones: string[] | null
  exercises: string[] | null
  nextAction: string | null
  effort?: "easy" | "comfortable" | "hard" | "very-hard" | null
  concern?: boolean | null
  kind?: ActivityKind | null
  goalId?: string | null
  why?: string | null
  details?: string[] | null
  workout?: PlannedExercise[] | null
  weeks?: number | null
}

export type StudioProposal = { reply: string; actions: StudioAction[]; sources?: { title: string; url: string }[] }

export type CoachSuggestion = {
  title: string
  summary: string
  why?: string
  goalId?: string | null
  exercises: PlannedExercise[]
}

async function post<T>(path: string, body: BodyInit, contentType: string) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 60000)
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": contentType, ...authHeaders() },
      body,
      signal: controller.signal,
    })
    const data = (await response.json().catch(() => ({}))) as T & {
      error?: string
    }
    if (!response.ok)
      throw new Error(
        data.error ||
          (response.status === 401
            ? "Enter your Studio passcode in My Studio to use AI."
            : response.status === 404
            ? "The AI service is not deployed here yet."
            : "Studio could not reach the AI service."),
      )
    return data as T
  } catch (error) {
    if (!navigator.onLine)
      throw new Error("You are offline. AI needs a connection.")
    if ((error as Error).name === "AbortError")
      throw new Error("That took too long. Please try again.")
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

const ai = <T>(task: string, input: string, context?: unknown) =>
  post<T>("/api/ai", JSON.stringify({ task, input, context }), "application/json")

export const localDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

// The current training phase, its focus, the week within it and its planned end.
function phaseSummary(state: AppState) {
  const { current, week, rows } = phaseTimeline(state)
  const next = rows.find((row) => row.id === current.id + 1)
  return {
    trainingFor: state.trainingPlan
      ? {
          purpose: state.trainingPlan.purpose,
          targetDate: state.trainingPlan.targetDate,
          // Only the shape of the week: old session notes can mention things that are no longer true.
          typicalWeek: state.trainingPlan.week.map((session) => ({
            day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][session.dayOffset] ?? session.dayOffset,
            title: session.title,
            kind: session.kind,
            duration: session.duration,
            exercises: session.workout?.map((exercise) => exercise.name),
          })),
        }
      : "Restart, then Hackney Half (16 May 2027) and FairPlay dance camp",
    number: current.id,
    title: current.title,
    focus: current.body,
    readyWhen: current.ready,
    week,
    plannedWeeks: current.weeks,
    started: current.start,
    endsAround: current.end,
    next: next && { title: next.title, startsAround: next.start },
  }
}

// What the AI needs to plan well: the calendar, goals, training answers and recent history.
function studioContext(state: AppState) {
  const now = new Date()
  const start = localDate(new Date(now.getTime() - 14 * 86400000))
  const end = localDate(new Date(now.getTime() + 21 * 86400000))
  const today = localDate(now)
  const profile = state.trainingProfile
  return {
    today,
    weekday: now.toLocaleDateString("en-GB", { weekday: "long" }),
    time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    timezone: "Europe/London",
    name: state.name,
    priorities: state.priorities,
    energy: state.checkIn,
    trainingPhase: state.trainingPhase ?? 1,
    phase: phaseSummary(state),
    // Things Studio had wrong, corrected by the user: these override everything else.
    corrections: (state.corrections ?? []).map((item) => `${item.text} (${item.at.slice(0, 10)})`),
    // In their own words: health goals, body, energy, week. Tailor everything to this.
    aboutMe: state.aboutMe && { ...Object.fromEntries(Object.entries(state.aboutMe).filter(([key, value]) => key !== "updatedAt" && value)), lastUpdated: state.aboutMe.updatedAt },
    notesForStudio: (state.movementNotes ?? []).slice(0, 12).map((note) => note.text),
    sleep: sleepContext(state),
    progression: state.trainingPlan?.progression?.filter((week) => week.weekStart >= localDate(new Date(Date.now() - 6 * 86400000))).slice(0, 8),
    profile: profile && {
      equipment: profile.equipment,
      gymExperience: profile.gymExperience,
      familiar: profile.familiar,
      walking: profile.walking,
      danceFrequency: profile.danceFrequency,
      danceIntensity: profile.danceIntensity,
      concern: profile.concern,
      concernNote: profile.concern === "yes" ? profile.concernNote : undefined,
      days: profile.days,
      minutes: profile.minutes,
    },
    // Explicit booked slots per day, so suggestions never overlap existing plans.
    busy: state.plan
      .filter(
        (item) =>
          item.time && item.date >= today && item.date <= end && item.status !== "let-go",
      )
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      .slice(0, 80)
      .map((item) => {
        const [h, m] = item.time!.split(":").map(Number)
        const finish = h * 60 + m + (item.duration ?? 30)
        const to = `${String(Math.floor(finish / 60) % 24).padStart(2, "0")}:${String(finish % 60).padStart(2, "0")}`
        return `${item.date} ${item.time}-${to} ${item.title}${item.mode === "fixed" ? " (fixed)" : ""}`
      }),
    plan: state.plan
      .filter((item) => item.date >= today && item.date <= end && item.status !== "let-go")
      .sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`))
      .slice(0, 80)
      .map(({ id, title, date, time, duration, mode, status, area, kind, intensity, optional }) => ({
        id,
        title,
        date,
        time,
        duration,
        mode,
        status,
        area,
        kind,
        intensity,
        optional,
      })),
    recentLogs: state.plan
      .filter((item) => item.status === "complete" && item.log && item.date >= start)
      .slice(-20)
      .map((item) => ({
        title: item.log?.summary ?? item.title,
        date: item.date,
        kind: item.kind,
        duration: item.log?.duration,
        effort: item.log?.effort,
        concern: item.log?.concern,
        wasClass: item.log?.wasClass,
      })),
    recentWorkouts: (state.workoutHistory ?? []).slice(0, 5).map((record) => ({
      date: record.date,
      effort: record.effort,
      concern: record.concern,
      exercises: record.exercises
        .map((exercise) => {
          const done = exercise.sets.filter((set) => set.done)
          const last = done[done.length - 1]
          return last
            ? {
                name: exercise.name,
                setsDone: done.length,
                reps: last.reps,
                seconds: last.seconds,
                weightKg: last.weight,
              }
            : null
        })
        .filter(Boolean),
    })),
    goals: state.goals.map(({ id, title, area, status, date, dateLabel, nextStep }) => ({
      id,
      title,
      area,
      status,
      date: date ?? dateLabel,
      nextStep,
    })),
  }
}

export type ChatTurn = { role: "user" | "studio"; text: string; suggested?: string[]; outcome?: string }

export const askStudio = (input: string, state: AppState, history: ChatTurn[] = [], search = false) =>
  post<StudioProposal>(
    "/api/ai",
    JSON.stringify({ task: "assist", input, context: { ...studioContext(state), history: history.slice(-12) }, search }),
    "application/json",
  )

export const askMoneyGuide = (question: string) =>
  ai<{ answer: string }>("guide", question).then((data) => data.answer)

export const suggestGymSession = (
  details: { goal: string; energy: string; equipment: string; note: string },
  state: AppState,
) =>
  ai<CoachSuggestion>("coach", details.note || "No extra notes.", {
    ...studioContext(state),
    sessionGoal: details.goal,
    energy: details.energy,
    equipmentToday: details.equipment,
  })

export type SessionPlan = CoachSuggestion & { duration: number; details: string[] }

// Studio plans one session (gym, run, walk or dance) with the whole week, phase, goals and body in mind.
export const planSession = (
  state: AppState,
  session: { kind: ActivityKind; date: string; time?: string; duration?: number; title?: string; note?: string },
) =>
  ai<SessionPlan>("coach", session.note || `Plan this ${session.kind} session for ${session.date}.`, {
    ...studioContext(state),
    session,
    energy: state.checkIn,
  })

export const suggestProjectSteps = (project: {
  title: string
  note: string
  existing: string[]
}) =>
  ai<{ steps: { title: string; minutes: number }[] }>(
    "steps",
    "Suggest the next small steps for this project.",
    project,
  ).then((data) => (Array.isArray(data.steps) ? data.steps : []))

export type WeeklyDigest = { headline: string; thisWeek: string; nextWeek: string; encouragement: string }

// Everything the weekly digest needs: this week's real activity and next week's plan.
export function digestContext(state: AppState, weekStart: string) {
  const today = localDate()
  const nextEnd = localDate(new Date(new Date(`${today}T12:00:00`).getTime() + 7 * 86400000))
  const goalTitle = (id?: string) => state.goals.find((goal) => goal.id === id)?.title
  const week = state.plan.filter((item) => item.date >= weekStart && item.date <= today)
  return {
    today,
    weekStart,
    name: state.name,
    done: week
      .filter((item) => item.status === "complete")
      .map((item) => ({
        title: item.log?.summary ?? item.title,
        kind: item.kind,
        area: item.area,
        goal: goalTitle(item.goalId),
        project: state.projects.find((project) => project.id === item.projectId)?.title,
        minutes: item.log?.duration,
        effort: item.log?.effort,
        concern: item.log?.concern,
        danceClass: item.log?.wasClass,
      })),
    setAside: week.filter((item) => item.status === "let-go").length,
    stepsDone: state.projects.flatMap((project) =>
      (project.steps ?? [])
        .filter((step) => step.doneAt && step.doneAt.slice(0, 10) >= weekStart)
        .map((step) => ({ project: project.title, step: step.title })),
    ),
    milestonesDone: state.goals.flatMap((goal) =>
      goal.milestones
        .filter((milestone) => milestone.completedAt && milestone.completedAt.slice(0, 10) >= weekStart)
        .map((milestone) => ({ goal: goal.title, milestone: milestone.title })),
    ),
    reflections: (state.roadmap?.reflections ?? [])
      .filter((item) => item.date >= weekStart)
      .map((item) => (item.title ? `${item.title}: ${item.text}` : item.text)),
    nextWeek: state.plan
      .filter((item) => item.date > today && item.date <= nextEnd && (item.status === "planned" || item.status === "proposed"))
      .map((item) => ({ title: item.title, date: item.date, kind: item.kind, goal: goalTitle(item.goalId), optional: item.optional || item.mode === "maybe" })),
    events: (state.journeyEvents ?? [])
      .filter((event) => event.date && event.date >= today)
      .map((event) => ({ title: event.title, date: event.date, feeling: event.feeling, goal: goalTitle(event.goalId) })),
    energy: state.checkIn,
    phase: phaseSummary(state),
  }
}

export const weeklyDigest = (state: AppState, weekStart: string) =>
  ai<WeeklyDigest>("digest", "Write my weekly digest.", digestContext(state, weekStart))

export type PlanDraft = {
  summary: string
  goalTitle: string
  cautions: string
  phases: { title: string; weeks: number; body: string; ready: string }[]
  week: {
    dayOffset: number
    title: string
    kind: "gym" | "walk" | "run" | "dance" | "recovery" | "journal" | "reset"
    time: string | null
    duration: number
    intensity: "light" | "moderate" | "hard"
    details: string[]
    optional: boolean
    workout: PlannedExercise[]
  }[]
}

// Studio writes a new training plan for a new purpose.
export const draftTrainingPlan = (
  state: AppState,
  request: { purpose: string; why: string; targetDate: string; days: string[]; minutes: string; keep: string },
) => {
  const base = studioContext(state)
  return ai<PlanDraft>(
    "replan",
    [
      `My new purpose: ${request.purpose}`,
      request.why && `Why it's changed: ${request.why}`,
      request.targetDate && `Target date: ${request.targetDate}`,
      request.keep && `Keep in my week: ${request.keep}`,
    ]
      .filter(Boolean)
      .join("\n"),
    {
      ...base,
      targetDate: request.targetDate || null,
      profile: { ...base.profile, days: request.days.length ? request.days : base.profile?.days, minutes: request.minutes || base.profile?.minutes },
      leavingPlan: { phase: base.phase, purpose: state.trainingPlan?.purpose ?? "Restart, then Hackney Half and dance camp" },
    },
  )
}

export type TurnReply = { reply: string; followUp: string | null; chips: string[] }

// One step of the setup conversation: Studio reacts to your answer (and may ask one follow-up).
export const onboardingTurn = (answer: string, context: { topic: string; question: string; transcript: { from: string; text: string }[]; followUpsAsked: number }) =>
  ai<TurnReply>("turn", answer || "(skipped)", { today: localDate(), ...context })

export type SetupDraft = {
  welcome: string
  aboutMe: { workingTowards: string; healthGoals: string; body: string; movementNow: string; equipment: string; week: string; energy: string; other: string }
  priorities: ("reflect" | "create" | "connect" | "move" | "money" | "home")[]
  density: "one" | "few" | "full"
  profile: { equipment: "gym" | "machines" | "dumbbells" | "home" | "not-sure"; gymExperience: string; days: string[]; minutes: string; concern: "no" | "yes" | "not-sure"; concernNote: string }
  goals: { title: string; area: "reflect" | "create" | "connect" | "move" | "money" | "home"; scale: "small" | "big"; date: string | null; why: string; milestones: string[] }[]
  // Things they already do on a set day: stay on that day, every week.
  commitments: { title: string; kind: "gym" | "walk" | "run" | "dance" | "recovery" | "social" | "create" | "none"; area: "reflect" | "create" | "connect" | "move" | "money" | "home"; dayOffset: number; frequency: "weekly" | "fortnightly"; time: string | null; duration: number }[]
  training: { include: boolean; purpose: string; targetDate: string | null; summary: string; phases: PlanDraft["phases"]; week: PlanDraft["week"] }
  routines: { title: string; frequency: "daily" | "weekdays" | "weekly"; time: string | null; duration: number }[]
}

// Studio turns the whole setup conversation into your starting space.
export const setupSpace = (transcript: { from: string; text: string }[], name: string) => {
  const now = new Date()
  return ai<SetupDraft>("setup", "Set up my Life Studio from our conversation.", {
    today: localDate(now),
    weekday: now.toLocaleDateString("en-GB", { weekday: "long" }),
    name,
    transcript,
  })
}

export type NextWeekDraft = { review: string; phaseReady: boolean; phaseNote: string; week: PlanDraft["week"] }

// Studio writes next week from what you actually did: progress small, repeat what was hard, ease pain.
export const planNextWeek = (state: AppState, weekStart: string) => {
  const base = studioContext(state)
  const plan = state.trainingPlan
  const from = localDate(new Date(new Date(`${weekStart}T12:00:00`).getTime() - 14 * 86400000))
  const end = localDate(new Date(new Date(`${weekStart}T12:00:00`).getTime() + 6 * 86400000))
  const goal = state.goals.find((item) => item.id === plan?.goalId)
  return ai<NextWeekDraft>("nextweek", `Plan my week starting ${weekStart}.`, {
    ...base,
    weekStart,
    // If there's a planned build-up, this week's step: follow it, adjusting to how last week went.
    plannedFocus: plan?.progression?.find((week) => week.weekStart === weekStart) ?? null,
    template: plan?.week ?? [],
    purpose: plan?.purpose,
    goal: goal && { title: goal.title, date: goal.date, nextMilestone: goal.milestones.find((milestone) => !milestone.completedAt)?.title ?? null },
    lastWeeks: state.plan
      .filter((item) => item.kind && item.date >= from && item.date < weekStart)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        title: item.title,
        kind: item.kind,
        date: item.date,
        status: item.status,
        effort: item.log?.effort,
        concern: item.log?.concern,
        note: item.log?.note,
        duration: item.log?.duration ?? item.duration,
        workout: item.workout?.map((exercise) => `${exercise.name} ${exercise.sets}×${exercise.reps} ${exercise.load}`),
      })),
    commitments: state.plan
      .filter((item) => item.seriesId && item.mode === "fixed" && item.date >= weekStart && item.date <= end)
      .map((item) => ({ title: item.title, date: item.date, time: item.time, kind: item.kind })),
  })
}

// Once a week: Studio suggests About me updates from your progress (you accept or dismiss each).
export const suggestAboutMe = (state: AppState) => {
  const from = localDate(new Date(Date.now() - 14 * 86400000))
  const { aboutMe } = state
  return ai<{ changes: { field: string; suggested: string; reason: string }[] }>("aboutme", "Suggest updates to my About me from the last two weeks.", {
    today: localDate(),
    aboutMe: aboutMe && Object.fromEntries(Object.entries(aboutMe).filter(([key]) => key !== "updatedAt")),
    phase: phaseSummary(state),
    goals: state.goals.filter((goal) => goal.status !== "complete").map((goal) => ({ title: goal.title, milestonesReached: goal.milestones.filter((milestone) => milestone.completedAt).map((milestone) => milestone.title) })),
    logs: state.plan
      .filter((item) => item.kind && item.date >= from && item.date <= localDate() && item.status !== "planned" && item.status !== "proposed")
      .map((item) => ({ title: item.title, kind: item.kind, date: item.date, status: item.status, effort: item.log?.effort, pain: item.log?.concern, note: item.log?.note })),
    workouts: (state.workoutHistory ?? []).filter((record) => record.date >= from).slice(0, 8),
    sleep: sleepContext(state),
    reflections: (state.roadmap?.reflections ?? []).filter((item) => item.date >= from).map((item) => item.text).slice(0, 8),
    messages: (state.chat ?? []).filter((message) => message.role === "user" && message.at >= from).map((message) => `${message.at.slice(0, 10)}: ${message.text}`).slice(-20),
    concern: state.trainingProfile?.concern === "yes" ? state.trainingProfile.concernNote ?? "yes" : "no",
    corrections: (state.corrections ?? []).map((item) => `${item.text} (${item.at.slice(0, 10)})`),
  })
}

export type ProgressionDraft = {
  summary: string
  path: { week: number; focus: string; keySession: string }[]
  sessions: (PlanDraft["week"][number] & { week: number })[]
}

// Several weeks of gradual build-up towards what you asked for, from where you are now.
export const planProgression = (state: AppState, request: string, weeks: number, startMonday: string) => {
  const end = localDate(new Date(new Date(`${startMonday}T12:00:00`).getTime() + (weeks * 7 - 1) * 86400000))
  return ai<ProgressionDraft>("progression", request, {
    ...studioContext(state),
    weeks,
    startMonday,
    commitments: Array.from(
      new Map(
        state.plan
          .filter((item) => item.seriesId && item.mode === "fixed" && item.date >= startMonday && item.date <= end)
          .map((item) => [`${item.title}-${new Date(`${item.date}T12:00:00`).getDay()}`, { title: item.title, weekday: new Date(`${item.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" }), time: item.time, kind: item.kind }]),
      ).values(),
    ),
  })
}
