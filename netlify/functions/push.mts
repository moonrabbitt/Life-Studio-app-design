import type { Config } from "@netlify/functions"
import { HttpError, assertPasscode, assertSameOrigin, errorResponse, json } from "../lib/gateway"
import { loadPush, savePush, sendAll, vapid, type Subscription } from "../lib/push"

// Register this phone for notifications, remove it, send a test, or say "I'm in the app".
export default async (req: Request) => {
  try {
    assertSameOrigin(req)
    assertPasscode(req)
    if (req.method === "GET") {
      const configured = !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY
      const data = await loadPush()
      return json({ publicKey: configured ? process.env.VAPID_PUBLIC_KEY : null, devices: data.subscriptions.length })
    }
    if (req.method !== "POST") throw new HttpError(405, "Use GET or POST.")
    const body = (await req.json().catch(() => null)) as { action?: string; subscription?: Subscription; endpoint?: string; label?: string } | null
    const data = await loadPush()

    if (body?.action === "seen") {
      data.seenAt = Date.now()
      await savePush(data)
      return json({ ok: true })
    }
    if (body?.action === "subscribe") {
      const subscription = body.subscription
      if (!subscription?.endpoint || !/^https:\/\//.test(subscription.endpoint) || !subscription.keys?.p256dh || !subscription.keys?.auth)
        throw new HttpError(400, "That notification subscription looks incomplete.")
      vapid()
      data.subscriptions = [
        ...data.subscriptions.filter((item) => item.endpoint !== subscription.endpoint),
        { endpoint: subscription.endpoint, keys: subscription.keys, label: (body.label ?? "").slice(0, 60), at: new Date().toISOString() },
      ].slice(-5)
      await savePush(data)
      return json({ ok: true, devices: data.subscriptions.length })
    }
    if (body?.action === "unsubscribe") {
      data.subscriptions = data.subscriptions.filter((item) => item.endpoint !== body.endpoint)
      await savePush(data)
      return json({ ok: true, devices: data.subscriptions.length })
    }
    if (body?.action === "test") {
      if (!data.subscriptions.length) throw new HttpError(400, "No phone is set up for notifications yet.")
      const delivered = await sendAll(data, { title: "Hello from Life Studio 🐾", body: "This is what a gentle nudge looks like.", url: "/", tag: "test" })
      await savePush(data)
      return json({ ok: true, delivered })
    }
    throw new HttpError(400, "Unknown action.")
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/push",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
}
