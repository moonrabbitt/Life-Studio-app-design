# Life Studio — balanced local-first prototype

Prepared for Avika

## 1. Product outcome

Build an exhibition-quality, mobile-first personal life app that helps Avika shape an independent, satisfying life across the things that matter together:

- daily rhythm and practical plans
- reflection and journaling
- creative work
- friendships and connection
- movement and physical confidence
- money and personal stability
- home, rest, and ordinary life maintenance

Exercise is one part of Life Studio, not the primary product, default lens, or measure of progress. Running, dance, and strength can have purpose-built tools, but they must sit alongside the other life areas as peers. The product should feel like opening a calm personal studio: a place to notice what matters, choose a manageable next step, and see a life taking shape over time.

The prototype must be genuinely interactive and local-first rather than a static mockup. It should retain data on the device, support its primary flows offline after a successful load, install to an iPhone home screen, and describe simulated or unavailable capabilities honestly.

## 2. Guiding product principles

1. **A whole life, not a performance dashboard.** No single area dominates Today, navigation, setup, or progress.
2. **Useful on low-energy days.** The first screen makes the next manageable action clear without demanding a complete life audit.
3. **Plans are adjustable, not moral obligations.** Missed or moved items create no debt, guilt, streak loss, or red warning state.
4. **Depth where it earns its place.** Movement may have a workout player, writing may have autosave, and money may use envelopes; every area gets the interaction it needs rather than identical cards.
5. **Manual control always works.** Voice and simulated AI can accelerate capture but never become prerequisites.
6. **Private and honest.** Data stays on the device; simulated transcription, AI, sync, and integrations are clearly labelled.
7. **No invented personal facts.** Demonstration content is labelled, editable, and never presented as Avika's actual history.

## 3. Confirmed scope and capability boundaries

### Build now

- Four labelled navigation destinations: **Today, Plan, Progress, My space**
- A global microphone action separate from navigation
- A three-step whole-life setup and editable first-week preview
- A balanced Today view that blends life areas
- A unified weekly plan with conflict-aware rescheduling
- A whole-life weekly review and goal view
- Functional My space areas for Journal, Projects, People, Movement, Money, and Home & routine
- Purpose-built movement flows for strength, run/run-walk, and dance
- Real local microphone recording with explicitly simulated transcription and AI proposals
- Fully functional manual capture and editing
- Local persistence, interrupted-flow recovery, offline-capable PWA shell, and iPhone install guidance

### Real in the prototype

- Local microphone permission and audio recording
- Recording timer, pause/stop/discard, playback, and an audio-level meter derived from the microphone stream
- Typed capture and all manual forms
- Local saves, edits, deletes, undo, and deterministic conflict checks
- Journal autosave
- Strength set logging and foreground rest timer
- Run/run-walk foreground interval timing
- Dance, connection, project, routine, and finance logging
- Browser back/forward and refresh-safe top-level navigation

### Simulated and visibly labelled

- Speech-to-text output
- AI interpretation and proposed actions
- Gateway processing and gateway-error responses
- Cloud save/sync and conflict-resolution demonstrations
- External calendar integration

The app must never imply that simulated transcription, AI, cloud sync, calendar sync, GPS, background audio/timers, notifications, Apple Health, or banking connectivity is live. No credentials or secrets belong in frontend code.

### Not in v1

- Backend, account, authentication, multi-device sync, or cloud backup
- Automatic calendar, bank, fitness tracker, health, or contact integrations
- Medical advice or an individually prescribed training programme
- Calorie tracking, body metrics, mandatory weigh-ins, or nutrition plans
- Sentiment diagnosis, life scoring, or productivity scoring
- Social feed, competitive features, streaks, points, or leaderboards
- Automatic plan changes without preview and confirmation
- Live coach chat or arbitrary AI chat

## 4. Source findings and constraints

The repository is a blank React 19 + Vite 8 + TypeScript + Tailwind CSS v4 scaffold. The implementation should stay within those foundations and use the repository scripts exactly as documented.

Do not carry forward the audited gym-calendar app's fixed 1,800px layout, tiny labels, repeated calendars, contradictory dates, hard-coded calorie tables, stale week clamping, inconsistent gym-day definitions, in-memory-only chat, unsanitised `innerHTML`, or missing-function assumptions.

