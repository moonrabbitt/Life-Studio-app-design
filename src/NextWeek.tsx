import { CalendarCheck, RotateCcw, Sparkles, TrendingUp } from "lucide-react"
import { useState } from "react"
import { planNextWeek, planProgression, type NextWeekDraft, type ProgressionDraft } from "./ai"
import { addPlanWeek, applyNextWeek, applyProgression, mondayOf, nextMonday, phasesOf, phaseTimeline } from "./training"
import type { AppState } from "./types"
import { Button, formatDate, today } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

// Should Today offer to plan next week? Friday to Sunday, when next week has nothing from the plan yet.
export function nextWeekDue(state: AppState) {
  if (!state.trainingPlan) return false
  const day = new Date(`${today()}T12:00:00`).getDay()
  const monday = nextMonday(today())
  return (day === 5 || day === 6 || day === 0) && !state.plan.some((item) => item.batch === `plan-${monday}`)
}

// Studio plans next week from what you actually did, building gradually towards your goal.
export function NextWeekPlanner({ state, update, compact = false }: { state: AppState; update: Update; compact?: boolean }) {
  const monday = nextMonday(today())
  const plan = state.trainingPlan
  const [draft, setDraft] = useState<NextWeekDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const review = plan?.lastReview?.weekStart === monday ? plan.lastReview : undefined
  const planned = state.plan.some((item) => item.batch === `plan-${monday}`)
  const { current } = phaseTimeline(state)
  const nextPhase = phasesOf(state).find((phase) => phase.id === current.id + 1)
  if (!plan) return null

  const ask = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await planNextWeek(state, monday)
      if (!result?.week?.length) throw new Error("Studio couldn’t plan next week this time. Try again.")
      setDraft(result)
    } catch (failure) {
      setError((failure as Error).message)
    }
    setLoading(false)
  }

  const moveOn = (
    <Button
      variant="secondary"
      icon={TrendingUp}
      onClick={() =>
        update(
          (currentState) => ({
            ...currentState,
            trainingPhase: current.id + 1,
            roadmap: {
              ...currentState.roadmap,
              phaseDates: { ...(currentState.roadmap?.phaseDates ?? {}), [String(current.id + 1)]: monday },
              phaseLog: [...(currentState.roadmap?.phaseLog ?? []), { phase: current.id + 1, date: today(), title: `Moved on to ${nextPhase?.title}` }],
            },
          }),
          `${nextPhase?.title} starts next week.`,
        )
      }
    >
      Move on to {nextPhase?.title}
    </Button>
  )

  if (draft)
    return (
      <section className="next-week">
        <p className="eyebrow">Next week · from {formatDate(monday, { day: "numeric", month: "short" })}</p>
        <p>{draft.review}</p>
        {draft.phaseReady && nextPhase ? (
          <div className="next-week__ready">
            <p>
              <strong>You look ready for {nextPhase.title}.</strong> {draft.phaseNote}
            </p>
            {moveOn}
          </div>
        ) : (
          draft.phaseNote && <p className="next-week__note">{draft.phaseNote}</p>
        )}
        <ul className="next-week__list">
          {[...draft.week]
            .sort((a, b) => a.dayOffset - b.dayOffset)
            .map((session, index) => (
              <li key={index} className={session.kind === "recovery" ? "is-rest" : ""}>
                <b>{DAYS[Math.max(0, Math.min(6, session.dayOffset))]}</b>
                <span>
                  {session.title}
                  {session.kind !== "recovery" && session.details[0] && <small>{session.details[0]}</small>}
                </span>
                <small>
                  {session.workout?.length ? `${session.workout.length} ex · ` : ""}
                  {session.duration} min
                </small>
              </li>
            ))}
        </ul>
        <div className="inline-actions">
          <Button
            icon={CalendarCheck}
            onClick={() => {
              update((currentState) => applyNextWeek(currentState, monday, draft, true), "Next week is in your plan as suggestions. Anything from the old version is gone.")
              setDraft(null)
            }}
          >
            Add to my plan
          </Button>
          <Button variant="ghost" icon={RotateCcw} onClick={ask} disabled={loading}>
            {loading ? "Planning…" : "Try again"}
          </Button>
        </div>
      </section>
    )

  return (
    <section className={`next-week ${compact ? "is-compact" : ""}`}>
      <p className="eyebrow">Next week</p>
      {review ? (
        <>
          <p>{review.text}</p>
          {review.phaseReady && nextPhase && current.id < phasesOf(state).length && moveOn}
        </>
      ) : (
        <p>
          {planned
            ? "Next week is planned. Studio can re-plan it from how this week went."
            : "Studio looks at how this week actually went and builds on it: small steps up when it felt good, the same again when it was hard."}
        </p>
      )}
      <div className="inline-actions">
        <Button variant={planned ? "secondary" : "primary"} icon={Sparkles} onClick={ask} disabled={loading}>
          {loading ? "Studio is looking at your week…" : planned ? "Re-plan with Studio" : "Plan next week with Studio"}
        </Button>
        {!planned && !compact && (
          <button
            type="button"
            className="text-link"
            onClick={() => update((currentState) => addPlanWeek(currentState, monday), "Next week’s sessions are in your plan as suggestions.")}
          >
            Just repeat this week
          </button>
        )}
      </div>
      {error && <p className="capture-disclaimer">{error}</p>}
    </section>
  )
}

