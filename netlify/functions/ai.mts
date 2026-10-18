import type { Config } from "@netlify/functions"
import {
  HttpError,
  assertPasscode,
  assertSameOrigin,
  callResponses,
  errorResponse,
  json,
} from "../lib/gateway"
import { webSearch, type WebResult } from "../lib/search"

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

ABOUT THEM
- context.aboutMe is what they told you in their own words: long-term health goals, body (injuries,
  conditions, what feels good or bad), how they move now, equipment, the shape of their week, energy
  patterns, anything else. context.notesForStudio are extra notes they asked you to remember. Tailor
  every suggestion to these: avoid or adapt movements their body notes flag, pick times that suit
  their energy, and say in "why" how it serves their long-term health goals where it does.

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
- Look at the shape of the whole fortnight (context.recentLogs behind, context.plan ahead): after two
  or three active days in a row, the next day is rest or recovery; spread hard days out; and keep
  the total sensible for their phase.
- Never pile missed or skipped sessions onto later days. Do not raise workload just because a week
  has passed; base it on recent logs (effort, concern) in context.recentLogs.
- In "details", the first line explains the timing choice in plain words (e.g. "Thursday 18:30:
  after work, and two days after your dance class"). Keep details to at most 3 short lines and the
  reply to 1-2 sentences, so answers stay quick.

PHASE
- context.phase is where they are in their training plan (context.phase.trainingFor says what for): its focus, the current week and
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
- "kind": gym | walk | run | dance | create | money | social | journal | reset | recovery. ANY
  movement item (area move) MUST have a kind: gym for strength or a gym visit (and fill "workout"),
  walk, run, dance, or recovery for stretching, yoga or mobility. Use null only for non-movement items
  that fit none of these.
- Before adding, check context.plan for something similar on the same day (e.g. a gym session when
  one is already planned). If there is one, don't add a second: suggest moving or changing it instead.

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
                "set_aside_plan",
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
- move_plan / complete_plan / set_aside_plan: planId MUST be an id from context.plan; move_plan needs
  the new date (and time if given). set_aside_plan lets an item go (it waits on the Set aside shelf,
  no catching up).
- SOMETHING CAME UP: when the user says plans changed ("working late Thursday", "I'm ill", "friends
  are visiting this weekend", "I'm exhausted"), look at every plan item affected (in context.plan,
  with ids) and propose the reshuffle as several actions: move_plan for what still matters to a day and
  time that fits (check context.busy, keep rest days after hard ones, never two hard sessions on one
  day, never stack missed sessions), and set_aside_plan for optional or less important items rather than
  cramming them in. Fixed commitments stay unless they say otherwise. If they're ill or exhausted,
  prefer setting things aside and suggest rest. In "reply", say plainly what moves where and why.
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
    required: ["title", "summary", "why", "goalId", "duration", "details", "exercises"],
    properties: {
      duration: { type: "integer" },
      details: { type: "array", items: { type: "string" } },
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

Plan ONE session of kind context.session.kind on context.session.date (a gym, run, walk or dance
session the user is adding or already has in their calendar). Base it on the whole picture, not just
this day:
- The week around it: context.recentLogs (what they actually did, with effort) and context.plan (what
  else is planned). If they have trained hard two or three days running, or a hard session or dance
  class is the day before or after, make this one lighter and say so; if they have rested for a while,
  start gently. Their training phase (context.phase), goals, About me (body, energy, health goals) and
  notes always apply.
Return: a short title; a one-sentence summary with effort guidance ("finish with energy left");
"why" (how this session serves their goal, naming it, and how it fits this week); goalId (from
context.goals, or null); "duration" in minutes (keep within context.session.duration if given);
"details": 2-4 short, concrete lines.
- gym: 3-6 "exercises", each with an exact name, sets, reps, rest, load (from their recent workouts if
  there; otherwise "a weight you could lift 3-4 more times" or "bodyweight"), a one-line why and a cue
  (one technique tip). Adapt to their body notes and equipment. Low energy means 3 exercises, one set.
  "details" covers the warm-up and cool-down.
- run or walk: "exercises": []. "details" gives the exact shape: total time, any run/walk intervals
  (e.g. "5 min brisk walk, then 6 × (1 min run, 90 s walk), 5 min walk"), effort by feel
  ("conversational pace"), and where it sits in their progression (from recent runs and their phase:
  no structured running before their plan or logs show they can run a little). For a race goal, keep
  long-run growth gradual.
- dance: "exercises": []. "details" gives duration, one focus (technique, stamina, a routine) and a
  warm-up.

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

const replanSchema = {
  name: "training_plan",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "goalTitle", "cautions", "phases", "week"],
    properties: {
      summary: { type: "string" },
      goalTitle: { type: "string" },
      cautions: { type: "string" },
      phases: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "weeks", "body", "ready"],
          properties: {
            title: { type: "string" },
            weeks: { type: "integer" },
            body: { type: "string" },
            ready: { type: "string" },
          },
        },
      },
      week: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["dayOffset", "title", "kind", "time", "duration", "intensity", "details", "optional", "workout"],
          properties: {
            workout: { type: "array", items: workoutItem },
            dayOffset: { type: "integer" },
            title: { type: "string" },
            kind: { type: "string", enum: ["gym", "walk", "run", "dance", "recovery", "journal", "reset"] },
            time: nullable("string"),
            duration: { type: "integer" },
            intensity: { type: "string", enum: ["light", "moderate", "hard"] },
            details: { type: "array", items: { type: "string" } },
            optional: { type: "boolean" },
          },
        },
      },
    },
  },
}