No actual exercise history, lifting weights, set counts, current class schedule, health readiness, personal financial balances, friend reminders, or project status has been supplied. Seed content must say **Example — edit this** or **Demo data**, and onboarding must not convert guesses into facts.

Use one source of truth for planned items, actual logs, projects, reflections, people notes, finances, and proposed actions. Render user and simulated AI content through React text nodes only.

## 5. Information architecture

Use a fixed, safe-area-aware four-item mobile navigation:

1. **Today** — the day's shape, a small check-in, and manageable next actions across life areas
2. **Plan** — a unified seven-day schedule for commitments, intentions, and flexible tasks
3. **Progress** — goals, recent moments, and a whole-life weekly review without a score
4. **My space** — direct access to Journal, Projects, People, Movement, Money, Home & routine, and Preferences

The round microphone button floats above the navigation and opens capture; it is not a fifth destination. No domain, including Movement, receives a permanent top-level tab.

Use shallow route navigation with React state plus `history.pushState` and `popstate`, avoiding a router dependency:

- `/` — Today
- `/plan`
- `/progress`
- `/space`

Focused tools open as accessible sheets or full-screen flows and return to their origin. Refresh, browser back/forward, and interrupted-flow recovery must behave predictably. Unknown paths fall back to Today without crashing.

On desktop, use a composed app canvas with a compact left rail and optional two-column content where it improves comprehension. Do not stretch a phone column across the viewport.

## 6. Life-area model

Use consistent area metadata across the app:

- **Reflect** — journal entries and personal check-ins
- **Create** — writing, photography, music, film, and other projects
- **Connect** — friends, plans, and gentle contact reminders
- **Move** — walking, running, dance, strength, mobility, and recovery
- **Money** — spending, commitments, savings, and project envelopes
- **Home** — routines, errands, admin, rest, and practical care

Area labels help organise information but never become performance categories. A plan item may have one primary area and optional related links. Private records remain isolated by default: journal body text, health concerns, people notes, and finance details are never silently combined into simulated AI context.

## 7. Three-step whole-life setup

First use must introduce Life Studio as a whole-life tool, not a movement programme. Keep setup skippable, one question group per screen, and easy to revise later.

### Step 1 — What would you like more room for?

Let Avika choose up to three current areas from Reflect, Create, Connect, Move, Money, and Home, plus **I'm not sure yet**. Explain that this changes what appears first, not what the app judges as important.

### Step 2 — What already shapes your week?

Capture broad availability and optional recurring commitments:

- work or fixed obligations
- classes or social plans
- preferred quiet time
- a general energy rhythm: mornings, afternoons, evenings, varies
- optional editable examples rather than assumed commitments

Every item can be skipped. No specific dance, yoga, gym, friend, or work schedule is preselected.

### Step 3 — What kind of support feels useful?

- cue style: concise, encouraging, or more detail
- daily planning density: one focus, a few things, or fuller view
- reminder tone preference, while clearly stating notifications are not connected
- whether to begin with an empty studio or labelled examples

### Preview

Show one balanced example week combining confirmed commitments, open space, and at most one or two gentle intentions from selected areas. Every generated entry is editable before acceptance. The accepted preview becomes the local plan; skipped setup opens a calm empty Today with obvious add actions.

Movement-specific readiness, equipment, pain/concern, and scheduling questions are deferred until Avika first opens **Movement setup**. They must not block use of Journal, Projects, People, Money, Home, Today, or Plan.

## 8. Today experience

Today should answer:

> What would make today feel a little more like mine?

Keep the first viewport calm and useful:

- time-aware greeting and full date
- a lightweight energy/space check-in: low, steady, or open
- **Today's shape**, showing the next fixed commitment and open space
- one primary chosen focus, editable at any time
- up to three small next actions drawn from different relevant areas
- **Later today** compact timeline
- quick **Add something** and global microphone actions

Do not automatically select exercise as the primary action. Ranking uses: fixed time first, user-pinned focus second, then selected setup priorities and recency; it never uses streaks or an opaque score. Avika can hide, reorder, complete, move, or let go of each suggestion.

Representative actions include:

- continue a journal entry
- spend 20 minutes on a film or writing idea
- message a friend
- review an upcoming payment
- reset one small home area
- start a planned movement session
- choose rest or open time

