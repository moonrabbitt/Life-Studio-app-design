import type { AppState, Project, ProjectStep } from "./types"

export const projectSteps = (project: Project): ProjectStep[] =>
  project.steps ??
  (project.nextAction
    ? [{ id: `${project.id}-first`, title: project.nextAction, done: false }]
    : [])

export const nextStep = (project: Project) =>
  projectSteps(project).find((step) => !step.done)

// One-time tidy: each idea lives in one place, and old "next action" text becomes a step.
export function tidyProjects(state: AppState): AppState {
  let next = state
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

// Completing a plan item that came from a project step ticks that step.
export function reconcileProjects(input: AppState): AppState {
  const state = reconcileGoals(input)
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
