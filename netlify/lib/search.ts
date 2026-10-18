import { HttpError } from "./gateway"

export type WebResult = { title: string; url: string; content: string }

// Optional web search (Tavily). Off until TAVILY_API_KEY is set in Netlify's environment.
export async function webSearch(query: string): Promise<WebResult[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) throw new HttpError(503, "Web search isn’t set up yet. Add a TAVILY_API_KEY in Netlify to turn it on.")
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: query.slice(0, 400), max_results: 5, search_depth: "basic", include_answer: false }),
  })
  if (response.status === 401 || response.status === 403) throw new HttpError(502, "Web search key was refused. Check TAVILY_API_KEY in Netlify.")
  if (response.status === 429 || response.status === 432) throw new HttpError(429, "Web search limit reached for now. Try again later.")
  if (!response.ok) throw new HttpError(502, "Web search isn’t responding right now.")
  const data = (await response.json()) as { results?: { title?: string; url?: string; content?: string }[] }
  return (data.results ?? [])
    .filter((item) => item.url && /^https?:\/\//.test(item.url))
    .map((item) => ({ title: (item.title ?? item.url!).slice(0, 160), url: item.url!, content: (item.content ?? "").slice(0, 1200) }))
}
