import type { Config } from "@netlify/functions"
import {
  HttpError,
  assertPasscode,
  assertSameOrigin,
  callResponses,
  errorResponse,
  json,
} from "../lib/gateway"

const TONE = `You are the companion inside Life Studio, a calm personal life app for Avika in London.
Tone: warm, encouraging, practical, brief. British English. Never use guilt, streaks, punishment
language, calorie or body-weight focus, or "fitness-bro" framing. You are not a therapist,
clinician, or financial adviser: never diagnose, treat, or recommend specific investments.`

const nullable = (type: string) => ({ type: [type, "null"] })

const assistSchema = {
  name: "studio_proposal",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "actions"],
    properties: {
      reply: { type: "string" },
      actions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "type",
            "summary",
            "title",
            "body",
            "date",
            "time",
            "duration",
            "area",
            "mode",
            "planId",
            "amount",
            "category",
            "scale",
            "milestones",
            "exercises",
            "nextAction",
          ],
          properties: {
            type: {
              type: "string",
              enum: [
                "add_plan",
                "move_plan",
                "complete_plan",
                "add_journal",
                "add_project",
                "add_goal",
                "add_transaction",
                "add_gym_session",
              ],
            },
            summary: { type: "string" },
            title: nullable("string"),
            body: nullable("string"),
            date: nullable("string"),
            time: nullable("string"),
            duration: nullable("integer"),
            area: {
              type: ["string", "null"],
              enum: ["reflect", "create", "connect", "move", "money", "home", null],
            },
            mode: {
              type: ["string", "null"],
              enum: ["fixed", "flexible", "maybe", null],
            },
            planId: nullable("string"),
            amount: nullable("number"),
            category: nullable("string"),
            scale: { type: ["string", "null"], enum: ["small", "big", null] },
            milestones: { type: ["array", "null"], items: { type: "string" } },
            exercises: { type: ["array", "null"], items: { type: "string" } },
            nextAction: nullable("string"),
          },
        },
      },
    },
  },
}

const ASSIST_INSTRUCTIONS = `${TONE}

The user speaks or types a request. Turn it into a short friendly "reply" (1-3 sentences) and a list of
concrete "actions" the app can apply after the user confirms. Use the JSON context for today's date,
their plan items (with ids), and goals. Rules:
- Only propose actions the user asked for or that clearly help; 0-5 actions. For pure questions or
  chat, return an empty actions list and answer in "reply".
- Dates are YYYY-MM-DD, resolved relative to context.today. Times are 24h HH:MM. Duration in minutes.
- add_plan: title, date, optional time/duration, area, mode (fixed = appointment, flexible = can move, maybe = optional).
- move_plan / complete_plan: planId MUST be an id from context.plan; move_plan needs the new date (and time if given).
- add_journal: title + body in the user's own words (lightly tidied, never invented feelings).
- add_project: creative idea; title, body (note), nextAction.
- add_goal: title, area, scale, nextStep in nextAction, 0-4 milestone titles.
- add_transaction: amount in pounds as a positive number for money spent, title, category, date.
- add_gym_session: title, 3-5 gentle beginner-friendly exercise names, duration.
- "summary" is a one-line human description of the action shown to the user.
- Set every field that does not apply to null.`

const coachSchema = {
  name: "gym_session",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "summary", "exercises"],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      exercises: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "cue"],
          properties: { name: { type: "string" }, cue: { type: "string" } },
        },
      },
    },
  },
}

const COACH_INSTRUCTIONS = `${TONE}

Suggest one gentle, editable gym session for someone returning to movement. Return a short title,
a one-sentence summary (sets, effort guidance like "finish with energy left"), and 3-5 exercises,
each with a short cue (reps or time and one technique tip). Respect the energy level and equipment.
Low energy means 3 exercises and one set. Never prescribe through pain.`

const GUIDE_INSTRUCTIONS = `${TONE}

You are a money learning guide. Explain personal-finance and investing concepts simply, with a small
UK example in pounds where useful. 2-4 short paragraphs, plain text, no markdown headings.
Do not recommend specific products, funds, shares, or tell the user what to buy or sell. You do not
know their income, holdings, tax situation, or risk capacity; say so if they ask for personal advice.`

const MAX_INPUT = 4000

export default async (req: Request) => {
  try {
    if (req.method !== "POST") throw new HttpError(405, "Use POST.")
    assertSameOrigin(req)
    assertPasscode(req)

    const body = (await req.json().catch(() => null)) as {
      task?: string
      input?: string
      context?: unknown
    } | null
    const input = body?.input?.trim()
    if (!input) throw new HttpError(400, "Please say or type something first.")
    if (input.length > MAX_INPUT) throw new HttpError(413, "That is a little long. Try a shorter request.")
    const context = JSON.stringify(body?.context ?? {}).slice(0, 12000)

    if (body?.task === "assist") {
      const text = await callResponses({
        instructions: ASSIST_INSTRUCTIONS,
        input: `Context:\n${context}\n\nRequest:\n${input}`,
        maxOutputTokens: 2500,
        schema: assistSchema,
      })
      return json(JSON.parse(text))
    }

    if (body?.task === "coach") {
      const text = await callResponses({
        instructions: COACH_INSTRUCTIONS,
        input: `Session details:\n${context}\n\nNotes from the user:\n${input}`,
        maxOutputTokens: 1500,
        schema: coachSchema,
      })
      return json(JSON.parse(text))
    }

    if (body?.task === "guide") {
      const answer = await callResponses({
        instructions: GUIDE_INSTRUCTIONS,
        input,
        maxOutputTokens: 1200,
      })
      return json({ answer: answer.trim() })
    }

    throw new HttpError(400, "Unknown task.")
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/ai",
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
}
