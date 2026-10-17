export type Area = "reflect" | "create" | "connect" | "move" | "money" | "home"

export type PlanMode = "fixed" | "flexible" | "maybe"
export type PlanStatus = "planned" | "complete" | "let-go"

export type PlanStep = {
  id: string
  title: string
  complete: boolean
}

export type PlanItem = {
  id: string
  title: string
  area: Area
  date: string
  time?: string
  duration?: number
  mode: PlanMode
  status: PlanStatus
  note?: string
  goalId?: string
  steps?: PlanStep[]
}

export type JournalEntry = {
  id: string
  title: string
  body: string
  date: string
  mood?: string
}

export type Project = {
  id: string
  title: string
  note: string
  stage: "Seed" | "Exploring" | "Making" | "Resting" | "Complete"
  nextAction?: string
  estimatedCost?: number
}

export type Person = {
  id: string
  name: string
  note: string
  lastConnected?: string
  nextTouch?: string
}

export type Transaction = {
  id: string
  title: string
  amount: number
  date: string
  category: string
}

export type Routine = {
  id: string
  title: string
  cadence: string
  completedDates: string[]
}

export type Goal = {
  id: string
  title: string
  area: Area
  scale: "small" | "big"
  date?: string
  dateLabel?: string
  status: "tending" | "paused" | "complete"
  nextStep: string
  milestones: {
    id: string
    title: string
    completedAt?: string
  }[]
}

export type WorkoutSet = {
  id: string
  exercise: string
  reps: number
  weight?: number
  complete: boolean
}

export type WorkoutDraft = {
  active: boolean
  startedAt?: number
  current: number
  sets: WorkoutSet[]
}

export type CheckIn = "low" | "steady" | "open"

export type VoiceNote = {
  id: string
  title: string
  createdAt: string
  duration: number
}

export type MovementNote = {
  id: string
  text: string
  createdAt: string
}

export type GymSessionPlan = {
  id: string
  title: string
  createdAt: string
  goal: string
  note?: string
  exercises: string[]
}

export type BreatheSession = {
  id: string
  duration: number
  completedAt: string
  note?: string
}

export type AppState = {
  version: 1
  onboarded: boolean
  name: string
  priorities: Area[]
  density: "one" | "few" | "full"
  checkIn: CheckIn
  plan: PlanItem[]
  journal: JournalEntry[]
  projects: Project[]
  people: Person[]
  transactions: Transaction[]
  routines: Routine[]
  goals: Goal[]
  workout: WorkoutDraft
  voiceNotes: VoiceNote[]
  moneyLessonsCompleted: string[]
  movementNotes: MovementNote[]
  gymSessionPlans: GymSessionPlan[]
  breatheSessions: BreatheSession[]
}
