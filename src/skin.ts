import { downloadPhoto, getPasscode, uploadPhoto } from "./sync"
import { addDays } from "./training"
import type { AppState, SkinCare, SkinFeel, SkinSchedule, SkinStep, SkinSuggestion } from "./types"

export const emptySkin = (): SkinCare => ({ steps: [], done: [], checks: [], photos: [] })
export const skinOf = (state: AppState): SkinCare => ({ ...emptySkin(), ...state.skin })

export const FEELS: [SkinFeel, string][] = [
  ["calm", "Calm"],
  ["glowy", "Glowy"],
  ["dry", "Dry"],
  ["oily", "Oily"],
  ["irritated", "Irritated"],
  ["breakout", "Breakout"],
]

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const weekday = (date: string) => new Date(`${date}T12:00:00`).getDay()

// Monday of the week a date falls in.
export const weekStart = (date: string) => addDays(date, -((weekday(date) + 6) % 7))

export const isDone = (skin: SkinCare, stepId: string, date: string) =>
  skin.done.some((item) => item.stepId === stepId && item.date === date)

export const timesThisWeek = (skin: SkinCare, stepId: string, date: string) => {
  const from = weekStart(date)
  return skin.done.filter((item) => item.stepId === stepId && item.date >= from && item.date <= addDays(from, 6)).length
}

// Due on a day: scheduled for it, or a "few times a week" step that still has some left this week
// (once done today it stays listed, ticked).
export function isDue(skin: SkinCare, step: SkinStep, date: string) {
  const { schedule } = step
  if (schedule.kind === "daily") return true
  if (schedule.kind === "days") return schedule.days.includes(weekday(date))
  return isDone(skin, step.id, date) || timesThisWeek(skin, step.id, date) < schedule.times
}

export const dueOn = (skin: SkinCare, date: string, when?: "am" | "pm") =>
  skin.steps.filter((step) => (!when || step.when === when) && isDue(skin, step, date))

export function scheduleLabel(schedule: SkinSchedule) {
  if (schedule.kind === "daily") return "Every day"
  if (schedule.kind === "weekly") return schedule.times === 1 ? "Once a week" : `${schedule.times}× a week`
  const days = [...schedule.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  return days.length === 7 ? "Every day" : days.map((day) => WEEKDAYS[day]).join(", ")
}

export const whenLabel = (when: "am" | "pm") => (when === "am" ? "Morning" : "Evening")

// Ready-made steps, so a routine takes a few taps.
export const STARTERS: Omit<SkinStep, "id">[] = [
  { name: "Cleanser", when: "pm", schedule: { kind: "daily" } },
  { name: "Moisturiser", when: "am", schedule: { kind: "daily" } },
  { name: "SPF", when: "am", schedule: { kind: "daily" } },
  { name: "Retinol", when: "pm", schedule: { kind: "weekly", times: 2 }, note: "Not on the same night as acids or PDRN" },
  { name: "PDRN", when: "pm", schedule: { kind: "weekly", times: 1 } },
  { name: "Exfoliating acid", when: "pm", schedule: { kind: "weekly", times: 1 } },
  { name: "Face mask", when: "pm", schedule: { kind: "weekly", times: 1 } },
]

// Toggle one step on one day.
export const toggleDone = (current: AppState, stepId: string, date: string): AppState => {
  const skin = skinOf(current)
  const done = isDone(skin, stepId, date)
    ? skin.done.filter((item) => !(item.stepId === stepId && item.date === date))
    : [...skin.done, { id: crypto.randomUUID(), stepId, date, at: new Date().toISOString() }]
  return { ...current, skin: { ...skin, done } }
}

export const SKIN_TYPES = ["Dry", "Oily", "Combination", "Normal", "Sensitive"]
export const CONCERNS = ["Breakouts", "Texture", "Dark spots", "Redness", "Dryness", "Fine lines", "Dullness", "Pores", "Dark circles"]

const localToday = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// What Studio sees: skin type and concerns, the routine, how often each step really happened lately,
// and how the skin has felt (never the photos, unless you share them for a review).
export function skinContext(state: AppState) {
  const skin = state.skin
  if (!skin?.steps.length && !skin?.profile?.concerns.length && !skin?.profile?.type) return undefined
  const today = localToday()
  const from = addDays(today, -13)
  return {
    profile: skin.profile ?? null,
    routine: skin.steps.map((step) => ({ id: step.id, name: step.name, when: whenLabel(step.when).toLowerCase(), schedule: scheduleLabel(step.schedule), note: step.note ?? null })),
    lastTwoWeeks: Object.fromEntries(skin.steps.map((step) => [step.name, skin.done.filter((item) => item.stepId === step.id && item.date >= from).length])),
    checks: skin.checks.filter((check) => check.date >= addDays(today, -27)).map((check) => ({ date: check.date, feel: check.feel, note: check.note ?? null })),
  }
}

// A suggested step from Studio, as a routine step.
export function stepFromSuggestion(suggestion: SkinSuggestion, id: string): SkinStep | null {
  const step = suggestion.step
  if (!step?.name.trim()) return null
  const schedule: SkinSchedule =
    step.schedule === "days" && step.days.length
      ? { kind: "days", days: [...new Set(step.days.filter((day) => day >= 0 && day <= 6))] }
      : step.schedule === "weekly"
        ? { kind: "weekly", times: Math.min(7, Math.max(1, step.times || 1)) }
        : { kind: "daily" }
  return { id, name: step.name.trim(), when: step.when === "am" ? "am" : "pm", schedule, note: step.note?.trim() || undefined }
}

// A photo as a small JPEG data URL, for sharing with Studio in a review.
export async function photoForStudio(id: string) {
  const blob = await loadPhoto(id)
  if (!blob) return null
  const small = await shrinkPhoto(blob, 1024)
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(small)
  })
}

// Photos ----------------------------------------------------------------------
// Kept on the phone in IndexedDB, and in the photo store when there's a passcode.

const DATABASE = "life-studio-photos"
const STORE = "skin"

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  const database = await openDatabase()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode)
      const request = run(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request ? (request.result as T) : undefined)
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}

export const savePhotoLocal = (id: string, blob: Blob) => withStore<void>("readwrite", (store) => void store.put(blob, id))
export const getPhotoLocal = (id: string) => withStore<Blob>("readonly", (store) => store.get(id))
export const deletePhotoLocal = (id: string) => withStore<void>("readwrite", (store) => void store.delete(id))

export async function loadPhoto(id: string) {
  const local = await getPhotoLocal(id).catch(() => undefined)
  if (local) return local
  if (!getPasscode()) return undefined
  const remote = await downloadPhoto(id).catch(() => undefined)
  if (remote) await savePhotoLocal(id, remote).catch(() => undefined)
  return remote
}

// Shrink a photo from the camera to at most 1280px on the long side, as a JPEG (a few hundred KB).
export async function shrinkPhoto(file: Blob, longest = 1280): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = "async"
    image.src = url
    await image.decode()
    const scale = Math.min(1, longest / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn’t read that photo."))), "image/jpeg", 0.82),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Upload any photos that haven't reached the photo store yet; returns the ids that did.
export async function uploadPendingPhotos(skin: SkinCare) {
  if (!getPasscode()) return []
  const done: string[] = []
  for (const photo of skin.photos.filter((item) => !item.uploaded)) {
    const blob = await getPhotoLocal(photo.id).catch(() => undefined)
    if (!blob) continue
    try {
      await uploadPhoto(photo.id, blob)
      done.push(photo.id)
    } catch {
      break // offline or no passcode yet; try again next time
    }
  }
  return done
}
