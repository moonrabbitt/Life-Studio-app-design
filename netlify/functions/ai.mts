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

// One exercise in a suggested workout: exact, loggable, explained.
const workoutItem = {
  type: "object",
  additionalProperties: false,
  required: ["name", "sets", "reps", "rest", "load", "why"],
  properties: {
    name: { type: "string" },
    sets: { type: "integer" },
    reps: { type: "string" },
    rest: { type: "string" },
    load: { type: "string" },
    why: { type: "string" },
  },
}

const PLANNING = `How to plan well (apply to every suggestion that adds or moves something):

TIMING
- context.busy lists every booked slot as "YYYY-MM-DD HH:MM-HH:MM title". A new or moved item's
  start-to-end range must not intersect ANY busy slot on that date. Check each one before choosing a
  time; if a slot clashes, pick another time or day. Leave at least 15 minutes either side of "fixed" items.
- Never schedule earlier today than context.time. Weekday sessions usually fit 18:00-20:30;
  weekends are more flexible. Prefer days in context.profile.days when given, and keep sessions
  within context.profile.minutes.
- Do not put two moderate or hard sessions (gym, run, dance class) on the same day. Keep the day
  after a dance class (wasClass) or a hard/very-hard log light. Respect recovery days (kind recovery).
- Leave space: no more than one exercise session a day, and not every day.
- Never pile missed or skipped sessions onto later days. Do not raise workload just because a week
  has passed; base it on recent logs (effort, concern) in context.recentLogs.
- In "details", the first line explains the timing choice in plain words (e.g. "Thursday 18:30:
  after work, and two days after your dance class"). Keep details to at most 3 short lines and the
  reply to 1-2 sentences, so answers stay quick.

PHASE
- context.phase is where they are in a running-gym-dance programme: its focus, the current week and
  its planned length. Shape exercise suggestions to that phase's focus (e.g. walks and gentle strength
  in the Restart phase; no structured running before "Beginner running"). Never jump ahead to a later
  phase's training. Near the end of a phase, it's fine to suggest checking readiness for the next one.

EXERCISE SPECIFICS
- Gym/strength: fill "workout" with 3-5 exercises. Each: exact exercise name (e.g. "Goblet squat"),
  sets (usually 2; 1 if energy is low or they are new), reps ("8-10" or "20-30 seconds"),
  rest ("60-90 seconds"), load, and a one-line why (what it strengthens and how it helps their goal).
- Load: if context.recentWorkouts has that exercise, start from the last weight used: repeat it, or
  add the smallest step (about 1-2 kg on dumbbells, 2.5 kg on machines) only if it felt easy or
  comfortable with no concern. If there is no record, never invent a number: say "a weight you could
  lift 3-4 more times; log it so next time can be specific". Bodyweight moves say "bodyweight".
- Cover a squat or leg press, a hip hinge or bridge, a push, a pull, and optionally calves or core,
  matched to context.profile.equipment. Runners benefit from calf and single-leg work.
- Walks and runs: put duration, effort ("conversational pace") and any run/walk intervals in
  "details". Only include running if their profile or logs show they can run a little.
- Dance: duration and one focus (technique, stamina, a routine) in "details".

WHY AND GOALS
- "why": one sentence on why this, now. Mention the goal it serves by name.
- "goalId": the id from context.goals it contributes to (Hackney Half, FairPlay Dance Camp,
  strength routine, money, creative goals), or null.
- "kind": gym | walk | run | dance | create | money | social | journal | reset | recovery, or null.

SAFETY
- If context.profile.concern is "yes" or a recent log has concern true, suggest only gentle
  options (easy walk, mobility) and recommend getting advice from a GP or physiotherapist.
- No medical claims, no calorie or weight-loss talk.`

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
            "effort",
            "concern",
            "kind",
            "goalId",
            "why",
            "details",
            "workout",
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
                "log_activity",
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
            effort: {
              type: ["string", "null"],
              enum: ["easy", "comfortable", "hard", "very-hard", null],
            },
            concern: nullable("boolean"),
            kind: {
              type: ["string", "null"],
              enum: [
                "gym",
                "walk",
                "run",
                "dance",
                "create",
                "money",
                "social",
                "journal",
                "reset",
                "recovery",
                null,
              ],
            },
            goalId: nullable("string"),
            why: nullable("string"),
            details: { type: ["array", "null"], items: { type: "string" } },
            workout: { type: ["array", "null"], items: workoutItem },
          },
        },
      },
    },
  },
}

