import type { SetupDraft } from "./ai"
import { createSeries, REPEAT_LABELS } from "./series"
import { startNewPlan } from "./training"
import type { AboutMe, AppState, Goal, TrainingPlan } from "./types"
import { formatDate, today, uid } from "./ui"

export type SetupChoices = {
  goals: boolean[]
  training: boolean
  routines: boolean[]
  aboutMe: Omit<AboutMe, "updatedAt">
}

// Set up from the top, starting fresh: current goals, routines and upcoming plans are archived
// (so nothing is truly lost); logs, done sessions, story, journal, people and projects stay.
export function applySetup(state: AppState, draft: SetupDraft, choices: SetupChoices, name: string): AppState {
  const now = today()
  const upcoming = state.plan.filter((item) => item.date >= now && (item.status === "planned" || item.status === "proposed"))
  const hasSomething = state.goals.length || state.routines.length || upcoming.length
  let next: AppState = {
    ...state,
    archives: hasSomething
      ? [
          { at: new Date().toISOString(), reason: "Set up again from the top", goals: state.goals, routines: state.routines, series: state.series ?? [], plan: upcoming },
          ...(state.archives ?? []),
        ].slice(0, 5)
      : state.archives,
    goals: [],
    routines: [],
    series: [],
    plan: state.plan.filter((item) => !upcoming.includes(item)),
  }

  const goals: Goal[] = draft.goals
    .filter((_, index) => choices.goals[index])
    .map((goal) => {
      const id = `goal-${uid().slice(0, 8)}`
      return {
        id,
        title: goal.title,
        area: goal.area,
        scale: goal.scale,
        date: goal.date && /^\d{4}-\d{2}-\d{2}$/.test(goal.date) ? goal.date : undefined,
        status: "tending",
        nextStep: goal.milestones[0] ?? goal.why,
        milestones: goal.milestones.map((title, index) => ({ id: `${id}-m${index + 1}`, title })),
      }
    })

  next = {
    ...next,
    name: name.trim() || state.name,
    onboarded: true,
    tourDone: false,
    priorities: draft.priorities.length ? draft.priorities : state.priorities,
    density: draft.density,
    restartOffer: "dismissed",
    aboutMe: { ...choices.aboutMe, updatedAt: new Date().toISOString() },
    trainingProfile: {
      completedAt: new Date().toISOString(),
      activity: choices.aboutMe.movementNow,
      walking: "",
      gymExperience: draft.profile.gymExperience,
      familiar: [],
      equipment: draft.profile.equipment,
      danceFrequency: "",
      danceIntensity: "",
      concern: draft.profile.concern,
      concernNote: draft.profile.concernNote || undefined,
      days: draft.profile.days,
      minutes: draft.profile.minutes,
    },
    goals,
  }

  const training = draft.training
  if (choices.training && training.include && training.phases.length && training.week.length) {
    const id = uid()
    const target = training.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(training.targetDate) ? training.targetDate : undefined
    const linked = goals.find((goal) => goal.area === "move" && goal.scale === "big") ?? goals.find((goal) => goal.area === "move")
    const plan: TrainingPlan = {
      id,
      purpose: training.purpose,
      targetDate: target,
      targetLabel: target ? formatDate(target, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : undefined,
      summary: training.summary,
      createdAt: new Date().toISOString(),
      phases: training.phases.slice(0, 6).map((phase, index) => ({ ...phase, id: index + 1, weeks: Math.max(1, Math.min(52, phase.weeks || 1)) })),
      week: training.week.map((session) => ({
        ...session,
        time: session.time && /^\d{2}:\d{2}$/.test(session.time) ? session.time : undefined,
        duration: Math.max(5, Math.min(240, session.duration || 30)),
      })),
      goalId: linked?.id,
    }
    next = startNewPlan(next, plan, "Set up again from the top")
  }

  draft.routines
    .filter((_, index) => choices.routines[index])
    .forEach((routine) => {
      const id = uid()
      const created = createSeries(
        { ...next, routines: [...next.routines, { id, title: routine.title, cadence: REPEAT_LABELS[routine.frequency], completedDates: [] }] },
        {
          title: routine.title,
          area: "home",
          mode: "flexible",
          time: routine.time && /^\d{2}:\d{2}$/.test(routine.time) ? routine.time : undefined,
          duration: routine.duration || 15,
          details: ["A routine. Ticking it here marks it done in Home & routine."],
        },
        routine.frequency,
        now,
        undefined,
        { routineId: id },
      )
      next = { ...created.state, routines: created.state.routines.map((item) => (item.id === id ? { ...item, seriesId: created.series.id } : item)) }
    })

  return next
}

// Bring back what was archived when you set up again (anything not already there).
export function restoreArchive(state: AppState, index: number): AppState {
  const archive = state.archives?.[index]
  if (!archive) return state
  const has = (ids: string[], id: string) => ids.includes(id)
  const goalIds = state.goals.map((goal) => goal.id)
  const routineIds = state.routines.map((routine) => routine.id)
  const seriesIds = (state.series ?? []).map((series) => series.id)
  const planIds = state.plan.map((item) => item.id)
  return {
    ...state,
    goals: [...state.goals, ...archive.goals.filter((goal) => !has(goalIds, goal.id))],
    routines: [...state.routines, ...archive.routines.filter((routine) => !has(routineIds, routine.id))],
    series: [...(state.series ?? []), ...archive.series.filter((series) => !has(seriesIds, series.id))],
    plan: [...state.plan, ...archive.plan.filter((item) => !has(planIds, item.id) && item.date >= today())],
    archives: (state.archives ?? []).filter((_, position) => position !== index),
  }
}
