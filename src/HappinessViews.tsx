import { Heart, PawPrint, Shuffle, Sparkles, Trash2 } from "lucide-react"
import { useState } from "react"
import { celebrate } from "./GoalProjectViews"
import type { AppState, HappinessPocket } from "./types"
import { Button, formatDate, Modal, SwipeRow, today, uid, useRemove } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

// Small, cute, doable-now ideas for days when happiness is hard to find. Mostly animals.
export const HAPPY_IDEAS: { text: string; link?: { label: string; url: string } }[] = [
  { text: "Watch the sea otters for five minutes. They hold hands when they sleep so they don’t drift apart.", link: { label: "Monterey Bay Aquarium live cams", url: "https://www.montereybayaquarium.org/animals/live-cams" } },
  { text: "Check in on the giant pandas. Something is almost always rolling over.", link: { label: "National Zoo panda cam", url: "https://nationalzoo.si.edu/webcams/panda-cam" } },
  { text: "Pick a live animal cam at random and watch until something happens.", link: { label: "explore.org live cams", url: "https://explore.org/livecams" } },
  { text: "Look up a quokka photo. They’re called the happiest animal in the world for a reason.", link: { label: "Quokka", url: "https://en.wikipedia.org/wiki/Quokka" } },
  { text: "Find out what a red panda does when it’s surprised (it stands up on its back legs).", link: { label: "Red panda", url: "https://en.wikipedia.org/wiki/Red_panda" } },
  { text: "Meet the axolotl: a salamander that looks like it’s always smiling.", link: { label: "Axolotl", url: "https://en.wikipedia.org/wiki/Axolotl" } },
  { text: "On your next walk, find the roundest pigeon you can. Give it a name." },
  { text: "Say a quiet hello to the next dog you pass. Bonus if it does a happy tail wiggle." },
  { text: "Go and look at the ducks or geese in a park. Watch one do a full bum-in-the-air dive." },
  { text: "Spot a cat sitting in a window on your street and wave at it." },
  { text: "Look for a robin. They’re one of the few birds that sing all through the winter." },
  { text: "Find a squirrel and watch it plan its next move for a whole minute." },
  { text: "Search “baby goats in pyjamas”. Trust me." },
  { text: "Watch a video of a capybara relaxing in a hot spring. Match its energy." },
  { text: "Look up a group of puffins (it’s called an “improbability”)." },
  { text: "Find a photo of a hedgehog yawning." },
  { text: "Watch a slow loris or sloth video and copy its pace for the next ten minutes." },
  { text: "Look up a pygmy marmoset: a monkey that fits on your finger." },
  { text: "Text someone a photo of a cute animal and see what they send back." },
  { text: "Find a bird feeder or bird bath and watch who comes for two minutes." },
  { text: "Look up the dumbo octopus. It flaps its ear-fins like a tiny cartoon." },
  { text: "Find out how penguins propose (with a pebble)." },
  { text: "Watch a fox at dusk if you’re near a park. London foxes are very confident." },
  { text: "Make a cup of tea, sit by a window and count the birds you see." },
  { text: "Look at photos of your favourite animal as a baby." },
  { text: "Learn one weird fact about cows: they have best friends and get stressed when apart." },
  { text: "Draw a terrible little animal on a sticky note and put it somewhere you’ll see later." },
  { text: "Find the fluffiest cloud and decide which animal it is." },
  { text: "Put on a song you loved at fifteen and dance like no one’s watching (no one is)." },
  { text: "Step outside for two minutes and find one thing that’s quietly beautiful." },
  { text: "Smell something lovely: fresh bread, coffee, a flower, clean laundry." },
  { text: "Look back at an old photo that makes you smile." },
]

// One idea per day (so it doesn't jump around), with "Another" to shuffle.
const ideaFor = (date: string, offset: number) => {
  const seed = Number(date.replace(/-/g, "")) + offset
  return HAPPY_IDEAS[Math.abs(seed * 7919) % HAPPY_IDEAS.length]
}

export const pocketsOn = (state: AppState, date: string) => (state.happiness ?? []).filter((pocket) => pocket.date === date)

const thisMonth = (state: AppState) => {
  const month = today().slice(0, 7)
  return new Set((state.happiness ?? []).filter((pocket) => pocket.date.startsWith(month)).map((pocket) => pocket.date)).size
}

const savePocket = (update: Update, text: string, fromIdea = false) => {
  update((current) => ({
    ...current,
    happiness: [{ id: uid(), date: today(), text: text.trim(), fromIdea: fromIdea || undefined, at: new Date().toISOString() }, ...(current.happiness ?? [])],
  }))
  celebrate({ title: "A pocket of happiness", body: "Noticed and kept. That’s the habit." })
}

