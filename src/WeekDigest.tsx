import { RefreshCw, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { weeklyDigest } from "./ai"
import { mondayOf } from "./training"
import type { AppState } from "./types"
import { Button, today } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

// "This week": your real numbers, Studio's warm summary of the week and the one ahead,
// and your own latest reflection.
export function WeekDigestCard({ state, update }: { state: AppState; update: Update }) {
  const weekStart = mondayOf(today())
  const digest = state.weeklyDigest?.weekStart === weekStart ? state.weeklyDigest : undefined
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const tried = useRef(false)
  const done = state.plan.filter((item) => item.status === "complete" && item.date >= weekStart && item.date <= today())
  const sessions = done.filter((item) => item.kind && ["gym", "walk", "run", "dance"].includes(item.kind))
  const latest = (state.roadmap?.reflections ?? []).find((item) => !item.title && item.date >= weekStart)

  const generate = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await weeklyDigest(state, weekStart)
      if (!result?.headline || !result.thisWeek) throw new Error("Studio couldn’t write a summary this time. Try again.")
      update((current) => ({
        ...current,
        weeklyDigest: { weekStart, generatedAt: new Date().toISOString(), ...result },
      }))
    } catch (failure) {
      setError((failure as Error).message)
    }
    setLoading(false)
  }

  // Write itself once a week, the first time you open Journey.
  useEffect(() => {
    if (digest || tried.current) return
    tried.current = true
    generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digest])

  return (
    <aside className="week-note this-week">
      <p className="eyebrow">This week</p>
      <p className="this-week__facts">
        {done.length ? `${done.length} thing${done.length === 1 ? "" : "s"} done` : "A quiet week so far"}
        {sessions.length ? ` · ${sessions.length} movement session${sessions.length === 1 ? "" : "s"}` : ""}
      </p>
      {digest ? (
        <div className="this-week__digest">
          <h3>{digest.headline}</h3>
          <p>{digest.thisWeek}</p>
          {digest.nextWeek && (
            <p>
              <strong>Coming up: </strong>
              {digest.nextWeek}
            </p>
          )}
          {digest.encouragement && <p className="this-week__cheer">{digest.encouragement}</p>}
        </div>
      ) : loading ? (
        <p className="this-week__loading">
          <Sparkles size={14} /> Studio is looking back at your week…
        </p>
      ) : (
        <Button variant="secondary" icon={Sparkles} onClick={generate}>
          Summarise my week
        </Button>
      )}
      {error && <p className="capture-disclaimer">{error}</p>}
      {latest && <blockquote>“{latest.text}”</blockquote>}
      <div className="this-week__actions">
        {digest && (
          <button type="button" className="text-link" onClick={generate} disabled={loading}>
            <RefreshCw size={13} className={loading ? "is-spinning" : ""} /> {loading ? "Updating…" : "Refresh summary"}
          </button>
        )}
        <button
          type="button"
          className="text-link"
          onClick={() => document.querySelector(".roadmap__reflect textarea")?.scrollIntoView({ behavior: "smooth", block: "center" })}
        >
          {latest ? "Add another reflection" : "Write this week’s reflection"}
        </button>
      </div>
    </aside>
  )
}
