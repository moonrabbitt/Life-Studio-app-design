import { Compass, Map, Plus, RotateCcw, Trash2 } from "lucide-react"
import { useState } from "react"
import { restoreArchive } from "./setup"
import { ABOUT_LABELS } from "./SetupChat"
import type { AboutMe, AppState } from "./types"
import { Button, formatDate, Modal, SwipeRow, uid, useRemove } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

const PROMPTS: Record<keyof Omit<AboutMe, "updatedAt">, string> = {
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

  return (
    <Modal title="About me" eyebrow="What Studio knows about you" onClose={close} wide>
      <div className="about-me">
        <p className="capture-disclaimer">
          Studio reads this every time it plans something or suggests exercises, so plans fit your body, energy and
          week. Change it whenever life changes.
        </p>
        <form
          className="about-me__form"
          onSubmit={(event) => {
            event.preventDefault()
            update((current) => ({ ...current, aboutMe: { ...draft, updatedAt: new Date().toISOString() } }), "Saved. Studio will use this from now on.")
          }}
        >
          {ABOUT_LABELS.map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <textarea rows={2} value={draft[key]} placeholder={PROMPTS[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
            </label>
          ))}
          <div className="about-me__save">
            <Button type="submit" disabled={!changed}>
              {changed ? "Save" : "Saved"}
            </Button>
            {saved.updatedAt && <small>Updated {formatDate(saved.updatedAt.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}</small>}
          </div>
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
