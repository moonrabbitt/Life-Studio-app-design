# Life Studio — mobile exercise redesign

Prepared for Avika • 17 October 2026

## 1. Outcome

Build a clickable, mobile-first exercise experience inside the wider Life Studio React app. Design for a tired person asking:

> What am I doing today, how do I do it, and how do I record it?

The prototype must make today’s session immediately understandable, provide a genuinely usable guided workout flow, save manual progress locally, and connect exercise to the rest of Avika’s life without turning every concern into a top-level tab.

This is an exercise-first redesign, not an import of the old gym calendar. The old files are historical evidence only. Their Monday/Thursday gym, optional Friday session, Tuesday yoga with Pearl, Wednesday dance/social, Saturday run, and Sunday review may inform editable demonstration data, but are not Avika’s current confirmed routine or prescription.

## 2. Confirmed scope and boundaries

### Build now

- Four labelled destinations: **Today, Plan, Progress, My space**
- A conspicuous global microphone action, separate from navigation
- Three-step movement setup and first-week preview
- Today’s actionable workout overview
- Guided strength workout with set logging and rest timer
- Run/run–walk interval player with manual result
- Dance class/practice logging
- Finish reflection and correction/undo
- Combined weekly plan and safe rescheduling
- Weekly review with previewed adjustment
- Local persistence, workout resume, offline-capable PWA shell, and iPhone install guidance
- Wider Life Studio entry points for friends/routine, journal/writing, music/film projects, and finance/investing

### Real in the prototype

- Local microphone permission and audio recording
- Actual recording timer and audio-level meter derived from the microphone stream
- Pause/stop/discard controls
- Audio retained locally in memory or IndexedDB through review/error handling
- Manual text editing and all exercise/workout logging
- Local saves, resume behavior, timers while the app remains active, navigation, and deterministic rescheduling logic

### Simulated and clearly labelled

- Speech-to-text output
- AI interpretation/proposed actions
- Gateway processing and gateway-error responses
- Cloud save/sync and conflict-resolution demonstrations
- Calendar integration

The app must never claim simulated transcription, AI, cloud sync, calendar sync, GPS, background timers/audio, notifications, Apple Health, or bank connectivity is working. No credentials or secrets go into frontend code.

### Not in v1

- A medical or individually prescribed training programme
- Nutrition, calorie, weight-loss, or mandatory weigh-in targets
- Live coach chat
- Automatic progression without review
- Print-first layouts
- Actual backend, account, multi-device sync, external calendar, health, GPS, or banking integrations

## 3. Source findings that govern the rebuild

Do not reproduce the old implementation’s fixed 1,800px layout, 7–8px labels, repeated calendars, contradictory race dates, hard-coded calorie tables, stale week clamping, inconsistent gym-day definitions, in-memory-only chat, unsanitised `innerHTML`, or missing Netlify function assumption.

Use one source of truth for plan dates, planned sessions, logs, completions, coach/proposed actions, progress, and future export. Render all content through React text nodes; never inject user or simulated AI content as HTML.

No prior exercise weights, sets, reps, completion history, health readiness, or current class schedule exists. Demonstration data must be visibly labelled and must never imply it is Avika’s history.

## 4. Product structure

Use a fixed, safe-area-aware four-item mobile navigation:

1. **Today** — one next action, a compact rest-of-day view, quick update
2. **Plan** — seven-day selector and vertical agenda; optional compact month view
3. **Progress** — goal milestones, recent sessions, recovery pattern, weekly review
4. **My space** — journal, writing, music/film projects, friends/routine, finance/investing, preferences

The round microphone button floats above the navigation and opens capture; it is not a fifth destination.

Use a shallow route convention with React state plus browser history, avoiding a router dependency:

- `/` Today
- `/plan`
- `/progress`
- `/space`
- focused subflows use sheet/full-screen state and return to their origin

Back/forward, refresh, and interrupted-workout recovery must behave predictably. Avoid nested menus: My space is a simple grid/list of secondary areas, each opening a single focused panel.

## 5. First-use setup

Use three short, one-question-at-a-time steps with progress text and “Not sure” options.

### Step 1 — What feels comfortable now?

- current walk/run comfort: walking only, run–walk, continuous easy running, not sure
- current dance experience/frequency
- injury, pain, or health concern affecting movement: yes/no/prefer not to say

If a concern is reported, do not prescribe intensity. Show a neutral safety note and require the user to choose conservative planning/manual setup; advise appropriate professional guidance without diagnosis.

