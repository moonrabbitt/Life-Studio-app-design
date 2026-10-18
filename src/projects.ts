import type { AppState, Project, ProjectStep } from "./types"

export const projectSteps = (project: Project): ProjectStep[] =>
  project.steps ??
  (project.nextAction
    ? [{ id: `${project.id}-first`, title: project.nextAction, done: false }]
    : [])

export const nextStep = (project: Project) =>
  projectSteps(project).find((step) => !step.done)

// Hackney Half and FairPlay used to be special cases; they become ordinary events.
function seedEvents(state: AppState): AppState {
  if (state.journeyEvents) return state
  const flags = state.events ?? {}
  return {
    ...state,
    journeyEvents: [
      {
        id: "event-hackney",
        title: "Race day",
        date: "2027-05-16",
        location: "Hackney Marshes, London",
        links: [{ label: "Official site", url: "https://www.hackneymoves.com/2027" }],
        note: "Date confirmed on the official site.",
        feeling: "nervous",
        booked: !!flags.hackneyBooked,
        goalId: state.goals.some((goal) => goal.id === "goal-race") ? "goal-race" : undefined,
      },
      {
        id: "event-fairplay",
        title: "The camp",
        date: flags.fairplayConfirmed ? "2027-08-01" : undefined,
        endDate: flags.fairplayConfirmed ? "2027-08-08" : undefined,
        dateTBC: !flags.fairplayConfirmed,
        location: "Kraków, Poland",
        links: [{ label: "Official site", url: "https://fpdancecamp.com/en/" }],
        note: flags.fairplayConfirmed
          ? "Dates confirmed by you."
          : "Reported as 1–8 Aug 2027 in Kraków, but not yet verified on the official site.",
        booked: !!flags.fairplayBooked,
        goalId: state.goals.some((goal) => goal.id === "goal-dance") ? "goal-dance" : undefined,
      },
    ],
  }
}

// One-time tidy: each idea lives in one place, and old "next action" text becomes a step.
export function tidyProjects(input: AppState): AppState {
  let next = seedEvents(input)
  const filmGoal = next.goals.find((goal) => goal.id === "goal-film")
  const filmProject = next.projects.find((project) => project.id === "project-1")
  if (filmGoal && filmProject && !filmProject.steps) {
    next = {
      ...next,
      goals: next.goals.filter((goal) => goal.id !== "goal-film"),
      projects: next.projects.map((project) =>
        project.id === "project-1"
          ? {
              ...project,
              steps: filmGoal.milestones.map((milestone) => ({
                id: milestone.id,
                title: milestone.title,
                done: !!milestone.completedAt,
                doneAt: milestone.completedAt,
              })),
              stage: filmGoal.milestones.some((milestone) => milestone.completedAt)
                ? "Making"
                : project.stage,
            }
          : project,
      ),
      plan: next.plan.map((item) =>
        item.goalId === "goal-film" ? { ...item, goalId: undefined, projectId: "project-1" } : item,
      ),
    }
  }
  if (next.projects.some((project) => !project.steps))
    next = {
      ...next,
      projects: next.projects.map((project) =>
        project.steps ? project : { ...project, steps: projectSteps(project) },
      ),
    }
  return next
}

// Completing a plan item that came from a goal step or milestone ticks it.
function reconcileGoals(state: AppState): AppState {
  const done = new Map(
    state.plan
      .filter((item) => item.goalId && item.milestoneId && item.status === "complete")
      .map((item) => [`${item.goalId}:${item.milestoneId}`, item.log?.completedAt]),
  )
  if (!done.size) return state
  let changed = false
  const goals = state.goals.map((goal) => {
    let touched = false
    const milestones = goal.milestones.map((milestone) => {
      const key = `${goal.id}:${milestone.id}`
      if (milestone.completedAt || !done.has(key)) return milestone
      touched = true
      return { ...milestone, completedAt: done.get(key) ?? new Date().toISOString() }
    })
    if (!touched) return goal
    changed = true
    return { ...goal, milestones }
  })
  return changed ? { ...state, goals } : state
}

// Completing a calendar entry made from a routine marks the routine done that day.
function reconcileRoutines(state: AppState): AppState {
  const linked = (state.series ?? []).filter((series) => series.routineId)
  if (!linked.length) return state
  let changed = false
  const routines = state.routines.map((routine) => {
    const ids = linked.filter((series) => series.routineId === routine.id).map((series) => series.id)
    if (!ids.length) return routine
    const dates = state.plan
      .filter((item) => item.seriesId && ids.includes(item.seriesId) && item.status === "complete")
      .map((item) => item.date)
      .filter((date) => !routine.completedDates.includes(date))
    if (!dates.length) return routine
    changed = true
    return { ...routine, completedDates: [...routine.completedDates, ...dates] }
  })
  return changed ? { ...state, routines } : state
}

// Completing a plan item that came from a project step ticks that step.
export function reconcileProjects(input: AppState): AppState {
  const state = reconcileRoutines(reconcileGoals(input))
  const done = new Map(
    state.plan
      .filter((item) => item.projectId && item.stepId && item.status === "complete")
      .map((item) => [`${item.projectId}:${item.stepId}`, item.log?.completedAt]),
  )
  if (!done.size) return state
  let changed = false
  const projects = state.projects.map((project) => {
    let touched = false
    const steps = projectSteps(project).map((step) => {
      const key = `${project.id}:${step.id}`
      if (step.done || !done.has(key)) return step
      touched = true
      return { ...step, done: true, doneAt: done.get(key) ?? new Date().toISOString() }
    })
    if (!touched) return project
    changed = true
    return { ...project, steps, stage: project.stage === "Seed" ? ("Making" as const) : project.stage }
  })
  return changed ? { ...state, projects } : state
}
