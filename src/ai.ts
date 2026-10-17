import { authHeaders } from "./sync"
import type { AppState, Area, PlanMode } from "./types"

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
}

export type StudioProposal = { reply: string; actions: StudioAction[] }

export type CoachSuggestion = {
  title: string
  summary: string
  exercises: { name: string; cue: string }[]
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

function studioContext(state: AppState) {
  const now = new Date()
  const start = localDate(new Date(now.getTime() - 2 * 86400000))
  const end = localDate(new Date(now.getTime() + 21 * 86400000))
  return {
    today: localDate(now),
    weekday: now.toLocaleDateString("en-GB", { weekday: "long" }),
    time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    name: state.name,
    priorities: state.priorities,
    energy: state.checkIn,
    plan: state.plan
      .filter((item) => item.date >= start && item.date <= end)
      .slice(0, 60)
      .map(({ id, title, date, time, duration, mode, status, area }) => ({
        id,
        title,
        date,
        time,
        duration,
        mode,
        status,
        area,
      })),
    goals: state.goals.map(({ id, title, area, status, date, dateLabel }) => ({
      id,
      title,
      area,
      status,
      date: date ?? dateLabel,
    })),
  }
}

export const askStudio = (input: string, state: AppState) =>
  ai<StudioProposal>("assist", input, studioContext(state))

export const askMoneyGuide = (question: string) =>
  ai<{ answer: string }>("guide", question).then((data) => data.answer)

export const suggestGymSession = (details: {
  goal: string
  energy: string
  equipment: string
  note: string
}) =>
  ai<CoachSuggestion>("coach", details.note || "No extra notes.", {
    goal: details.goal,
    energy: details.energy,
    equipment: details.equipment,
  })