Completion feedback is factual and brief. Empty or low-energy states may use the Samoyed companion with copy such as “We can keep today small.”

## 9. Plan and conflict-aware rescheduling

Plan combines all areas in one schedule:

- horizontally scrollable seven-day strip
- vertical agenda for the selected day
- fixed commitments, flexible intentions, and open-space blocks
- clear area label plus icon; never rely on colour alone
- create, edit, complete, move, duplicate, or delete
- optional compact month picker for jumping dates, not a dense desktop calendar

Items use one of three planning modes:

- **Fixed** — tied to a date/time or external commitment
- **Flexible** — intended for a day or time window
- **Maybe** — optional and safe to let go

Moving an item opens a sheet with nearby candidate slots. Before confirmation, show:

- direct time conflicts
- whether a fixed item would be displaced
- loss of requested quiet/open space
- movement recovery concerns only when moving a movement session
- a recommended available slot and **Choose another time**

The app may warn but never silently move a second item. “Move anyway” remains available unless the movement-specific safety rules require a neutral caution. Missed items offer **Move**, **Keep as a note**, or **Let it go**; they never roll forward automatically.

## 10. Progress as reflection, not scoring

Progress is a whole-life reflection surface, not a fitness dashboard.

### Overview

- current goals and meaningful dates across any life area
- recent moments collected from completions, logs, entries, and manually pinned wins
- a gentle area filter, defaulting to **All**
- “Things taking shape” cards with factual status and next step
- no rings, life score, streak count, red/green judgement, or cross-domain ranking

### Goals

Goals may belong to any area and contain:

- title, area, optional target date, and why it matters
- status: tending, paused, complete, or archived
- small milestones and optional linked plan items
- notes and manual progress updates

Seed only clearly labelled examples. Known movement examples:

- **Hackney Half Marathon — 16 May 2027**
  - booking status is distinct from target status
  - default booking status is **Not confirmed**
  - include an official organiser link but do not claim live availability
- **FairPlay Dance Camp 2027 — Dates TBC**
  - allow a confirmed date to be added later
  - show no countdown or generated peak schedule until dates are confirmed

### Whole-life weekly review

The review asks:

1. What gave you energy?
2. What felt heavier than expected?
3. What do you want to make room for next week?
4. Is anything safe to make smaller, move, pause, or let go?

Show a factual recap by area, but only for areas with actual activity. Proposed next-week changes are deterministic, editable, and previewed before save. The user can keep, edit, or reject every proposal. A movement-specific progression suggestion can appear within Move, but it cannot dominate or determine the whole review.

## 11. My space

My space is a warm, direct collection of functional personal areas. Use a responsive card grid with a short recent-state preview; each card opens a focused panel or screen.

### Journal

- create, edit, date, and delete entries
- title, body, optional mood/energy word, and optional prompt
- debounced local autosave with clear saved state
- chronological list and text search
- no sentiment analysis, diagnosis, or streak

### Projects

- projects for writing, photography, music, film, or custom categories
- title, note, stage, optional tags, next action, and optional estimated cost
- stages: Seed, Exploring, Making, Resting, Complete
- accessible action menu for moving stages; no drag-only requirement
- link a next action to Plan and estimated cost to a Money envelope without turning it into actual spending

### People

- lightweight private list of important people
- last connected date, optional note, and optional next-touch intention
- schedule a plan or reminder manually
- no contact import, relationship scoring, “overdue friend” state, or social feed
- notes stay private and outside simulated AI unless explicitly included in a single proposal

### Movement

- landing view for walking, running, dance, strength, mobility, and recovery
- movement-specific setup, current plan, upcoming sessions, actual logs, and goals
- setup and generated content are optional; manual logging works immediately
- detailed interaction requirements are in section 12

### Money

- calm monthly snapshot with manually entered available amount, spending, and upcoming commitments
- transaction create/edit/delete: amount, date, category, note, and optional linked project or plan item
- envelopes such as Creative projects, Movement/classes, Travel/adventures, Home, and Cushion; all editable
- integer-pence storage and `Intl` GBP formatting
- linked project estimates remain estimates, not transactions
- always label the source **Entered on this device**; never imply live bank data

### Home & routine

