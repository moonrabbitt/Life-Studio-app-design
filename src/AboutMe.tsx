import { Compass, Map, Plus, RotateCcw, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { AboutMeSuggestions } from "./AboutMeUpdates"
import { restoreArchive } from "./setup"
import { ABOUT_LABELS } from "./SetupChat"
import type { AboutMe, AppState } from "./types"
import { Button, formatDate, Modal, SwipeRow, uid, useRemove } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const PROMPTS: Record<keyof Omit<AboutMe, "updatedAt">, string> = {
  whereNow: "Studio keeps this up to date with your progress each week",
  workingTowards: "Events, dates, things you’d love to be able to do",
  healthGoals: "e.g. strong and mobile as I get older, more energy",
  body: "Injuries, conditions, what hurts, what feels good",
  movementNow: "How active you are now, what you already do",
  equipment: "Gym, dumbbells at home, classes…",
  week: "Work hours, realistic days, how long a session can be",
  energy: "Best time of day, what drains or lifts you",
  other: "Anything else Studio should keep in mind",
}

const blank: Omit<AboutMe, "updatedAt"> = {
  whereNow: "",
  workingTowards: "",
  healthGoals: "",
  body: "",
  movementNow: "",
  equipment: "",
  week: "",
  energy: "",
  other: "",
}

// What Studio knows about you, in your own words. Every plan and exercise is shaped by it.
export function AboutMeSpace({
  state,
  update,
  close,
  onSetupAgain,
  onTour,
}: {
  state: AppState
  update: Update
  close: () => void
  onSetupAgain: () => void
  onTour: () => void
}) {
  const [draft, setDraft] = useState<Omit<AboutMe, "updatedAt">>({ ...blank, ...state.aboutMe })
  const [note, setNote] = useState("")
  const [confirmAgain, setConfirmAgain] = useState(false)
  const remove = useRemove()
  const saved = state.aboutMe ?? { ...blank, updatedAt: "" }
  const changed = (Object.keys(blank) as (keyof typeof blank)[]).some((key) => (saved[key] ?? "") !== draft[key])
  const notes = state.movementNotes ?? []
  const profile = state.trainingProfile
  const concern = profile?.concern ?? "not-sure"

  // Save as you type (and when you close), so an update is never lost.
  const latest = useRef({ draft, changed })
  latest.current = { draft, changed }
  const persist = () => {
    if (!latest.current.changed) return
    const next = latest.current.draft
    update((current) => ({ ...current, aboutMe: { ...next, updatedAt: new Date().toISOString() } }))
  }
  useEffect(() => {
    if (!changed) return
    const timer = window.setTimeout(persist, 700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => persist(), [])

  const setConcern = (value: "no" | "yes", note?: string) =>
    update(
      (current) => ({
        ...current,
        trainingProfile: {
          ...(current.trainingProfile ?? {
            completedAt: new Date().toISOString(),
            activity: "",
            walking: "",
            gymExperience: "not-sure",
            familiar: [],
            equipment: "not-sure" as const,
            danceFrequency: "",
            danceIntensity: "",
            days: [],
            minutes: "",
          }),
          concern: value,
          concernNote: value === "yes" ? (note ?? current.trainingProfile?.concernNote) : undefined,
        },
      }),
      value === "no" ? "Got it. Studio will plan normally again." : "Got it. Studio will keep things gentle.",
    )

  return (
    <Modal
      title="About me"
      eyebrow="What Studio knows about you"
      onClose={() => {
        persist()
        close()
      }}
      wide
    >
      <div className="about-me">
        <p className="capture-disclaimer">
          Studio reads this every time it plans something or suggests exercises, so plans fit your body, energy and
          week. Change it whenever life changes.
        </p>
        <AboutMeSuggestions state={state} update={update} onAccepted={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} />
        <section className="about-me__concern">
          <h3>Anything affecting exercise right now?</h3>
          <p className="capture-disclaimer">Pain, an injury or a condition. When this is on, Studio only suggests gentle options.</p>
          <div className="segmented" role="group" aria-label="Anything affecting exercise right now?">
            <button type="button" className={concern === "no" ? "is-active" : ""} aria-pressed={concern === "no"} onClick={() => setConcern("no")}>
              No, I’m fine
            </button>
            <button type="button" className={concern === "yes" ? "is-active" : ""} aria-pressed={concern === "yes"} onClick={() => setConcern("yes")}>
              Yes
            </button>
          </div>
          {concern === "yes" && (
            <label>
              <span>What is it?</span>
              <input
                defaultValue={profile?.concernNote ?? ""}
                placeholder="e.g. sore left ankle"
                onBlur={(event) => {
                  if (event.target.value.trim() !== (profile?.concernNote ?? "")) setConcern("yes", event.target.value.trim())
                }}
              />
            </label>
          )}
        </section>
        <form className="about-me__form" onSubmit={(event) => { event.preventDefault(); persist() }}>
          {ABOUT_LABELS.map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <textarea rows={2} value={draft[key]} placeholder={PROMPTS[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
            </label>
          ))}
          <p className="about-me__save">
            <small>
              {changed ? "Saving…" : saved.updatedAt ? `Saved automatically · updated ${formatDate(saved.updatedAt.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}` : "Saves automatically as you type"}
            </small>
          </p>
        </form>

        <section className="about-me__notes">
          <h3>Notes for Studio</h3>
          <p className="capture-disclaimer">Little things to remember, like “squats feel better with heels raised”.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!note.trim()) return
              update((current) => ({
                ...current,
                movementNotes: [{ id: uid(), text: note.trim(), createdAt: new Date().toISOString() }, ...(current.movementNotes ?? [])],
              }))
              setNote("")
            }}
          >
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" aria-label="New note for Studio" />
            <Button type="submit" variant="secondary" icon={Plus}>
              Add
            </Button>
          </form>
          {notes.length > 0 && (
            <ul>
              {notes.map((item) => (
                <SwipeRow
                  as="li"
                  key={item.id}
                  actions={[
                    {
                      label: "Delete",
                      icon: Trash2,
                      tone: "danger",
                      onClick: () =>
                        remove((current) => ({ ...current, movementNotes: (current.movementNotes ?? []).filter((candidate) => candidate.id !== item.id) }), "Note deleted."),
                    },
                  ]}
                >
                  <p>{item.text}</p>
                </SwipeRow>
              ))}
            </ul>
          )}
        </section>

        <section className="about-me__restart">
          <h3>Start again</h3>
          <div className="inline-actions">
            <Button variant="secondary" icon={Map} onClick={onTour}>
              Take the tour
            </Button>
            {!confirmAgain && (
              <Button variant="secondary" icon={Compass} onClick={() => setConfirmAgain(true)}>
                Set up from the top
              </Button>
            )}
          </div>
          {confirmAgain && (
            <div className="plan-edit__delete">
              <p>
                Studio will get to know you again and build a fresh space. Your current goals, routines and upcoming
                plans are put away (you can bring them back here). Logs, story, journal, people and projects stay.
              </p>
              <div className="inline-actions">
                <Button icon={Compass} onClick={onSetupAgain}>
                  Start the conversation
                </Button>
                <Button variant="ghost" onClick={() => setConfirmAgain(false)}>
                  Not now
                </Button>
              </div>
            </div>
          )}
          {(state.archives ?? []).length > 0 && (
            <details className="plan-change__past">
              <summary>Put away when you set up again ({state.archives!.length})</summary>
              <ul>
                {state.archives!.map((archive, index) => (
                  <li key={archive.at}>
                    <div>
                      <strong>{formatDate(archive.at.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}</strong>
                      <small>
                        {archive.goals.length} goal{archive.goals.length === 1 ? "" : "s"} · {archive.routines.length} routine
                        {archive.routines.length === 1 ? "" : "s"} · {archive.plan.length} upcoming plan{archive.plan.length === 1 ? "" : "s"}
                      </small>
                    </div>
                    <button type="button" className="text-link" onClick={() => update((current) => restoreArchive(current, index), "Brought back. Anything already there was left as it is.")}>
                      <RotateCcw size={14} /> Bring back
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </Modal>
  )
}
