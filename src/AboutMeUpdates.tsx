import { Check, RefreshCw, Sparkles, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { suggestAboutMe } from "./ai"
import { ABOUT_LABELS } from "./SetupChat"
import { mondayOf } from "./training"
import type { AboutMe, AboutMeSuggestion, AppState } from "./types"
import { Button, today } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void
type Field = keyof Omit<AboutMe, "updatedAt">

const FIELDS = new Set(ABOUT_LABELS.map(([key]) => key))
const labelOf = (field: Field) => ABOUT_LABELS.find(([key]) => key === field)?.[1] ?? field

const recentActivity = (state: AppState) => {
  const from = new Date(Date.now() - 7 * 86400000).toISOString()
  return (
    state.plan.some((item) => item.kind && item.status !== "planned" && item.status !== "proposed" && item.date >= from.slice(0, 10)) ||
    (state.chat ?? []).some((message) => message.role === "user" && message.at >= from) ||
    (state.sleep ?? []).some((entry) => entry.lightsOut >= from)
  )
}

// Due once a week, when there's something new to learn from.
export const aboutMeUpdateDue = (state: AppState) =>
  !!state.aboutMe && state.aboutMeSuggestions?.weekStart !== mondayOf(today()) && recentActivity(state)

export async function fetchAboutMeSuggestions(state: AppState, update: Update) {
  const result = await suggestAboutMe(state)
  const items: AboutMeSuggestion[] = (result?.changes ?? [])
    .filter((change) => FIELDS.has(change.field as Field) && change.suggested?.trim())
    .filter((change) => change.suggested.trim() !== (state.aboutMe?.[change.field as Field] ?? "").trim())
    .map((change) => ({ field: change.field as Field, suggested: change.suggested.trim(), reason: change.reason }))
  update((current) => ({ ...current, aboutMeSuggestions: { weekStart: mondayOf(today()), at: new Date().toISOString(), items } }))
  return items.length
}

// Ask once a week in the background (e.g. when Journey opens). Never more than once per visit.
export function useWeeklyAboutMe(state: AppState, update: Update) {
  const tried = useRef(false)
  useEffect(() => {
    if (tried.current || !aboutMeUpdateDue(state)) return
    tried.current = true
    fetchAboutMeSuggestions(state, update).catch(() => {
      // Offline or no passcode: try again next time.
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// Studio's suggested updates: accept, or dismiss each one. You can also ask for a fresh look.
export function AboutMeSuggestions({ state, update, onAccepted }: { state: AppState; update: Update; onAccepted?: (field: Field, value: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState("")
  const items = state.aboutMeSuggestions?.items ?? []
  const drop = (index: number) =>
    update((current) => ({
      ...current,
      aboutMeSuggestions: current.aboutMeSuggestions && { ...current.aboutMeSuggestions, items: current.aboutMeSuggestions.items.filter((_, position) => position !== index) },
    }))

  return (
    <section className="about-updates">
      <div className="about-updates__head">
        <h3>
          <Sparkles size={16} /> Keeping up with you
        </h3>
        <button
          type="button"
          className="text-link"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            setNote("")
            try {
              const count = await fetchAboutMeSuggestions(state, update)
              if (!count) setNote("Nothing new to change right now.")
            } catch (failure) {
              setNote((failure as Error).message)
            }
            setLoading(false)
          }}
        >
          <RefreshCw size={13} className={loading ? "is-spinning" : ""} /> {loading ? "Looking at your progress…" : "Suggest updates from my progress"}
        </button>
      </div>
      {!items.length && !note && (
        <p className="capture-disclaimer">Each week Studio looks at what you’ve done, logged and told it, and suggests updates here.</p>
      )}
      {note && <p className="capture-disclaimer">{note}</p>}
      {items.map((item, index) => (
        <article className="about-updates__item" key={`${item.field}-${index}`}>
          <p className="eyebrow">{labelOf(item.field)}</p>
          <p className="about-updates__new">{item.suggested}</p>
          {state.aboutMe?.[item.field] && <p className="about-updates__old">Was: {state.aboutMe[item.field]}</p>}
          <small>{item.reason}</small>
          <div className="inline-actions">
            <Button
              variant="secondary"
              icon={Check}
              onClick={() => {
                update(
                  (current) => ({
                    ...current,
                    aboutMe: { ...(current.aboutMe ?? ({} as AboutMe)), [item.field]: item.suggested, updatedAt: new Date().toISOString() },
                    aboutMeSuggestions: current.aboutMeSuggestions && { ...current.aboutMeSuggestions, items: current.aboutMeSuggestions.items.filter((_, position) => position !== index) },
                  }),
                  "About me updated.",
                )
                onAccepted?.(item.field, item.suggested)
              }}
            >
              Update
            </Button>
            <Button variant="ghost" icon={X} onClick={() => drop(index)}>
              Not quite
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

// A quiet nudge on Journey when there are suggestions waiting.
export function AboutMeNudge({ state }: { state: AppState }) {
  const count = state.aboutMeSuggestions?.items.length ?? 0
  if (!count) return null
  return (
    <button type="button" className="about-nudge" onClick={() => window.dispatchEvent(new CustomEvent("space:open", { detail: "about" }))}>
      <Sparkles size={16} />
      <span>
        Studio suggests {count} update{count === 1 ? "" : "s"} to About me, from your progress this week.
      </span>
      <strong>Review</strong>
    </button>
  )
}
