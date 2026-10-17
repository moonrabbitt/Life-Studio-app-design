import type { Config } from "@netlify/functions"
import { getStore } from "@netlify/blobs"
import { HttpError, assertPasscode, assertSameOrigin, errorResponse, json } from "../lib/gateway"

type Saved = { state: unknown; updatedAt: number }

const MAX_BYTES = 4_000_000

// One person, one studio: the whole app state lives under a single key.
// Whichever copy was changed most recently wins.
export default async (req: Request) => {
  try {
    assertSameOrigin(req)
    assertPasscode(req)
    const store = getStore({ name: "life-studio", consistency: "strong" })
    const saved = (await store.get("state", { type: "json" })) as Saved | null

    if (req.method === "GET") return json(saved ?? { state: null, updatedAt: 0 })

    if (req.method === "PUT") {
      const raw = await req.text()
      if (raw.length > MAX_BYTES) throw new HttpError(413, "Your studio is too large to sync.")
      const incoming = JSON.parse(raw) as Partial<Saved>
      if (!incoming.state || typeof incoming.updatedAt !== "number")
        throw new HttpError(400, "Nothing to save.")
      if (saved && saved.updatedAt > incoming.updatedAt) return json(saved, 409)
      const next = { state: incoming.state, updatedAt: incoming.updatedAt }
      await store.setJSON("state", next)
      return json({ updatedAt: next.updatedAt })
    }

    throw new HttpError(405, "Use GET or PUT.")
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/sync",
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ["ip", "domain"] },
}