// Plan several weeks of gradual build-up towards a goal (e.g. walking → running), from where you are.
export function ProgressionPlanner({ state, update }: { state: AppState; update: Update }) {
  const [request, setRequest] = useState(state.trainingPlan?.progressionGoal ?? state.trainingPlan?.purpose ?? "")
  const [weeks, setWeeks] = useState(6)
  const [draft, setDraft] = useState<ProgressionDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const day = new Date(`${today()}T12:00:00`).getDay()
  const start = day >= 1 && day <= 3 ? mondayOf(today()) : nextMonday(today())
  const path = state.trainingPlan?.progression ?? []

  const ask = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await planProgression(state, request.trim() || "Build up gradually towards my goal", weeks, start)
      if (!result?.sessions?.length) throw new Error("Studio couldn’t plan those weeks this time. Try again.")
      setDraft(result)
    } catch (failure) {
      setError((failure as Error).message)
    }
    setLoading(false)
  }

  return (
    <section className="next-week progression">
      <p className="eyebrow">The build-up</p>
      {!draft && (state.trainingPlan?.roadmap ?? []).length > 0 && (
        <>
          {state.trainingPlan?.onTrack && <p className="progression-preview__ontrack">{state.trainingPlan.onTrack}</p>}
          <ol className="progression-preview__route">
            {state.trainingPlan!.roadmap!.map((stage) => (
              <li key={stage.start} className={stage.start <= today() && today() <= stage.end ? "is-now" : ""}>
                <b>
                  {formatDate(stage.start, { day: "numeric", month: "short" })} – {formatDate(stage.end, { day: "numeric", month: "short" })}
                </b>
                <span>
                  {stage.stage}
                  <small>Target: {stage.target}</small>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {path.length > 0 && !draft && (
        <ol className="progression__path">
          {path.map((entry) => (
            <li key={entry.weekStart} className={entry.weekStart === mondayOf(today()) ? "is-now" : entry.weekStart < mondayOf(today()) ? "is-done" : ""}>
              <b>{formatDate(entry.weekStart, { day: "numeric", month: "short" })}</b>
              <span>
                {entry.focus}
                <small>{entry.keySession}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
      {draft ? (
        <ProgressionPreview draft={draft} start={start}>
          <div className="inline-actions">
            <Button
              icon={CalendarCheck}
              onClick={() => {
                update((current) => applyProgression(current, start, request.trim(), draft), `${draft.path.length || weeks} weeks are in your plan. The old upcoming sessions are gone.`)
                setDraft(null)
              }}
            >
              Add these weeks to my calendar
            </Button>
            <Button variant="ghost" icon={RotateCcw} onClick={ask} disabled={loading}>
              {loading ? "Planning…" : "Try again"}
            </Button>
          </div>
        </ProgressionPreview>
      ) : (
        <form
          className="progression__form"
          onSubmit={(event) => {
            event.preventDefault()
            ask()
          }}
        >
          <label>
            <span>Building towards</span>
            <input value={request} onChange={(event) => setRequest(event.target.value)} placeholder="e.g. from walking to running 20 minutes" />
          </label>
          <label>
            <span>Over</span>
            <select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))}>
              {[4, 5, 6, 7, 8].map((count) => (
                <option value={count} key={count}>
                  {count} weeks
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant={path.length ? "secondary" : "primary"} icon={Sparkles} disabled={loading}>
            {loading ? "Studio is planning the weeks… (up to a minute)" : path.length ? "Re-plan the build-up" : "Plan the build-up with Studio"}
          </Button>
        </form>
      )}
      {error && <p className="capture-disclaimer">{error}</p>}
    </section>
  )
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

// Look before you add: the route to your goal dates, then every week's sessions in detail.
export function ProgressionPreview({ draft, start, children }: { draft: ProgressionDraft; start: string; children?: React.ReactNode }) {
  const weeks = Array.from(new Set([...draft.path.map((entry) => entry.week), ...draft.sessions.map((session) => session.week)])).sort((a, b) => a - b)
  const mondayOfWeek = (week: number) => {
    const date = new Date(`${start}T12:00:00`)
    date.setDate(date.getDate() + (week - 1) * 7)
    return date.toISOString().slice(0, 10)
  }
  return (
    <div className="progression-preview">
      <p>{draft.summary}</p>
      {draft.onTrack && <p className="progression-preview__ontrack">{draft.onTrack}</p>}
      {draft.roadmap?.length > 0 && (
        <>
          <p className="eyebrow">The route to your goals</p>
          <ol className="progression-preview__route">
            {draft.roadmap.map((stage) => (
              <li key={stage.start}>
                <b>
                  {formatDate(stage.start, { day: "numeric", month: "short" })} – {formatDate(stage.end, { day: "numeric", month: "short" })}
                </b>
                <span>
                  {stage.stage}
                  <small>Target: {stage.target}</small>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="eyebrow">Week by week</p>
      {weeks.map((week) => {
        const entry = draft.path.find((item) => item.week === week)
        const sessions = draft.sessions.filter((session) => session.week === week).sort((a, b) => a.dayOffset - b.dayOffset)
        return (
          <details className="progression-preview__week" key={week} open={week === weeks[0]}>
            <summary>
              <b>
                Week {week} · {formatDate(mondayOfWeek(week), { day: "numeric", month: "short" })}
              </b>
              <span>{(entry?.focus ?? "").replace(/^week \d+:\s*/i, "")}</span>
            </summary>
            <ul>
              {sessions.map((session, index) => (
                <li key={index}>
                  <div className="progression-preview__session">
                    <b>{DAY_NAMES[Math.max(0, Math.min(6, session.dayOffset))]}</b>
                    <strong>{session.title}</strong>
                    <small>{session.duration} min</small>
                  </div>
                  {session.details.length > 0 && (
                    <ul className="progression-preview__details">
                      {session.details.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  {session.workout?.length > 0 && (
                    <ul className="progression-preview__details">
                      {session.workout.map((exercise) => (
                        <li key={exercise.name}>
                          {exercise.name}: {exercise.sets} × {exercise.reps}
                          {exercise.load ? ` · ${exercise.load}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              <li className="progression-preview__rest">Other days: rest, plus your regular commitments.</li>
            </ul>
          </details>
        )
      })}
      {children}
    </div>
  )
}
