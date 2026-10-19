import { Check, Search, X } from "lucide-react"
import { useState } from "react"
import { cleanMentions, findMentions, type Mentions } from "./corrections"
import { ABOUT_LABELS } from "./SetupChat"
import type { AppState } from "./types"
import { Button, formatDate } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

// "Studio has something wrong": find every old mention and clean it up in one go.
export function CorrectionBox({ state, update }: { state: AppState; update: Update }) {
  const [word, setWord] = useState("")
  const [truth, setTruth] = useState("")
  const [found, setFound] = useState<Mentions | null>(null)
  const [clearChat, setClearChat] = useState(true)
  const [resolvePain, setResolvePain] = useState(true)
  const corrections = state.corrections ?? []
  const label = (key: string) => ABOUT_LABELS.find(([field]) => field === key)?.[1] ?? key
  const rows = found
    ? ([
        [found.sessions, `upcoming session${found.sessions === 1 ? "" : "s"} mention it`],
        [found.plan, `place${found.plan === 1 ? "" : "s"} in your training plan`],
        [found.goals, `goal next step${found.goals === 1 ? "" : "s"}`],
        [found.notes, `note${found.notes === 1 ? "" : "s"} for Studio (will be deleted)`],
        [found.concern ? 1 : 0, "the “affecting exercise” switch is on for it (will be turned off)"],
      ] as [number, string][]).filter(([count]) => count > 0)
    : []

  return (
    <section className="correction-box">
      <h3>Studio has something wrong?</h3>
      <p className="capture-disclaimer">Tell it what’s no longer true. It finds every old mention and cleans them up.</p>
      <form
        className="correction-box__form"
        onSubmit={(event) => {
          event.preventDefault()
          setFound(findMentions(state, word))
        }}
      >
        <label>
          <span>What to look for</span>
          <input value={word} onChange={(event) => { setWord(event.target.value); setFound(null) }} placeholder="e.g. ankle" />
        </label>
        <label>
          <span>What’s true now</span>
          <input value={truth} onChange={(event) => setTruth(event.target.value)} placeholder="e.g. My ankles are completely fine now" />
        </label>
        <Button type="submit" variant="secondary" icon={Search} disabled={word.trim().length < 3}>
          Find old mentions
        </Button>
      </form>
      {found && (
        <div className="correction-box__found">
          {rows.length === 0 && !found.chat && !found.painLogs && !found.aboutMe.length ? (
            <p>No old mentions found. Studio will still remember what’s true now once you save it.</p>
          ) : (
            <ul>
              {rows.map(([count, text]) => (
                <li key={text}>
                  <b>{count}</b> {text}
                </li>
              ))}
              {found.aboutMe.length > 0 && (
                <li>
                  In About me: {found.aboutMe.map(label).join(", ")}. <em>Edit those below in your own words.</em>
                </li>
              )}
            </ul>
          )}
          {found.chat > 0 && (
            <label className="check-row">
              <input type="checkbox" checked={clearChat} onChange={(event) => setClearChat(event.target.checked)} />
              <span>Start a new chat ({found.chat} message{found.chat === 1 ? "" : "s"} mention it)</span>
            </label>
          )}
          {found.painLogs > 0 && (
            <label className="check-row">
              <input type="checkbox" checked={resolvePain} onChange={(event) => setResolvePain(event.target.checked)} />
              <span>Mark recent pain in your logs as resolved ({found.painLogs})</span>
            </label>
          )}
          <Button
            icon={Check}
            disabled={!truth.trim() && !rows.length && !found.chat && !found.painLogs}
            onClick={() => {
              update((current) => cleanMentions(current, word, truth, { clearChat: clearChat && found.chat > 0, resolvePain: resolvePain && found.painLogs > 0 }), "Cleaned up. Studio will go by what’s true now.")
              setFound(null)
              setWord("")
              setTruth("")
            }}
          >
            Clean up and remember
          </Button>
        </div>
      )}
      {corrections.length > 0 && (
        <div className="correction-box__list">
          <p className="eyebrow">Studio remembers</p>
          <ul>
            {corrections.map((item) => (
              <li key={item.id}>
                <span>
                  {item.text} <small>· {formatDate(item.at.slice(0, 10), { day: "numeric", month: "short" })}</small>
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Forget “${item.text}”`}
                  onClick={() => update((current) => ({ ...current, corrections: (current.corrections ?? []).filter((entry) => entry.id !== item.id) }))}
                >
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