- editable recurring routines and one-off practical tasks
- categories such as home, admin, rest, and errands
- choose frequency or flexible day without requiring a streak
- completing or skipping creates factual history only
- a reset action can generate a short “ten-minute tidy/admin” checklist from a fixed local template

### Preferences & data

- edit setup choices and visual/cue preferences
- privacy and local-data explanation
- voice capability explanation
- iPhone install guidance
- export structured data as a local JSON download
- import only after schema validation and explicit confirmation
- reset demo/app data behind confirmation
- unobtrusive prototype-scenario controls for review

## 12. Movement as one peer life area

Movement keeps enough depth to be genuinely useful, but it must not leak exercise-first hierarchy into global navigation, onboarding, Today, or Progress.

### Movement setup

Ask only when Movement is opened:

1. current comfort: walking, run-walk, easy continuous running, strength familiarity, dance frequency, or not sure
2. realistic days, session length, existing classes, location, and equipment
3. preferred cue detail and current priorities within Move
4. injury, pain, or health concern affecting movement: yes/no/prefer not to say

If concern is reported, do not prescribe intensity or progression. Offer manual/conservative planning and neutral professional-guidance copy without diagnosis.

Generated plans are labelled **Example plan — review before using** until accepted. Unknown readiness always produces the gentler option.

### Strength

- overview with purpose, duration, equipment, full exercise list, definitions, alternatives, and source/review note
- demonstration templates use broad movement categories and editable variants/volume
- player shows one exercise, setup cues, planned sets/reps or duration, and optional external source
- weight may be blank/bodyweight; large weight/reps controls
- complete set, skip set, swap exercise, and navigate/correct prior sets
- foreground rest timer with pause, +30 seconds, and skip
- autosave each set/edit and resume exact exercise/set
- finishing records only actual completed work plus perceived effort, concern flag, and optional note

### Run/run-walk

- purpose, expected duration, comfortable-effort explanation, warm-up, and cool-down
- interval player with current/next interval, time remaining, progress, pause, skip, and end
- foreground-only timing; no GPS or background-audio claim
- manual actual duration and optional distance, separate from the intended plan
- conservative starting example for returning/new runners unless setup confirms otherwise

### Dance

- booked class: style, date/time, place, duration, expected effort
- flexible practice: style/focus, window, duration
- actual log captures duration, perceived effort, and what was practised
- dance is treated as meaningful load and never silently displaced by running or strength

### Movement review and planning

- rest is a valid plan state
- missed sessions can move, adapt, or be let go without debt
- plan from current date, confirmed availability, actual logs, recovery, and known goal dates
- no rigid half-marathon block regardless of readiness
- FairPlay remains date-neutral until a confirmed date is entered
- pain/concern pauses automated progression suggestions
- concise disclaimer: general guidance only; pain/injury should be assessed by a qualified professional

## 13. Global voice and typed capture

The microphone opens a capture sheet from every top-level destination. The sheet starts with two equally clear choices:

- **Record**
- **Type instead**

Manual capture is always fully functional and must not be visually demoted as an error fallback.

### Real local recording state

`idle → requesting permission → recording ↔ paused → stopped/review`

Error branches:

- permission denied
- no input device
- unsupported browser
- recording interrupted

Requirements:

- request permission only after explicit Record action
- show real elapsed time and audio-level feedback from a Web Audio analyser
- do not open the keyboard during recording
- provide obvious pause, stop, and discard controls
- stop media tracks whenever the recorder closes
- preserve the blob through review and simulated gateway errors
- revoke object URLs and remove transient audio after save/discard unless local retention is explicitly chosen

### Simulated transcription and proposals

`audio review → simulated processing → editable demo transcript → proposed actions → confirm/save`

Always display:

> Audio recording is real and stays on this device. Transcription and AI suggestions are simulated because the Life Studio gateway is not connected.

The app generates no transcript automatically. Avika must choose **Use demo transcript**, then can edit it before interpretation. Include a simulated gateway-error state that preserves audio and typed text, with playback/download where supported, retry demonstration, and typing.

Example transcripts must span the product:

- “Journal: I felt more settled after seeing Maya.”
- “Idea: photograph the river at sunrise and add it to the London film.”
- “Dinner with Sam next Thursday at seven.”
- “Spent £18 on dance class.”
- “I did two sets of ten on the leg press at 30 kilos.”
- “Move tomorrow's admin hour to Saturday morning.”
- “I only have twenty minutes today.”

