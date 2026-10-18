import { authHeaders } from "./sync"
import type { ActivityKind, AppState, Area, PlanMode, PlannedExercise } from "./types"

export type StudioAction = {
  type:
    | "add_plan"
    | "move_plan"
    | "complete_plan"
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
}

export type StudioProposal = { reply: string; actions: StudioAction[] }

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
    profile: profile && {
      equipment: profile.equipment,
      gymExperience: profile.gymExperience,
      familiar: profile.familiar,
      walking: profile.walking,
      danceFrequency: profile.danceFrequency,
      danceIntensity: profile.danceIntensity,
      concern: profile.concern,
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

export const askStudio = (input: string, state: AppState) =>
  ai<StudioProposal>("assist", input, studioContext(state))

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
