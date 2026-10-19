import type { AppState, PlannedExercise } from "./types"
import { today, uid } from "./ui"

// Find and clean up old mentions of something that's no longer true (e.g. "ankle"),
// everywhere Studio reads from. Past logs and your own writing are never rewritten.

const pattern = (word: string) => {
  const stem = word.trim().toLowerCase().replace(/(es|s)$/, "")
  return stem.length < 3 ? null : new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")
}

const dropSentences = (text: string | undefined, match: RegExp) =>
  (text ?? "")
    .split(/(?<=[.!?;])\s+/)
    .filter((sentence) => !match.test(sentence))
    .join(" ")
    .trim()

const cleanWorkout = (workout: PlannedExercise[] | undefined, match: RegExp) =>
  workout?.map((exercise) => ({
    ...exercise,
    why: dropSentences(exercise.why, match) || "Part of this session",
    cue: exercise.cue && (dropSentences(exercise.cue, match) || undefined),
  }))

const workoutMentions = (workout: PlannedExercise[] | undefined, match: RegExp) =>
  (workout ?? []).some((exercise) => match.test(exercise.why) || (exercise.cue && match.test(exercise.cue)))

// Health cautions written into a plan earlier ("check with a professional before impact").
export const CAUTION = /\b(health ?professional|professional|physio\w*|GP|doctor|clinician|medical|before (any )?impact|impact training|clearance)\b/i

// Is anything flagged as current right now? (pain switch on, or pain logged in the last week)
export const currentConcern = (state: AppState) => {
  const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  return state.trainingProfile?.concern === "yes" || state.plan.some((item) => item.log?.concern && item.date >= week)
}

// Drop out-of-date cautions from plan text when nothing current is flagged.
export const withoutCautions = (text: string | undefined, state: AppState) =>
  !text || currentConcern(state) ? (text ?? "") : dropSentences(text, CAUTION)

export type Mentions = {
  sessions: number
  plan: number
  goals: number
  notes: number
  painLogs: number
  chat: number
  concern: boolean
  aboutMe: string[]
}

const isUpcoming = (item: AppState["plan"][number]) => item.date >= today() && (item.status === "planned" || item.status === "proposed")

export function findMentions(state: AppState, word: string): Mentions | null {
  const match = pattern(word)
  if (!match) return null
  const plan = state.trainingPlan
  const twoWeeks = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  return {
    sessions: state.plan.filter(
      (item) => isUpcoming(item) && ((item.details ?? []).some((line) => match.test(line)) || match.test(item.note ?? "") || workoutMentions(item.workout, match)),
    ).length,
    plan: plan
      ? [plan.summary, plan.purpose, ...plan.phases.flatMap((phase) => [phase.body, phase.ready]), ...plan.week.flatMap((session) => session.details)].filter((text) => match.test(text)).length +
        plan.week.filter((session) => workoutMentions(session.workout, match)).length
      : 0,
    goals: state.goals.filter((goal) => match.test(goal.nextStep ?? "")).length,
    notes: (state.movementNotes ?? []).filter((note) => match.test(note.text)).length,
    painLogs: state.plan.filter((item) => item.log?.concern && item.date >= twoWeeks).length,
    chat: (state.chat ?? []).filter((message) => match.test(message.text)).length,
    concern: state.trainingProfile?.concern === "yes" && match.test(state.trainingProfile.concernNote ?? word),
    aboutMe: Object.entries(state.aboutMe ?? {})
      .filter(([key, value]) => key !== "updatedAt" && typeof value === "string" && match.test(value))
      .map(([key]) => key),
  }
}

// Clean everything that was written for you (plans, notes, goals' next steps), clear the concern,
// mark recent pain logs as resolved, optionally start a new chat, and remember the correction.
export function cleanMentions(state: AppState, word: string, truth: string, options: { clearChat: boolean; resolvePain: boolean }): AppState {
  const match = pattern(word)
  if (!match) return state
  const plan = state.trainingPlan
  const twoWeeks = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  return {
    ...state,
    corrections: truth.trim()
      ? [{ id: uid(), text: truth.trim(), at: new Date().toISOString() }, ...(state.corrections ?? [])].slice(0, 10)
      : state.corrections,
    plan: state.plan.map((item) => {
      if (isUpcoming(item))
        return {
          ...item,
          details: item.details?.filter((line) => !match.test(line) && !CAUTION.test(line)),
          note: item.note && (dropSentences(item.note, match) || undefined),
          workout: cleanWorkout(item.workout, match),
        }
      if (options.resolvePain && item.log?.concern && item.date >= twoWeeks) return { ...item, log: { ...item.log, concern: false } }
      return item
    }),
    trainingPlan: plan && {
      ...plan,
      summary: dropSentences(dropSentences(plan.summary, match), CAUTION) || plan.summary,
      onTrack: plan.onTrack && (dropSentences(dropSentences(plan.onTrack, match), CAUTION) || undefined),
      phases: plan.phases.map((phase) => ({
        ...phase,
        body: dropSentences(dropSentences(phase.body, match), CAUTION) || phase.body,
        ready: dropSentences(dropSentences(phase.ready, match), CAUTION) || phase.ready,
      })),
      week: plan.week.map((session) => ({ ...session, details: session.details.filter((line) => !match.test(line) && !CAUTION.test(line)), workout: cleanWorkout(session.workout, match) })),
    },
    goals: state.goals.map((goal) => (match.test(goal.nextStep ?? "") ? { ...goal, nextStep: dropSentences(goal.nextStep, match) || goal.milestones.find((milestone) => !milestone.completedAt)?.title || "" } : goal)),
    movementNotes: (state.movementNotes ?? []).filter((note) => !match.test(note.text)),
    trainingProfile:
      state.trainingProfile?.concern === "yes" && match.test(state.trainingProfile.concernNote ?? word)
        ? { ...state.trainingProfile, concern: "no", concernNote: undefined }
        : state.trainingProfile,
    chat: options.clearChat ? [] : state.chat,
  }
}