### Deterministic proposal rules

Support previewable proposals for:

- add or update plan item
- add journal entry
- capture project idea or next action
- add connection intention
- add transaction
- log movement or update an existing planned session
- add home/routine task

Never invent missing amounts, weights, reps, people, dates, completions, or links. Ambiguous content stays editable and can be saved as an uncategorised note. Mutations occur only after confirmation. Matching an update to an existing item uses its ID and previews the match to avoid duplicates. Every confirmed action gets brief feedback and an undo option.

## 14. Visual design system

Before implementation, invoke the repository's `make/use-design-system` procedure.

Use the supplied images as visual source material:

- the sunlit London studio is the primary atmosphere for Today and My space: creativity, ordinary domestic life, plants, notebook, music, camera, tea, and the Samoyed all coexist
- the riverside pavilion supports Movement and occasional Progress moments, without becoming the product's global hero
- the transparent Samoyed is a quiet companion for low-energy, empty, rest, and reflection states

Optimise local copies and preserve aspect ratios. Put text on calm solid surfaces, not over visually dense imagery.

Establish local tokens in `src/index.css`:

- warm paper/cream background
- pale peach and parchment surfaces
- deep moss primary
- muted sage secondary
- restrained terracotta/coral accent
- honey highlight
- ink-brown text and olive borders
- soft organic radii and low-contrast elevation

Use a public Google editorial serif for short display headings and a highly legible sans-serif for controls/body text. Wire them through CSS import or the project's existing documented mechanism; keep CSS `@import` statements first.

Design at 390px first and verify 320px and 430px:

- personal-desk atmosphere rather than a clinical dashboard
- one dominant action per state
- minimum 44×44px controls
- clear 16px-class body/form text
- restrained texture and botanical light/shadow away from dense controls
- no decorative badges competing with content
- no emoji icons; add `lucide-react` as the single icon library if needed
- no accidental horizontal page scroll
- reduced motion, visible focus, AA contrast, keyboard and safe-area awareness

## 15. Data contracts

Define explicit TypeScript types in `src/types.ts`.

### Shared

- `AppState`, schema version, IDs, timestamps, area union, demo-data marker
- `UserPreferences`, `LifeSetupProfile`, `AreaPreference`
- `PrototypeScenario`

### Planning

- `PlanItem`
  - ID, title, area, start/end or flexible window, timezone
  - mode: fixed/flexible/maybe
  - status: planned/inProgress/completed/skipped/moved
  - optional recurrence, location, note, and links
- `LifeCheckIn`
- `WeeklyReview` and previewed `PlanAdjustment`

### Goals and areas

- `Goal`, `Milestone`, `ProgressMoment`
- `JournalEntry`
- `Project`, `ProjectAction`
- `Person`, `ConnectionIntention`
- `Routine`, `RoutineLog`
- `Transaction`, `Envelope`
- `UncategorisedNote`

### Movement

- `MovementProfile`, `MovementGoal`
- `ExerciseTemplate`
- `WorkoutDraft`, `WorkoutLog`, `CompletedSet`
- `RunDraft`, `RunLog`, `RunInterval`
- `DanceLog`
- shared `MovementReflection`

### Capture

- `VoiceCaptureDraft`
- `CaptureTranscript`
- discriminated `ProposedAction` union for each supported life area

Use ISO timestamps and explicit local timezone at storage boundaries, `Intl.DateTimeFormat` for display, and integer pence for money. Planned and actual values remain separate. Links use stable IDs rather than duplicated embedded records.

## 16. Local state, storage, and data flow

Use:

- `localStorage` for versioned structured app state and resumable non-binary drafts
- IndexedDB for transient audio blobs
- guarded parsing, migration by schema version, and top-level shape validation
- immutable updates through one `useLifeStudioState` hook
- debounced routine writes plus immediate writes after major state transitions, completed sets, and financial mutations

Suggested modules:

- `src/types.ts`
- `src/data/demo.ts`
- `src/hooks/useLifeStudioState.ts`
- `src/lib/storage.ts`
- `src/lib/audioStore.ts`
- `src/lib/dates.ts`
- `src/lib/money.ts`
- `src/lib/todaySuggestions.ts`
- `src/lib/reschedule.ts`
- `src/lib/weeklyReview.ts`
- `src/lib/movementPlan.ts`
- `src/lib/voiceProposal.ts`

