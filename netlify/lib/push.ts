import { getStore } from "@netlify/blobs"
import webpush from "web-push"
import { HttpError } from "./gateway"

export type Subscription = { endpoint: string; keys: { p256dh: string; auth: string }; label?: string; at: string }
export type PushData = { subscriptions: Subscription[]; seenAt?: number; log?: { date: string; sent: string[] } }

export const store = () => getStore({ name: "life-studio", consistency: "strong" })

export async function loadPush(): Promise<PushData> {
  return ((await store().get("push", { type: "json" })) as PushData | null) ?? { subscriptions: [] }
}

export const savePush = (data: PushData) => store().setJSON("push", data)

export function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) throw new HttpError(503, "Notifications aren’t set up yet. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Netlify.")
  // The subject identifies the sender to Apple/Google; the site's own address is enough.
  webpush.setVapidDetails(process.env.URL || "https://life-studio.netlify.app", publicKey, privateKey)
  return { publicKey }
}

// Send to every device; drop ones the push service says are gone.
export async function sendAll(data: PushData, payload: { title: string; body: string; url: string; tag: string }) {
  vapid()
  const alive: Subscription[] = []
  let delivered = 0
  for (const subscription of data.subscriptions) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60, urgency: "normal" })
      alive.push(subscription)
      delivered++
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status !== 404 && status !== 410) alive.push(subscription)
      else console.log("Removing expired push subscription")
    }
  }
  data.subscriptions = alive
  return delivered
}
