import type { Config } from "@netlify/functions"
import type { AppState } from "../../src/types"
import { dueNotifications, londonNow } from "../lib/notifications"
import { loadPush, savePush, sendAll, store } from "../lib/push"

// Every 15 minutes: work out whether a gentle notification is due, and send it (at most a couple).
export default async () => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return new Response("Notifications not configured")
    const data = await loadPush()
    if (!data.subscriptions.length) return new Response("No devices")
    const saved = (await store().get("state", { type: "json" })) as { state: AppState } | null
    if (!saved?.state) return new Response("No synced state")
    const now = new Date()
    const today = londonNow(now).date
    if (data.log?.date !== today) data.log = { date: today, sent: [] }
    const due = dueNotifications(saved.state, saved.state.notifications, now, new Set(data.log.sent), data.seenAt)
    for (const item of due) {
      await sendAll(data, { title: item.title, body: item.body, url: item.url, tag: item.key })
      data.log.sent.push(item.key)
    }
    await savePush(data)
    return new Response(`Sent ${due.length}`)
  } catch (error) {
    console.error(error)
    return new Response("Error", { status: 500 })
  }
}

export const config: Config = { schedule: "*/15 * * * *" }