Pure helpers return previews or proposed mutations; components do not directly parse prose or generate schedules. Proposal confirmation dispatches one typed state action. Undo stores the inverse or previous record for the most recent user mutation, not an unbounded history.

On first run, setup controls whether to start empty or use labelled examples. Corrupt persisted state falls back to a recoverable screen that offers JSON download of the bad payload where safe, reset to demo/empty state, and a plain explanation. Storage write failure preserves in-memory work and shows a persistent warning plus export option.

Cloud-conflict and pending-sync states exist only under **Prototype scenarios** and are labelled **Demo sync state**. They must not attach themselves to real local saves.

## 17. Component and file structure

- `src/App.tsx` — app shell, shallow routing, onboarding gate, global capture, scenario entry
- `src/types.ts`
- `src/data/demo.ts`
- `src/hooks/useLifeStudioState.ts`
- `src/lib/*` — focused pure helpers and storage adapters
- `src/components/AppShell.tsx`
- `src/components/BottomNav.tsx`
- `src/components/VoiceCaptureSheet.tsx`
- `src/components/ui/*` — only repeated primitives such as Button, Card, Dialog/Sheet, Field, SegmentedControl, Timer
- `src/features/onboarding/LifeSetup.tsx`
- `src/features/today/TodayView.tsx`
- `src/features/plan/PlanView.tsx`
- `src/features/progress/ProgressView.tsx`
- `src/features/review/WeeklyReview.tsx`
- `src/features/space/MySpaceView.tsx`
- `src/features/journal/*`
- `src/features/projects/*`
- `src/features/people/*`
- `src/features/money/*`
- `src/features/home/*`
- `src/features/movement/*`
- `src/features/preferences/*`
- `src/index.css`
- `public/assets/*`
- `public/manifest.webmanifest`
- `public/sw.js`

Do not add charting, animation, router, AI, form, or calendar libraries. Add `lucide-react` only if a consistent icon set is needed. Use native IndexedDB unless a tiny helper demonstrably reduces error-handling complexity.

## 18. PWA and offline behavior

- manifest with standalone display, cream background, moss theme, and 192/512 maskable icons
- iOS web-app metadata, Apple touch icon, and **Share → Add to Home Screen** instructions
- minimal service worker caching versioned first-party app shell and local assets
- previously opened shell, structured records, manual forms, timers, and local saves remain usable offline
- external links show an offline message when unavailable
- simulated transcription remains clearly simulated online and offline
- service-worker registration/update failure never blocks app use
- never claim cloud backup; removing browser/site data removes local records
- first-ever offline load may fail normally if the shell has never been cached

## 19. Accessibility, safety, and failure handling

- semantic landmarks, heading order, lists, forms, status text, and labelled controls
- accessible dialogs/sheets with initial focus, focus containment, Escape close, background blocking, and focus return
- all important actions keyboard-operable
- colour never carries area, status, conflict, concern, or completion meaning alone
- screen-reader announcements for saves, errors, timer milestones, and undo without countdown chatter
- reduced-motion support and strong visible focus
- 44px minimum touch targets and safe-area bottom padding
- no accidental horizontal overflow beyond intentional date strips
- invalid dates, amounts, sets, and durations remain editable and are never silently coerced
- microphone denial never shows a listening state
- interrupted audio preserves recoverable state where the browser allows
- foreground timers reconcile against timestamps after backgrounding and explain any catch-up
- delete, reset, and import replacement require confirmation
- no user or simulated AI text passes through `innerHTML`

## 20. Required clickable scenarios

Expose an unobtrusive **Prototype scenarios** entry under Preferences so reviewers can reach states without contaminating normal data.