### Step 2 — What can realistically fit?

- available days and approximate session length
- existing classes, including editable day/time/place
- gym, home, or minimal equipment
- explicitly ask whether “Yoga with Pearl” still occurs; never assume Tuesday

### Step 3 — What would make it easier?

- preferred cue style: concise, encouraging, more detail
- shorter-day preference
- rank running, dance, strength, and general energy as current priorities

### Preview

Generate a conservative first-week demonstration from confirmed answers. Show all seven days together, with **Main plan**, **Optional**, and **Recovery** labels. Explain why sessions are placed where they are. Let the user edit before accepting. Unknown readiness always produces the gentler option.

The accepted week replaces demonstration status with a locally saved personal plan. Before acceptance, every screen carrying generated content says “Example plan — review before using.”

## 6. Today experience

Keep the first viewport operational:

- small greeting/date, no oversized decorative hero
- “Today · Strength/Run/Dance/Recovery”
- title, approximate duration, equipment/location
- one sentence connecting the session to running, dance, or everyday energy
- primary **Start workout/session**
- secondary **Short version**, **Move session**, **View exercises**
- actual exercise/session list visible before starting
- compact “Later today” agenda

If there is no planned session, show recovery as a valid plan and offer **Choose a gentle session** or **Update today**. If an in-progress workout exists, **Resume workout** replaces Start and returns to the exact exercise/set.

## 7. Guided strength workout

Strength content is new reviewed demonstration content, not imported prescription. Templates use movement categories such as squat/sit-to-stand, hinge, push, pull, calf work, and trunk control. Exact variant and volume come from setup/equipment choices and remain editable.

### Overview

- session purpose, estimated duration, equipment
- complete exercise list and short version
- plain-language definitions for sets, reps, effort, and rest
- source/review note for the template

### Player

Show one current exercise prominently:

- name, equipment, target sets/reps or duration
- concise setup and technique cues
- expandable external demonstration/source link
- alternatives and equipment-unavailable action
- previous recorded effort only when a real local prior log exists
- large weight and reps controls; weight can be blank/bodyweight
- **Complete set**, **Skip set**, **Swap exercise**
- rest timer after a completed set with visible countdown, pause, +30 sec, and skip
- compact exercise rail/list for jumping ahead or correcting a prior set

Autosave after every set/edit. Record only explicitly completed sets. Ending early preserves completed work and marks remaining sets unperformed, never complete. Resume restores session, exercise, set, entered values, elapsed active duration, and paused/rest state.

Timers are foreground-only. If the browser sleeps/backgrounds, recompute elapsed wall-clock time on return and show an honest “Timer caught up while Life Studio was in the background” message; do not promise background alerts.

### Finish

- summary of actual completed, substituted, and skipped work
- feeling: easier than expected / about right / too much
- separate pain or concern flag
- optional note
- save, brief confirmation, undo/correct

A pain flag stops automated progression suggestions and points to appropriate professional advice without diagnosis or alarmist language.

## 8. Run/run–walk flow

- session goal, expected duration, comfortable-effort explanation
- warm-up and cool-down instructions
- interval sequence when applicable
- player showing current interval, time remaining, next interval, total progress
- pause, resume, skip interval, and end controls
- foreground timing only; no GPS or background-audio claim
- completion supports manual actual duration and optional distance
- intended session and actual result remain separate records

The starting demonstration plan assumes returning/new-to-running unless onboarding establishes otherwise. It begins below the old 5–6 km baseline. It may use an NHS Couch to 5K-style three-session rhythm only when availability/recovery permit; it must not imply 30 minutes equals 5 km or that completing it creates half-marathon readiness.

## 9. Dance flow

Support two forms:

- **Booked class:** style/class, date/time, place, duration, expected intensity
- **Flexible practice:** style/focus, flexible day/window, expected duration

Logging captures actual duration, perceived effort, and “What I worked on.” Dance contributes to the same weekly load/recovery view as running and strength. It is never automatically displaced by running.

## 10. Combined planning and rescheduling

Plan shows a horizontally scrollable seven-day selector and a vertical agenda combining exercise, work, friends, creative time, and recovery.

Session priorities:

- **Main plan**
- **Optional**
- **Recovery**

Moving a session opens a bottom sheet with candidate slots. Before confirmation, show:

- conflicts with existing commitments
- adjacency to harder run/dance/strength days
- loss of recovery spacing
- whether another session should remain, move, or become optional

