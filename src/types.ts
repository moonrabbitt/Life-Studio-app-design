export type Area = "reflect" | "create" | "connect" | "move" | "money" | "home"

export type PlanMode = "fixed" | "flexible" | "maybe"
// proposed = suggested, not yet accepted · planned = accepted · complete = actually done · let-go = skipped
export type PlanStatus = "proposed" | "planned" | "complete" | "let-go"

export type ActivityKind =
  | "gym"
  | "walk"
  | "run"
  | "dance"
  | "recovery"
  | "money"
  | "create"
  | "social"
  | "reset"
  | "journal"

// An exercise suggested by the coach or assistant, with exact guidance.
export type PlannedExercise = {
  name: string
  sets: number
  reps: string
  rest: string
  load: string
  why: string
  cue?: string
}

export type Effort = "easy" | "comfortable" | "hard" | "very-hard"

export type ActivityLog = {
  completedAt: string
  summary: string
  duration?: number
  effort?: Effort
  note?: string
  concern?: boolean
  shortVersion?: boolean
  wasClass?: boolean
  workoutId?: string
}

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
  kind?: ActivityKind
  phase?: "restart"
  batch?: string
  details?: string[]
  shortVersion?: { duration: number; note: string }
  optional?: boolean
  intensity?: "light" | "moderate" | "hard"
  workout?: PlannedExercise[]
  log?: ActivityLog
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
  uploaded?: boolean
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

export type LoggedSet = { reps?: number; weight?: number; seconds?: number; done: boolean }

export type WorkoutRecord = {
  id: string
  planId?: string
  date: string
  title: string
  duration?: number
  effort?: Effort
  note?: string
  concern?: boolean
  exercises: { id: string; name: string; sets: LoggedSet[] }[]
}

export type TrainingProfile = {
  completedAt: string
  activity: string
  walking: string
  gymExperience: string
  familiar: string[]
  equipment: "gym" | "machines" | "dumbbells" | "home" | "not-sure"
  danceFrequency: string
  danceIntensity: string
  concern: "no" | "yes" | "not-sure"
  concernNote?: string
  days: string[]
  minutes: string
}

export type WeeklyReview = {
  id: string
  weekStart: string
  date: string
  energy?: string
  recovery?: string
  barriers?: string
  adjustments?: string
  decision?: "repeat" | "reduce" | "next-phase"
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
  workoutHistory: WorkoutRecord[]
  weeklyReviews: WeeklyReview[]
  trainingProfile?: TrainingProfile
  restartOffer?: "dismissed" | "added"
  trainingPhase?: 1 | 2 | 3 | 4 | 5
  events?: { fairplayConfirmed?: boolean; hackneyBooked?: boolean; fairplayBooked?: boolean }
}