1. Whole-life setup → balanced week preview → edit → accept
2. Today on a steady day with Journal, People, Home, and Movement actions
3. Low-energy Today → shrink or let go of actions → keep one gentle focus
4. Plan → move a cross-domain item → conflict preview → confirm
5. Journal create/autosave/edit/delete
6. Project idea → next action in Plan → estimated cost linked to Money
7. People intention → scheduled plan → factual connection log
8. Money transaction/envelope edit with project estimate kept separate
9. Home routine complete/skip without streak or penalty
10. Strength overview → set logging → rest → correction → finish → resume test
11. Run interval active/paused → manual actual result
12. Dance class/practice log → movement view update
13. Whole-life weekly review → editable next-week preview → accept
14. Voice record → demo transcript across a non-movement area → proposal → save
15. Voice update matched to an existing movement plan item without duplication
16. Permission denial and simulated gateway failure with typing/audio recovery
17. Empty, offline, corrupt-storage, write-failure, timer-catch-up, and demo-sync states

## 21. Verification strategy

Use the already-running Figma Make development server; never start another development server.

For the broad implementation, run:

1. `pnpm run format`
2. `pnpm run build`

Then manually verify at 320px, 390px, 430px, tablet, and desktop:

- all four destinations, browser back/forward, refresh, and unknown-route fallback
- whole-life setup changes the preview and can be skipped
- Movement setup is deferred and never blocks other areas
- Today does not default to or consistently privilege movement
- suggestions can represent all six areas and can be reordered, moved, completed, or let go
- Plan combines all areas and never silently moves a second item
- Progress shows no life score, streak, or exercise-first hierarchy
- weekly review proposals are editable and save only after confirmation
- every My space card has a functional representative interaction
- project estimates remain separate from actual transactions
- journal, people, health, and finance details remain outside simulated AI unless explicitly selected
- movement setup stays conservative with unknown readiness or concern
- completed sets/logs preserve actual versus planned values and resume exactly
- foreground timers pause/reconcile honestly
- missed movement creates no debt or automatic progression
- Hackney target is 16 May 2027 with booking unconfirmed by default
- FairPlay remains Dates TBC until explicitly edited
- local recording permission, level, timer, pause, review, and media-track cleanup work
- transcription, AI, cloud, and calendar states are visibly simulated
- manual capture works without microphone permission
- ambiguous proposals do not guess missing facts or mutate before confirmation
- undo does not create duplicate records
- local persistence, export/import validation, reset confirmation, and corrupt/write failure states
- PWA metadata/icons resolve and cached-shell behavior is honest
- keyboard-only dialog/player flows, focus return, screen-reader statuses, reduced motion, contrast, and safe areas
- no console errors across required scenarios

## 22. Acceptance criteria

The prototype succeeds when Avika can:

1. Open Life Studio and understand the shape of today without being pushed toward exercise.
2. Choose a manageable next step from reflection, creativity, connection, movement, money, or home.
3. Put different parts of life into one adjustable weekly plan.
4. Move or let go of an item without guilt or hidden knock-on changes.
5. Write privately, develop a project, remember a friend, manage a practical task, and record money through functional local interactions.
6. Use a guided workout, run/run-walk timer, or dance log when Movement is what matters.
7. Reflect on a whole week without receiving a life score or having fitness stand in for overall progress.
8. Record real local audio while understanding that transcript and AI proposals are demonstrations.
9. complete every capture and logging task manually if voice is unavailable or unwanted.
10. Trust that known dates are accurate, unknown dates remain unknown, and demonstration content is not presented as personal history.
11. Install the app on an iPhone and keep using the local prototype offline after its shell is cached.

## 23. Implementation order

1. Invoke `make/use-design-system`; derive tokens, typography, responsive shell, optimised supplied artwork, and icon approach.
2. Add shared types, area metadata, setup/demo data, guarded versioned storage, IndexedDB audio adapter, and shallow routing.
3. Build whole-life onboarding, balanced week preview, and first-run empty/demo paths.
4. Build Today's shape, check-in, suggestion logic, completion/let-go behavior, and unified Plan.
5. Build Progress, cross-area goals, recent moments, and whole-life weekly review.
6. Build functional Journal, Projects, People, Money, and Home & routine spaces plus their Plan links.
7. Build deferred Movement setup, movement landing page, strength player, run timer, dance logger, movement review, and exact resume behavior.
8. Build global typed capture, then real local audio recording and explicitly simulated transcript/proposal/error flows across all areas.
9. Add Preferences, data export/import/reset, privacy explanations, and prototype scenario controls.
10. Add PWA manifest/icons/service worker and iPhone install/offline guidance.
11. Complete accessibility and responsive polish, run the prescribed formatter/build, and execute the full clickable acceptance pass.