Offer a recommended gentler slot but allow an explicit override. Never cram missed sessions together, treat a miss as debt, increase mileage because a calendar week elapsed, or replace an existing class without preview and confirmation.

## 11. Progress, goals, and weekly review

### Goals

- **Hackney Half Marathon — 16 May 2027**
  - booking status is separate from target status
  - default booking status: **Not confirmed**
  - link to the official organiser page for the current entry check
  - do not claim availability from stale or build-time information
- **FairPlay Dance Camp 2027 — Dates TBC**
  - explicit action to add a confirmed date later
  - no countdown or relative scheduling until confirmed

### Planning phases

Use phases as explanatory guardrails, not guarantees:

1. Re-establish manageable movement from assessed baseline
2. Build easy aerobic capacity and restore strength with recovery
3. Use a suitable established beginner running progression when ready
4. Introduce a race-specific half-marathon block only if base and remaining time fit; otherwise prompt reassessment rather than compression
5. Taper/recover around the race and adapt dance preparation only after FairPlay dates are confirmed

The plan generator works from the current date, confirmed availability, actual logs, and goal date. Do not hard-code a 16-week block regardless of readiness.

### Weekly review

Summarise:

- planned versus actually completed activity
- energy/recovery check
- barriers and what helped
- pain/concern flags

Suggest **repeat**, **make gentler**, or **progress slightly**, with one-sentence reasoning and a full next-week preview before save. The user can edit or reject. Unknown data or concern defaults to repeat/gentler, never progression.

Advanced pace, volume, and trend charts are secondary and hidden until enough real data exists. No streaks, calorie scores, seven-day exercise score, or guilt language.

## 12. Voice capture

### Real local recording state machine

`idle → requesting-permission → recording ↔ paused → stopped/review`

Error branches:

- permission denied
- no input device
- browser unsupported
- recording interrupted

Recording behavior:

- request permission only after the explicit mic tap
- do not open the keyboard while recording
- show a real elapsed timer and audio-level feedback from Web Audio analyser data
- show obvious pause, stop, and discard controls
- stop media tracks when capture closes
- preserve the blob through transcript/gateway errors and until save/discard
- revoke object URLs and delete transient audio after confirmed save/discard unless the user explicitly chooses local retention

### Simulated integration state machine

`audio review → simulated processing → editable demonstration transcript → proposed actions → confirm/save`

Provide an explicit prototype notice:

> Audio capture is real and stays on this device. Transcription and AI suggestions are simulated because the Life Studio gateway is not connected.

Include clickable gateway-error and retry states. The error state preserves audio, offers playback/download where supported, retry demonstration, and typing.

Seed transcript examples only after the user chooses a clearly labelled **Use demo transcript** action:

- “I did two sets of ten on the leg press at 30 kilos.”
- “I finished today’s lower-body session, but skipped the last exercise.”
- “Dance was harder than expected; move tomorrow’s gym session.”
- “I only have twenty minutes today.”

Proposed actions are editable and validated. Never invent missing weights, reps, dates, or completion. Matching a voice update to an existing planned session uses the plan ID and previews that match, avoiding duplicate workout logs.

Manual logging must remain fully functional without recording or simulated AI.

## 13. Wider Life Studio continuity

My space keeps the broader app visible without building all areas to exercise-player depth:

- **Journal** — saved local entries and gentle prompts
- **Writing**
- **Music & film projects**
- **Friends & routine**
- **Finance & investing**
- **Preferences and data**

These are clickable lightweight panels with representative local interactions, not dead cards. Exercise may link to relevant commitments or project costs, but health notes, journals, and finances remain separate data domains. Do not pass private cross-domain content into any simulated AI context.

Use the transparent Samoyed primarily in Journal/recovery/empty states. Use the creative-room image in My space and the dance-pavilion image in dance/progress contexts, preserving aspect ratios and placing text on calm solid surfaces.

## 14. Visual design

Before implementation, invoke the repository’s design-system procedure.

- design at 390px first, then verify 320px and 430px
- warm cream paper base, sage/moss controls, honey light, restrained peach, deep ink text
- expressive serif only for short headings; clear sans-serif around 16px for body/forms
- subtle paper texture and botanical shadow, never behind dense workout controls
- one primary action per state, reachable by thumb
- minimum 44×44px controls
- no decorative badges or motivational paragraphs competing with instructions
- no emoji icons; use one consistent icon library
- no horizontal page scrolling
- desktop becomes a composed wider layout, not a stretched phone
- reduced motion, visible keyboard focus, AA contrast, safe-area and keyboard awareness