const REPLAN_INSTRUCTIONS = `${TONE}

The user wants a new training plan because their purpose has changed. Write a plan for the purpose
in the request, using the JSON context (today, training answers, recent activity, other goals,
the current plan they are leaving, busy calendar slots).
- "phases": 3-6 phases in order. "title" is 2-4 words. "weeks" is realistic; if context.targetDate is
  set, the phases before the last one must finish by that date (count weeks from context.today), and
  the last phase is the event itself plus recovery or what comes after. Without a date, the plan builds
  steadily and the last phase is about keeping it going. "body" is 1-2 sentences on what happens in
  this phase. "ready" is one sentence on how they know they are ready to move on (based on how it feels
  and their logs, never on a week passing).
- Start where they actually are (training answers and recent logs), not where they wish they were.
  The first phase is gentle and repeatable.
- "week": the typical week for phase 1 only, 3-7 sessions. dayOffset 0 = Monday … 6 = Sunday. Respect
  context.profile.days and context.profile.minutes when given; keep a rest or recovery day between hard
  days; put a short weekly check-in (kind "journal", 10 minutes) on Sunday. "time" is "HH:MM" only if a
  time clearly suits them, otherwise null. "details" are 2-4 short concrete lines (what exactly to do,
  e.g. "3 sets of 8 goblet squats, a weight that leaves 2-3 reps in reserve"). Mark extras "optional".
- Keep anything from their other goals that still matters (for example dance) as part of the week,
  unless the request says to drop it.
- Things they already do on a set day (a regular class, a club, a standing plan, anything in "Keep in
  my week" or already repeating in context.plan) stay on EXACTLY that day and time. Do not move them
  and do not add a second one; count them in the week's load (e.g. yoga is recovery or mobility, a
  dance class is a hard day) and plan the other sessions around them.
- Plan the WHOLE week, all seven days: every day that has no session and no commitment gets an entry
  that says what that day is for: kind "recovery", title "Rest day" (duration 5, details like "Full
  rest: sleep, eat well, an easy stroll if you fancy it") or "Recovery: gentle mobility" (10-20 min,
  light, with 2-3 named stretches or mobility moves), optional true. Put recovery after hard days.
  The user can still add extra sessions on top.
- Every "gym" session MUST have "workout": 4-6 exercises, each with an exact name ("Goblet squat",
  "Seated cable row"), sets (2 at the start; 1 if they are new or low on energy), reps ("8-10" or
  "20-30 seconds"), rest ("60-90 seconds"), load ("bodyweight", or "a weight you could lift 3-4 more
  times" when there is no record, or the weight from their recent workouts), and a one-line why that
  names what it strengthens and the goal it helps. Cover legs (squat or leg press), a hinge or bridge,
  a push, a pull and core, matched to their equipment and adapted to their body notes (e.g. box squats
  or leg press instead of deep squats or lunges for sore knees). Different gym days in the week use
  different exercises or emphasis. Non-gym sessions have "workout": [].
- "summary": 2-3 warm sentences on the shape of the plan and why it suits them now.
- "goalTitle": a short goal title for the purpose, in their words where possible.
- "cautions": one sentence of honest caveats (e.g. tight timelines, pain needing a professional), or "".
- No calorie, weight-loss or body-shape targets.`

