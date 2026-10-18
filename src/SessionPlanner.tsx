import { RotateCcw, Sparkles } from "lucide-react"
import { useState } from "react"
import { planSession, type SessionPlan } from "./ai"
import { PlannedWorkoutList } from "./TrainingViews"
import type { ActivityKind, AppState, PlannedExercise } from "./types"
import { Button } from "./ui"

export type PlannedSession = {
  title?: string
  duration?: number
  details: string[]
  workout?: PlannedExercise[]
}

// "Studio: plan this session" for a gym, run, walk or dance slot, or one of your saved workouts.
export function SessionPlanner({
  state,
  kind,
  date,
  time,
  duration,
  title,
  onUse,
}: {
  state: AppState
  kind: ActivityKind
  date: string
  time?: string
  duration?: number
  title?: string
  onUse: (session: PlannedSession) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [plan, setPlan] = useState<SessionPlan | null>(null)
  const templates = kind === "gym" ? (state.workoutTemplates ?? []) : []

  const ask = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await planSession(state, { kind, date, time, duration, title })
      if (!result?.title || (kind === "gym" && !result.exercises?.length)) throw new Error("Studio couldn’t plan this session. Try again.")
      setPlan(result)
    } catch (failure) {
      setError((failure as Error).message)
    }
    setLoading(false)
  }

  if (plan)
    return (
      <div className="session-planner is-result">
        <p className="eyebrow">Studio’s suggestion · {plan.duration} min</p>
        <strong>{plan.title}</strong>
        <p>{plan.summary}</p>
        {plan.why && <p className="session-planner__why">{plan.why}</p>}
        {plan.details?.length > 0 && (
          <ul>
            {plan.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {plan.exercises?.length > 0 && <PlannedWorkoutList workout={plan.exercises} />}
        <div className="inline-actions">
          <Button
            onClick={() => {
              onUse({
                title: plan.title,
                duration: plan.duration || undefined,
                details: [plan.why, plan.summary, ...(plan.details ?? [])].filter((line): line is string => !!line),
                workout: plan.exercises?.length ? plan.exercises : undefined,
              })
              setPlan(null)
            }}
          >
            Use this
          </Button>
          <Button variant="ghost" icon={RotateCcw} onClick={ask} disabled={loading}>
            {loading ? "Planning…" : "Try another"}
          </Button>
        </div>
      </div>
    )

  return (
    <div className="session-planner">
      <Button variant="secondary" icon={Sparkles} onClick={ask} disabled={loading}>
        {loading ? "Studio is planning…" : "Studio: plan this session"}
      </Button>
      <small>Based on your week so far, your phase, goals and About me.</small>
      {templates.length > 0 && (
        <label>
          <span>Or use one of my workouts</span>
          <select
            value=""
            onChange={(event) => {
              const template = templates.find((item) => item.id === event.target.value)
              if (template) onUse({ title: template.name, details: [], workout: template.exercises })
            }}
          >
            <option value="">Choose a workout…</option>
            {templates.map((template) => (
              <option value={template.id} key={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="capture-disclaimer">{error}</p>}
    </div>
  )
}