const ASSIST_INSTRUCTIONS = `${TONE}

This is an ongoing chat. context.history holds the recent conversation (oldest first), including what
you suggested and whether the user saved it. Use it to understand follow-ups like "make it Thursday
instead" or "and add a walk too", and don't repeat suggestions they already saved.
The user speaks or types a message. Reply conversationally in "reply" (1-3 sentences) and add concrete
"actions" the app can apply after the user confirms, only when they help. Use the JSON context for today's date,
their plan items (with ids), and goals. Rules:
- Only propose actions the user asked for or that clearly help; 0-5 actions. For pure questions or
  chat, return an empty actions list and answer in "reply".
- Dates are YYYY-MM-DD, resolved relative to context.today. Times are 24h HH:MM. Duration in minutes.
- add_plan: title, date, time, duration, area, mode (fixed = appointment, flexible = can move,
  maybe = optional), kind, goalId, why, details. For a gym session also fill workout.
- move_plan / complete_plan: planId MUST be an id from context.plan; move_plan needs the new date (and time if given).
- add_journal: title + body in the user's own words (lightly tidied, never invented feelings).
- add_project: creative idea; title, body (note), nextAction.
- add_goal: title, area, scale, nextStep in nextAction, 0-4 milestone titles.
- add_transaction: amount in pounds as a positive number for money spent, title, category, date.
- add_gym_session: title, date, time, duration, goalId, why, details, and a full workout (exercises
  can stay null).
- log_activity: the user says they DID something ("I walked 20 minutes, it felt easy"). Set planId to
  the matching open item in context.plan (same day and kind, status planned or proposed) or null if none
  fits. Never point at an item whose status is complete. Include title (what they actually did),
  duration, effort (easy|comfortable|hard|very-hard) if stated, body = their note, and concern = true
  only if they mention pain, injury or feeling unwell. Never invent numbers they did not say.
- Plans with status "proposed" are suggestions the user has not accepted yet. Never pile missed or
  skipped sessions onto other days.
- "summary" is a one-line human description of the action shown to the user, including day and time.
- Set every field that does not apply to null.

${PLANNING}`

const coachSchema = {
  name: "gym_session",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "summary", "why", "goalId", "exercises"],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      why: { type: "string" },
      goalId: nullable("string"),
      exercises: {
        type: "array",
        items: {
          ...workoutItem,
          required: [...workoutItem.required, "cue"],
          properties: { ...workoutItem.properties, cue: { type: "string" } },
        },
      },
    },
  },
}

const COACH_INSTRUCTIONS = `${TONE}

Suggest one gentle, editable gym session for someone returning to movement. Return a short title,
a one-sentence summary (effort guidance like "finish with energy left"), "why" (one sentence on how
this session serves their goal), goalId (from context.goals, or null), and 3-5 exercises. Each
exercise has an exact name, sets, reps, rest, load, a one-line why, and a cue (one technique tip).
Respect the energy level and equipment: low energy means 3 exercises and one set.

${PLANNING}`

const stepsSchema = {
  name: "project_steps",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["steps"],
    properties: {
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "minutes"],
          properties: { title: { type: "string" }, minutes: { type: "integer" } },
        },
      },
    },
  },
}

const STEPS_INSTRUCTIONS = `${TONE}

Break a creative project (something the user is making) into 3-6 small, concrete next steps, in order.
- Each step is one sitting of 15-45 minutes, starts with a verb, and is specific to this project
  ("Write three possible opening lines", not "Work on writing").
- The first step is tiny and easy to start. The last step moves towards finishing or sharing.
- Skip anything already in the existing steps. "minutes" is a realistic estimate.`

const digestSchema = {
  name: "weekly_digest",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["headline", "thisWeek", "nextWeek", "encouragement"],
    properties: {
      headline: { type: "string" },
      thisWeek: { type: "string" },
      nextWeek: { type: "string" },
      encouragement: { type: "string" },
    },
  },
}

const DIGEST_INSTRUCTIONS = `${TONE}

Write a short weekly digest from the JSON context: what the user actually did this week, and what is
coming up next week.
- "headline": 3-8 words, warm and specific (e.g. "Two runs closer to Hackney").
- "thisWeek": 2-3 sentences. Name real things they did and which goals they fed (e.g. "You did two
  strength sessions for your Hackney Half goal and finished a step of London light"). Notice effort and
  courage honestly; if something they are nervous about is ahead, acknowledge that showing up anyway
  matters. If little happened, be kind: rest and quiet weeks count. Never invent anything not in the
  context, never use numbers that are not there.
- "nextWeek": 1-2 sentences on what is planned next week, gently; suggest one small focus if useful,
  in line with context.phase (e.g. "week 3 of base building").
- "encouragement": one short line, genuine and not cheesy, no exclamation-mark overload.
- No guilt, no streaks, no comparison, no calorie or body talk.`

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
    const context = JSON.stringify(body?.context ?? {}).slice(0, 20000)

    if (body?.task === "assist") {
      const text = await callResponses({
        instructions: ASSIST_INSTRUCTIONS,
        input: `Context:\n${context}\n\nRequest:\n${input}`,
        maxOutputTokens: 4000,
        schema: assistSchema,
      })
      return json(JSON.parse(text))
    }

    if (body?.task === "coach") {
      const text = await callResponses({
        instructions: COACH_INSTRUCTIONS,
        input: `Session details:\n${context}\n\nNotes from the user:\n${input}`,
        maxOutputTokens: 2500,
        schema: coachSchema,
      })
      return json(JSON.parse(text))
    }

    if (body?.task === "digest") {
      const text = await callResponses({
        instructions: DIGEST_INSTRUCTIONS,
        input: `Context:\n${context}\n\nRequest:\n${input}`,
        maxOutputTokens: 900,
        schema: digestSchema,
      })
      return json(JSON.parse(text))
    }

    if (body?.task === "steps") {
      const text = await callResponses({
        instructions: STEPS_INSTRUCTIONS,
        input: `Project:\n${context}\n\nRequest:\n${input}`,
        maxOutputTokens: 1200,
        schema: stepsSchema,
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