const turnSchema = {
  name: "onboarding_turn",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "followUp", "chips"],
    properties: {
      reply: { type: "string" },
      followUp: nullable("string"),
      chips: { type: "array", items: { type: "string" } },
    },
  },
}

const TURN_INSTRUCTIONS = `${TONE}

You are getting to know the user in a short setup conversation, to set up their Life Studio.
The context has the topic, the question you asked, the conversation so far, and how many follow-ups
you have already asked on this topic. The request is their answer.
- "reply": 1-2 short sentences that show you heard the specifics (name a detail they gave). Warm, not
  gushing, no exclamation marks, no advice yet. If they skipped or said nothing to add, just accept it
  kindly.
- "followUp": ONE short question only if something important for planning safely or well is unclear
  and context.followUpsAsked is 0 (e.g. which knee and what makes it worse; the date of an event; how
  many hours they work). Otherwise null. Never ask about weight or calories.
- "chips": if followUp is set, 2-4 short likely answers (max 5 words each), otherwise [].`

const area = { type: "string", enum: ["reflect", "create", "connect", "move", "money", "home"] }

const setupSchema = {
  name: "space_setup",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["welcome", "aboutMe", "priorities", "density", "profile", "goals", "commitments", "training", "routines"],
    properties: {
      welcome: { type: "string" },
      aboutMe: {
        type: "object",
        additionalProperties: false,
        required: ["workingTowards", "healthGoals", "body", "movementNow", "equipment", "week", "energy", "other"],
        properties: {
          workingTowards: { type: "string" },
          healthGoals: { type: "string" },
          body: { type: "string" },
          movementNow: { type: "string" },
          equipment: { type: "string" },
          week: { type: "string" },
          energy: { type: "string" },
          other: { type: "string" },
        },
      },
      priorities: { type: "array", items: area },
      density: { type: "string", enum: ["one", "few", "full"] },
      profile: {
        type: "object",
        additionalProperties: false,
        required: ["equipment", "gymExperience", "days", "minutes", "concern", "concernNote"],
        properties: {
          equipment: { type: "string", enum: ["gym", "machines", "dumbbells", "home", "not-sure"] },
          gymExperience: { type: "string", enum: ["new", "some", "confident", "not-sure"] },
          days: { type: "array", items: { type: "string", enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] } },
          minutes: { type: "string", enum: ["", "20", "30", "45", "60"] },
          concern: { type: "string", enum: ["no", "yes", "not-sure"] },
          concernNote: { type: "string" },
        },
      },
      goals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "area", "scale", "date", "why", "milestones"],
          properties: {
            title: { type: "string" },
            area,
            scale: { type: "string", enum: ["small", "big"] },
            date: nullable("string"),
            why: { type: "string" },
            milestones: { type: "array", items: { type: "string" } },
          },
        },
      },
      training: {
        type: "object",
        additionalProperties: false,
        required: ["include", "purpose", "targetDate", "summary", "phases", "week"],
        properties: {
          include: { type: "boolean" },
          purpose: { type: "string" },
          targetDate: nullable("string"),
          summary: { type: "string" },
          phases: replanSchema.schema.properties.phases,
          week: replanSchema.schema.properties.week,
        },
      },
      commitments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "kind", "area", "dayOffset", "frequency", "time", "duration"],
          properties: {
            title: { type: "string" },
            kind: { type: "string", enum: ["gym", "walk", "run", "dance", "recovery", "social", "create", "none"] },
            area,
            dayOffset: { type: "integer" },
            frequency: { type: "string", enum: ["weekly", "fortnightly"] },
            time: nullable("string"),
            duration: { type: "integer" },
          },
        },
      },
      routines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "frequency", "time", "duration"],
          properties: {
            title: { type: "string" },
            frequency: { type: "string", enum: ["daily", "weekdays", "weekly"] },
            time: nullable("string"),
            duration: { type: "integer" },
          },
        },
      },
    },
  },
}

