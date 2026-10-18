import { ArrowLeft, Compass, RefreshCw, Sparkles, X } from "lucide-react"
import { useState } from "react"
import { draftTrainingPlan, type PlanDraft } from "./ai"
import { startNewPlan } from "./training"
import type { AppState, Goal, TrainingPlan } from "./types"
import { Button, formatDate, today, uid } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

// Changing direction is meant to be deliberate: say what's changed, let Studio draft a plan,
// look it over, then confirm. Logs, done sessions and your story always stay.
export function ChangeDirection({ state, update, onDone, onCancel, onEditProfile }: {
  state: AppState
  update: Update
  onDone: () => void
  onCancel: () => void
  onEditProfile: () => void
}) {
  const [purpose, setPurpose] = useState("")
  const [why, setWhy] = useState("")
  const [targetDate, setTargetDate] = useState("")
  const [days, setDays] = useState<string[]>(state.trainingProfile?.days ?? [])
  const [minutes, setMinutes] = useState(state.trainingProfile?.minutes ?? "")
  const [keep, setKeep] = useState("")
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [addGoal, setAddGoal] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const ready = purpose.trim().length > 3 && why.trim().length > 3

  const ask = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await draftTrainingPlan(state, { purpose: purpose.trim(), why: why.trim(), targetDate, days, minutes, keep: keep.trim() })
      if (!result?.phases?.length || !result.week?.length) throw new Error("Studio couldn’t draft a plan this time. Try again.")
      setDraft({ ...result, phases: result.phases.slice(0, 6) })
      setConfirming(false)
    } catch (failure) {
      setError((failure as Error).message)
    }
    setLoading(false)
  }

  const start = () => {
    if (!draft) return
    const id = uid()
    const goalId = addGoal ? `goal-plan-${id}` : undefined
    const plan: TrainingPlan = {
      id,
      purpose: purpose.trim(),
      why: why.trim() || undefined,
      targetDate: targetDate || undefined,
      targetLabel: targetDate ? formatDate(targetDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : undefined,
      summary: draft.summary,
      createdAt: new Date().toISOString(),
      phases: draft.phases.map((phase, index) => ({ ...phase, id: index + 1, weeks: Math.max(1, Math.min(52, phase.weeks || 1)) })),
      week: draft.week.map((session) => ({
        ...session,
        time: session.time && /^\d{2}:\d{2}$/.test(session.time) ? session.time : undefined,
        duration: Math.max(5, Math.min(240, session.duration || 30)),
      })),
      goalId,
    }
    const goal: Goal | undefined = goalId
      ? {
          id: goalId,
          title: draft.goalTitle || purpose.trim(),
          area: "move",
          scale: "big",
          status: "tending",
          date: plan.targetDate,
          nextStep: plan.week[0]?.title ?? "Start phase 1",
          milestones: plan.phases.map((phase) => ({ id: `${goalId}-p${phase.id}`, title: `Finish ${phase.title.toLowerCase()}` })),
        }
      : undefined
    update((current) => {
      const next = startNewPlan(current, plan, why.trim())
      return goal ? { ...next, goals: [goal, ...next.goals] } : next
    }, "New direction set. This week’s sessions are in your plan as suggestions.")
    onDone()
  }

  if (draft) {
    const editPhase = (index: number, patch: Partial<PlanDraft["phases"][number]>) =>
      setDraft({ ...draft, phases: draft.phases.map((phase, position) => (position === index ? { ...phase, ...patch } : phase)) })
    const totalWeeks = draft.phases.reduce((sum, phase) => sum + (phase.weeks || 0), 0)
    return (
      <section className="plan-change">
        <button type="button" className="text-link" onClick={() => setDraft(null)}>
          <ArrowLeft size={14} /> Back to your answers
        </button>
        <h3>Studio’s draft</h3>
        <p>{draft.summary}</p>
        {draft.cautions && <p className="events__reassure">{draft.cautions}</p>}
        <p className="eyebrow">Phases · about {totalWeeks} weeks</p>
        <ol className="plan-change__phases">
          {draft.phases.map((phase, index) => (
            <li key={index}>
              <span>{index + 1}</span>
              <div>
                <input value={phase.title} onChange={(event) => editPhase(index, { title: event.target.value })} aria-label={`Phase ${index + 1} name`} />
                <p>{phase.body}</p>
                <label className="plan-change__weeks">
                  <input
                    type="number"
                    min={1}
                    max={52}
                    inputMode="numeric"
                    value={phase.weeks}
                    onChange={(event) => editPhase(index, { weeks: Math.max(1, Math.min(52, Number(event.target.value) || 1)) })}
                    aria-label={`Phase ${index + 1} weeks`}
                  />
                  weeks
                </label>
              </div>
              {draft.phases.length > 2 && (
                <button
                  type="button"
                  className="plan-change__remove"
                  aria-label={`Remove phase ${phase.title}`}
                  onClick={() => setDraft({ ...draft, phases: draft.phases.filter((_, position) => position !== index) })}
                >
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
        </ol>
        <p className="eyebrow">A typical week to start</p>
        <ul className="plan-change__week">
          {[...draft.week]
            .sort((a, b) => a.dayOffset - b.dayOffset)
            .map((session, index) => (
              <li key={index}>
                <b>{DAYS[Math.max(0, Math.min(6, session.dayOffset))]}</b>
                <span>
                  {session.title}
                  {session.optional ? " (optional)" : ""}
                </span>
                <small>{session.duration} min</small>
              </li>
            ))}
        </ul>
        <label className="check-row">
          <input type="checkbox" checked={addGoal} onChange={(event) => setAddGoal(event.target.checked)} />
          <span>Add “{draft.goalTitle || purpose}” as a goal on my Journey, with a milestone for each phase</span>
        </label>
        {confirming ? (
          <div className="plan-change__confirm">
            <p>
              <strong>Start this plan from today?</strong> Future training suggestions from your current plan are
              replaced. Everything you’ve done, logged and written stays, and you can go back to the old plan later.
            </p>
            <div className="plan-change__actions">
              <Button icon={Compass} onClick={start}>
                Yes, start it
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Not yet
              </Button>
            </div>
          </div>
        ) : (
          <div className="plan-change__actions">
            <Button onClick={() => setConfirming(true)}>Start this plan</Button>
            <Button variant="secondary" icon={RefreshCw} onClick={ask} disabled={loading}>
              {loading ? "Drafting…" : "Draft again"}
            </Button>
          </div>
        )}
        {error && <p className="capture-disclaimer">{error}</p>}
      </section>
    )
  }

  return (
    <form
      className="plan-change"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready && !loading) ask()
      }}
    >
      <button type="button" className="text-link" onClick={onCancel}>
        <ArrowLeft size={14} /> Keep my current plan
      </button>
      <h3>Change direction</h3>
      <p className="capture-disclaimer">
        For when your purpose has really changed, not for a hard week (for that, shorten a phase or
        repeat one). Studio drafts a new plan; nothing changes until you’ve looked it over.
      </p>
      <label>
        <span>What are you training for now?</span>
        <textarea rows={2} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. Feel strong for a dance intensive in March" />
      </label>
      <label>
        <span>What’s changed?</span>
        <textarea rows={2} value={why} onChange={(event) => setWhy(event.target.value)} placeholder="e.g. I’ve decided not to run Hackney this year" />
      </label>
      <label>
        <span>Target date (optional)</span>
        <input type="date" min={today()} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
      </label>
      <fieldset className="chip-group">
        <legend>Days that are realistic</legend>
        <div>
          {DAYS.map((day) => (
            <button
              type="button"
              key={day}
              className={days.includes(day) ? "is-selected" : ""}
              aria-pressed={days.includes(day)}
              onClick={() => setDays(days.includes(day) ? days.filter((item) => item !== day) : [...days, day])}
            >
              {day}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        <span>Usual time for a session</span>
        <select value={minutes} onChange={(event) => setMinutes(event.target.value)}>
          <option value="">Not sure</option>
          <option value="20">About 20 minutes</option>
          <option value="30">About 30 minutes</option>
          <option value="45">About 45 minutes</option>
          <option value="60">An hour or more</option>
        </select>
      </label>
      <label>
        <span>Anything to keep in your week? (optional)</span>
        <input value={keep} onChange={(event) => setKeep(event.target.value)} placeholder="e.g. Wednesday dance class" />
      </label>
      <p className="capture-disclaimer">
        Studio also uses your training answers and recent logs.{" "}
        <button type="button" className="text-link" onClick={onEditProfile}>
          Update training answers
        </button>
      </p>
      <Button type="submit" icon={Sparkles} disabled={!ready || loading}>
        {loading ? "Studio is drafting…" : "Ask Studio to draft a plan"}
      </Button>
      {error && <p className="capture-disclaimer">{error}</p>}
    </form>
  )
}

// Plans you've moved on from, with a way back.
export function PastPlans({ state, update }: { state: AppState; update: Update }) {
  const [confirm, setConfirm] = useState<number | null>(null)
  const past = state.pastPlans ?? []
  if (!past.length) return null
  return (
    <details className="plan-change__past">
      <summary>Earlier plans ({past.length})</summary>
      <ul>
        {past.map((item, index) => (
          <li key={`${item.endedAt}-${index}`}>
            <div>
              <strong>{item.plan?.purpose ?? "Restart, then Hackney Half and dance camp"}</strong>
              <small>
                Until {formatDate(item.endedAt, { day: "numeric", month: "short", year: "numeric" })}
                {item.reason ? ` · ${item.reason}` : ""}
              </small>
            </div>
            {confirm === index ? (
              <span className="plan-change__inline">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    update((current) => startNewPlan(current, item.plan, "Went back to an earlier plan", item), "You’re back on your earlier plan.")
                    setConfirm(null)
                  }}
                >
                  Yes, go back
                </button>
                <button type="button" className="text-link" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" className="text-link" onClick={() => setConfirm(index)}>
                Go back to this
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