// On Today: one line about today's little pocket of happiness, or an idea if it's hard to find.
export function HappinessCard({ state, update, onOpen }: { state: AppState; update: Update; onOpen: () => void }) {
  const [text, setText] = useState("")
  const [idea, setIdea] = useState<number | null>(null)
  const todays = pocketsOn(state, today())
  const month = thisMonth(state)
  const suggestion = idea !== null ? ideaFor(today(), idea) : null

  return (
    <section className={`happiness-card ${todays.length ? "is-found" : ""}`}>
      <div className="happiness-card__head">
        <Heart size={18} />
        <p className="eyebrow">Pocket of happiness</p>
        <button type="button" className="text-link" onClick={onOpen}>
          {month ? `${month} this month` : "The jar"}
        </button>
      </div>
      {todays.length > 0 && (
        <ul className="happiness-card__today">
          {todays.map((pocket) => (
            <li key={pocket.id}>{pocket.text}</li>
          ))}
        </ul>
      )}
      <form
        className="happiness-card__form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!text.trim()) return
          savePocket(update, text)
          setText("")
          setIdea(null)
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={todays.length ? "Another one?" : "What was your little pocket of happiness today?"}
          aria-label="Today’s pocket of happiness"
        />
        <Button type="submit" variant="secondary" disabled={!text.trim()}>
          Keep it
        </Button>
      </form>
      {!todays.length &&
        (suggestion ? (
          <div className="happiness-card__idea">
            <PawPrint size={18} />
            <div>
              <p>{suggestion.text}</p>
              {suggestion.link && (
                <a href={suggestion.link.url} target="_blank" rel="noreferrer">
                  {suggestion.link.label} ↗
                </a>
              )}
              <div className="inline-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    savePocket(update, suggestion.text, true)
                    setIdea(null)
                  }}
                >
                  I did it
                </Button>
                <button type="button" className="text-link" onClick={() => setIdea((idea ?? 0) + 1)}>
                  <Shuffle size={14} /> Another
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="text-link happiness-card__help" onClick={() => setIdea(0)}>
            <Sparkles size={14} /> Can’t find one today? Here’s a little idea
          </button>
        ))}
    </section>
  )
}

// The happiness jar: every pocket, by day, and a random one to reach in for.
export function HappinessJar({ state, update, close }: { state: AppState; update: Update; close: () => void }) {
  const remove = useRemove()
  const pockets = [...(state.happiness ?? [])].sort((a, b) => b.at.localeCompare(a.at))
  const [picked, setPicked] = useState<HappinessPocket | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const days = new Set(pockets.map((pocket) => pocket.date)).size

  return (
    <Modal title="Happiness jar" eyebrow="Little pockets you’ve kept" onClose={close} wide>
      <div className="happiness-jar">
        <p className="capture-disclaimer">
          {pockets.length
            ? `${pockets.length} pocket${pockets.length === 1 ? "" : "s"} across ${days} day${days === 1 ? "" : "s"}. No streaks, just noticing.`
            : "Nothing in the jar yet. Add one on Today when something small makes you smile."}
        </p>
        {pockets.length > 1 && (
          <div className="happiness-jar__reach">
            <Button
              variant="secondary"
              icon={Shuffle}
              onClick={() => {
                const others = pockets.filter((pocket) => pocket.id !== picked?.id)
                setPicked(others[Math.floor(Math.random() * others.length)])
              }}
            >
              Reach into the jar
            </Button>
            {picked && (
              <blockquote>
                “{picked.text}”<small>{formatDate(picked.date, { weekday: "long", day: "numeric", month: "long" })}</small>
              </blockquote>
            )}
          </div>
        )}
        <ul className="happiness-jar__list">
          {pockets.map((pocket) =>
            editing === pocket.id ? (
              <li key={pocket.id}>
                <form
                  className="happiness-card__form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!draft.trim()) return
                    update((current) => ({ ...current, happiness: (current.happiness ?? []).map((item) => (item.id === pocket.id ? { ...item, text: draft.trim() } : item)) }))
                    setEditing(null)
                  }}
                >
                  <input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Edit pocket of happiness" autoFocus />
                  <Button type="submit" variant="secondary">
                    Save
                  </Button>
                </form>
              </li>
            ) : (
              <SwipeRow
                as="li"
                key={pocket.id}
                actions={[
                  {
                    label: "Delete",
                    icon: Trash2,
                    tone: "danger",
                    onClick: () => remove((current) => ({ ...current, happiness: (current.happiness ?? []).filter((item) => item.id !== pocket.id) }), "Removed from the jar."),
                  },
                ]}
              >
                <button
                  type="button"
                  className="happiness-jar__row"
                  onClick={() => {
                    setEditing(pocket.id)
                    setDraft(pocket.text)
                  }}
                >
                  <span>{pocket.text}</span>
                  <small>
                    {formatDate(pocket.date, { weekday: "short", day: "numeric", month: "short" })}
                    {pocket.fromIdea ? " · from an idea" : ""}
                  </small>
                </button>
              </SwipeRow>
            ),
          )}
        </ul>
      </div>
    </Modal>
  )
}
