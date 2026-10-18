import {
  ArrowLeft,
  Compass,
  ArrowRight,
  AudioLines,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  CloudCheck,
  CloudOff,
  CircleDollarSign,
  Clock3,
  Coffee,
  Dumbbell,
  Feather,
  Film,
  Heart,
  Home,
  Lightbulb,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  Music2,
  Pause,
  PenLine,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  Sparkles,
  Square,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  WandSparkles,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react"
import { flushSync } from "react-dom"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  askMoneyGuide,
  askStudio,
  localDate,
  suggestGymSession,
  type StudioAction,
  type StudioProposal,
} from "./ai"
import { getVoiceNote, saveVoiceNote as storeVoiceNote } from "./audioStore"
import { listen, speechSupported } from "./speech"
import { downloadVoice, getPasscode } from "./sync"
import { areaMeta, demoState } from "./data"
import { createSeries, REPEAT_LABELS } from "./series"
import { checkPlacement, mondayOf, nextUsefulAction } from "./training"
import type {
  ActivityKind,
  AppState,
  PlannedExercise,
  RepeatFrequency,
  Area,
  CheckIn,
  Goal,
  JournalEntry,
  PlanItem,
  Project,
} from "./types"
import {
  ActivityButtons,
  ActivityFlow,
  ActivityHistory,
  GymIntake,
  JourneyGoals,
  JourneyPhase,
  JourneyStory,
  NextActionCard,
  PlannedWorkoutList,
  RestartSetup,
  WorkoutEditor,
  Roadmap,
  skipItem,
  StatusBadge,
  WeekAcceptBanner,
  type ActivityMode,
} from "./TrainingViews"
import {
  Celebration,
  celebrateDone,
  GoalDetail,
  GOAL_VS_PROJECT,
  ProjectsSpace,
  SetAsideShelf,
  type CelebrationMessage,
} from "./GoalProjectViews"
import { HomeSpace } from "./HomeViews"
import { LogEditor, MyWorkouts, StrengthProgress } from "./GymViews"
import {
  actionWarnings as checkActionWarnings,
  applyAction,
  areaKeys,
  blankAction,
  destinationOf,
  isDate,
  isTime,
  offlineProposal,
  type Destination,
  type SpaceKey,
} from "./assistant"
import { PeopleSpace } from "./PeopleViews"
import { PlanItemSheet, planSwipeActions } from "./PlanItemSheet"
import { QuickMenu } from "./QuickMenu"
import { StudioChat } from "./StudioChat"
import { AboutMeSpace } from "./AboutMe"
import { SetupChat } from "./SetupChat"
import { applySetup } from "./setup"
import { Tour } from "./Tour"
import { NextWeekPlanner, nextWeekDue } from "./NextWeek"
import { SessionPlanner, type PlannedSession } from "./SessionPlanner"
import { VoiceNoteList } from "./VoiceNotes"
import { WeekDigestCard } from "./WeekDigest"
import { Art, Button, formatDate, IconButton, Modal, RemoveContext, SwipeHint, SwipeRow, today, uid, useRemove } from "./ui"
import { useLifeStudioState, type SyncStatus } from "./useLifeStudioState"

type Route = "today" | "plan" | "progress" | "space"

const formatMoney = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)

const routePath: Record<Route, string> = {
  today: "/",
  plan: "/plan",
  progress: "/journey",
  space: "/space",
}

const areaIcon: Record<Area, LucideIcon> = {
  reflect: Feather,
  create: Lightbulb,
  connect: Users,
  move: Heart,
  money: CircleDollarSign,
  home: Home,
}

const navItems: { key: Route; label: string; icon: LucideIcon }[] = [
  { key: "today", label: "Today", icon: Coffee },
  { key: "plan", label: "Plan", icon: CalendarDays },
  { key: "progress", label: "Journey", icon: Compass },
  { key: "space", label: "My space", icon: UserRound },
]

function routeFromPath(): Route {
  const value = window.location.pathname
  if (value.endsWith("/plan")) return "plan"
  if (value.endsWith("/journey") || value.endsWith("/progress")) return "progress"
  if (value.endsWith("/space")) return "space"
  return "today"
}

function AreaMark({ area, compact = false }: { area: Area; compact?: boolean }) {
  const Icon = areaIcon[area]
  return (
    <span
      className={`area-mark area-${area} ${
        compact ? "area-mark--compact" : ""
      }`}
    >
      <Icon size={compact ? 14 : 17} strokeWidth={1.9} />
      {!compact && areaMeta[area].label}
    </span>
  )
}

function LogoMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="15" fill="#34543f" />
      <path
        d="M13 36V22.5C13 14.5 17.8 9 24 9s11 5.5 11 13.5V36H13Z"
        fill="#fffaf0"
      />
      <circle cx="25.5" cy="19" r="5.5" fill="#e9b59c" />
      <path
        d="M18 34c5.8-1.5 9.6-5.3 12.6-11.4-1.2 6.5-4.7 11.4-10.8 14.1"
        fill="none"
        stroke="#34543f"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M21.5 29.5c-3.8.1-5.7-1.8-5.9-4.8 3.8-.4 6.2 1 6.8 3.9"
        fill="#9eae8d"
      />
      <path
        d="M26.8 25.2c.5-3.5 2.8-5.1 5.8-4.7.1 3.5-1.7 5.7-4.9 5.8"
        fill="#9eae8d"
      />
    </svg>
  )
}

function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string
  body: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="empty-state">
      <img src="/assets/samoyed.png" alt="" />
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
        <Button variant="secondary" icon={Plus} onClick={onAction}>
          {action}
        </Button>
      </div>
    </div>
  )
}

