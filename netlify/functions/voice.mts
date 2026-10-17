import type { Config } from "@netlify/functions"
import { getStore } from "@netlify/blobs"
import { HttpError, assertPasscode, assertSameOrigin, errorResponse } from "../lib/gateway"

const MAX_BYTES = 5_500_000

// Voice note audio, keyed by note id, so recordings play on every device.
export default async (req: Request) => {
  try {
    assertSameOrigin(req)
    assertPasscode(req)
    const id = new URL(req.url).searchParams.get("id") ?? ""
    if (!/^[\w-]{8,64}$/.test(id)) throw new HttpError(400, "Missing voice note id.")
    const store = getStore({ name: "life-studio-voice", consistency: "strong" })

    if (req.method === "GET") {
      const result = await store.getWithMetadata(id, { type: "arrayBuffer" })
      if (!result) throw new HttpError(404, "Voice note not found.")
      return new Response(result.data, {
        headers: {
          "Content-Type": String(result.metadata.type || "audio/webm"),
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      })
    }

    if (req.method === "PUT") {
      const audio = await req.arrayBuffer()
      if (!audio.byteLength) throw new HttpError(400, "The recording was empty.")
      if (audio.byteLength > MAX_BYTES) throw new HttpError(413, "That recording is too large.")
      const type = (req.headers.get("content-type") || "audio/webm").split(";")[0]
      await store.set(id, audio, { metadata: { type } })
      return new Response(null, { status: 204 })
    }

    throw new HttpError(405, "Use GET or PUT.")
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/voice",
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
}
