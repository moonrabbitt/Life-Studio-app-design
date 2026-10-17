import type { AppState, Area } from "./types"

const iso = (offset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toLocaleDateString("en-CA")
}

export const areaMeta: Record<Area, {
  label: string
  short: string
  description: string
}> = {
  reflect: {
    label: "Reflect",
    short: "A quiet note",
    description: "Journal, notice, and make sense of things.",
  },
  create: {
    label: "Create",
    short: "Make something",
    description: "Ideas, writing, photography, music, and film.",
  },
  connect: {
    label: "Connect",
    short: "Reach out",
    description: "Friends, plans, and the people you want nearby.",
  },
  move: {
    label: "Move",
    short: "Move your way",
    description: "Walk, run, dance, strength, mobility, or rest.",
  },
  money: {
    label: "Money",
    short: "Feel informed",
    description: "Spending, commitments, and room for what matters.",
  },
  home: {
    label: "Home",
    short: "Tend to life",
    description: "Routines, errands, admin, and genuine rest.",
  },
}

export const emptyState: AppState = {
  version: 1,
  onboarded: false,
  name: "Avika",
  priorities: [],
  density: "few",
  checkIn: "steady",
  plan: [],
  journal: [],
  projects: [],
  people: [],
  transactions: [],
  routines: [],
  goals: [],
  workout: { active: false, current: 0, sets: [] },
  voiceNotes: [],
  moneyLessonsCompleted: [],
  movementNotes: [],
  gymSessionPlans: [],
  breatheSessions: [],
  workoutHistory: [],
  weeklyReviews: [],
}

export const demoState: AppState = {
  ...emptyState,
  onboarded: true,
  priorities: ["create", "connect", "home"],
  plan: [
    {
      id: "plan-coffee",
      title: "Coffee with Maya",
      area: "connect",
      date: iso(),
      time: "11:30",
      duration: 60,
      mode: "fixed",
      status: "planned",
    },
    {
      id: "plan-film",
      title: "Shape the London film idea",
      area: "create",
      date: iso(),
      time: "15:00",
      duration: 25,
      mode: "flexible",
      status: "planned",
    },
    {
      id: "plan-reset",
      title: "Ten-minute home reset",
      area: "home",
      date: iso(),
      time: "18:30",
      duration: 10,
      mode: "maybe",
      status: "planned",
    },
    {
      id: "plan-move",
      title: "Gentle strength session",
      area: "move",
      date: iso(1),
      time: "17:30",
      duration: 35,
      mode: "flexible",
      status: "planned",
    },
    {
      id: "plan-journal",
      title: "A page with tea",
      area: "reflect",
      date: iso(2),
      time: "20:00",
      duration: 15,
      mode: "maybe",
      status: "planned",
    },
  ],
  journal: [
    {
      id: "journal-1",
      title: "A softer beginning",
      body: "I want this season to feel spacious enough for ideas, friends, movement, and ordinary quiet.",
      date: iso(-2),
      mood: "hopeful",
    },
  ],
  projects: [
    {
      id: "project-1",
      title: "London light",
      note: "A short film about quiet creative rituals and the city at first light.",
      stage: "Exploring",
      nextAction: "Collect five river reference shots",
      estimatedCost: 6500,
    },
    {
      id: "project-2",
      title: "Small songs",
      note: "Return to the keyboard without needing to finish anything.",
      stage: "Seed",
      nextAction: "Record one rough melody",
    },
  ],
  people: [
    {
      id: "person-1",
      name: "Maya",
      note: "Ask about the new studio.",
      lastConnected: iso(-12),
      nextTouch: "Coffee today",
    },
    {
      id: "person-2",
      name: "Sam",
      note: "Send the riverside photo.",
      lastConnected: iso(-20),
      nextTouch: "Message this week",
    },
  ],
  transactions: [
    {
      id: "transaction-1",
      title: "Dance class",
      amount: 1800,
      date: iso(-1),
      category: "Movement",
    },
    {
      id: "transaction-2",
      title: "Film processing",
      amount: 1450,
      date: iso(-4),
      category: "Creative",
    },
  ],
  routines: [
    {
      id: "routine-1",
      title: "Sunday life admin",
      cadence: "Weekly, gently",
      completedDates: [],
    },
    {
      id: "routine-2",
      title: "Clear the kitchen table",
      cadence: "When it helps",
      completedDates: [iso(-1)],
    },
  ],
  goals: [
    {
      id: "goal-film",
      title: "Make a small London film",
      area: "create",
      scale: "big",
      status: "tending",
      nextStep: "Collect five river reference shots",
      milestones: [
        {
          id: "film-idea",
          title: "Choose the feeling and shape of the film",
          completedAt: iso(-8),
        },
        {
          id: "film-references",
          title: "Collect five river reference shots",
        },
        {
          id: "film-first-cut",
          title: "Make a rough first cut",
        },
        {
          id: "film-share",
          title: "Share it with one trusted person",
        },
      ],
    },
    {
      id: "goal-race",
      title: "Hackney Half Marathon",
      area: "move",
      scale: "big",
      date: "2027-05-16",
      dateLabel: "16 May 2027 · booking not confirmed",
      status: "tending",
      nextStep: "Build a comfortable return-to-movement rhythm",
      milestones: [
        {
          id: "race-rhythm",
          title: "Find a comfortable weekly movement rhythm",
        },
        {
          id: "race-base",
          title: "Build an easy running base",
        },
        {
          id: "race-plan",
          title: "Review readiness for a race-specific plan",
        },
        {
          id: "race-day",
          title: "Arrive at race week feeling supported",
        },
      ],
    },
    {
      id: "goal-dance",
      title: "FairPlay Dance Camp 2027",
      area: "move",
      scale: "small",
      dateLabel: "Dates to be confirmed",
      status: "tending",
      nextStep: "Keep dance enjoyable and consistent",
      milestones: [],
    },
    {
      id: "goal-money-confidence",
      title: "Grow my investing confidence",
      area: "money",
      scale: "big",
      status: "tending",
      nextStep: "Learn how compounding works over a long time horizon",
      milestones: [
        {
          id: "money-compounding",
          title: "Understand compounding and time horizon",
        },
        {
          id: "money-risk",
          title: "Write down what risk means for me",
        },
        {
          id: "money-diversification",
          title: "Learn the role of diversification",
        },
        {
          id: "money-principles",
          title: "Create my own investing principles",
        },
      ],
    },
  ],
}
