// Shared helpers for talking to the Cloudflare AI Gateway from Netlify Functions.
// The gateway key lives only in Netlify environment variables and never reaches the browser.

// All three values come from Netlify environment variables; none are hard-coded,
// so Netlify's secrets scanning never finds them in the repo.
export function gatewayConfig() {
  const key = process.env.CLOUDFLARE_KEY
  const url = process.env.CF_GATEWAY_URL
  const model = process.env.AI_MODEL
  if (!key || !url || !model)
    throw new HttpError(503, "AI is not configured on the server yet.")
  return { url: url.replace(/\/$/, ""), key, model }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status)
  console.error(error)
  return json({ error: "Studio could not reach the server. Please try again." }, 502)
}

// Every API call must carry the private passcode set in STUDIO_PASSCODE.
export function assertPasscode(req: Request) {
  const expected = process.env.STUDIO_PASSCODE
  if (!expected)
    throw new HttpError(503, "Add STUDIO_PASSCODE in Netlify to unlock sync and AI.")
  const given = req.headers.get("x-studio-passcode") ?? ""
  if (!given) throw new HttpError(401, "Enter your Studio passcode in My Studio first.")
  const a = new TextEncoder().encode(given)
  const b = new TextEncoder().encode(expected)
  let diff = a.length ^ b.length
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i]
  if (diff !== 0) throw new HttpError(401, "That passcode is not right.")
}

// Only accept calls from pages served by this same site.
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin")
  if (!origin) return
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host")
  if (new URL(origin).host !== host) throw new HttpError(403, "Not allowed.")
}

type ResponsesOptions = {
  instructions: string
  input: string
  maxOutputTokens?: number
  schema?: { name: string; schema: Record<string, unknown> }
}

export async function callResponses({
  instructions,
  input,
  maxOutputTokens = 1500,
  schema,
}: ResponsesOptions): Promise<string> {
  const { url, key, model } = gatewayConfig()
  const response = await fetch(`${url}/openai/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-aig-authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: maxOutputTokens,
      store: false,
      ...(schema && {
        text: {
          format: {
            type: "json_schema",
            name: schema.name,
            strict: true,
            schema: schema.schema,
          },
        },
      }),
    }),
  })

  if (!response.ok) {
    console.error("Gateway error", response.status, await response.text())
    throw new HttpError(502, "The AI service returned an error. Please try again.")
  }

  const data = (await response.json()) as {
    output_text?: string
    output?: { type: string; content?: { type: string; text?: string }[] }[]
  }
  const text =
    data.output_text ??
    (data.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("")
  if (!text.trim()) throw new HttpError(502, "The AI service returned an empty answer.")
  return text
}
