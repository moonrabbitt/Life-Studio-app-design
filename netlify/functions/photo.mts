import type { Config } from "@netlify/functions"
import { getStore } from "@netlify/blobs"
import { HttpError, assertPasscode, assertSameOrigin, errorResponse } from "../lib/gateway"

const MAX_BYTES = 3_000_000

// Skin care progress photos (already shrunk on the phone), keyed by photo id, so they show on every device.
export default async (req: Request) => {
  try {
    assertSameOrigin(req)
    assertPasscode(req)
    const id = new URL(req.url).searchParams.get("id") ?? ""
    if (!/^[\w-]{8,64}$/.test(id)) throw new HttpError(400, "Missing photo id.")
    const store = getStore({ name: "life-studio-photos", consistency: "strong" })

    if (req.method === "GET") {
      const result = await store.getWithMetadata(id, { type: "arrayBuffer" })
      if (!result) throw new HttpError(404, "Photo not found.")
      return new Response(result.data, {
        headers: {
          "Content-Type": String(result.metadata.type || "image/jpeg"),
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      })
    }

    if (req.method === "PUT") {
      const image = await req.arrayBuffer()
      if (!image.byteLength) throw new HttpError(400, "The photo was empty.")
      if (image.byteLength > MAX_BYTES) throw new HttpError(413, "That photo is too large.")
      const type = (req.headers.get("content-type") || "image/jpeg").split(";")[0]
      if (!type.startsWith("image/")) throw new HttpError(415, "Only photos, please.")
      await store.set(id, image, { metadata: { type } })
      return new Response(null, { status: 204 })
    }

    if (req.method === "DELETE") {
      await store.delete(id)
      return new Response(null, { status: 204 })
    }

    throw new HttpError(405, "Use GET, PUT or DELETE.")
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/photo",
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
}
