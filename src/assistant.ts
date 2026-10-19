import { localDate, type StudioAction, type StudioProposal } from "./ai"
import { areaMeta } from "./data"
import { removePlanItem } from "./series"
import { checkPlacement } from "./training"
import type { ActivityKind, AppState, Area, PlanItem } from "./types"

export type SpaceKey = Area | "breathe" | "preferences" | "about" | "sleep"
import { formatDate, today, uid } from "./ui"

export const areaKeys = Object.keys(areaMeta) as Area[]
export const isDate = (value: string | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
export const isTime = (value: string | null): value is string =>
  !!value && /^\d{2}:\d{2}$/.test(value)

export const blankAction = (
  type: StudioAction["type"],
  summary: string,
): StudioAction => ({
  type,
  summary,
  title: null,
  body: null,
  date: null,
  time: null,
  duration: null,
  area: null,
  mode: null,
  planId: null,
  amount: null,
  category: null,
  scale: null,
  milestones: null,
  exercises: null,
  nextAction: null,
  effort: null,
  concern: null,
  kind: null,
  goalId: null,
  why: null,
  details: null,
  workout: null,
})

// Offline fallback: a small keyword parser used when the AI service is unreachable.
export function offlineProposal(text: string, state: AppState): StudioProposal {
  const lower = text.toLowerCase()
  const reply = "Studio is offline, so here is a simple suggestion to review."
  if (lower.includes("gym") || lower.includes("workout")) {
    return {
      reply,
      actions: [
        {
          ...blankAction("add_gym_session", "Add a gentle gym session to Today"),
          title: "Gentle gym session",
          duration: 35,
          exercises: lower.includes("dance")
            ? ["Supported split squat", "Cable row", "Incline push"]
            : ["Sit to stand or leg press", "Supported row", "Calf raise"],
        },
      ],
    }
  }
  if (lower.includes("move") || lower.includes("reschedule")) {
    const item = state.plan.find(
      (candidate) =>
        candidate.status === "planned" && candidate.mode !== "fixed",
    )
    if (!item) return { reply: "There is no flexible plan to move.", actions: [] }
    const date = new Date(`${item.date}T12:00:00`)
    date.setDate(date.getDate() + 1)
    return {
      reply,
      actions: [
        {
          ...blankAction("move_plan", `Move “${item.title}” to tomorrow`),
          planId: item.id,
          date: localDate(date),
        },
      ],
    }
  }
  if (lower.includes("spent") || lower.includes("£")) {
    const amount = Number(text.match(/£(\d+(?:\.\d{1,2})?)/)?.[1] ?? 0)
    return {
      reply,
      actions: [
        {
          ...blankAction("add_transaction", `Add a £${amount} expense`),
          title:
            text.replace(/spent|£\d+(?:\.\d{1,2})?/gi, "").trim() ||
            "Captured expense",
          amount,
          category: "Captured",
        },
      ],
    }
  }
  if (lower.startsWith("journal")) {
    return {
      reply,
      actions: [
        {
          ...blankAction("add_journal", "Save a journal entry"),
          title: "Captured reflection",
          body: text.replace(/^journal:\s*/i, ""),
        },
      ],
    }
  }
  if (lower.includes("goal")) {
    return {
      reply,
      actions: [
        {
          ...blankAction("add_goal", "Add a goal to shape with milestones"),
          title:
            text.split(":").slice(1).join(":").trim() ||
            "A new goal to shape over time",
          scale: lower.includes("big") ? "big" : "small",
        },
      ],
    }
  }
  if (lower.includes("plan my") || lower.includes("balanced day")) {
    return {
      reply,
      actions: [
        {
          ...blankAction("add_plan", "Add a gentle focus to Today"),
          title: "Choose one thing that would make today feel mine",
          duration: 20,
        },
      ],
    }
  }
  return {
    reply,
    actions: [
      {
        ...blankAction("add_project", "Capture this as a project idea"),
        title: "A captured idea",
        body: text.replace(/^idea:\s*/i, ""),
      },
    ],
  }
}

export const EXERCISE_KINDS: ActivityKind[] = ["gym", "walk", "run", "dance"]

// The planning details the AI attached: why, how, linked goal and exact workout.
// If Studio forgets to say what kind of movement something is, work it out from the words,
// so it still gets a workout, a timer and logging.
export function guessKind(title: string, area?: string): ActivityKind | undefined {
  const text = title.toLowerCase()
  if (/\b(gym|strength|weights?|lift|squat|full[- ]body|workout)\b/.test(text)) return "gym"
  if (/\b(run|jog|couch to 5k|c25k|5k|10k|half)\b/.test(text)) return "run"
  if (/\b(walk|hike|stroll)\b/.test(text)) return "walk"
  if (/\b(dance|class|choreo|salsa|ballet|heels)\b/.test(text)) return "dance"
  if (/\b(stretch|yoga|mobility|pilates|foam roll|recovery)\b/.test(text)) return "recovery"
  return area === "move" ? "recovery" : undefined
}

function plannedExtras(current: AppState, action: StudioAction) {
  const kind = action.kind ?? (action.area === "move" || action.workout?.length ? guessKind(action.title ?? "", action.area ?? undefined) ?? (action.workout?.length ? "gym" : undefined) : undefined)
  const workout = action.workout?.filter((item) => item?.name?.trim()) ?? []
  return {
    kind,
    intensity:
      kind === "walk" ? ("light" as const) : kind && EXERCISE_KINDS.includes(kind) ? ("moderate" as const) : undefined,
    goalId: current.goals.some((goal) => goal.id === action.goalId)
      ? (action.goalId ?? undefined)
      : undefined,
    details: [action.why ?? "", ...(action.details ?? [])].filter((line) => line.trim()),
    workout: workout.length ? workout : undefined,
  }
}

export function applyAction(current: AppState, action: StudioAction): AppState {
  const area =
    action.area && areaKeys.includes(action.area) ? action.area : undefined
  const date = isDate(action.date) ? action.date : today()
  const title = action.title?.trim()
  switch (action.type) {
    case "add_plan": {
      const extras = plannedExtras(current, action)
      return {
        ...current,
        plan: [
          ...current.plan,
          {
            id: uid(),
            title: title || "A new plan",
            area:
              extras.kind && EXERCISE_KINDS.includes(extras.kind)
                ? "move"
                : (area ?? current.priorities[0] ?? "home"),
            date,
            time: isTime(action.time) ? action.time : undefined,
            duration: action.duration ?? undefined,
            mode: action.mode ?? "flexible",
            status: "planned",
            note: action.body ?? undefined,
            ...extras,
          },
        ],
      }
    }
    case "plan_progression":
      // Planned asynchronously by the chat (it needs Studio to write the weeks).
      return current
    case "delete_plan": {
      const item = current.plan.find((candidate) => candidate.id === action.planId)
      return item ? removePlanItem(current, item, action.scope === "future" ? "future" : "this") : current
    }
    case "move_plan":
    case "complete_plan":
    case "set_aside_plan":
      return {
        ...current,
        plan: current.plan.map((item) =>
          item.id !== action.planId
            ? item
            : action.type === "set_aside_plan"
              ? { ...item, status: "let-go" }
              : action.type === "complete_plan"
              ? { ...item, status: "complete" }
              : {
                  ...item,
                  date,
                  time: isTime(action.time) ? action.time : item.time,
                },
        ),
      }
    case "add_journal":
      return {
        ...current,
        journal: [
          {
            id: uid(),
            title: title || "Captured reflection",
            body: action.body ?? "",
            date,
          },
          ...current.journal,
        ],
      }
    case "add_project":
      return {
        ...current,
        projects: [
          {
            id: uid(),
            title: title || "A captured idea",
            note: action.body ?? "",
            stage: "Seed",
            nextAction: action.nextAction ?? "Give it twenty curious minutes",
          },
          ...current.projects,
        ],
      }
    case "add_goal":
      return {
        ...current,
        goals: [
          {
            id: uid(),
            title: title || "A new goal to shape over time",
            area: area ?? current.priorities[0] ?? "create",
            scale: action.scale ?? "small",
            status: "tending",
            nextStep:
              action.nextAction ?? "Choose the smallest meaningful first step",
            milestones: (action.milestones ?? []).map((milestone) => ({
              id: uid(),
              title: milestone,
            })),
          },
          ...current.goals,
        ],
      }
    case "add_transaction":
      return {
        ...current,
        transactions: [
          {
            id: uid(),
            title: title || "Captured expense",
            amount: Math.round(Math.abs(action.amount ?? 0) * 100),
            date,
            category: action.category ?? "Captured",
          },
          ...current.transactions,
        ],
      }
    case "log_activity": {
      const log = {
        completedAt: new Date().toISOString(),
        summary: title || "Activity",
        duration: action.duration ?? undefined,
        effort: action.effort ?? undefined,
        note: action.body ?? undefined,
        concern: action.concern ?? undefined,
      }
      const target = current.plan.find((item) => item.id === action.planId)
      if (target?.status === "complete") return current
      if (target)
        return {
          ...current,
          plan: current.plan.map((item) =>
            item.id === target.id ? { ...item, status: "complete", log } : item,
          ),
        }
      return {
        ...current,
        plan: [
          ...current.plan,
          {
            id: uid(),
            title: title || "Activity",
            area: area ?? "move",
            date,
            duration: action.duration ?? undefined,
            mode: "flexible",
            status: "complete",
            log,
          },
        ],
      }
    }
    case "add_gym_session": {
      const sessionId = uid()
      const extras = plannedExtras(current, { ...action, kind: "gym" })
      const exercises = extras.workout?.length
        ? extras.workout.map((item) => item.name)
        : action.exercises?.length
          ? action.exercises
          : ["Sit to stand or leg press", "Supported row", "Calf raise"]
      return {
        ...current,
        gymSessionPlans: [
          {
            id: sessionId,
            title: title || "Gentle gym session",
            createdAt: new Date().toISOString(),
            goal: "Studio suggestion",
            exercises,
          },
          ...(current.gymSessionPlans ?? []),
        ],
        workout: {
          active: false,
          current: 0,
          sets: exercises.flatMap((exercise) =>
            [1, 2].map((round) => ({
              id: `${sessionId}-${exercise}-${round}`,
              exercise,
              reps: 8,
              complete: false,
            })),
          ),
        },
        plan: [
          ...current.plan,
          {
            id: uid(),
            title: title || "Gentle gym session",
            area: "move",
            date,
            time: isTime(action.time) ? action.time : undefined,
            duration: action.duration ?? 35,
            mode: "flexible",
            status: "planned",
            note: "Suggested by Studio. Edit it to suit you.",
            ...extras,
          },
        ],
      }
    }
    default:
      return current
  }
}

export type Destination =
  | { kind: "plan"; date: string }
  | { kind: "space"; space: SpaceKey }
  | { kind: "progress" }

// Where each confirmed change lives, so the assistant can say "go there".
export function destinationOf(action: StudioAction, state: AppState): { label: string; to: Destination } {
  const date = isDate(action.date) ? action.date : today()
  const day = date === today() ? "today" : formatDate(date, { weekday: "long", day: "numeric", month: "short" })
  switch (action.type) {
    case "add_journal":
      return { label: "Saved in your Journal", to: { kind: "space", space: "reflect" } }
    case "add_project":
      return { label: "New project in Projects", to: { kind: "space", space: "create" } }
    case "add_goal":
      return { label: "New goal in Journey", to: { kind: "progress" } }
    case "add_transaction":
      return { label: "Added to Money", to: { kind: "space", space: "money" } }
    case "move_plan":
    case "complete_plan": {
      const item = state.plan.find((candidate) => candidate.id === action.planId)
      const target = action.type === "move_plan" ? date : (item?.date ?? date)
      return {
        label: action.type === "move_plan" ? `Moved in your Plan to ${target === today() ? "today" : formatDate(target, { weekday: "long" })}` : "Marked done in your Plan",
        to: { kind: "plan", date: target },
      }
    }
    case "plan_progression":
      return { label: `${action.weeks ?? 6} weeks added to your Plan as suggestions`, to: { kind: "plan", date: today() } }
    case "delete_plan": {
      const item = state.plan.find((candidate) => candidate.id === action.planId)
      return { label: action.scope === "future" ? "Deleted from your Plan, from that day on" : "Deleted from your Plan", to: { kind: "plan", date: item?.date ?? date } }
    }
    case "set_aside_plan": {
      const item = state.plan.find((candidate) => candidate.id === action.planId)
      return { label: "Set aside · it’s under Plan → Set aside", to: { kind: "plan", date: item?.date ?? date } }
    }
    case "log_activity":
      return { label: "Logged in your Plan and Journey", to: { kind: "plan", date } }
    default:
      return { label: `Added to your Plan · ${day}`, to: { kind: "plan", date } }
  }
}


// Moving or completing needs a real, still-open plan item.
export function isValidAction(state: AppState, action: StudioAction) {
  if (action.type === "delete_plan") return state.plan.some((item) => item.id === action.planId)
  if (action.type === "move_plan" || action.type === "complete_plan" || action.type === "set_aside_plan")
    return state.plan.some((item) => item.id === action.planId && item.status !== "complete")
  if (action.type === "log_activity" && action.planId)
    return state.plan.some((item) => item.id === action.planId && item.status !== "complete")
  return true
}

// Safety net: check a suggestion against the real calendar and recovery rules.
export function actionWarnings(state: AppState, action: StudioAction) {
  if (!isDate(action.date)) return []
  const time = isTime(action.time) ? action.time : undefined
  const existing =
    action.type === "move_plan" ? state.plan.find((item) => item.id === action.planId) : undefined
  if (action.type === "move_plan" && !existing) return []
  if (!existing && action.type !== "add_plan" && action.type !== "add_gym_session") return []
  const candidate: PlanItem = existing ?? {
    id: "suggestion",
    title: action.title ?? "",
    area: "move",
    date: action.date,
    mode: "flexible",
    status: "planned",
    duration: action.duration ?? undefined,
    kind: action.type === "add_gym_session" ? "gym" : (action.kind ?? undefined),
    intensity: action.kind === "walk" ? "light" : undefined,
  }
  const { conflicts, warnings } = checkPlacement(
    state.plan,
    { ...candidate, duration: action.duration ?? candidate.duration },
    action.date,
    time ?? existing?.time,
  )
  const kind = candidate.kind ?? guessKind(candidate.title, action.area ?? undefined)
  const twin =
    !existing &&
    state.plan.find(
      (item) =>
        item.date === action.date &&
        (item.status === "planned" || item.status === "proposed") &&
        ((kind && item.kind === kind && kind !== "walk") || item.title.trim().toLowerCase() === candidate.title.trim().toLowerCase()),
    )
  return [
    ...(twin ? [`You already have “${twin.title}” that day`] : []),
    ...conflicts.map((other) => `Overlaps ${other.title} at ${other.time}`),
    ...warnings,
  ]
}
