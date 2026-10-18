import { PenLine, RefreshCw, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { weeklyDigest } from "./ai"
import { mondayOf } from "./training"
import type { AppState } from "./types"
import { Art, Button, today } from "./ui"

// A different illustration each week, so the card feels fresh.
const WEEK_ART = [
  "/assets/life-studio-room.jpg",
  "/assets/movement-path.jpg",
  "/assets/writing-nook.jpg",
  "/assets/creative-room.jpg",
  "/assets/dance-pavilion.jpg",
  "/assets/friends-cafe.jpg",
  "/assets/money-growth.jpg",
  "/assets/making-music.jpg",
  "/assets/film-director.jpg",
  "/assets/dance-floor.jpg",
  "/assets/creative-tech.jpg",
]
const artForWeek = (weekStart: string) => {
  const weekNumber = Math.floor(new Date(`${weekStart}T12:00:00`).getTime() / (7 * 86400000))
  return WEEK_ART[weekNumber % WEEK_ART.length]
}

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

// "This week": your real numbers, Studio's warm summary of the week and the one ahead,
// and your own latest reflection.
export function WeekDigestCard({ state, update }: { state: AppState; update: Update }) {
  const weekStart = mondayOf(today())
  const digest = state.weeklyDigest?.weekStart === weekStart ? state.weeklyDigest : undefined
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
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
    <section className="week-card">
      <div className="week-card__art">
        <Art src={artForWeek(weekStart)} fallback="/assets/life-studio-room.jpg" />
        <div className="week-card__veil" />
        <div className="week-card__over">
          <p className="eyebrow eyebrow--light">This week</p>
          <h2>{digest?.headline ?? (loading ? "Looking back at your week…" : done.length ? "Your week so far" : "A fresh week")}</h2>
        </div>
      </div>
      <div className="week-card__body">
        <p className="week-card__facts">
          <span>{done.length ? `${done.length} done` : "Nothing logged yet"}</span>
          {sessions.length > 0 && <span>{sessions.length} movement</span>}
        </p>
        {digest ? (
          <div className={`week-card__digest ${expanded ? "is-open" : ""}`}>
            <p>{digest.thisWeek}</p>
            {expanded && digest.nextWeek && (
              <p>
                <strong>Coming up: </strong>
                {digest.nextWeek}
              </p>
            )}
            {expanded && digest.encouragement && <p className="this-week__cheer">{digest.encouragement}</p>}
            <button type="button" className="text-link" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Show less" : "Read more"}
            </button>
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
        {latest && <blockquote className="week-card__quote">“{latest.text}”</blockquote>}
        <div className="week-card__actions">
          <Button variant="secondary" icon={PenLine} onClick={() => window.dispatchEvent(new CustomEvent("journey:compose", { detail: "reflect" }))}>
            Reflect
          </Button>
          {digest && (
            <button type="button" className="text-link" onClick={generate} disabled={loading}>
              <RefreshCw size={13} className={loading ? "is-spinning" : ""} /> {loading ? "Updating…" : "Refresh"}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