## 15. Data contracts and one source of truth

Define explicit TypeScript records:

### `Goal`

- `id`, `name`, `date | null`, `dateStatus: confirmed | tbc`
- `bookingStatus: unknown | notBooked | booked`
- `officialUrl`, milestones

### `PlanSession`

- `id`, `dateTime`, `timeZone`, `type`
- `priority: main | optional | recovery`
- `plannedDuration`, `templateVersion`
- `status: planned | inProgress | completed | skipped | moved`
- optional class/place and source session ID when moved

### `ExerciseTemplate`

- `id`, `name`, movement category, equipment
- instructions, alternatives, source link
- planned sets/reps/time, default rest, version

### `WorkoutDraft` / `WorkoutLog`

- associated `planSessionId` when applicable
- actual start/end/duration
- per-set weight/reps/duration and completion timestamp
- substitutions/skips
- perceived effort, pain/concern flag, note
- draft/player/rest-timer state for resume

### `Review`

- week start, energy/recovery, barriers
- proposed adjustments and reasoning
- confirmation status

Also define `OnboardingProfile`, `DanceLog`, `RunLog`, `LifeEvent`, `VoiceCaptureDraft`, and lightweight records for My space.

Use ISO timestamps with explicit timezone at storage boundaries, `Intl` for display, and integer pence for money. Planned and actual fields never overwrite each other.

## 16. Local persistence and simulated sync

Use:

- `localStorage` for versioned structured app state and drafts
- IndexedDB for transient recorded audio because blobs do not belong in localStorage
- a guarded migration/version layer and corrupt-data recovery notice
- debounced writes plus immediate writes after set completion and major state transitions

Suggested modules:

- `src/types.ts`
- `src/data/demo.ts`
- `src/hooks/useLifeStudioState.ts`
- `src/lib/storage.ts`
- `src/lib/audioStore.ts`
- `src/lib/planGenerator.ts`
- `src/lib/reschedule.ts`
- `src/lib/voiceProposal.ts`
- `src/lib/dates.ts`

Show cloud conflict and pending-sync states only in a dedicated prototype scenario. Label them **Demo sync state**. Demonstrate preserving both versions and choosing/merging, but do not attach these states to real local saves or imply cloud persistence.

## 17. Component map

- `src/App.tsx` — shell, shallow routing, global mic, prototype scenario control
- `src/components/AppShell.tsx`
- `src/components/BottomNav.tsx`
- `src/components/VoiceCaptureSheet.tsx`
- `src/components/ui/*` — Button, Card, Sheet/Dialog, SegmentedControl, Timer, Field
- `src/features/onboarding/MovementSetup.tsx`
- `src/features/today/TodayView.tsx`
- `src/features/plan/PlanView.tsx`
- `src/features/progress/ProgressView.tsx`
- `src/features/space/MySpaceView.tsx`
- `src/features/workout/WorkoutOverview.tsx`
- `src/features/workout/StrengthPlayer.tsx`
- `src/features/workout/RunPlayer.tsx`
- `src/features/workout/DanceLogger.tsx`
- `src/features/workout/FinishReflection.tsx`
- `src/features/review/WeeklyReview.tsx`
- `src/index.css` — Tailwind import first, fonts/tokens, texture, focus, safe-area and motion rules
- `public/assets/*` — optimized supplied artwork and PWA icons
- `public/manifest.webmanifest`
- `public/sw.js`

Add only focused dependencies:

- `lucide-react` for consistent icons
- a tiny IndexedDB helper only if native IndexedDB makes blob/error handling materially less reliable; otherwise keep it native

No charting, animation, router, form, AI, or calendar library is necessary for this prototype.

## 18. PWA and offline behavior

- manifest with standalone mode, cream background, moss theme, and 192/512 maskable icons
- iOS metadata, Apple touch icon, and Share → Add to Home Screen guidance
- minimal service worker caches versioned first-party app shell/assets
- previously opened app shell and structured local records remain available offline
- workout logging, timers, plan viewing, and local saves work offline
- official source/demo links display an offline message when unavailable
- simulated transcription explicitly remains a demo whether online or offline
- no claim of cloud backup; removing browser/site data removes local records

## 19. Accessibility, safety, and failures

