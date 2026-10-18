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

export type RepeatFrequency = "daily" | "weekdays" | "weekly" | "fortnightly" | "monthly"

// A repeating plan: occurrences are real plan items generated a few weeks ahead.
export type Series = {
  id: string
  template: Omit<PlanItem, "id" | "date" | "status" | "log" | "seriesId">
  frequency: RepeatFrequency
  start: string
  until?: string
  exceptions: string[]
  routineId?: string
}

export type EventLink = { label: string; url: string }

// Something on a date to look forward to (a race day, camp, trip, concert…).
export type JourneyEvent = {
  id: string
  title: string
  date?: string
  endDate?: string
  dateTBC?: boolean
  location?: string
  links: EventLink[]
  note?: string
  booked?: boolean
  goalId?: string
  planItemId?: string
  feeling?: "excited" | "nervous" | "mixed" | "not-sure"
  hideCountdown?: boolean
}

// A pre-planned workout you can reuse and add to any day.
export type WorkoutTemplate = {
  id: string
  name: string
  exercises: PlannedExercise[]
}

export type ChatMessage = {
  id: string
  role: "user" | "studio"
  text: string
  at: string
  // Suggested changes attached to a Studio reply, and what happened to them.
  actions?: unknown[]
  status?: "pending" | "saved" | "dismissed"
  saved?: { summary: string; label: string; to: unknown }[]
  // Pages Studio read when you asked it to search the web.
  sources?: { title: string; url: string }[]
}

// A reflection, or a moment you add yourself (with a title), on your journey.
export type RoadmapReflection = {
  id: string
  date: string
  text: string
  phase: number
  title?: string
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
  phase?: "restart" | "plan"
  batch?: string
  details?: string[]
  shortVersion?: { duration: number; note: string }
  optional?: boolean
  intensity?: "light" | "moderate" | "hard"
  workout?: PlannedExercise[]
  projectId?: string
  stepId?: string
  milestoneId?: string
  personId?: string
  seriesId?: string
  eventId?: string
  links?: EventLink[]
  log?: ActivityLog
}

export type JournalEntry = {
  id: string
  title: string
  body: string
  date: string
  mood?: string
}

export type ProjectStep = {
  id: string
  title: string
  done: boolean
  doneAt?: string
}

// A project makes something: ordered steps lead to a finished thing.
export type Project = {
  id: string
  title: string
  note: string
  stage: "Seed" | "Exploring" | "Making" | "Resting" | "Complete"
  nextAction?: string
  estimatedCost?: number
  steps?: ProjectStep[]
  goalId?: string
  finishedAt?: string
  madeNote?: string
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
  seriesId?: string
}

export type Goal = {
  id: string
  title: string
  area: Area
  scale: "small" | "big"
  date?: string
  dateLabel?: string
  status: "tending" | "paused" | "complete"
  reachedAt?: string
  nextStep: string
  milestones: Milestone[]
}

// Details for a milestone that happens on a date (race day, the camp…).
export type MilestoneEvent = Omit<JourneyEvent, "id" | "title" | "goalId">

export type Milestone = {
  id: string
  title: string
  completedAt?: string
  event?: MilestoneEvent
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

export type AboutMeSuggestion = {
  field: keyof Omit<AboutMe, "updatedAt">
  suggested: string
  reason: string
}

export type SleepEntry = {
  id: string
  lightsOut: string // ISO time
  lightsOn?: string // ISO time; missing while you're asleep
  feeling?: "rough" | "okay" | "rested"
  note?: string
}

export type AboutMe = {
  // A short snapshot of progress, refreshed with Studio's weekly suggestions.
  whereNow?: string
  workingTowards: string
  healthGoals: string
  body: string
  movementNow: string
  equipment: string
  week: string
  energy: string
  other: string
  updatedAt: string
}

export type SpaceArchive = {
  at: string
  reason: string
  goals: Goal[]
  routines: Routine[]
  series: Series[]
  plan: PlanItem[]
}

export type TrainingPhaseDef = {
  id: number
  title: string
  weeks: number
  body: string
  ready: string
}

// One session in the plan's typical week. dayOffset: 0 = Monday … 6 = Sunday.
export type PlanWeekSession = {
  dayOffset: number
  title: string
  kind: ActivityKind
  time?: string
  duration: number
  intensity: "light" | "moderate" | "hard"
  details: string[]
  optional?: boolean
  workout?: PlannedExercise[]
}

export type TrainingPlan = {
  id: string
  purpose: string
  why?: string
  targetDate?: string
  targetLabel?: string
  summary: string
  createdAt: string
  phases: TrainingPhaseDef[]
  week: PlanWeekSession[]
  goalId?: string
  // Studio's latest look back at a week, and whether you look ready for the next phase.
  lastReview?: { weekStart: string; text: string; phaseReady: boolean; phaseNote: string; at: string }
}

// A plan you moved on from, kept so you can see it (or go back to it).
export type PastPlan = {
  plan: TrainingPlan | null // null = the original built-in plan
  phase: number
  endedAt: string
  reason: string
  phaseWeeks?: Record<string, number>
  phaseDates?: Record<string, string>
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
  trainingPhase?: number
  // A training plan Studio wrote for a purpose you chose. Without one, the built-in restart → Hackney plan applies.
  trainingPlan?: TrainingPlan
  // What Studio knows about you: health goals, body, energy, your week. Shapes every plan.
  aboutMe?: AboutMe
  // Snapshots kept when you set up again from the top.
  archives?: SpaceArchive[]
  tourDone?: boolean
  // Studio's weekly suggested updates to About me, waiting for you to accept or dismiss.
  aboutMeSuggestions?: { weekStart: string; at: string; items: AboutMeSuggestion[] }
  // Lights out / lights on, to see sleep patterns over time.
  sleep?: SleepEntry[]
  pastPlans?: PastPlan[]
  events?: { fairplayConfirmed?: boolean; hackneyBooked?: boolean; fairplayBooked?: boolean }
  series?: Series[]
  chat?: ChatMessage[]
  workoutTemplates?: WorkoutTemplate[]
  journeyEvents?: JourneyEvent[]
  weeklyDigest?: {
    weekStart: string
    generatedAt: string
    headline: string
    thisWeek: string
    nextWeek: string
    encouragement: string
  }
  roadmap?: {
    phaseDates?: Record<string, string>
    phaseWeeks?: Record<string, number>
    reflections?: RoadmapReflection[]
    phaseLog?: { phase: number; date: string; title?: string }[]
  }
}