const SETUP_INSTRUCTIONS = `${TONE}

From the setup conversation in the context, set up the user's Life Studio. Use only what they said;
where they skipped something, stay gentle and general rather than inventing details.
- "welcome": 2-3 sentences reflecting back what you heard and the shape of what you've set up.
- "aboutMe": their own details in short plain notes (second person is fine: "Left knee aches on
  stairs"). "" where they said nothing. This is what Studio will remember, so keep specifics: dates,
  injuries, what feels good or bad, work hours, energy patterns, equipment.
- "priorities": 1-3 areas they want more room for. "density": "one" if they want very light days,
  "full" if they like full days, else "few".
- "profile": training answers inferred from the conversation ("not-sure" when unclear; concern "yes"
  for pain, injury or a health condition that affects exercise, with concernNote saying what).
- "goals": 1-5 goals in their words. "big" for things that take months (an event, a long-term health
  goal), "small" for things done in a few weeks. "date" YYYY-MM-DD only if they gave one. "why" is
  their reason in one line. "milestones": 2-4 concrete, celebratable steps in order; for an event,
  the last milestone is the event itself.
- "commitments": things they ALREADY do regularly on a set day: classes (yoga with their sister on
  Tuesdays, a dance class), clubs, standing plans. dayOffset 0 = Monday … 6 = Sunday, the exact day they
  said; time "HH:MM" if they gave one, else null; duration in minutes (60 if unsaid). kind "recovery" for
  yoga, pilates or stretching, "dance" for dance classes, "social" for plans with people, "none" if not
  movement. These go into their calendar on that day every week; never put them in training.week too.
- "training": include true if they want to move more or train for something. Then write a plan like a
  careful coach: 3-6 phases (title 2-4 words, realistic weeks, body, ready = how they'll know they're
  ready to move on, from how it feels and their logs) that start where they actually are, respect
  their body notes, and fit their target date if any (phases before the last finish by it). "week" is
  phase 1's typical week: 3-7 sessions on their realistic days and session length, planned around
  their commitments (never on top of them or duplicating them; count them in the week's load), recovery
  between hard days, a rest or recovery entry on every day without a session or commitment (kind
  "recovery", optional, "Rest day" or "Recovery: gentle mobility" with named moves), a 10-minute Sunday
  check-in (kind "journal"), concrete details, adapted to any
  injury or energy pattern they mentioned. Every gym session has a full "workout" (see the gym rule
  below). If include is false, use
  empty strings, null and empty arrays.
- "routines": 0-4 small home or self-care routines they mentioned or would clearly help (e.g. a
  Sunday reset). time "HH:MM" or null.
- No calorie, weight-loss or body-shape targets. Pain or a condition means gentler starts and a note
  to check with a professional, never a diagnosis.
- Every "gym" session MUST have "workout": 4-6 exercises, each with an exact name ("Goblet squat",
  "Seated cable row"), sets (2 at the start; 1 if they are new or low on energy), reps ("8-10" or
  "20-30 seconds"), rest ("60-90 seconds"), load ("bodyweight", or "a weight you could lift 3-4 more
  times" when there is no record, or the weight from their recent workouts), and a one-line why that
  names what it strengthens and the goal it helps. Cover legs (squat or leg press), a hinge or bridge,
  a push, a pull and core, matched to their equipment and adapted to their body notes (e.g. box squats
  or leg press instead of deep squats or lunges for sore knees). Different gym days in the week use
  different exercises or emphasis. Non-gym sessions have "workout": [].`

const nextWeekSchema = {
  name: "next_week",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["review", "phaseReady", "phaseNote", "week"],
    properties: {
      review: { type: "string" },
      phaseReady: { type: "boolean" },
      phaseNote: { type: "string" },
      week: replanSchema.schema.properties.week,
    },
  },
}