function TodayView({
  state,
  update,
  onAdd,
  onOpenSpace,
  onActivity,
  onRoadmap,
  onSetupRestart,
  onOpenItem,
}: {
  state: AppState
  update: (recipe: (current: AppState) => AppState, message?: string) => void
  onAdd: () => void
  onOpenSpace: (space: SpaceKey) => void
  onActivity: (id: string, mode: ActivityMode) => void
  onRoadmap: () => void
  onSetupRestart: () => void
  onOpenItem: (id: string) => void
}) {
  const remove = useRemove()
  const currentItems = state.plan
    .filter(
      (item) =>
        item.date === today() &&
        (item.status === "planned" || item.status === "proposed"),
    )
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
  // The check-in shapes today: small hides optional plans, explore adds room for one more idea.
  const energy = state.checkIn
  const [showTucked, setShowTucked] = useState(false)
  const isOptional = (item: PlanItem) => item.optional || item.mode === "maybe"
  const tucked = energy === "low" ? currentItems.filter(isOptional) : []
  const shown =
    energy === "low" && !showTucked ? currentItems.filter((item) => !isOptional(item)) : currentItems
  const baseMax = state.density === "one" ? 1 : state.density === "few" ? 3 : 5
  const max = energy === "low" ? Math.min(baseMax, 2) : energy === "open" ? baseMax + 2 : baseMax
  // The same item the Next useful action card points at is marked "Up next" here, and always shown.
  const upNext = nextUsefulAction(state.plan, today())
  const upNextId = upNext?.when === "today" ? upNext.item.id : undefined
  // Nothing disappears silently: beyond your usual amount, the rest sits behind "N more today".
  const [showMore, setShowMore] = useState(false)
  const withinLimit = shown.filter((item, index) => index < max || item.id === upNextId)
  const visibleItems = showMore || (energy === "low" && showTucked) ? shown : withinLimit
  const hiddenCount = shown.length - withinLimit.length
  const exploreIdea = (() => {
    if (energy !== "open") return null
    for (const project of state.projects) {
      if (project.stage === "Complete") continue
      const step = (project.steps ?? []).find((candidate) => !candidate.done)
      if (step && !state.plan.some((item) => item.stepId === step.id && item.status !== "complete"))
        return { title: step.title, from: project.title, projectId: project.id, stepId: step.id }
    }
    for (const goal of state.goals) {
      if (goal.status === "complete") continue
      const milestone = goal.milestones.find((candidate) => !candidate.completedAt)
      if (milestone && !state.plan.some((item) => item.milestoneId === milestone.id && item.status !== "complete"))
        return { title: milestone.title, from: goal.title, goalId: goal.id, milestoneId: milestone.id }
    }
    return null
  })()
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  const setCheckIn = (value: CheckIn) =>
    update(
      (current) => ({ ...current, checkIn: value }),
      value === "low"
        ? "Keeping it small: optional plans are tucked away and short versions come first."
        : value === "open"
          ? "Room to explore: everything is showing, plus one extra idea."
          : "Steady: your plan as it is.",
    )
  const complete = (id: string) => {
    const done = state.plan.find((item) => item.id === id)
    update((current) => ({
      ...current,
      plan: current.plan.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "complete",
              log: { completedAt: new Date().toISOString(), summary: item.title },
            }
          : item,
      ),
    }))
    if (done) celebrateDone(done.title, done.area)
  }

  return (
    <div className="page today-page">
      <section className="today-hero">
        <img
          src="/assets/life-studio-room.jpg"
          alt=""
          className="today-hero__image"
        />
        <div className="today-hero__veil" />
        <div className="today-hero__content">
          <p className="eyebrow eyebrow--light">
            {formatDate(today(), {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1>
            {greeting}, {state.name}.
          </h1>
          <p>What would make today feel a little more like yours?</p>
        </div>
      </section>

      <NextActionCard
        state={state}
        update={update}
        onActivity={onActivity}
        onRoadmap={onRoadmap}
        onSetupRestart={onSetupRestart}
      />

      <section className="check-in today-check-in">
        <div>
          <p className="eyebrow">A small check-in</p>
          <h2>How much room is there today?</h2>
        </div>
        <div className="segmented" aria-label="Energy check-in">
          {[
            ["low", "Keep it small"],
            ["steady", "Steady"],
            ["open", "Room to explore"],
          ].map(([value, label]) => (
            <button
              type="button"
              className={state.checkIn === value ? "is-active" : ""}
              aria-pressed={state.checkIn === value}
              onClick={() => setCheckIn(value as CheckIn)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="page-grid">
        <div className="page-grid__main">
          <section className="section-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Today’s shape</p>
                <h2>
                  {visibleItems.length
                    ? "A few things, with space between"
                    : "Open space"}
                </h2>
              </div>
              <Button variant="ghost" icon={Plus} onClick={onAdd}>
                Add
              </Button>
            </div>
            {tucked.length > 0 && (
              <button type="button" className="energy-note" onClick={() => setShowTucked(!showTucked)}>
                {showTucked
                  ? "Hide optional plans again"
                  : `Keeping it small: ${tucked.length} optional plan${tucked.length === 1 ? "" : "s"} tucked away. Show`}
              </button>
            )}
            {exploreIdea && (
              <div className="energy-explore">
                <div>
                  <p className="eyebrow">Room to explore</p>
                  <strong>{exploreIdea.title}</strong>
                  <small>Next step of {exploreIdea.from}</small>
                </div>
                <Button
                  variant="secondary"
                  icon={Plus}
                  onClick={() =>
                    update(
                      (current) => ({
                        ...current,
                        plan: [
                          ...current.plan,
                          {
                            id: uid(),
                            title: exploreIdea.title,
                            area: exploreIdea.projectId ? "create" : (current.goals.find((goal) => goal.id === exploreIdea.goalId)?.area ?? "create"),
                            kind: exploreIdea.projectId ? "create" : undefined,
                            date: today(),
                            duration: 25,
                            mode: "maybe",
                            status: "planned",
                            projectId: exploreIdea.projectId,
                            stepId: exploreIdea.stepId,
                            goalId: exploreIdea.goalId,
                            milestoneId: exploreIdea.milestoneId,
                          },
                        ],
                      }),
                      "Added to today, as optional.",
                    )
                  }
                >
                  Add to today
                </Button>
              </div>
            )}
            {nextWeekDue(state) && <NextWeekPlanner state={state} update={update} compact />}
            {visibleItems.length > 0 && (
              <button
                type="button"
                className="text-link today-came-up"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("studio:open", { detail: { hint: "What came up? e.g. working late tonight, away Saturday" } }))
                }
              >
                Something came up? Studio can reshuffle
              </button>
            )}
            {visibleItems.length ? (
              <div className="today-list">
                {visibleItems.map((item) => (
                  <SwipeRow key={item.id} className="swipe--card" actions={planSwipeActions(item, remove)}>
                  <article
                    className={`today-item ${
                      item.id === upNextId ? "today-item--focus" : ""
                    }`}
                  >
                    <div className="today-item__time">
                      <span>{item.time ?? "Anytime"}</span>
                      {item.duration && <small>{item.duration} min</small>}
                    </div>
                    <div className="today-item__body">
                      <div className="today-item__marks">
                        <AreaMark area={item.area} />
                        {item.id === upNextId && <span className="up-next-badge">Up next</span>}
                        {item.status === "proposed" && <StatusBadge item={item} />}
                      </div>
                      <h3>{item.title}</h3>
                      <p>
                        {item.mode === "fixed"
                          ? "A fixed point in the day."
                          : item.mode === "maybe"
                            ? "Optional. Let it go if the space matters more."
                            : "Flexible. Move it until it fits."}
                      </p>
                      {item.kind ? (
                        <ActivityButtons
                          item={item}
                          onActivity={onActivity}
                          onSkip={(id) => skipItem(update, id)}
                        />
                      ) : (
                        <div className="inline-actions">
                          <Button onClick={() => complete(item.id)} icon={Check}>
                            Done
                          </Button>
                          <Button variant="ghost" onClick={() => onOpenItem(item.id)}>
                            Open
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                  </SwipeRow>
                ))}
                {hiddenCount > 0 && !showMore && !(energy === "low" && showTucked) && (
                  <button type="button" className="energy-note" onClick={() => setShowMore(true)}>
                    {hiddenCount} more today. Show
                  </button>
                )}
                {showMore && shown.length > withinLimit.length && (
                  <button type="button" className="energy-note" onClick={() => setShowMore(false)}>
                    Show less
                  </button>
                )}
              </div>
            ) : (
              <EmptyState
                title="We can keep today small."
                body="Open time counts. Add one gentle intention only if it would help."
                action="Add one thing"
                onAction={onAdd}
              />
            )}
          </section>
        </div>

        <aside className="page-grid__aside">
          <section className="companion-card">
            <div>
              <p className="eyebrow">A quiet corner</p>
              <h3>A softer day still belongs to your life.</h3>
              <p>Rest, make tea, write one line, or leave the space open.</p>
              <div className="companion-card__actions">
                <button type="button" onClick={() => onOpenSpace("breathe")}>
                  <Wind size={16} /> Breathe for a minute
                </button>
                <button type="button" onClick={() => onOpenSpace("reflect")}>
                  <Feather size={16} /> Write one line
                </button>
              </div>
            </div>
            <img src="/assets/samoyed.png" alt="" />
          </section>
          <section className="quick-spaces">
            <div className="section-heading section-heading--small">
              <h3>Drop into a space</h3>
            </div>
            <div className="quick-spaces__grid">
              {(["reflect", "create", "connect", "money"] as Area[]).map(
                (area) => {
                  const Icon = areaIcon[area]
                  return (
                    <button
                      type="button"
                      onClick={() => onOpenSpace(area)}
                      key={area}
                    >
                      <Icon size={19} />
                      <span>{areaMeta[area].label}</span>
                    </button>
                  )
                },
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function PlanView({
  state,
  update,
  onAdd,
  onActivity,
  focusDate,
  onOpenItem,
}: {
  state: AppState
  update: (recipe: (current: AppState) => AppState, message?: string) => void
  onAdd: (date?: string) => void
  onActivity: (id: string, mode: ActivityMode) => void
  focusDate?: string | null
  onOpenItem: (id: string) => void
}) {
  const remove = useRemove()
  const days = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const date = new Date()
        date.setDate(date.getDate() + index)
        return localDate(date)
      }),
    [],
  )
  const [selected, setSelected] = useState(
    focusDate && days.includes(focusDate) ? focusDate : days[0],
  )
  useEffect(() => {
    if (focusDate && days.includes(focusDate)) setSelected(focusDate)
  }, [focusDate, days])
  // Skipped things live on the Set aside shelf, not in the day's list.
  const items = state.plan
    .filter((item) => item.date === selected && item.status !== "let-go")
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))

  const moveTomorrow = (item: PlanItem) => {
    const target = new Date(`${item.date}T12:00:00`)
    target.setDate(target.getDate() + 1)
    const targetDate = localDate(target)
    const conflict = state.plan.some(
      (candidate) =>
        candidate.date === targetDate &&
        candidate.time === item.time &&
        candidate.status === "planned",
    )
    update(
      (current) => ({
        ...current,
        plan: current.plan.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, date: targetDate }
            : candidate,
        ),
      }),
      conflict
        ? "Moved. There is another plan at that time, so both remain visible."
        : "Moved to a kinder day.",
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your week</p>
          <h1>Plan with room to change.</h1>
          <p>
            Commitments, possibilities, and genuine open space live together
            here.
          </p>
        </div>
        <Button icon={Plus} onClick={() => onAdd(selected)}>
          Add something
        </Button>
      </header>

      <nav className="day-strip" aria-label="Choose a day">
        {days.map((date) => (
          <button
            type="button"
            className={selected === date ? "is-selected" : ""}
            aria-current={selected === date ? "date" : undefined}
            onClick={() => setSelected(date)}
            key={date}
          >
            <span>{formatDate(date, { weekday: "short" })}</span>
            <strong>{formatDate(date, { day: "numeric" })}</strong>
            <small>
              {state.plan.filter(
                (item) =>
                  item.date === date &&
                  (item.status === "planned" || item.status === "proposed"),
              ).length || "—"}
            </small>
          </button>
        ))}
      </nav>

      <div className="plan-layout">
        <section className="agenda">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {formatDate(selected, { weekday: "long" })}
              </p>
              <h2>{formatDate(selected, { day: "numeric", month: "long" })}</h2>
            </div>
            <span className="open-space-label">Open space is intentional</span>
          </div>
          <WeekAcceptBanner state={state} date={selected} update={update} />
          {items.length ? (
            <div className="agenda__timeline">
              {items.map((item) => (
                <SwipeRow key={item.id} className="swipe--card" actions={planSwipeActions(item, remove)}>
                <article
                  className={`agenda-item area-border-${item.area} ${
                    item.status === "proposed" ? "is-proposed" : ""
                  }`}
                >
                  <div className="agenda-item__time">
                    <strong>{item.time ?? "Anytime"}</strong>
                    <span>
                      {item.duration ? `${item.duration} min` : item.mode}
                    </span>
                    {item.seriesId && <small className="repeat-badge">↻ Repeats</small>}
                  </div>
                  <div className="agenda-item__content">
                    <div className="today-item__marks">
                      <AreaMark area={item.area} />
                      {item.kind && <StatusBadge item={item} />}
                    </div>
                    <h3>{item.title}</h3>
                    {item.log && (
                      <small className="agenda-item__log">
                        {item.log.summary}
                        {item.log.duration ? ` · ${item.log.duration} min` : ""}
                      </small>
                    )}
                    <p>
                      {item.status === "complete"
                        ? "Complete"
                        : item.status === "let-go"
                          ? "Let go"
                          : `${item.mode[0].toUpperCase()}${item.mode.slice(1)}`}
                    </p>
                    {(item.steps ?? []).length > 0 && (
                      <span className="agenda-item__steps">
                        {
                          (item.steps ?? []).filter((step) => step.complete)
                            .length
                        }{" "}
                        of {(item.steps ?? []).length} steps
                      </span>
                    )}
                  </div>
                  {item.kind &&
                    (item.status === "planned" || item.status === "proposed") && (
                      <div className="agenda-item__actions">
                        <ActivityButtons
                          item={item}
                          onActivity={onActivity}
                          onSkip={(id) => skipItem(update, id)}
                        />
                        <Button variant="ghost" onClick={() => onOpenItem(item.id)}>
                          Details & edit
                        </Button>
                      </div>
                    )}
                  {!item.kind && item.status === "planned" && (
                    <div className="agenda-item__actions">
                      <Button
                        variant="secondary"
                        onClick={() => onOpenItem(item.id)}
                      >
                        Open
                      </Button>
                      <Button
                        icon={Check}
                        onClick={() => {
                          update((current) => ({
                            ...current,
                            plan: current.plan.map((candidate) =>
                              candidate.id === item.id
                                ? {
                                    ...candidate,
                                    status: "complete",
                                    log: {
                                      completedAt: new Date().toISOString(),
                                      summary: candidate.title,
                                    },
                                  }
                                : candidate,
                            ),
                          }))
                          celebrateDone(item.title, item.area)
                        }}
                      >
                        Done
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => moveTomorrow(item)}
                      >
                        Move
                      </Button>
                      <IconButton
                        label="Let this go"
                        icon={X}
                        onClick={() =>
                          update(
                            (current) => ({
                              ...current,
                              plan: current.plan.map((candidate) =>
                                candidate.id === item.id
                                  ? { ...candidate, status: "let-go" }
                                  : candidate,
                              ),
                            }),
                            "Set aside. It’s under Plan → Set aside if you want it back.",
                          )
                        }
                      />
                    </div>
                  )}
                  {(item.status === "complete" || item.status === "let-go") && (
                    <div className="agenda-item__actions">
                      <Button
                        variant="ghost"
                        onClick={() => onOpenItem(item.id)}
                      >
                        Review
                      </Button>
                    </div>
                  )}
                </article>
                </SwipeRow>
              ))}
              <SwipeHint />
              <button
                type="button"
                className="open-space"
                onClick={() => onAdd(selected)}
              >
                <Plus size={18} />
                <span>
                  <strong>Open space</strong>
                  <small>Keep it, or add something that would help.</small>
                </span>
              </button>
            </div>
          ) : (
            <EmptyState
              title="Nothing is asking for this day."
              body="Leave it open, or add a small intention without filling every hour."
              action="Add an intention"
              onAction={() => onAdd(selected)}
            />
          )}
        </section>

        <SetAsideShelf state={state} update={update} />
        <aside className="plan-note">
          <CalendarDays size={23} />
          <h3>Plans, not promises</h3>
          <p>
            Flexible things can move. Maybe things can disappear. Life Studio
            will never create debt from a missed plan.
          </p>
        </aside>
      </div>
    </div>
  )
}

function ProgressView({
  state,
  update,
  onJourney,
}: {
  state: AppState
  update: (recipe: (current: AppState) => AppState, message?: string) => void
  onJourney: () => void
}) {
  const [reviewing, setReviewing] = useState(false)
  const [editLogId, setEditLogId] = useState<string | null>(null)
  const [addingGoal, setAddingGoal] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [editGoal, setEditGoal] = useState(false)
  const [celebration, setCelebration] = useState("")
  const completeItems = state.plan.filter((item) => item.status === "complete")
  const activeAreas = Array.from(
    new Set(completeItems.map((item) => item.area)),
  )
  const biggerGoals = state.goals.filter(
    (goal) => (goal.scale ?? "big") === "big" && goal.status !== "complete",
  )
  const smallerGoals = state.goals.filter(
    (goal) => (goal.scale ?? "small") === "small" && goal.status !== "complete",
  )
  const reachedGoals = state.goals.filter((goal) => goal.status === "complete")
  const selectedGoal = state.goals.find((goal) => goal.id === selectedGoalId)

  const completeMilestone = (goalId: string, milestoneId: string) => {
    const goal = state.goals.find((item) => item.id === goalId)
    const milestone = (goal?.milestones ?? []).find(
      (item) => item.id === milestoneId,
    )
    const wasComplete = Boolean(milestone?.completedAt)
    update((current) => ({
      ...current,
      goals: current.goals.map((item) =>
        item.id === goalId
          ? {
              ...item,
              milestones: (item.milestones ?? []).map((step) =>
                step.id === milestoneId
                  ? {
                      ...step,
                      completedAt: step.completedAt
                        ? undefined
                        : new Date().toISOString(),
                    }
                  : step,
              ),
            }
          : item,
      ),
    }))
    if (!wasComplete && milestone) {
      setCelebration(milestone.title)
      window.setTimeout(() => setCelebration(""), 2600)
    }
  }

  const addMilestone = (goalId: string, title: string) => {
    update(
      (current) => ({
        ...current,
        goals: current.goals.map((goal) =>
          goal.id === goalId
            ? {
                ...goal,
                milestones: [...(goal.milestones ?? []), { id: uid(), title }],
              }
            : goal,
        ),
      }),
      "A new milestone is ready when you are.",
    )
  }

  return (
    <div className="page">
      <header className="page-header progress-header journey-header">
        <div>
          <p className="eyebrow">Where you’re going, and how far you’ve come</p>
          <h1>Your journey</h1>
        </div>
      </header>

      <div className="journey-layout">
        <WeekDigestCard state={state} update={update} />
        <JourneyGoals
          state={state}
          update={update}
          onOpenGoal={(id, edit) => {
            setEditGoal(!!edit)
            setSelectedGoalId(id)
          }}
          onNewGoal={() => setAddingGoal(true)}
        />
        <JourneyPhase state={state} onOpenPlan={onJourney} />
        <JourneyStory state={state} update={update} />
        <details className="journey-records">
          <summary>Your records: activity and strength</summary>
          <ActivityHistory state={state} onEditLog={setEditLogId} />
          <StrengthProgress state={state} />
        </details>
      </div>

      {reviewing && (
        <WeeklyReview
          onClose={() => setReviewing(false)}
          onSave={() => {
            update(
              (current) => current,
              "Your reflection is saved on this device.",
            )
            setReviewing(false)
          }}
        />
      )}
      {selectedGoal && (
        <GoalDetail
          key={`${selectedGoal.id}-${editGoal}`}
          goal={selectedGoal}
          state={state}
          update={update}
          startEditing={editGoal}
          onClose={() => {
            setSelectedGoalId(null)
            setEditGoal(false)
          }}
        />
      )}
      {addingGoal && (
        <NewGoalModal
          onClose={() => setAddingGoal(false)}
          onSave={(goal) => {
            update(
              (current) => ({
                ...current,
                goals: [goal, ...current.goals],
              }),
              "Your new goal is ready to shape.",
            )
            setAddingGoal(false)
          }}
        />
      )}
      {celebration && <MilestoneCelebration title={celebration} />}
      {editLogId && (
        <LogEditor itemId={editLogId} state={state} update={update} onClose={() => setEditLogId(null)} />
      )}
    </div>
  )
}

function MilestoneCelebration({ title }: { title: string }) {
  return (
    <div className="milestone-celebration" role="status" aria-live="polite">
      <div className="milestone-celebration__sparkles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <Sparkles key={index} size={16 + (index % 3) * 4} />
        ))}
      </div>
      <div className="milestone-celebration__card">
        <span>
          <Sparkles size={28} />
        </span>
        <p className="eyebrow">A moment worth keeping</p>
        <h3>You did that.</h3>
        <p>{title}</p>
        <small>It’s now part of how far you’ve come.</small>
      </div>
    </div>
  )
}

function NewGoalModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (goal: Goal) => void
}) {
  const [scale, setScale] = useState<Goal["scale"]>("small")
  return (
    <Modal
      title="Create a goal"
      eyebrow="Something worth tending"
      onClose={onClose}
    >
      <form
        className="plan-form"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onSave({
            id: uid(),
            title: String(data.get("title")),
            area: String(data.get("area")) as Area,
            scale,
            status: "tending",
            date: String(data.get("date") || "") || undefined,
            dateLabel: String(data.get("date") || "")
              ? formatDate(String(data.get("date")), {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : undefined,
            nextStep:
              String(data.get("nextStep")) ||
              "Choose the smallest meaningful first step",
            milestones:
              scale === "big"
                ? [
                    {
                      id: uid(),
                      title: "Name what a good beginning looks like",
                    },
                  ]
                : [],
          })
        }}
      >
        <p className="goal-vs-project">
          {GOAL_VS_PROJECT} Making something, like a film or a song? Create it in
          My space → Projects instead.
        </p>
        <label>
          <span>What would you like to move toward?</span>
          <input
            name="title"
            required
            autoFocus
            placeholder="Name the goal in your own words"
          />
        </label>
        <fieldset className="goal-size-choice">
          <legend>What kind of goal is this?</legend>
          <button
            type="button"
            className={scale === "small" ? "is-selected" : ""}
            aria-pressed={scale === "small"}
            onClick={() => setScale("small")}
          >
            <Check size={17} />
            <span>
              <strong>Smaller goal</strong>
              <small>Something to reach in days or weeks. A few small steps, then tick it off.</small>
            </span>
          </button>
          <button
            type="button"
            className={scale === "big" ? "is-selected" : ""}
            aria-pressed={scale === "big"}
            onClick={() => setScale("big")}
          >
            <Sparkles size={17} />
            <span>
              <strong>Bigger goal</strong>
              <small>A change over months, often with a date. Milestones and logged sessions show the way.</small>
            </span>
          </button>
        </fieldset>
        <label>
          <span>Part of life</span>
          <select name="area" defaultValue="create">
            {(Object.keys(areaMeta) as Area[]).map((area) => (
              <option value={area} key={area}>
                {areaMeta[area].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Target date, optional</span>
          <input name="date" type="date" min={today()} />
        </label>
        <label>
          <span>First gentle step, optional</span>
          <input name="nextStep" placeholder="What is small enough to begin?" />
        </label>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon={Plus}>
            Create goal
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function WeeklyReview({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: () => void
}) {
  const [step, setStep] = useState(0)
  const prompts = [
    "What gave you energy?",
    "What felt heavier than expected?",
    "What would you like to make room for?",
    "What is safe to make smaller or let go?",
  ]
  const [answers, setAnswers] = useState(["", "", "", ""])

  return (
    <Modal
      title="A gentle look back"
      eyebrow="Whole-life weekly reflection"
      onClose={onClose}
    >
      <div className="review">
        <div className="review__progress">
          {prompts.map((_, index) => (
            <span className={index <= step ? "is-active" : ""} key={index} />
          ))}
        </div>
        <p className="eyebrow">
          Question {step + 1} of {prompts.length}
        </p>
        <h3>{prompts[step]}</h3>
        <textarea
          rows={6}
          value={answers[step]}
          placeholder="A few words are enough…"
          onChange={(event) =>
            setAnswers((current) =>
              current.map((answer, index) =>
                index === step ? event.target.value : answer,
              ),
            )
          }
        />
        <div className="modal-actions">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <span />
          {step < prompts.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>Next question</Button>
          ) : (
            <Button onClick={onSave}>Save reflection</Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

const spaceCards: {
  key: SpaceKey
  title: string
  description: string
  icon: LucideIcon
  accent: string
}[] = [
  {
    key: "reflect",
    title: "Journal",
    description: "A private place to notice what is here.",
    icon: Feather,
    accent: "peach",
  },
  {
    key: "breathe",
    title: "Breathe",
    description: "Guided breathing, quiet meditation, and a little space.",
    icon: Wind,
    accent: "sage",
  },
  {
    key: "create",
    title: "Projects",
    description: "Ideas, writing, film, music, and things becoming.",
    icon: Film,
    accent: "gold",
  },
  {
    key: "connect",
    title: "People",
    description: "The people you want to keep close, without obligation.",
    icon: Users,
    accent: "rose",
  },
  {
    key: "move",
    title: "Movement",
    description: "Walk, run, dance, build strength, or recover.",
    icon: Heart,
    accent: "sage",
  },
  {
    key: "money",
    title: "Money",
    description: "Goals, investing knowledge, and long-term thinking.",
    icon: WalletCards,
    accent: "olive",
  },
  {
    key: "home",
    title: "Home & routine",
    description: "Practical care, ordinary rhythm, and rest.",
    icon: Home,
    accent: "blue",
  },
]

function MySpaceView({
  state,
  openSpace,
}: {
  state: AppState
  openSpace: (key: SpaceKey) => void
}) {
  return (
    <div className="page space-page">
      <header className="space-hero">
        <img src="/assets/life-studio-room.jpg" alt="" />
        <div className="space-hero__content">
          <p className="eyebrow eyebrow--light">My space</p>
          <h1>Everything you’re making room for.</h1>
          <p>Private, local, and allowed to change with you.</p>
        </div>
      </header>

      <button type="button" className="about-card" onClick={() => openSpace("about")}>
        <span className="about-card__icon">
          <Sparkles size={22} />
        </span>
        <span>
          <strong>About me</strong>
          <small>
            {state.aboutMe
              ? "What Studio knows about your body, health goals, energy and week. Keep it up to date."
              : "Tell Studio about your body, health goals and energy, so plans fit you."}
          </small>
        </span>
        <ChevronRight size={20} />
      </button>

      <section className="space-grid">
        {spaceCards.map(({ key, title, description, icon: Icon, accent }) => {
          const count =
            key === "reflect"
              ? state.journal.length
              : key === "breathe"
                ? (state.breatheSessions ?? []).length
                : key === "create"
                  ? state.projects.length
                  : key === "connect"
                    ? state.people.length
                    : key === "money"
                      ? state.goals.filter((goal) => goal.area === "money")
                          .length + (state.moneyLessonsCompleted ?? []).length
                      : key === "home"
                        ? state.routines.length
                        : state.goals.filter((goal) => goal.area === "move")
                            .length + (state.gymSessionPlans ?? []).length
          const countLabel =
            key === "reflect"
              ? `${count} page${count === 1 ? "" : "s"}`
              : key === "breathe"
                ? `${count} quiet moment${count === 1 ? "" : "s"}`
                : key === "create"
                  ? `${count} project${count === 1 ? "" : "s"}`
                  : key === "connect"
                    ? `${count} person${count === 1 ? "" : "s"}`
                    : key === "money"
                      ? `${count} growing thing${count === 1 ? "" : "s"}`
                      : key === "home"
                        ? `${count} routine${count === 1 ? "" : "s"}`
                        : `${count} movement thread${count === 1 ? "" : "s"}`
          return (
            <button
              type="button"
              className={`space-card space-card--${accent}`}
              onClick={() => openSpace(key)}
              key={key}
            >
              <span className="space-card__icon">
                <Icon size={23} strokeWidth={1.7} />
              </span>
              <span className="space-card__copy">
                <strong>{title}</strong>
                <small>{description}</small>
                <span>{countLabel}</span>
              </span>
              <ChevronRight size={20} />
            </button>
          )
        })}
      </section>

      <section className="studio-note">
        <div>
          <p className="eyebrow">Make it yours</p>
          <h2>This is Avika’s studio, not a generic dashboard.</h2>
          <p>
            Change what appears first, how much Today holds, and what your
            companion helps you tend.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={Settings}
          onClick={() => openSpace("preferences")}
        >
          Settings, sync & backup
        </Button>
      </section>
    </div>
  )
}

function JournalSpace({ state, update, close }: SpaceProps) {
  const [editing, setEditing] = useState<JournalEntry | null>(null)
  const remove = useRemove()
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const entry: JournalEntry = {
      id: editing?.id ?? uid(),
      title: String(form.get("title") || "Untitled entry"),
      body: String(form.get("body") || ""),
      mood: String(form.get("mood") || ""),
      date: editing?.date ?? today(),
    }
    update(
      (current) => ({
        ...current,
        journal: editing
          ? current.journal.map((item) =>
              item.id === editing.id ? entry : item,
            )
          : [entry, ...current.journal],
      }),
      "Journal entry saved on this device.",
    )
    setEditing(null)
  }

  return (
    <Modal title="Journal" eyebrow="Reflect" onClose={close} wide>
      <Art className="space-banner" src="/assets/writing-nook.jpg" />
      <div className="feature-layout">
        <div className="feature-main">
          <form className="writing-form" onSubmit={save}>
            <label>
              <span>Title</span>
              <input
                name="title"
                defaultValue={editing?.title}
                placeholder="A few words for this moment"
              />
            </label>
            <label>
              <span>Your page</span>
              <textarea
                name="body"
                rows={10}
                defaultValue={editing?.body}
                placeholder="Start wherever you are…"
              />
            </label>
            <div className="form-row">
              <label>
                <span>Feeling word, optional</span>
                <input
                  name="mood"
                  defaultValue={editing?.mood}
                  placeholder="Steady, tender, curious…"
                />
              </label>
              <Button type="submit" icon={Feather}>
                Save entry
              </Button>
            </div>
          </form>
        </div>
        <aside className="feature-aside">
          <p className="eyebrow">Recent pages</p>
          <div className="mini-list">
            {state.journal.map((entry) => (
              <SwipeRow
                key={entry.id}
                actions={[
                  {
                    label: "Delete",
                    icon: Trash2,
                    tone: "danger",
                    onClick: () => {
                      if (editing?.id === entry.id) setEditing(null)
                      remove(
                        (current) => ({ ...current, journal: current.journal.filter((item) => item.id !== entry.id) }),
                        `Deleted “${entry.title}”.`,
                      )
                    },
                  },
                ]}
              >
                <button type="button" onClick={() => setEditing(entry)}>
                  <strong>{entry.title}</strong>
                  <small>
                    {formatDate(entry.date)} {entry.mood ? `· ${entry.mood}` : ""}
                  </small>
                  <span>{entry.body}</span>
                </button>
              </SwipeRow>
            ))}
          </div>
          {(state.voiceNotes ?? []).length > 0 && (
            <div className="journal-voice">
              <p className="eyebrow">Voice notes</p>
              <VoiceNoteList state={state} update={update} />
            </div>
          )}
        </aside>
      </div>
    </Modal>
  )
}

type SpaceProps = {
  state: AppState
  update: (recipe: (current: AppState) => AppState, message?: string) => void
  close: () => void
  reset?: (kind: "demo" | "empty") => void
}

type SyncControls = ReturnType<typeof useLifeStudioState>["sync"]

const syncLabel: Record<SyncStatus, string> = {
  off: "Not connected",
  syncing: "Syncing…",
  synced: "Synced",
  offline: "Offline · will sync later",
  locked: "Passcode needed",
  error: "Sync paused",
}

// Plays a voice note from this device, or fetches it from your other devices.
async function loadVoiceNote(id: string) {
  const local = await getVoiceNote(id).catch(() => undefined)
  if (local) return local
  if (!getPasscode()) return undefined
  const remote = await downloadVoice(id).catch(() => undefined)
  if (remote) await storeVoiceNote(id, remote).catch(() => undefined)
  return remote
}

function SyncSettings({ sync }: { sync: SyncControls }) {
  const [passcode, setPasscodeInput] = useState("")
  const [replace, setReplace] = useState(false)
  const connected = sync.status !== "off" && sync.status !== "locked"
  const Icon = sync.status === "synced" ? CloudCheck : CloudOff

  return (
    <section className="sync-setting">
      <div>
        <h3>Sync across devices</h3>
        <p>
          Your studio and voice notes are saved privately to your own site, so
          your phone and laptop stay in step. Enter the same passcode on each
          device.
        </p>
      </div>
      {connected ? (
        <div className="sync-status">
          <p className={`sync-pill is-${sync.status}`} role="status">
            <Icon size={16} />
            {syncLabel[sync.status]}
            {sync.status === "synced" && sync.lastSynced > 0 && (
              <small>
                {" "}
                ·{" "}
                {new Date(sync.lastSynced).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            )}
          </p>
          {sync.message && <p className="capture-disclaimer">{sync.message}</p>}
          <div className="inline-actions">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => sync.syncNow()}
            >
              Sync now
            </Button>
            <Button variant="ghost" onClick={sync.disconnect}>
              Stop syncing on this device
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="sync-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!passcode.trim()) return
            sync.connect(passcode, replace ? "upload" : "load")
          }}
        >
          <input
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(event) => setPasscodeInput(event.target.value)}
            placeholder="Studio passcode"
            aria-label="Studio passcode"
          />
          <label className="sync-replace">
            <input
              type="checkbox"
              checked={replace}
              onChange={(event) => setReplace(event.target.checked)}
            />
            <span>
              Replace the synced studio with this device’s data
              <small>
                Leave unticked to load what you saved on your other devices.
              </small>
            </span>
          </label>
          <Button type="submit" disabled={!passcode.trim()}>
            Connect
          </Button>
          {sync.message && (
            <p className="capture-disclaimer" role="alert">
              {sync.message}
            </p>
          )}
        </form>
      )}
    </section>
  )
}

function BreatheSpace({ state, update, close }: SpaceProps) {
  const [practice, setPractice] = useState<"guided" | "quiet">("guided")
  const [duration, setDuration] = useState(180)
  const [remaining, setRemaining] = useState(180)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const elapsed = duration - remaining
  const cycle = elapsed % 12
  const phase =
    practice === "quiet"
      ? "Be here"
      : cycle < 4
        ? "Breathe in"
        : cycle < 6
          ? "Rest gently"
          : "Breathe out"

  useEffect(() => {
    if (!running || remaining <= 0) return
    const timer = window.setInterval(
      () =>
        setRemaining((value) => {
          if (value <= 1) {
            setRunning(false)
            setFinished(true)
            return 0
          }
          return value - 1
        }),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [running, remaining])

  const chooseDuration = (seconds: number) => {
    setDuration(seconds)
    setRemaining(seconds)
    setRunning(false)
    setFinished(false)
  }

  const resetPractice = () => {
    setRemaining(duration)
    setRunning(false)
    setFinished(false)
  }

  return (
    <Modal
      title="Breathe"
      eyebrow="A quiet practice within Reflect"
      onClose={close}
      wide
    >
      <div className="breathe-layout">
        <section className="breathe-intro">
          <div>
            <p className="eyebrow">No streaks, no perfect calm</p>
            <h3>Make a little room inside the day.</h3>
            <p>
              Follow a gentle breath cue or sit with a quiet timer. Stop or
              return to normal breathing whenever you need.
            </p>
          </div>
          <img src="/assets/samoyed.png" alt="" />
        </section>

        <section className="breathe-player">
          <div className="segmented" aria-label="Choose a practice">
            <button
              type="button"
              className={practice === "guided" ? "is-active" : ""}
              aria-pressed={practice === "guided"}
              onClick={() => {
                setPractice("guided")
                resetPractice()
              }}
            >
              Guided breathing
            </button>
            <button
              type="button"
              className={practice === "quiet" ? "is-active" : ""}
              aria-pressed={practice === "quiet"}
              onClick={() => {
                setPractice("quiet")
                resetPractice()
              }}
            >
              Quiet meditation
            </button>
          </div>

          <div
            className={`breath-orb ${
              running ? "is-running" : ""
            } breath-orb--${phase.toLowerCase().replace(/ /g, "-")}`}
            aria-live="polite"
          >
            <Wind size={28} />
            <strong>{phase}</strong>
            <span>
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </span>
          </div>

          <div className="breathe-durations" aria-label="Practice duration">
            {[
              [60, "1 min"],
              [180, "3 min"],
              [300, "5 min"],
            ].map(([seconds, label]) => (
              <button
                type="button"
                className={duration === seconds ? "is-selected" : ""}
                aria-pressed={duration === seconds}
                onClick={() => chooseDuration(seconds as number)}
                key={seconds}
              >
                {label}
              </button>
            ))}
          </div>

          {!finished ? (
            <div className="inline-actions breathe-actions">
              <Button
                icon={running ? Pause : Play}
                onClick={() => setRunning(!running)}
              >
                {running ? "Pause" : elapsed ? "Continue" : "Begin"}
              </Button>
              {elapsed > 0 && (
                <Button variant="ghost" onClick={() => setFinished(true)}>
                  End gently
                </Button>
              )}
            </div>
          ) : (
            <form
              className="breathe-finish"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                update(
                  (current) => ({
                    ...current,
                    breatheSessions: [
                      {
                        id: uid(),
                        duration: Math.max(1, duration - remaining),
                        completedAt: new Date().toISOString(),
                        note: String(data.get("note") || "") || undefined,
                      },
                      ...(current.breatheSessions ?? []),
                    ],
                  }),
                  "A quiet moment saved—without a streak.",
                )
                resetPractice()
              }}
            >
              <p className="eyebrow">That was enough</p>
              <h3>How do you feel now?</h3>
              <textarea
                name="note"
                rows={3}
                placeholder="Optional. One word is enough…"
              />
              <Button type="submit" icon={Check}>
                Save this moment
              </Button>
            </form>
          )}

          <p className="breathe-safety">
            Breathing practices should feel comfortable. Stop if you feel dizzy,
            distressed, or unwell and return to your normal breath.
          </p>
        </section>

        <aside className="breathe-history">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent moments</p>
              <h3>Space you’ve already made</h3>
            </div>
          </div>
          {(state.breatheSessions ?? []).length ? (
            <div>
              {(state.breatheSessions ?? []).slice(0, 5).map((session) => (
                <article key={session.id}>
                  <span>
                    <Wind size={16} />
                  </span>
                  <div>
                    <strong>
                      {Math.max(1, Math.round(session.duration / 60))} quiet
                      minute
                      {session.duration >= 90 ? "s" : ""}
                    </strong>
                    <small>
                      {formatDate(session.completedAt.slice(0, 10))}
                    </small>
                    {session.note && <p>{session.note}</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>
              Your completed practices can gather here gently. Nothing is missed
              and nothing is overdue.
            </p>
          )}
          <Button
            variant="secondary"
            icon={Plus}
            onClick={() =>
              update(
                (current) => ({
                  ...current,
                  plan: [
                    ...current.plan,
                    {
                      id: uid(),
                      title: "A few quiet minutes",
                      area: "reflect",
                      date: today(),
                      duration: 5,
                      mode: "maybe",
                      status: "planned",
                    },
                  ],
                }),
                "A quiet five minutes is on Today, only if it helps.",
              )
            }
          >
            Add quiet time to Today
          </Button>
        </aside>
      </div>
    </Modal>
  )
}

function MoneySpace({ state, update, close }: SpaceProps) {
  const lessons = [
    {
      id: "time-in-market",
      title: "Why time matters more than perfect timing",
      theme: "Foundations",
      minutes: 8,
      summary:
        "Explore how compounding, consistency, and a long time horizon can work together.",
      reflection:
        "What would a patient approach to growing money make possible in your life?",
    },
    {
      id: "risk-language",
      title: "Making risk feel less mysterious",
      theme: "Risk & resilience",
      minutes: 10,
      summary:
        "Learn the difference between volatility, permanent loss, and the risk of not meeting a future goal.",
      reflection:
        "Which kinds of uncertainty feel manageable, and which would keep you awake?",
    },
    {
      id: "diversification",
      title: "The quiet power of diversification",
      theme: "Building blocks",
      minutes: 9,
      summary:
        "Understand why spreading exposure can reduce dependence on any single company, sector, or story.",
      reflection:
        "Where might you currently be relying too heavily on one outcome?",
    },
  ]
  const dayIndex = new Date().getDate() % lessons.length
  const dailyLesson = lessons[dayIndex]
  const [selectedLesson, setSelectedLesson] =
    useState<typeof lessons[number] | null>(null)
  const [addingGoal, setAddingGoal] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [guideAnswer, setGuideAnswer] = useState("")
  const moneyGoals = state.goals.filter((goal) => goal.area === "money")
  const completedLessons = state.moneyLessonsCompleted ?? []

  const [guideLoading, setGuideLoading] = useState(false)
  const [guideError, setGuideError] = useState("")

  const askGuide = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!question.trim() || guideLoading) return
    setGuideLoading(true)
    setGuideError("")
    try {
      setGuideAnswer(await askMoneyGuide(question.trim()))
    } catch (error) {
      setGuideError((error as Error).message)
    }
    setGuideLoading(false)
  }

  if (selectedLesson) {
    const complete = completedLessons.includes(selectedLesson.id)
    return (
      <Modal
        title={selectedLesson.title}
        eyebrow={`${selectedLesson.theme} · ${selectedLesson.minutes} minute lesson`}
        onClose={close}
        wide
      >
        <button
          type="button"
          className="back-link"
          onClick={() => setSelectedLesson(null)}
        >
          <ArrowLeft size={17} /> Investing Lab
        </button>
        <article className="money-lesson">
          <div className="money-lesson__visual">
            <span>
              <BookOpen size={34} />
            </span>
            <div>
              <p className="eyebrow">Today’s learning</p>
              <h3>{selectedLesson.title}</h3>
              <p>{selectedLesson.summary}</p>
            </div>
          </div>
          <section>
            <h3>One idea to hold onto</h3>
            <p>
              Investing is less about finding a perfect moment and more about
              understanding the relationship between time, uncertainty,
              diversification, costs, and your own goals. The right learning
              pace is one that helps you make informed decisions without
              urgency.
            </p>
          </section>
          <section className="lesson-example">
            <TrendingUp size={23} />
            <div>
              <h3>A simple thought experiment</h3>
              <p>
                Imagine two plans: one depends on predicting exactly what
                happens next, while the other is designed to remain sensible
                across many possible futures. What qualities would make the
                second plan feel resilient?
              </p>
            </div>
          </section>
          <section className="lesson-reflection">
            <p className="eyebrow">Think it through</p>
            <h3>{selectedLesson.reflection}</h3>
            <textarea
              rows={4}
              placeholder="A private note for your own thinking…"
            />
          </section>
          <div className="lesson-actions">
            <Button
              icon={complete ? Check : BookOpen}
              onClick={() =>
                update(
                  (current) => ({
                    ...current,
                    moneyLessonsCompleted: complete
                      ? current.moneyLessonsCompleted.filter(
                          (id) => id !== selectedLesson.id,
                        )
                      : [...current.moneyLessonsCompleted, selectedLesson.id],
                  }),
                  complete
                    ? "Lesson reopened."
                    : "Lesson complete. Your learning path has grown.",
                )
              }
            >
              {complete ? "Completed" : "Complete lesson"}
            </Button>
            <p>
              Educational content only. This prototype does not provide
              personalized investment advice.
            </p>
          </div>
        </article>
      </Modal>
    )
  }

  return (
    <Modal
      title="Investing Lab"
      eyebrow="Learn, reflect, and grow with intention"
      onClose={close}
      wide
    >
      <section className="money-studio-hero">
        <Art className="money-studio-hero__art" src="/assets/money-growth.jpg" />
        <div>
          <p className="eyebrow eyebrow--light">
            Your money, understood slowly
          </p>
          <h3>Grow knowledge before chasing outcomes.</h3>
          <p>
            Build your investing confidence, shape long-term goals, and ask
            better questions one lesson at a time.
          </p>
        </div>
        <TrendingUp size={48} strokeWidth={1.35} />
      </section>

      <div className="money-studio-grid">
        <section className="daily-lesson-card">
          <div className="daily-lesson-card__top">
            <span>
              <BookOpen size={23} />
            </span>
            <div>
              <p className="eyebrow">
                Today’s lesson · {dailyLesson.minutes} min
              </p>
              <h3>{dailyLesson.title}</h3>
            </div>
          </div>
          <p>{dailyLesson.summary}</p>
          <div className="daily-lesson-card__footer">
            <span>
              {completedLessons.includes(dailyLesson.id)
                ? "Completed and ready to revisit"
                : "One calm idea for today"}
            </span>
            <Button
              icon={BookOpen}
              onClick={() => setSelectedLesson(dailyLesson)}
            >
              Open lesson
            </Button>
          </div>
        </section>

        <section className="money-guide-card">
          <span className="money-guide-card__icon">
            <WandSparkles size={25} />
          </span>
          <p className="eyebrow">AI learning guide</p>
          <h3>Ask without pretending you should already know.</h3>
          <p>
            Explore concepts, vocabulary, and trade-offs. It will not recommend
            investments or tell you what to buy.
          </p>
          <Button variant="secondary" onClick={() => setGuideOpen(!guideOpen)}>
            {guideOpen ? "Close guide" : "Ask the guide"}
          </Button>
        </section>
      </div>

      {guideOpen && (
        <section className="money-guide">
          <div className="prototype-note">
            <Sparkles size={19} />
            <p>
              Answers come from AI and are educational only. The guide does not
              know your income, holdings, tax situation, or risk capacity.
            </p>
          </div>
          <form onSubmit={askGuide}>
            <label>
              <span>What would you like to understand?</span>
              <textarea
                rows={3}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="What does diversification actually do?"
              />
            </label>
            <Button
              type="submit"
              disabled={!question.trim() || guideLoading}
              icon={Sparkles}
            >
              {guideLoading ? "Thinking…" : "Explain it simply"}
            </Button>
          </form>
          {guideError && (
            <p className="capture-disclaimer" role="alert">
              {guideError}
            </p>
          )}
          {guideAnswer && (
            <div className="money-guide__answer" role="status">
              <span>
                <WandSparkles size={19} />
              </span>
              <div>
                <p className="eyebrow">A starting point</p>
                <p>{guideAnswer}</p>
                <small>
                  Learn the principle, then verify important decisions with
                  regulated, qualified guidance.
                </small>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="money-goals">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Money goals</p>
            <h3>What are you growing toward?</h3>
          </div>
          <Button
            variant="ghost"
            icon={Plus}
            onClick={() => setAddingGoal(!addingGoal)}
          >
            Add goal
          </Button>
        </div>
        {addingGoal && (
          <form
            className="money-goal-form"
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              update(
                (current) => ({
                  ...current,
                  goals: [
                    {
                      id: uid(),
                      title: String(data.get("title")),
                      area: "money",
                      scale: "big",
                      status: "tending",
                      nextStep:
                        String(data.get("nextStep")) ||
                        "Learn what this goal would need from me",
                      milestones: [
                        {
                          id: uid(),
                          title: "Define what this goal means to me",
                        },
                      ],
                    },
                    ...current.goals,
                  ],
                }),
                "Money goal added to your bigger goals.",
              )
              setAddingGoal(false)
            }}
          >
            <input
              name="title"
              required
              placeholder="Build long-term investing confidence"
            />
            <input
              name="nextStep"
              placeholder="A first learning or planning step"
            />
            <Button type="submit">Create goal</Button>
          </form>
        )}
        <div className="money-goal-list">
          {moneyGoals.map((goal) => {
            const milestones = goal.milestones ?? []
            const completed = milestones.filter(
              (milestone) => milestone.completedAt,
            ).length
            return (
              <article key={goal.id}>
                <div>
                  <span className="money-goal-list__icon">
                    <TrendingUp size={20} />
                  </span>
                  <div>
                    <h3>{goal.title}</h3>
                    <p>{goal.nextStep}</p>
                  </div>
                </div>
                <span>
                  {completed} of {milestones.length} milestones
                </span>
              </article>
            )
          })}
        </div>
      </section>

      <section className="learning-path">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Learning path</p>
            <h3>A foundation you can build on</h3>
          </div>
          <ShieldCheck size={22} />
        </div>
        <div className="learning-path__list">
          {lessons.map((lesson, index) => (
            <button
              type="button"
              onClick={() => setSelectedLesson(lesson)}
              key={lesson.id}
            >
              <span
                className={
                  completedLessons.includes(lesson.id) ? "is-complete" : ""
                }
              >
                {completedLessons.includes(lesson.id) ? (
                  <Check size={16} />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                <strong>{lesson.title}</strong>
                <small>
                  {lesson.theme} · {lesson.minutes} min
                </small>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      </section>
    </Modal>
  )
}

function MovementSpace({ state, update, close }: SpaceProps) {
  const [mode, setMode] =
    useState<"landing" | "strength" | "run" | "dance">("landing")
  if (mode === "strength") {
    return (
      <StrengthPlayer
        state={state}
        update={update}
        onBack={() => setMode("landing")}
        close={close}
      />
    )
  }
  if (mode === "run") {
    return (
      <RunPlayer
        onBack={() => setMode("landing")}
        close={close}
        update={update}
      />
    )
  }
  if (mode === "dance") {
    return (
      <DanceLogger
        onBack={() => setMode("landing")}
        close={close}
        update={update}
      />
    )
  }
  return (
    <Modal
      title="Movement"
      eyebrow="One part of a whole life"
      onClose={close}
      wide
    >
      <div className="movement-hero">
        <Art
          src="/assets/movement-path.jpg"
          fallback="/assets/dance-pavilion.jpg"
          alt="A dancer moving in a sunlit riverside pavilion"
        />
        <div>
          <p className="eyebrow eyebrow--light">
            Move in a way that meets you here
          </p>
          <h3>Strength, air, rhythm, or rest.</h3>
          <p>Choose what would support the day. Nothing is owed.</p>
        </div>
      </div>
      <div className="movement-grid">
        <button
          type="button"
          className="movement-grid__coach"
          onClick={() => window.dispatchEvent(new CustomEvent("studio:open", { detail: { focus: "move" } }))}
        >
          <WandSparkles size={24} />
          <strong>Plan with Studio</strong>
          <small>Workouts shaped by your body, energy and goals</small>
          <ChevronRight size={18} />
        </button>
        <button type="button" onClick={() => setMode("strength")}>
          <Dumbbell size={24} />
          <strong>Gentle strength</strong>
          <small>35 min · full body · editable</small>
          <ChevronRight size={18} />
        </button>
        <button type="button" onClick={() => setMode("run")}>
          <Play size={24} />
          <strong>Run / walk</strong>
          <small>Foreground intervals · no GPS</small>
          <ChevronRight size={18} />
        </button>
        <button type="button" onClick={() => setMode("dance")}>
          <Music2 size={24} />
          <strong>Dance</strong>
          <small>Log a class or flexible practice</small>
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          onClick={() =>
            update(
              (current) => ({
                ...current,
                plan: [
                  ...current.plan,
                  {
                    id: uid(),
                    title: "Recovery and open space",
                    area: "move",
                    date: today(),
                    mode: "flexible",
                    status: "planned",
                    duration: 20,
                  },
                ],
              }),
              "Recovery is the plan.",
            )
          }
        >
          <Coffee size={24} />
          <strong>Recovery</strong>
          <small>Rest, walk, or gentle mobility</small>
          <ChevronRight size={18} />
        </button>
      </div>
      <MyWorkouts state={state} update={update} />
      <section className="movement-notes">
        <div className="section-heading">
          <div>
            <p className="eyebrow">What Studio knows</p>
            <h3>Your body, health goals and energy</h3>
          </div>
          <PenLine size={20} />
        </div>
        <p>
          {state.aboutMe?.body || state.aboutMe?.healthGoals
            ? [state.aboutMe.healthGoals, state.aboutMe.body].filter(Boolean).join(" · ")
            : "Tell Studio about injuries, what feels good, your long-term health goals and energy, so every workout fits you."}
        </p>
        <Button variant="secondary" onClick={() => window.dispatchEvent(new CustomEvent("space:open", { detail: "about" }))}>
          Open About me
        </Button>
      </section>
      <section className="movement-goals">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Known goals</p>
            <h3>Dates stay honest</h3>
          </div>
        </div>
        {state.goals
          .filter((goal) => goal.area === "move")
          .map((goal) => (
            <article key={goal.id}>
              <div>
                <strong>{goal.title}</strong>
                <p>{goal.dateLabel}</p>
              </div>
              <span>{goal.nextStep}</span>
            </article>
          ))}
      </section>
    </Modal>
  )
}

function StrengthPlayer({
  state,
  update,
  onBack,
  close,
}: SpaceProps & { onBack: () => void }) {
  const template = [
    ["Sit to stand", 10],
    ["Supported row", 10],
    ["Wall push", 8],
    ["Calf raise", 12],
  ] as const
  const sets =
    state.workout.sets.length > 0
      ? state.workout.sets
      : template.flatMap(([exercise, reps]) =>
          [1, 2].map((number) => ({
            id: `${exercise}-${number}`,
            exercise,
            reps,
            complete: false,
          })),
        )
  const current = sets[Math.min(state.workout.current, sets.length - 1)]
  const [rest, setRest] = useState(0)

  useEffect(() => {
    if (rest <= 0) return
    const timer = window.setInterval(
      () => setRest((value) => Math.max(0, value - 1)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [rest])

  const completeSet = () => {
    const index = sets.findIndex((set) => set.id === current.id)
    update((value) => ({
      ...value,
      workout: {
        active: index < sets.length - 1,
        startedAt: value.workout.startedAt ?? Date.now(),
        current: Math.min(index + 1, sets.length - 1),
        sets: sets.map((set) =>
          set.id === current.id ? { ...set, complete: true } : set,
        ),
      },
    }))
    if (index < sets.length - 1) setRest(45)
  }

  return (
    <Modal
      title="Gentle strength"
      eyebrow="Example plan — review before using"
      onClose={close}
      wide
    >
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft size={17} /> Movement
      </button>
      <div className="workout-layout">
        <aside className="workout-list">
          <p className="eyebrow">Today’s session</p>
          <h3>Full-body return</h3>
          <p>Two comfortable rounds. Stop if something does not feel right.</p>
          <div>
            {sets.map((set, index) => (
              <button
                type="button"
                className={`${set.complete ? "is-complete" : ""} ${
                  set.id === current.id ? "is-current" : ""
                }`}
                onClick={() =>
                  update((value) => ({
                    ...value,
                    workout: {
                      ...value.workout,
                      sets,
                      current: index,
                      active: true,
                    },
                  }))
                }
                key={set.id}
              >
                <span>{set.complete ? <Check size={15} /> : index + 1}</span>
                <span>
                  <strong>{set.exercise}</strong>
                  <small>{set.reps} comfortable reps</small>
                </span>
              </button>
            ))}
          </div>
        </aside>
        <section className="workout-player">
          {rest > 0 ? (
            <div className="rest-state">
              <p className="eyebrow">Rest is part of the set</p>
              <div className="rest-clock">{rest}</div>
              <h3>Let your breath settle.</h3>
              <p>The next exercise is {current.exercise}.</p>
              <div className="inline-actions">
                <Button variant="secondary" onClick={() => setRest(rest + 30)}>
                  +30 seconds
                </Button>
                <Button onClick={() => setRest(0)}>I’m ready</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="exercise-illustration">
                <Dumbbell size={48} strokeWidth={1.3} />
              </div>
              <p className="eyebrow">
                Set {state.workout.current + 1} of {sets.length}
              </p>
              <h2>{current.exercise}</h2>
              <p className="exercise-cue">
                Move slowly and keep the range comfortable. Finish with a little
                energy left.
              </p>
              <div className="set-fields">
                <label>
                  <span>Reps</span>
                  <input type="number" defaultValue={current.reps} min="1" />
                </label>
                <label>
                  <span>Weight, optional</span>
                  <div className="input-suffix">
                    <input type="number" min="0" step="0.5" placeholder="—" />
                    <span>kg</span>
                  </div>
                </label>
              </div>
              <Button
                className="button--large"
                icon={Check}
                onClick={completeSet}
              >
                Complete set
              </Button>
              <div className="player-links">
                <button
                  type="button"
                  onClick={() =>
                    update(
                      (value) => ({
                        ...value,
                        workout: {
                          ...value.workout,
                          active: true,
                          sets: sets.map((set) =>
                            set.id === current.id
                              ? {
                                  ...set,
                                  exercise: "Comfortable alternative",
                                }
                              : set,
                          ),
                        },
                      }),
                      "Swapped for a comfortable alternative.",
                    )
                  }
                >
                  Swap exercise
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const index = sets.findIndex((set) => set.id === current.id)
                    update(
                      (value) => ({
                        ...value,
                        workout: {
                          ...value.workout,
                          active: index < sets.length - 1,
                          sets,
                          current: Math.min(index + 1, sets.length - 1),
                        },
                      }),
                      "Skipped without marking it complete.",
                    )
                  }}
                >
                  Skip this set
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </Modal>
  )
}

function RunPlayer({
  onBack,
  close,
  update,
}: {
  onBack: () => void
  close: () => void
  update: SpaceProps["update"]
}) {
  const [seconds, setSeconds] = useState(60)
  const [running, setRunning] = useState(false)
  const [round, setRound] = useState(1)

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value > 1) return value - 1
        setRound((current) => current + 1)
        return round % 2 ? 90 : 60
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, round])

  return (
    <Modal
      title="Run / walk"
      eyebrow="Foreground timer · no GPS"
      onClose={close}
    >
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft size={17} /> Movement
      </button>
      <div className="run-player">
        <p className="eyebrow">
          Round {round} · {round % 2 ? "Easy walk" : "Gentle run"}
        </p>
        <div className="run-clock">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </div>
        <h3>
          {round % 2
            ? "Walk and let your breath settle."
            : "Easy enough to speak."}
        </h3>
        <p>Next: {round % 2 ? "90 sec gentle run" : "60 sec easy walk"}</p>
        <Button
          className="button--round"
          icon={running ? Pause : Play}
          onClick={() => setRunning(!running)}
        >
          {running ? "Pause" : "Start"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setRunning(false)
            update(
              (current) => ({
                ...current,
                plan: [
                  ...current.plan,
                  {
                    id: uid(),
                    title: "Run / walk recorded",
                    area: "move",
                    date: today(),
                    mode: "flexible",
                    status: "complete",
                    duration: 20,
                  },
                ],
              }),
              "Run / walk saved as it happened.",
            )
            onBack()
          }}
        >
          Finish and save
        </Button>
        <p className="safety-note">
          This is general guidance, not a prescription. Stop if you feel pain or
          unwell.
        </p>
      </div>
    </Modal>
  )
}

function DanceLogger({
  onBack,
  close,
  update,
}: {
  onBack: () => void
  close: () => void
  update: SpaceProps["update"]
}) {
  return (
    <Modal
      title="Log dance"
      eyebrow="Class or flexible practice"
      onClose={close}
    >
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft size={17} /> Movement
      </button>
      <form
        className="dance-form"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          update(
            (current) => ({
              ...current,
              plan: [
                ...current.plan,
                {
                  id: uid(),
                  title: `${data.get("style") || "Dance"} practice`,
                  area: "move",
                  date: today(),
                  mode: "flexible",
                  status: "complete",
                  duration: Number(data.get("duration") || 45),
                  note: String(data.get("focus") || ""),
                },
              ],
            }),
            "Dance saved as meaningful movement.",
          )
          onBack()
        }}
      >
        <label>
          <span>Style or class</span>
          <input
            name="style"
            placeholder="Contemporary, house, open practice…"
          />
        </label>
        <div className="form-row">
          <label>
            <span>Actual minutes</span>
            <input name="duration" type="number" defaultValue="45" />
          </label>
          <label>
            <span>How did it feel?</span>
            <select name="effort">
              <option>Light and playful</option>
              <option>About right</option>
              <option>More demanding</option>
            </select>
          </label>
        </div>
        <label>
          <span>What did you work on?</span>
          <textarea
            name="focus"
            rows={4}
            placeholder="A phrase, quality, or moment to remember…"
          />
        </label>
        <Button type="submit" icon={Music2}>
          Save dance
        </Button>
      </form>
    </Modal>
  )
}

function PreferencesSpace({
  state,
  update,
  close,
  reset,
  sync,
}: SpaceProps & { sync: SyncControls }) {
  const [name, setName] = useState(state.name)
  const togglePriority = (area: Area) =>
    update(
      (current) => ({
        ...current,
        priorities: current.priorities.includes(area)
          ? current.priorities.filter((item) => item !== area)
          : [...current.priorities, area].slice(-3),
      }),
      "What appears first has been updated.",
    )

  return (
    <Modal
      title="My Studio"
      eyebrow="Shape the app around your life"
      onClose={close}
      wide
    >
      <div className="settings-list">
        <SyncSettings sync={sync} />
        <section>
          <div>
            <h3>What should the studio call you?</h3>
            <p>This is just for your greeting and companion.</p>
          </div>
          <form
            className="name-setting"
            onSubmit={(event) => {
              event.preventDefault()
              if (!name.trim()) return
              update(
                (current) => ({ ...current, name: name.trim() }),
                "Your studio feels a little more yours.",
              )
            }}
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Your name"
            />
            <Button type="submit" variant="secondary">
              Save
            </Button>
          </form>
        </section>
        <section>
          <div>
            <h3>Today’s density</h3>
            <p>Choose how much the home screen offers at once.</p>
          </div>
          <div className="segmented">
            {(["one", "few", "full"] as const).map((density) => (
              <button
                type="button"
                className={state.density === density ? "is-active" : ""}
                aria-pressed={state.density === density}
                onClick={() =>
                  update(
                    (current) => ({ ...current, density }),
                    "Today’s shape updated.",
                  )
                }
                key={density}
              >
                {density === "one"
                  ? "One focus"
                  : density === "few"
                    ? "A few"
                    : "Fuller"}
              </button>
            ))}
          </div>
        </section>
        <section className="priority-setting">
          <div>
            <h3>What matters in this season?</h3>
            <p>
              Choose up to three areas. They influence suggestions, not what
              counts.
            </p>
          </div>
          <div className="studio-priority-grid">
            {(Object.keys(areaMeta) as Area[]).map((area) => {
              const Icon = areaIcon[area]
              const active = state.priorities.includes(area)
              return (
                <button
                  type="button"
                  className={active ? "is-active" : ""}
                  aria-pressed={active}
                  onClick={() => togglePriority(area)}
                  key={area}
                >
                  <Icon size={17} />
                  {areaMeta[area].label}
                </button>
              )
            })}
          </div>
        </section>
        <section>
          <div>
            <h3>Your Studio companion</h3>
            <p>
              Ask for help planning, organising, learning, reflecting, or
              shaping a gentle next step. Speak or type; every AI suggestion is
              previewed before anything changes.
            </p>
          </div>
          <div className="settings-companion">
            <img src="/assets/samoyed.png" alt="" />
          </div>
        </section>
        <details className="backup-settings">
          <summary>Backup or start fresh</summary>
          <p>
            You probably won’t need this day to day. It is here only so your
            personal journey can be copied or reset when you choose.
          </p>
          <div className="inline-actions">
            <Button
              variant="secondary"
              onClick={() => {
                const blob = new Blob([JSON.stringify(state, null, 2)], {
                  type: "application/json",
                })
                const url = URL.createObjectURL(blob)
                const anchor = document.createElement("a")
                anchor.href = url
                anchor.download = "avika-life-studio-backup.json"
                anchor.click()
                URL.revokeObjectURL(url)
              }}
            >
              Download a backup
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                window.confirm(
                  "Start completely fresh? This clears everything (goals, plans, logs, journal, people, projects) on every synced device, then takes you through setup again. Download a backup first if you might want any of it.",
                ) && reset?.("empty")
              }
            >
              Start fresh
            </Button>
          </div>
        </details>
      </div>
    </Modal>
  )
}

function AddPlanModal({
  state,
  date,
  goals,
  plan,
  onClose,
  onSave,
}: {
  state: AppState
  date: string
  goals: Goal[]
  plan: PlanItem[]
  onClose: () => void
  onSave: (item: PlanItem, repeat?: { frequency: RepeatFrequency; until?: string }) => void
}) {
  const [draft, setDraft] = useState<{
    date: string
    time?: string
    duration?: number
    kind?: ActivityKind
    repeat?: RepeatFrequency
  }>({ date })
  // A session Studio planned (or a saved workout) for this slot.
  const [planned, setPlanned] = useState<PlannedSession | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const preview = checkPlacement(
    plan,
    {
      id: "new",
      title: "",
      area: "move",
      date: draft.date,
      mode: "flexible",
      status: "planned",
      duration: draft.duration,
      kind: draft.kind,
      intensity: draft.kind === "walk" ? "light" : undefined,
    },
    draft.date,
    draft.time,
  )
  return (
    <Modal
      title="Add something"
      eyebrow="A plan, not a promise"
      onClose={onClose}
    >
      <form
        ref={formRef}
        className="plan-form"
        onChange={(event) => {
          const data = new FormData(event.currentTarget)
          setDraft({
            date: String(data.get("date") || date),
            time: String(data.get("time")) || undefined,
            duration: Number(data.get("duration") || 0) || undefined,
            kind: (String(data.get("kind")) || undefined) as
              | ActivityKind
              | undefined,
            repeat: (String(data.get("repeat") || "") || undefined) as
              | RepeatFrequency
              | undefined,
          })
        }}
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const steps = String(data.get("steps") || "")
            .split("\n")
            .map((step) => step.trim())
            .filter(Boolean)
          const kind = (String(data.get("kind")) || undefined) as
            | ActivityKind
            | undefined
          onSave({
            id: uid(),
            title: String(data.get("title")),
            kind,
            intensity: kind === "walk" ? "light" : undefined,
            area: kind ? "move" : (String(data.get("area")) as Area),
            date: String(data.get("date")),
            time: String(data.get("time")) || undefined,
            duration: Number(data.get("duration") || 0) || undefined,
            mode: String(data.get("mode")) as PlanItem["mode"],
            status: "planned",
            goalId: String(data.get("goalId") || "") || undefined,
            ...(planned && kind
              ? { details: planned.details.length ? planned.details : undefined, workout: kind === "gym" ? planned.workout : undefined }
              : {}),
            steps: steps.map((title) => ({
              id: uid(),
              title,
              complete: false,
            })),
          }, String(data.get("repeat") || "")
            ? {
                frequency: String(data.get("repeat")) as RepeatFrequency,
                until: String(data.get("until") || "") || undefined,
              }
            : undefined)
        }}
      >
        <label>
          <span>What would you like to make room for?</span>
          <input name="title" required autoFocus placeholder="Name it simply" />
        </label>
        <div className="form-row">
          <label>
            <span>Part of life</span>
            <select name="area" defaultValue="create">
              {(Object.keys(areaMeta) as Area[]).map((area) => (
                <option value={area} key={area}>
                  {areaMeta[area].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>How fixed is it?</span>
            <select name="mode" defaultValue="flexible">
              <option value="fixed">Fixed commitment</option>
              <option value="flexible">Flexible intention</option>
              <option value="maybe">Maybe</option>
            </select>
          </label>
        </div>
        <div className="form-row form-row--three">
          <label>
            <span>Date</span>
            <input name="date" type="date" defaultValue={date} required />
          </label>
          <label>
            <span>Time</span>
            <input name="time" type="time" />
          </label>
          <label>
            <span>Minutes</span>
            <input
              name="duration"
              type="number"
              min="5"
              step="5"
              placeholder="25"
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>Repeats</span>
            <select name="repeat" defaultValue="">
              <option value="">Doesn’t repeat</option>
              {(Object.keys(REPEAT_LABELS) as RepeatFrequency[]).map((key) => (
                <option value={key} key={key}>
                  {REPEAT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          {draft.repeat && (
            <label>
              <span>Until (optional)</span>
              <input name="until" type="date" min={draft.date} />
            </label>
          )}
        </div>
        <label>
          <span>Movement session, optional</span>
          <select name="kind" defaultValue="">
            <option value="">Not a movement session</option>
            <option value="gym">Gym / strength</option>
            <option value="walk">Walk</option>
            <option value="run">Run</option>
            <option value="dance">Dance</option>
          </select>
        </label>
        {draft.kind && ["gym", "run", "walk", "dance"].includes(draft.kind) && (
          planned ? (
            <div className="session-planner is-result">
              <p className="eyebrow">Session planned</p>
              <strong>{planned.title}</strong>
              <small>
                {planned.workout?.length ? `${planned.workout.length} exercises, ready to follow` : "Details added"}
              </small>
              <button type="button" className="text-link" onClick={() => setPlanned(null)}>
                Change
              </button>
            </div>
          ) : (
            <SessionPlanner
              state={state}
              kind={draft.kind}
              date={draft.date}
              time={draft.time}
              duration={draft.duration}
              title={String(new FormData(formRef.current ?? undefined).get("title") || "") || undefined}
              onUse={(session) => {
                setPlanned(session)
                const form = formRef.current
                if (!form) return
                const titleInput = form.elements.namedItem("title") as HTMLInputElement | null
                const durationInput = form.elements.namedItem("duration") as HTMLInputElement | null
                if (titleInput && !titleInput.value.trim() && session.title) titleInput.value = session.title
                if (durationInput && !durationInput.value && session.duration) {
                  durationInput.value = String(session.duration)
                  setDraft((current) => ({ ...current, duration: session.duration }))
                }
              }}
            />
          )
        )}
        {(preview.conflicts.length > 0 || preview.warnings.length > 0) && (
          <div className="move-sheet__preview" role="status">
            <p className="eyebrow">Before you add it</p>
            {preview.conflicts.map((other) => (
              <p className="move-sheet__warn" key={other.id}>
                Overlaps {other.title} at {other.time}
              </p>
            ))}
            {preview.warnings.map((warning) => (
              <p className="move-sheet__warn" key={warning}>
                {warning}
              </p>
            ))}
          </div>
        )}
        <label>
          <span>Link to a goal, optional</span>
          <select name="goalId" defaultValue="">
            <option value="">No linked goal</option>
            {goals
              .filter((goal) => goal.status === "tending")
              .map((goal) => (
                <option value={goal.id} key={goal.id}>
                  {goal.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>Starting steps, optional</span>
          <textarea
            name="steps"
            rows={4}
            placeholder={"One small step per line\nAnother manageable step"}
          />
        </label>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon={Plus}>
            {preview.conflicts.length || preview.warnings.length
              ? "Add anyway"
              : "Add to plan"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

type CaptureMode =
  | "saved"
  | "choose"
  | "listening"
  | "recording"
  | "review"
  | "processing"
  | "compose"
  | "error"

const MAX_RECORDING_SECONDS = 180
const MAX_LISTENING_SECONDS = 120
function preferredAudioType() {
  if (typeof MediaRecorder === "undefined") return ""
  return (
    ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(
      (type) => MediaRecorder.isTypeSupported?.(type),
    ) ?? ""
  )
}

const DRAFT_KEY = "life-studio:assistant-draft"
// Your own words are kept if the AI fails, so nothing you said or typed is lost.
function readDraft() {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? ""
  } catch {
    return ""
  }
}
function saveDraft(value: string) {
  try {
    localStorage.setItem(DRAFT_KEY, value)
  } catch {
    // Storage unavailable; the text stays in the box for this visit.
  }
}
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nothing to clear.
  }
}

function VoiceCapture({
  state,
  onClose,
  update,
  onGo,
  notesOnly = false,
}: {
  state: AppState
  onClose: () => void
  update: SpaceProps["update"]
  onGo: (to: Destination) => void
  notesOnly?: boolean
}) {
  const [mode, setMode] = useState<CaptureMode>("choose")
  const [saved, setSaved] = useState<{ summary: string; label: string; to: Destination }[]>([])
  const [text, setText] = useState("")
  const [noteTitle, setNoteTitle] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0)
  const [audioUrl, setAudioUrl] = useState("")
  const [playingUrl, setPlayingUrl] = useState("")
  const [processingLabel, setProcessingLabel] = useState("")
  const [proposal, setProposal] = useState<StudioProposal | null>(null)
  const [selected, setSelected] = useState<boolean[]>([])
  const [aiError, setAiError] = useState("")
  const [errorKind, setErrorKind] = useState<"mic" | "storage" | "speech">(
    "mic",
  )
  const [heard, setHeard] = useState("")
  const [askedLabel, setAskedLabel] = useState("")
  const [hint, setHint] = useState("")
  const [dictateHint, setDictateHint] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(readDraft)
  const lastRequest = useRef("")
  const listener = useRef<ReturnType<typeof listen> | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const recordedBlob = useRef<Blob | null>(null)
  const chunks = useRef<Blob[]>([])
  const discarded = useRef(false)
  const analyserFrame = useRef<number | null>(null)

  const stopTracks = () => {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    if (analyserFrame.current) cancelAnimationFrame(analyserFrame.current)
    analyserFrame.current = null
    audioContext.current?.close().catch(() => undefined)
    audioContext.current = null
  }

  useEffect(() => {
    if (mode !== "recording" && mode !== "listening") return
    const timer = window.setInterval(
      () => setElapsed((value) => value + 1),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [mode])

  useEffect(() => {
    if (mode === "recording" && elapsed >= MAX_RECORDING_SECONDS)
      recorder.current?.stop()
    if (mode === "listening" && elapsed >= MAX_LISTENING_SECONDS)
      listener.current?.stop()
  }, [elapsed, mode])

  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") {
        discarded.current = true
        recorder.current.stop()
      }
      stopTracks()
      listener.current?.cancel()
    },
    [],
  )

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    },
    [audioUrl],
  )

  useEffect(
    () => () => {
      if (playingUrl) URL.revokeObjectURL(playingUrl)
    },
    [playingUrl],
  )

  // Quick actions run without filling the box, so it stays empty for your own words.
  const runAssistant = async (request: string, label = "") => {
    const input = request.trim()
    if (!input) return
    lastRequest.current = input
    setAskedLabel(label)
    setText(label ? "" : input)
    setProposal(null)
    setAiError("")
    setProcessingLabel("Studio is thinking…")
    setMode("processing")
    try {
      const result = await askStudio(input, state)
      const actions = Array.isArray(result.actions) ? result.actions : []
      setProposal({ reply: result.reply ?? "", actions })
      setSelected(actions.map(() => true))
    } catch (error) {
      setAiError((error as Error).message)
      if (!label) saveDraft(input)
    }
    setMode("compose")
  }

  // Keyboard dictation always works, including in iPhone home-screen apps.
  // flushSync + focus inside the tap is what lets iOS open the keyboard.
  const dictateWithKeyboard = () => {
    flushSync(() => {
      openComposer()
      setDictateHint(true)
    })
    composerRef.current?.focus()
  }

  const startListening = () => {
    if (!speechSupported()) {
      dictateWithKeyboard()
      return
    }
    setHeard("")
    setElapsed(0)
    setMode("listening")
    listener.current = listen({
      onText: setHeard,
      onDone: (transcript) => {
        listener.current = null
        if (transcript.trim()) runAssistant(transcript)
        else {
          openComposer()
          setAiError("Studio didn’t catch anything. Try again or type it.")
        }
      },
      onError: (kind) => {
        listener.current = null
        if (kind === "permission") {
          setErrorKind("speech")
          setMode("error")
        } else {
          openComposer()
          setDictateHint(true)
        }
      },
    })
  }

  const cancelListening = () => {
    listener.current?.cancel()
    listener.current = null
    setMode("choose")
  }

  const startRecording = async () => {
    setErrorKind("mic")
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMode("error")
      return
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      stream.current = mediaStream
      const mimeType = preferredAudioType()
      const mediaRecorder = mimeType
        ? new MediaRecorder(mediaStream, { mimeType })
        : new MediaRecorder(mediaStream)
      recorder.current = mediaRecorder
      chunks.current = []
      discarded.current = false
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data)
      }
      mediaRecorder.onstop = () => {
        stopTracks()
        if (discarded.current) return
        const blob = new Blob(chunks.current, {
          type: (mediaRecorder.mimeType || mimeType || "audio/mp4").split(
            ";",
          )[0],
        })
        recordedBlob.current = blob
        setAudioUrl(URL.createObjectURL(blob))
        setMode("review")
      }
      mediaRecorder.start(1000)
      setElapsed(0)
      setMode("recording")

      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (AudioContextClass) {
        const context = new AudioContextClass()
        audioContext.current = context
        const source = context.createMediaStreamSource(mediaStream)
        const analyser = context.createAnalyser()
        analyser.fftSize = 64
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const sample = () => {
          analyser.getByteFrequencyData(data)
          setLevel(
            data.reduce((sum, value) => sum + value, 0) / data.length / 255,
          )
          analyserFrame.current = requestAnimationFrame(sample)
        }
        sample()
      }
    } catch {
      stopTracks()
      setMode("error")
    }
  }

  const discardRecording = () => {
    discarded.current = true
    if (recorder.current?.state === "recording") recorder.current.stop()
    stopTracks()
    setMode("choose")
  }

  const openComposer = (prefill = "") => {
    setHeard("")
    setHint("")
    setDictateHint(false)
    setAskedLabel("")
    setText(prefill)
    setProposal(null)
    setAiError("")
    setMode("compose")
  }

  const useOffline = () => {
    const result = offlineProposal(text.trim() || lastRequest.current, state)
    setAiError("")
    setProposal(result)
    setSelected(result.actions.map(() => true))
  }

  // Safety net: check each suggestion against the real calendar and recovery rules.
  const actionWarnings = (action: StudioAction) => {
    if (!isDate(action.date)) return []
    const time = isTime(action.time) ? action.time : undefined
    const existing =
      action.type === "move_plan"
        ? state.plan.find((item) => item.id === action.planId)
        : undefined
    if (action.type === "move_plan" && !existing) return []
    if (!existing && action.type !== "add_plan" && action.type !== "add_gym_session")
      return []
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
    return [
      ...conflicts.map((other) => `Overlaps ${other.title} at ${other.time}`),
      ...warnings,
    ]
  }

  const isValidAction = (action: StudioAction) => {
    if (action.type === "move_plan" || action.type === "complete_plan")
      return state.plan.some(
        (item) => item.id === action.planId && item.status !== "complete",
      )
    if (action.type === "log_activity" && action.planId)
      return state.plan.some(
        (item) => item.id === action.planId && item.status !== "complete",
      )
    return true
  }

  const confirmProposal = () => {
    if (!proposal) return
    const chosen = proposal.actions.filter(
      (action, index) => selected[index] && isValidAction(action),
    )
    if (!chosen.length) return
    setSaved(
      chosen.map((action) => ({ summary: action.summary, ...destinationOf(action, state) })),
    )
    update((current) => chosen.reduce(applyAction, current))
    clearDraft()
    setMode("saved")
  }

  const saveRecordedNote = async () => {
    if (!recordedBlob.current) return
    const id = uid()
    try {
      await storeVoiceNote(id, recordedBlob.current)
      update(
        (current) => ({
          ...current,
          voiceNotes: [
            {
              id,
              title: noteTitle.trim() || "Voice note",
              createdAt: new Date().toISOString(),
              duration: elapsed,
            },
            ...(current.voiceNotes ?? []),
          ],
        }),
        "Voice note saved privately on this device.",
      )
      onClose()
    } catch {
      setErrorKind("storage")
      setMode("error")
    }
  }

  const playSavedNote = async (id: string) => {
    const blob = await loadVoiceNote(id)
    if (!blob) return
    setPlayingUrl(URL.createObjectURL(blob))
  }

  const quickActions: {
    icon: LucideIcon
    title: string
    hint: string
    prompt: string
  }[] = [
    {
      icon: CalendarRange,
      title: "Plan my day",
      hint: "Find a manageable shape",
      prompt: "Help me plan a balanced day with what I already have.",
    },
    {
      icon: ArrowRight,
      title: "Move something",
      hint: "Reschedule without the guilt",
      prompt: "Move my next flexible plan to tomorrow afternoon.",
    },
    {
      icon: Sparkles,
      title: "Add a goal",
      hint: "Break it into milestones",
      prompt: "Add a bigger goal: Create something I am proud to share",
    },
    {
      icon: Lightbulb,
      title: "Find inspiration",
      hint: "A small prompt, not homework",
      prompt:
        "Give me one creative inspiration for this week and save it as a project idea.",
    },
    {
      icon: Dumbbell,
      title: "Plan a gym session",
      hint: "Start from a goal, then edit",
      prompt: "Plan a gentle gym session to support my Hackney Half goal.",
    },
  ]

  return (
    <Modal
      title={notesOnly ? "Voice notes" : "Studio assistant"}
      eyebrow="Plan, capture, and shape what’s next"
      onClose={onClose}
    >
      <div className="capture assistant">
        {mode === "saved" && (
          <div className="assistant-saved">
            <span className="assistant-saved__icon">
              <Check size={26} />
            </span>
            <h3>{saved.length === 1 ? "Saved." : `${saved.length} changes saved.`}</h3>
            <ul>
              {saved.map((entry, index) => (
                <li key={index}>
                  <div>
                    <strong>{entry.summary}</strong>
                    <small>{entry.label}</small>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      onClose()
                      onGo(entry.to)
                    }}
                  >
                    Go there <ChevronRight size={15} />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="inline-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setSaved([])
                  setProposal(null)
                  setText("")
                  setMode("choose")
                }}
              >
                Ask something else
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
        {mode === "choose" && (
          <>
            <div className="assistant-welcome">
              <span className="assistant-welcome__pet">
                <img src="/assets/samoyed.png" alt="" />
              </span>
              <div>
                <h3>Your Studio companion is here.</h3>
                <p>
                  A gentle coach and organiser for the next manageable step.
                </p>
              </div>
            </div>
            {!notesOnly && draft && (
              <div className="draft-restore">
                <p>
                  <strong>Unsent request saved</strong>
                  <small>{draft.length > 70 ? `${draft.slice(0, 70)}…` : draft}</small>
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    openComposer(draft)
                    clearDraft()
                    setDraft("")
                  }}
                >
                  Restore
                </Button>
                <IconButton
                  label="Discard saved request"
                  icon={X}
                  onClick={() => {
                    clearDraft()
                    setDraft("")
                  }}
                />
              </div>
            )}
            {!notesOnly && (
            <div className="assistant-actions">
              {quickActions.map(({ icon: Icon, title, hint, prompt }) => (
                <button
                  type="button"
                  onClick={() => runAssistant(prompt, title)}
                  key={title}
                >
                  <Icon size={20} />
                  <span>
                    <strong>{title}</strong>
                    <small>{hint}</small>
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  openComposer()
                  setHint("Today I feel… (Studio can save it as a journal entry)")
                }}
              >
                <Heart size={20} />
                <span>
                  <strong>Check in gently</strong>
                  <small>Notice, don’t diagnose</small>
                </span>
              </button>
            </div>
            )}
            <div className="assistant-inputs">
              {!notesOnly && (
              <>
              <button type="button" onClick={startListening}>
                <span>
                  <Mic size={23} />
                </span>
                <div>
                  <strong>Talk to Studio</strong>
                  <small>Speak a request or thought</small>
                </div>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => openComposer()}>
                <span>
                  <PenLine size={21} />
                </span>
                <div>
                  <strong>Type to Studio</strong>
                  <small>Ask, plan, move, or capture</small>
                </div>
                <ChevronRight size={18} />
              </button>
              </>
              )}
              <button type="button" onClick={startRecording}>
                <span>
                  <AudioLines size={22} />
                </span>
                <div>
                  <strong>Save a voice note</strong>
                  <small>Keep the audio without AI</small>
                </div>
                <ChevronRight size={18} />
              </button>
            </div>
            {(state.voiceNotes ?? []).length > 0 && (
              <div className="recent-voice-notes">
                <p className="eyebrow">Your voice notes</p>
                <VoiceNoteList state={state} update={update} limit={notesOnly ? undefined : 3} />
              </div>
            )}
            <div className="prototype-note">
              <Sparkles size={19} />
              <p>
                {notesOnly
                  ? "Voice notes are private recordings saved to your studio. They are never sent to AI."
                  : "Your browser turns speech into text for free, then Studio’s AI suggests changes. Voice notes are never sent to AI. Nothing changes until you confirm."}
              </p>
            </div>
            <div className="assistant-boundary">
              <ShieldCheck size={17} />
              <p>
                Your companion can organise, encourage, and explain. It is not a
                therapist or clinician and does not diagnose or treat health
                conditions.
              </p>
            </div>
          </>
        )}
        {mode === "listening" && (
          <div className="recording-state">
            <div className="recording-orb is-listening">
              <span />
              <Mic size={31} />
            </div>
            <p className="eyebrow">Listening · tap send when you’re done</p>
            <p className="live-transcript" aria-live="polite">
              {heard || "Go ahead, I’m listening…"}
            </p>
            <Button icon={Check} onClick={() => listener.current?.stop()}>
              Send to Studio
            </Button>
            <Button variant="ghost" icon={Trash2} onClick={cancelListening}>
              Cancel
            </Button>
          </div>
        )}
        {mode === "recording" && (
          <div className="recording-state">
            <div className="recording-orb">
              <span style={{ transform: `scale(${1 + level * 0.6})` }} />
              <AudioLines size={31} />
            </div>
            <p className="eyebrow">Recording a private voice note</p>
            <div className="recording-time">
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            </div>
            <div className="level-bars" aria-label="Live microphone level">
              {Array.from({ length: 12 }, (_, index) => (
                <span
                  className={index / 12 < level ? "is-active" : ""}
                  key={index}
                />
              ))}
            </div>
            <Button icon={Square} onClick={() => recorder.current?.stop()}>
              Stop recording
            </Button>
            <Button variant="ghost" icon={Trash2} onClick={discardRecording}>
              Discard
            </Button>
          </div>
        )}
        {mode === "review" && (
          <div className="audio-review">
            <p className="eyebrow">Recording complete · {elapsed} seconds</p>
            <h3>Keep this thought as a voice note.</h3>
            <audio src={audioUrl} controls />
            <div className="voice-note-save">
              <label>
                <span>Give it a short title</span>
                <input
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  placeholder="A thought after the walk"
                  autoFocus
                />
              </label>
              <Button icon={AudioLines} onClick={saveRecordedNote}>
                Save voice note
              </Button>
              <p>
                The recording is stored privately in this browser and is not
                sent to AI.
              </p>
            </div>
          </div>
        )}
        {mode === "processing" && (
          <div className="processing">
            <span className="processing__ring" />
            <p className="eyebrow">Studio assistant</p>
            <h3>{processingLabel}</h3>
          </div>
        )}
        {mode === "compose" && (
          <div className="proposal">
            <button
              type="button"
              className="back-link"
              onClick={() => {
                setText("")
                setProposal(null)
                setAiError("")
                setMode("choose")
              }}
            >
              <ArrowLeft size={17} /> Assistant home
            </button>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                runAssistant(text)
              }}
            >
              {askedLabel && (
                <p className="asked-label">You asked: {askedLabel}</p>
              )}
              {dictateHint && !text && (
                <div className="dictate-hint" role="status">
                  <Mic size={20} />
                  <p>
                    <strong>Tap the 🎤 on your keyboard and speak.</strong>
                    <small>
                      iPhone home-screen apps can’t listen directly, but keyboard
                      dictation works. Then tap Ask Studio.
                    </small>
                  </p>
                </div>
              )}
              <label>
                <span>
                  {heard
                    ? "What Studio heard · edit if needed"
                    : "What would you like Studio to help with?"}
                </span>
                <textarea
                  ref={composerRef}
                  autoFocus={!text}
                  rows={4}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={
                    hint ||
                    (askedLabel
                      ? "Ask something else, or tweak the request…"
                      : "Help me plan today, move Friday’s admin, add a goal, or save an idea…")
                  }
                />
              </label>
              <Button
                type="submit"
                variant={proposal && !text.trim() ? "secondary" : "primary"}
                disabled={!text.trim()}
                icon={WandSparkles}
              >
                Ask Studio
              </Button>
            </form>
            {aiError && (
              <div className="prototype-note" role="alert">
                <Sparkles size={19} />
                <p>
                  {aiError}{" "}
                  {(text.trim() || lastRequest.current) && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={useOffline}
                    >
                      Use a simple offline suggestion
                    </button>
                  )}
                </p>
              </div>
            )}
            {proposal && (
              <div className="proposal-preview" role="status">
                <p className="eyebrow">
                  Studio proposes · review before saving
                </p>
                {proposal.reply && <p>{proposal.reply}</p>}
                {proposal.actions.map((action, index) => (
                  <label className="proposal-action" key={index}>
                    <input
                      type="checkbox"
                      checked={selected[index] ?? false}
                      disabled={!isValidAction(action)}
                      onChange={(event) =>
                        setSelected((current) =>
                          current.map((value, position) =>
                            position === index ? event.target.checked : value,
                          ),
                        )
                      }
                    />
                    <WandSparkles size={20} />
                    <span>
                      <strong>{action.summary}</strong>
                      <small>
                        {[
                          action.title,
                          isDate(action.date) && formatDate(action.date),
                          action.time,
                          action.amount != null && `£${action.amount}`,
                          !isValidAction(action) && "Already done or not found",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                      {action.goalId &&
                        state.goals.some((goal) => goal.id === action.goalId) && (
                          <small className="proposal-action__goal">
                            Supports{" "}
                            {state.goals.find((goal) => goal.id === action.goalId)?.title}
                          </small>
                        )}
                      {actionWarnings(action).map((warning) => (
                        <small className="proposal-action__warn" key={warning}>
                          ⚠ {warning}
                        </small>
                      ))}
                      {action.why && <small className="proposal-action__why">{action.why}</small>}
                      {(action.details ?? []).map((line) => (
                        <small className="proposal-action__detail" key={line}>
                          {line}
                        </small>
                      ))}
                      {(action.workout ?? []).length > 0 && (
                        <PlannedWorkoutList workout={action.workout ?? []} />
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {proposal && proposal.actions.length > 0 && (
              <Button
                disabled={
                  !proposal.actions.some(
                    (action, index) => selected[index] && isValidAction(action),
                  )
                }
                icon={Check}
                onClick={confirmProposal}
              >
                Confirm{" "}
                {selected.filter(Boolean).length > 1 ? "these changes" : "this"}
              </Button>
            )}
            <p className="capture-disclaimer">
              AI suggestions can be wrong. You stay in control of every change.
            </p>
          </div>
        )}
        {mode === "error" && (
          <div className="capture-error">
            <span>
              <MicOff size={28} />
            </span>
            <h3>
              {errorKind === "storage"
                ? "This browser could not save the voice note."
                : errorKind === "speech"
                  ? "Voice recognition needs permission."
                  : "The microphone is not available."}
            </h3>
            <p>
              {errorKind === "storage"
                ? "Private browsing or full storage can block saving audio. Studio still works by typing."
                : errorKind === "speech"
                  ? "Allow the microphone and speech recognition for this site. On iPhone, also turn on Settings › General › Keyboard › Enable Dictation. Studio still works by typing."
                  : "Microphone permission may be off. On iPhone, check Settings › Safari › Microphone. Studio still works by typing."}
            </p>
            <Button onClick={() => openComposer()}>Type to Studio</Button>
            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={errorKind === "speech" ? startListening : startRecording}
            >
              {errorKind === "speech" ? "Try talking again" : "Try recording again"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function App() {
  const { state, update, removeWithUndo, undo, notice, setNotice, reset, sync } = useLifeStudioState()
  const [quickMenu, setQuickMenu] = useState(false)
  const [chatHint, setChatHint] = useState("")
  const manualSync = async () => {
    const result = await sync.syncNow()
    setNotice(
      result === "synced"
        ? "Synced. Everything is up to date."
        : result === "offline"
          ? "You’re offline. It will sync when you’re back online."
          : result === "off"
            ? "Sync isn’t set up yet. Find it in My space → Settings."
            : result === "locked"
              ? "Sync needs your passcode. Enter it in My space → Settings."
              : result === "syncing"
                ? "Already syncing…"
                : "Couldn’t sync right now. Try again in a moment.",
    )
  }
  const [route, setRoute] = useState<Route>(routeFromPath)
  const [space, setSpace] = useState<SpaceKey | null>(null)
  const [capture, setCapture] = useState(false)
  const [voiceNotes, setVoiceNotes] = useState(false)
  const [addDate, setAddDate] = useState<string | null>(null)
  const [activity, setActivity] = useState<{
    id: string
    mode: ActivityMode
  } | null>(null)
  const [roadmap, setRoadmap] = useState(false)
  const [planFocus, setPlanFocus] = useState<string | null>(null)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [celebration, setCelebration] = useState<CelebrationMessage | null>(null)
  useEffect(() => {
    const onCelebrate = (event: Event) =>
      setCelebration((event as CustomEvent<CelebrationMessage>).detail)
    window.addEventListener("studio:celebrate", onCelebrate)
    return () => window.removeEventListener("studio:celebrate", onCelebrate)
  }, [])
  const [restartSetup, setRestartSetup] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [setupAgain, setSetupAgain] = useState(false)
  const [chatFocus, setChatFocus] = useState<"move" | undefined>(undefined)
  // Anywhere can open Studio (e.g. Movement's "Plan with Studio"), optionally focused on movement.
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ focus?: "move"; hint?: string }>).detail
      setChatFocus(detail?.focus)
      if (detail?.hint) setChatHint(detail.hint)
      setSpace(null)
      setCapture(true)
    }
    const onSpace = (event: Event) => setSpace((event as CustomEvent<SpaceKey>).detail)
    window.addEventListener("studio:open", onOpen)
    window.addEventListener("space:open", onSpace)
    return () => {
      window.removeEventListener("studio:open", onOpen)
      window.removeEventListener("space:open", onSpace)
    }
  }, [])
  const openActivity = (id: string, mode: ActivityMode) =>
    setActivity({ id, mode })

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath())
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined)
    }
  }, [])

  const navigate = (next: Route) => {
    setRoute(next)
    window.history.pushState({}, "", routePath[next])
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const finishSetup = (
    priorities: Area[],
    density: AppState["density"],
    examples: boolean,
  ) => {
    update(
      () => ({
        ...(examples
          ? demoState
          : {
              ...demoState,
              plan: [],
              journal: [],
              projects: [],
              people: [],
              transactions: [],
              routines: [],
              goals: demoState.goals,
            }),
        onboarded: true,
        tourDone: false,
        priorities,
        density,
      }),
      "Your Life Studio is ready.",
    )
  }

  const finishConversation: Parameters<typeof SetupChat>[0]["onApply"] = (draft, choices, name) => {
    update((current) => applySetup(current, draft, choices, name), "Your space is ready.")
    setSetupAgain(false)
    navigate("today")
  }

  if (!state.onboarded) {
    return (
      <main className="setup-page">
        <header className="setup-page__head">
          <img src="/assets/life-studio-room.jpg" alt="" />
          <div>
            <p className="eyebrow">Life Studio</p>
            <h1>Let’s set up your space</h1>
          </div>
        </header>
        <SetupChat state={state} again={false} onApply={finishConversation} />
        <button type="button" className="text-link setup-page__skip" onClick={() => finishSetup(["move", "create", "reflect"], "few", false)}>
          Skip and start with an empty space
        </button>
      </main>
    )
  }

  return (
    <RemoveContext.Provider value={removeWithUndo}>
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="desktop-rail">
        <div className="wordmark">
          <LogoMark />
          <strong>Life Studio</strong>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              type="button"
              className={route === key ? "is-active" : ""}
              aria-current={route === key ? "page" : undefined}
              onClick={() => navigate(key)}
              key={key}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="rail-capture"
          onClick={() => setCapture(true)}
        >
          <WandSparkles size={20} />
          <span>Studio assistant</span>
        </button>
        <div className="rail-footer">
          <span>{state.name}’s Life Studio</span>
          <small>One life, shaped gently</small>
        </div>
      </aside>

      <main id="main-content" className="app-content">
        <header className="mobile-topbar">
          <button
            type="button"
            className="mobile-wordmark"
            onClick={() => navigate("today")}
          >
            <LogoMark />
            <strong>Life Studio</strong>
          </button>
          <IconButton
            label="Open quick menu"
            icon={Menu}
            onClick={() => setQuickMenu(true)}
          />
        </header>

        {route === "today" && (
          <TodayView
            state={state}
            update={update}
            onAdd={() => setAddDate(today())}
            onOpenSpace={(key) => setSpace(key)}
            onActivity={openActivity}
            onRoadmap={() => navigate("progress")}
            onSetupRestart={() => setRestartSetup(true)}
            onOpenItem={setOpenItemId}
          />
        )}
        {route === "plan" && (
          <PlanView
            state={state}
            update={update}
            onAdd={(date) => setAddDate(date ?? today())}
            onActivity={openActivity}
            focusDate={planFocus}
            onOpenItem={setOpenItemId}
          />
        )}
        {route === "progress" && <ProgressView state={state} update={update} onJourney={() => setRoadmap(true)} />}
        {route === "space" && (
          <MySpaceView state={state} openSpace={(key) => setSpace(key)} />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            type="button"
            className={route === key ? "is-active" : ""}
            aria-current={route === key ? "page" : undefined}
            onClick={() => navigate(key)}
            key={key}
          >
            <Icon size={21} strokeWidth={route === key ? 2.3 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          className="bottom-nav__capture"
          aria-label="Open Studio chat"
          onClick={() => setCapture(true)}
        >
          <span className="assistant-glyph" aria-hidden="true">
            <MessageCircle size={24} strokeWidth={1.8} />
            <Sparkles size={12} strokeWidth={2} />
          </span>
        </button>
      </nav>

      {undo ? (
        <div className="toast" role="status">
          <Trash2 size={17} />
          {undo.message}
          <button type="button" className="toast__undo" onClick={undo.run}>
            Undo
          </button>
        </div>
      ) : (
        notice && (
          <div className="toast" role="status">
            <Check size={17} />
            {notice}
          </div>
        )
      )}

      {addDate && (
        <AddPlanModal
          state={state}
          date={addDate}
          goals={state.goals}
          plan={state.plan}
          onClose={() => setAddDate(null)}
          onSave={(item, repeat) => {
            if (repeat) {
              const { id: _id, date, status: _status, ...template } = item
              update(
                (current) =>
                  createSeries(current, template, repeat.frequency, date, repeat.until).state,
                `Added, repeating ${REPEAT_LABELS[repeat.frequency].toLowerCase()}.`,
              )
            } else
              update(
                (current) => ({ ...current, plan: [...current.plan, item] }),
                "Added to your plan.",
              )
            setAddDate(null)
          }}
        />
      )}
      {quickMenu && (
        <QuickMenu
          state={state}
          sync={{ ...sync, syncNow: manualSync }}
          onClose={() => setQuickMenu(false)}
          onStudio={() => {
            setChatHint("")
            setCapture(true)
          }}
          onLog={() => {
            setChatHint("Tell Studio what you did, e.g. walked 25 minutes, felt easy")
            setCapture(true)
          }}
          onAdd={() => setAddDate(today())}
          onSpace={(key) => setSpace(key)}
          onVoiceNotes={() => setVoiceNotes(true)}
          onJourney={() => navigate("progress")}
          onStartNext={(id) => openActivity(id, "start")}
        />
      )}
      {openItemId && (
        <PlanItemSheet
          itemId={openItemId}
          state={state}
          update={update}
          onClose={() => setOpenItemId(null)}
          onActivity={openActivity}
          onOpenSpace={(key) => setSpace(key)}
        />
      )}
      {celebration && (
        <Celebration message={celebration} onDone={() => setCelebration(null)} />
      )}
      {activity && (
        <ActivityFlow
          key={`${activity.id}-${activity.mode}`}
          itemId={activity.id}
          mode={activity.mode}
          state={state}
          update={update}
          onClose={() => setActivity(null)}
          onOpenSpace={(key) => setSpace(key)}
        />
      )}
      {roadmap && (
        <Roadmap
          state={state}
          update={update}
          onClose={() => setRoadmap(false)}
          onSetupRestart={() => {
            setRoadmap(false)
            setRestartSetup(true)
          }}
          onEditProfile={() => {
            setRoadmap(false)
            setEditProfile(true)
          }}
        />
      )}
      {restartSetup && (
        <RestartSetup
          state={state}
          update={update}
          onClose={() => setRestartSetup(false)}
        />
      )}
      {editProfile && (
        <Modal
          title="Your training answers"
          eyebrow="They shape your gym session"
          onClose={() => setEditProfile(false)}
        >
          <GymIntake
            initial={state.trainingProfile}
            onSave={(profile) => {
              update(
                (current) => ({ ...current, trainingProfile: profile }),
                "Training answers saved.",
              )
              setEditProfile(false)
            }}
          />
        </Modal>
      )}
      {capture && (
        <StudioChat
          state={state}
          initialHint={chatHint}
          focus={chatFocus}
          onClose={() => {
            setCapture(false)
            setChatHint("")
            setChatFocus(undefined)
          }}
          update={update}
          onVoiceNotes={() => {
            setCapture(false)
            setVoiceNotes(true)
          }}
          onGo={(to) => {
            if (to.kind === "space") setSpace(to.space)
            else if (to.kind === "progress") navigate("progress")
            else {
              setPlanFocus(to.date)
              navigate("plan")
            }
          }}
        />
      )}
      {voiceNotes && (
        <VoiceCapture
          notesOnly
          state={state}
          onClose={() => setVoiceNotes(false)}
          update={update}
          onGo={(to) => {
            if (to.kind === "space") setSpace(to.space)
            else if (to.kind === "progress") navigate("progress")
            else {
              setPlanFocus(to.date)
              navigate("plan")
            }
          }}
        />
      )}
      {space === "reflect" && (
        <JournalSpace
          state={state}
          update={update}
          close={() => setSpace(null)}
        />
      )}
      {space === "breathe" && (
        <BreatheSpace
          state={state}
          update={update}
          close={() => setSpace(null)}
        />
      )}
      {space === "create" && (
        <ProjectsSpace
          state={state}
          update={update}
          close={() => setSpace(null)}
        />
      )}
      {space === "connect" && (
        <PeopleSpace
          state={state}
          update={update}
          close={() => setSpace(null)}
          onGoPlan={(date) => {
            setPlanFocus(date)
            navigate("plan")
          }}
        />
      )}
      {space === "about" && (
        <AboutMeSpace
          state={state}
          update={update}
          close={() => setSpace(null)}
          onSetupAgain={() => {
            setSpace(null)
            setSetupAgain(true)
          }}
          onTour={() => {
            setSpace(null)
            update((current) => ({ ...current, tourDone: false }))
          }}
        />
      )}
      {setupAgain && (
        <Modal title="Set up from the top" eyebrow="A conversation with Studio" onClose={() => setSetupAgain(false)} wide>
          <SetupChat state={state} again onApply={finishConversation} />
        </Modal>
      )}
      {state.tourDone === false && !setupAgain && (
        <Tour onDone={() => update((current) => ({ ...current, tourDone: true }))} />
      )}
      {space === "move" && (
        <MovementSpace
          state={state}
          update={update}
          close={() => setSpace(null)}
        />
      )}
      {space === "money" && (
        <MoneySpace
          state={state}
          update={update}
          close={() => setSpace(null)}
        />
      )}
      {space === "home" && (
        <HomeSpace state={state} update={update} close={() => setSpace(null)} />
      )}
      {space === "preferences" && (
        <PreferencesSpace
          state={state}
          update={update}
          close={() => setSpace(null)}
          reset={reset}
          sync={{
            ...sync,
            syncNow: async () => {
              await manualSync()
              return sync.status
            },
          }}
        />
      )}
    </div>
    </RemoveContext.Provider>
  )
}