- semantic landmarks, heading order, labelled controls/forms, accessible dialogs
- focus trap/initial focus/Escape/focus return for sheets and full-screen flows
- screen-reader announcements for timer milestones, saves, errors, and undo without constant countdown chatter
- color is never the only signal for priority, completion, pain, or conflict
- all player actions keyboard-operable
- reduced motion support
- invalid values remain editable and are never silently coerced
- microphone denial never shows listening animation
- audio interruption preserves recoverable state where the browser permits
- storage failures keep the in-memory workout and offer export/copy of a plain summary
- service-worker failure never blocks app use
- delete/reset requires confirmation

## 20. Required clickable scenarios

Provide an unobtrusive “Prototype scenarios” entry under Preferences so reviewers can reset and enter each state without contaminating normal data.

1. **First use:** setup → conservative first-week preview → edit → accept
2. **Strength:** Today → overview/list → set logging → rest timer → next/correct → finish → saved
3. **Run:** instructions → warm-up → interval active/paused → end → manual actual result
4. **Dance:** booked class/practice log → weekly workload update
5. **Reschedule:** Plan → move → conflict/recovery impact → confirm
6. **Voice:** permission → real recording/level/timer → demo transcript edit → proposed actions → save
7. **Voice error:** denied permission and simulated gateway failure, both with typing/recovery
8. **Weekly review:** summary → gentler proposal/reason → preview → accept
9. **Interrupted:** resume in-progress strength workout at exact set
10. **Offline:** cached shell, local save, unavailable external-link message
11. **Empty/loading/paused/conflict:** directly reachable review states

## 21. Verification

Use the already-running development server; do not start another. After implementation:

1. `pnpm run format`
2. `pnpm run build`

Then manually verify at 320px, 390px, 430px, tablet, and desktop:

- four destinations, browser back/forward, refresh, safe areas, and no accidental horizontal overflow
- setup answers actually change the preview; unknown answers stay conservative
- Today answers what/why/how before Start
- strength logging saves only completed sets and resumes exactly
- rest/run timers survive pause and honestly reconcile background time
- actual results stay separate from intended session
- dance contributes to weekly load
- moving a session previews conflicts/recovery and never changes another session silently
- weekly change is previewed and requires confirmation
- missed sessions create no debt or automatic mileage
- Hackney target is 16 May 2027, booking remains unconfirmed until explicitly changed, and official link is present
- FairPlay remains Dates TBC until explicitly confirmed
- local recording has real permission/timer/level behavior; media tracks stop on close
- transcription/AI/cloud/calendar states are visibly marked simulated
- denied permission and gateway error never lose typed input or recoverable audio
- voice completion matches an existing plan session and does not double-count
- journals, health notes, and finance remain isolated from simulated AI context
- reload/offline behavior, local reset, corrupt data handling, and service-worker failure are honest
- keyboard-only and screen-reader flows, focus return, reduced motion, and contrast
- no user/simulated AI text is injected with `innerHTML`
- no console errors across required scenarios

## 22. Acceptance criteria

The redesign succeeds when Avika can:

1. Open the app tired and immediately understand today’s session.
2. See exactly what to do before arriving at the gym.
3. Start and record a set with minimal decisions.
4. Pause, leave, and reliably resume.
5. Log a run or dance session as it actually happened.
6. Move a session without accidentally harming recovery or displacing dance.
7. Review a gentler next week before accepting it.
8. Use manual logging without AI and understand which voice steps are real versus simulated.
9. Install the app on an iPhone and continue local workout logging offline.
10. Still reach friends/routine, journal, writing, creative projects, and finance from the wider Life Studio.

## 23. Implementation order

1. Invoke the design-system procedure; establish tokens, fonts, optimized supplied imagery, icons, and responsive shell.
2. Add domain types, demonstration data labels, storage/versioning, IndexedDB audio store, and shallow routing.
3. Build first-use setup and conservative first-week generation/preview.
4. Build Today and workout overview.
5. Build strength player, autosave/resume, rest timing, and reflection.
6. Build run player and dance logger.
7. Build combined Plan, conflict-aware rescheduling, Progress, and weekly review.
8. Build real local audio capture plus explicitly simulated transcript/proposal/error scenarios.
9. Add lightweight My space panels and privacy boundaries.
10. Add PWA/offline/install behavior and prototype scenario controls.
11. Complete accessibility, responsive polish, formatting, build, and the full clickable-flow acceptance pass.