const NEXT_WEEK_INSTRUCTIONS = `${TONE}

Write next week of the user's training plan (the week starting context.weekStart), building on what
they ACTUALLY did. context.lastWeeks lists their recent plan sessions with status (complete,
let-go = skipped, planned/proposed = not done), effort, concern (pain), notes and logged sets.
context.template is the current typical week. context.phase is where they are (week n of about N,
its focus and how they know they're ready). context.goal is the goal it builds towards and its next
milestone. context.commitments are fixed things already in that week.

Progress like a careful coach: start small, build gradually.
- A session done and felt easy or comfortable with no pain: progress ONE small thing (one more rep
  within the range, then a set, then the smallest weight step: 1-2 kg dumbbells, 2.5 kg machines;
  runs/walks +5 minutes or one more interval; never more than about 10% more total time a week).
- Felt hard or very hard: repeat it as it was. Pain or a concern: ease off that movement (swap or
  reduce) and suggest checking with a professional if it persists. Skipped or missed: repeat, never
  add the missed work on top. Mostly missed week: make next week a bit smaller, kindly.
- Use logged weights (context.recentWorkouts) for loads. Keep the same rhythm of days unless the logs
  show a day keeps getting skipped (then suggest a better day). Commitments stay exactly where they
  are; rest and recovery days stay after hard days; every day without a session or commitment has a
  rest or recovery entry; every gym session has a full "workout".
- Each session's first detail line says how it builds on last week, concretely ("Last week 2×8 at
  10 kg felt comfortable → 2×10 this week"; "New: first run-walk intervals"). Its "why" names how it
  moves them towards context.goal's next milestone.
- "review": 2-3 warm, honest sentences: how last week went (real things from the logs, no invented
  numbers) and what changes next week and why.
- "phaseReady": true only if the logs clearly meet context.phase.readyWhen; "phaseNote" says why, or
  what to keep doing. Never move them on yourself.`

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
      search?: boolean
    } | null
    const input = body?.input?.trim()
    if (!input) throw new HttpError(400, "Please say or type something first.")
    if (input.length > MAX_INPUT) throw new HttpError(413, "That is a little long. Try a shorter request.")
    const context = JSON.stringify(body?.context ?? {}).slice(0, 20000)

    if (body?.task === "assist") {
      // "Search the web" in chat: look it up first, then answer from those pages.
      const sources: WebResult[] = body.search ? await webSearch(input) : []
      const web = sources.length
        ? `\n\nWeb results (searched just now; answer from these, name the source you used, and say if they don't answer it):\n${JSON.stringify(sources)}`
        : body.search
          ? "\n\nA web search found nothing useful; say so plainly."
          : ""
      const text = await callResponses({
        instructions: ASSIST_INSTRUCTIONS,
        input: `Context:\n${context}${web}\n\nRequest:\n${input}`,
        maxOutputTokens: 4000,
        schema: assistSchema,
        timeoutMs: body.search ? 40000 : 25000,
      })
      return json({ ...JSON.parse(text), sources: sources.map(({ title, url }) => ({ title, url })) })
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

    if (body?.task === "replan") {
      const text = await callResponses({
        instructions: REPLAN_INSTRUCTIONS,
        input: `Context:\n${context}\n\nRequest:\n${input}`,
        maxOutputTokens: 5000,
        schema: replanSchema,
        timeoutMs: 50000,
      })
      return json(JSON.parse(text))
    }

    if (body?.task === "turn") {
      const text = await callResponses({
        instructions: TURN_INSTRUCTIONS,
        input: `Context:\n${context}\n\nTheir answer:\n${input}`,
        maxOutputTokens: 600,
        schema: turnSchema,
      })
      return json(JSON.parse(text))
    }

    if (body?.task === "setup") {
      const text = await callResponses({
        instructions: SETUP_INSTRUCTIONS,
        input: `Context:\n${context}\n\nRequest:\n${input}`,
        maxOutputTokens: 8000,
        schema: setupSchema,
        timeoutMs: 50000,
      })
      return json(JSON.parse(text))
    }

    if (body?.task === "nextweek") {
      const text = await callResponses({
        instructions: NEXT_WEEK_INSTRUCTIONS,
        input: `Context:\n${context}\n\nRequest:\n${input}`,
        maxOutputTokens: 6000,
        schema: nextWeekSchema,
        timeoutMs: 50000,
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
