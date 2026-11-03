import { authHeaders, getPasscode } from "./sync"
import type { NotificationPrefs } from "./types"

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  morning: { on: true, time: "08:00" },
  happiness: { on: true, time: "20:00" },
  lightsOut: { on: true },
  sessions: { on: false, minutesBefore: 30 },
  weekly: { on: false },
  dates: { on: false },
  dailyMax: 3,
  quiet: { from: "22:45", to: "07:30" },
}

export const prefsOf = (prefs?: Partial<NotificationPrefs>): NotificationPrefs => ({ ...DEFAULT_PREFS, ...prefs })

// iPhones only allow notifications for web apps opened from the Home Screen.
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window

const call = async (method: "GET" | "POST", body?: unknown) => {
  const response = await fetch("/api/push", {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((data as { error?: string }).error || "Couldn’t reach the notification service.")
  return data as { publicKey?: string | null; devices?: number; delivered?: number }
}

const keyBytes = (base64: string) => {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

export async function enablePush() {
  if (!getPasscode()) throw new Error("Connect sync first (Settings → Sync), so notifications know what’s in your plan.")
  const { publicKey } = await call("GET")
  if (!publicKey) throw new Error("Notifications aren’t set up on the server yet (the push keys need adding in Netlify).")
  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("Notifications are blocked. You can allow them in iPhone Settings → Notifications → Life Studio.")
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
  await call("POST", { action: "subscribe", subscription: subscription.toJSON(), label: navigator.userAgent.includes("iPhone") ? "iPhone" : "This device" })
}

export async function disablePush() {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await call("POST", { action: "unsubscribe", endpoint: subscription.endpoint }).catch(() => undefined)
    await subscription.unsubscribe().catch(() => undefined)
  }
}

export const sendTestPush = () => call("POST", { action: "test" })

export async function hasThisDevice() {
  if (!pushSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration()
  return !!(await registration?.pushManager.getSubscription())
}

// "I'm in the app right now", so nothing pings you while you're using it. At most every 10 minutes.
let lastSeen = 0
export function markSeen() {
  if (!getPasscode() || Date.now() - lastSeen < 10 * 60000) return
  lastSeen = Date.now()
  call("POST", { action: "seen" }).catch(() => undefined)
}
