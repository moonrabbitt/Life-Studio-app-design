# Life Studio — Local-First Prototype Implementation Plan

## 1. Product goal

Build an exhibition-quality, mobile-first personal life app for Avika that feels warm, calm, and lived-in rather than clinical. The prototype will connect six useful journeys:

1. Today and universal capture
2. Schedule
3. Combined running and dance training
4. Journal
5. Creative ideas
6. Finance

The result must be a genuinely interactive local-first prototype, not a static mockup. It should install to an iPhone home screen, retain data locally, reopen its shell offline, and use honest language around capabilities that are not yet backed by a server.

## 2. Confirmed product decisions

- **Delivery:** local-first working prototype.
- **Scope:** the six journeys listed above.
- **Voice:** a large microphone button remains the primary visual action, but tapping it opens a capture composer with a reliable typed fallback. The app does not request microphone permission, record audio, claim to transcribe, or call AI in v1. It clearly explains that private voice transcription is not connected yet.
- **Natural-language actions:** a small deterministic on-device parser supports a documented set of common typed commands. Every interpreted action is previewed for confirmation before local data changes.
- **Installability:** PWA manifest, icons, iOS metadata/install guidance, local persistence, and a minimal service worker for the static app shell.
- **Training baseline:** returning from a break/new to running.
- **Finance focus:** manually entered personal overview, spending, savings/goal envelopes, and upcoming commitments. No bank connection.
- **Hackney Half target:** 16 May 2027.
- **FairPlay Dance Camp 2027:** shown as “Date to be confirmed”; no date, countdown, or calendar block will be invented.
- **Tone:** encouraging and practical, with no streaks, guilt, punishment language, calorie focus, body metrics, or “fitness-bro” framing.

## 3. Visual and experience direction

Use the three supplied images as the visual source material:

- The sunlit London studio reference informs the home atmosphere: warm cream, honeyed wood, soft sage, leafy shadows, paper, notebooks, and a subtle London sense of place.
- The riverside dance reference informs Training: spacious movement, morning light, garden greens, and dance/running treated as complementary.
- The transparent Samoyed illustration becomes a quiet companion used selectively in empty/rest/recovery states, not a cartoon mascot on every screen.

Implementation should begin by invoking the repository’s design-system procedure and deriving a small local token system:

- warm paper background; cream and pale peach surfaces
- deep moss primary; muted sage secondary; terracotta/coral accent; ink-brown text
- editorial serif for display headings paired with a highly legible sans-serif for controls/body copy, using public Google fonts or safe fallbacks
- soft organic radii, fine olive borders, restrained paper grain, botanical shadow shapes, and low-contrast elevation
- tactile cards and illustrated scene crops without letting full-bleed artwork reduce readability
- subtle transitions for sheets, confirmations, navigation, and progress; all disabled under `prefers-reduced-motion`

The primary mobile composition should feel like a personal desk: atmospheric header, clear daily focus, generous touch targets, and one unmistakable capture control. Desktop should become a centered app canvas with a wider two-column layout where useful, not a stretched phone UI.

## 4. Information architecture and navigation

Use a five-item fixed mobile navigation:

- **Today**
- **Plan** (schedule)
- **Train**
- **Studio** (Journal and Ideas as an in-section segmented switch)
- **Money**

Keep the microphone/capture action visually centered above the navigation and available from every section. On larger screens, convert the same destinations into a compact left rail or top-level app navigation while retaining capture prominence.

Use simple React state plus `history.pushState`/`popstate` for section navigation rather than adding a router dependency. Store the active section in a small path convention (`/`, `/plan`, `/train`, `/studio`, `/money`) so refresh, back, and forward work. Unknown paths fall back to Today.

Include an unobtrusive settings/data entry point from the profile/header menu for:

- install instructions
- “voice is not connected” explanation
- local-data-only explanation
- reset to sample data, behind a confirmation

## 5. Core journeys and interactions

### 5.1 Today and universal capture

The home screen should answer “What matters today?” without becoming a dashboard wall:

- warm time-aware greeting to Avika
- one prominent “Today’s shape” card with the next scheduled item, movement/recovery suggestion, and one gentle open space
- a short timeline combining scheduled items, captured activities, and reminders
- a small training destination card showing the next session and both long-term goals
- a calm money/creative nudge only when useful
- Samoyed companion in the recovery/empty state with copy such as “A softer day still counts.”

The large microphone button opens a bottom sheet with:

- explicit status: voice transcription is not connected in this prototype
- prompt: “Type what you’d say”
- natural-language text field
- example chips
- parser result preview
- confirm, edit, or save as an uncategorised note
- polite success feedback and undo

Supported deterministic intents:

- log movement/activity: “I walked for 30 minutes”, “I did a 20 min run”
- add schedule item: “Dance class Friday at 7pm”
- reschedule: “Move dance to Friday at 7pm”
- add journal note: “Journal: I felt more grounded after class”
- capture idea: “Idea: film the river at sunrise”
- add expense: “Spent £18 on dance class”

The parser may recognise common relative dates (`today`, `tomorrow`, named weekday), 12/24-hour times, minute/hour durations, and pound amounts. It must not pretend to understand arbitrary prose. Ambiguous or incomplete input produces a neutral clarification/preview rather than silently guessing. Parsing and mutation remain separate so nothing is saved before confirmation.

### 5.2 Plan / schedule

- Provide a horizontally scrollable seven-day strip and an agenda for the selected day.
- Seed realistic work, life, dance, run/walk, rest, and creative blocks without overpacking the calendar.
- Allow item creation, completion, editing, and rescheduling through a bottom sheet.
- Support drag-free mobile rescheduling through “Move to…” controls; do not depend on precise drag gestures.
- Show conflicts before saving and offer “move anyway” or a nearby open slot.
- Connect training sessions to their training detail and expense-bearing items to Money where relevant.
- Use friendly language for incomplete plans (“Move it to a kinder day”) rather than overdue warnings.

### 5.3 Train

Create a combined movement plan with two goal cards:

- Hackney Half Marathon — 16 May 2027
- FairPlay Dance Camp 2027 — Date to be confirmed

The plan generator uses the current date and the race date rather than hard-coded week numbers. It should seed/generate:

- an initial 8-week return-to-movement foundation using run/walk sessions
- typically 3 running touchpoints per week at first: easy run/walk, short technique or gentle intervals only after adaptation, and gradually lengthening easy time-on-feet
- 1–2 dance sessions per week, treated as meaningful training load
- 1 short mobility/strength session
- at least 1 full rest day and recovery space after higher-load days
- conservative progression with a lighter week every fourth week
- a later maintenance/base phase
- a race-specific 16-week half-marathon block ending 16 May 2027
- no rigid FairPlay peak block until its dates are verified

The UI should present the current week, session details, completion/reflection controls, and the reason each session exists. Completing a session can record duration, perceived effort, and a short note—never weight, calories, pace pressure, or streaks. If a session is missed, offer reschedule, adapt the week, or let it go.

Avoid medical claims. Include a concise note that the plan is general guidance and pain/injury should be assessed by a qualified professional.

### 5.4 Studio / Journal

- Journal tab opens with a spacious writing surface and optional gentle prompts.
- Entries support title, body, mood/energy word, and date; autosave locally after a short debounce.
- Provide a chronological card list and entry editing/deletion with confirmation.
- Use the Samoyed illustration for the first-entry/quiet reflection state.
- Do not add sentiment analysis, streaks, or automated emotional diagnoses.

### 5.5 Studio / Ideas

- Capture lightweight idea cards with title, note, stage, optional tags, and optional estimated cost.
- Stages: Seed, Exploring, Making, Resting.
- Cards can move stages through an accessible action menu rather than drag-only interaction.
- Cost estimates link into a dedicated creative envelope in Money.
- Seed a few personal-feeling examples inspired by photography, music, movement, and London, clearly editable.

### 5.6 Money

- Show a calm monthly snapshot: available amount, spent amount, and upcoming commitments.
- Provide manual transaction add/edit/delete with amount, date, category, and optional linked idea/scheduled item.
- Include simple envelopes such as Dance & training, Creative projects, Travel/adventures, and Cushion.
- Allow envelope target and current amount edits.
- Surface the total estimated cost of linked Ideas without treating estimates as actual spending.
- Use clear GBP formatting and never imply live bank data.
- Label the section “On this device” and include a small privacy explanation.

## 6. Data model and local persistence

Define explicit TypeScript types in `src/types.ts`:

- `AppState`
- `ScheduleItem`
- `ActivityLog`
- `TrainingGoal`, `TrainingWeek`, `TrainingSession`, `SessionReflection`
- `JournalEntry`
- `Idea`
- `Transaction`, `Envelope`
- `CaptureDraft`, `ParsedIntent`
- shared IDs, dates, and category unions

Use ISO date/time strings in storage and format them at the UI boundary with `Intl.DateTimeFormat`. Store money as integer pence.

Create `src/lib/storage.ts` with:

- one namespaced key such as `life-studio:v1`
- schema version
- guarded JSON parsing and shape validation sufficient to reject corrupt top-level data
- seed-data merge only on first run
- immutable updates through a small `useLocalAppState` hook
- an in-app reset action
- a visible non-blocking recovery notice if corrupt data must be replaced

Do not store binary audio. Do not add secrets, external AI calls, analytics, authentication, or remote persistence.

Create pure helpers:

- `src/lib/captureParser.ts` for text-to-preview intent parsing
- `src/lib/trainingPlan.ts` for date-relative training phases and weekly seed generation
- `src/lib/dates.ts` and `src/lib/money.ts` only if they remove repeated formatting/parsing logic

Parser and training helpers should be independently testable pure functions even if the scaffold does not yet include a test runner.

## 7. Component and file structure

Keep the implementation modular without introducing a framework:

- `src/App.tsx` — app shell, section routing, global capture sheet
- `src/types.ts` — application contracts
- `src/data/seed.ts` — editable first-run content
- `src/hooks/useLocalAppState.ts` — central local state/persistence
- `src/lib/*` — parser, training generation, and focused formatting helpers
- `src/components/AppShell.tsx`
- `src/components/BottomNav.tsx`
- `src/components/CaptureSheet.tsx`
- `src/components/ui/*` — only repeated primitives such as Card, Sheet, Button, IconButton, ProgressBar
- `src/features/today/TodayView.tsx`
- `src/features/plan/PlanView.tsx`
- `src/features/train/TrainView.tsx`
- `src/features/studio/StudioView.tsx`
- `src/features/money/MoneyView.tsx`
- `src/index.css` — Tailwind import first, tokens, font import/wiring, paper texture, global focus/motion rules
- `public/assets/*` — optimised copies/crops of the supplied images and generated app icons
- `public/manifest.webmanifest`
- `public/sw.js`

Add only one UI dependency if needed: `lucide-react` for a consistent accessible icon set. Do not use emoji as icons. Prefer native platform APIs and existing React/Tailwind capabilities over further packages.

## 8. PWA and offline behavior

- Add manifest name/short name, theme/background colors, standalone display mode, portrait-friendly metadata, and 192px/512px maskable icons.
- Add Apple mobile web app metadata and touch icon in `index.html`.
- Register `public/sw.js` from the client only in production-capable contexts.
- Cache only versioned first-party shell assets needed to reopen the app; use a small cache-first strategy for those assets and network-first navigation fallback.
- Do not cache third-party APIs because there are none.
- Provide iOS-specific manual install guidance (“Share → Add to Home Screen”), since iOS does not expose a standard install prompt.
- Clearly distinguish “stored on this device” from encrypted or backed-up storage. Removing site data removes the prototype data.
- On first load while offline before the shell has been cached, allow the browser’s normal failure; do not claim impossible offline guarantees.

## 9. Accessibility and responsive requirements

- Semantic landmarks, headings, buttons, lists, forms, dialogs, and labels.
- Capture/settings/edit sheets use accessible dialog semantics, initial focus, Escape close, focus return, and background interaction blocking.
- Minimum 44×44px touch targets and comfortable bottom safe-area padding.
- Strong visible focus states and AA contrast for text/controls.
- Never encode schedule category, training state, or finance status by color alone.
- Use `aria-live` for save/undo feedback without excessive announcements.
- Respect reduced motion.
- Support narrow iPhone widths from 320px, common 390–430px devices, tablet, and desktop.
- Avoid horizontal overflow except intentional day-strip scrolling.

## 10. Empty, loading, and failure states

- No artificial loading skeletons for synchronous local data.
- Empty states provide one clear next action and warm, non-judgmental copy.
- Invalid capture text remains editable and can be saved as an uncategorised note.
- Invalid currency/date/form input receives inline guidance and is never silently coerced.
- Storage write failures show a persistent warning and keep the current in-memory state.
- Corrupt saved state falls back to seed data only after preserving the failure reason in a user-visible notice; never crash the app.
- Service-worker registration/update failure must not block the app.

## 11. Verification and acceptance criteria

Run the repository-prescribed formatter and then the production build:

1. `pnpm run format`
2. `pnpm run build`

Use the already-running Figma Make development server for a focused manual pass; do not start another server.

Verify:

- each of the five navigation destinations and both Studio modes is reachable
- browser back/forward and refresh retain the section
- microphone button opens the honest typed capture flow from every section
- each supported intent previews correctly, saves only after confirmation, appears in the correct journey, and can be undone
- ambiguous capture does not silently categorise
- create/edit/delete/reschedule flows persist after refresh
- training dates are generated relative to 16 May 2027 and FairPlay remains TBD
- missed/rest states use supportive language
- linked idea estimates appear in Money without becoming transactions
- GBP values retain integer-pence accuracy
- local data reset requires confirmation
- manifest and icons resolve; installed/standalone layout respects safe areas
- shell can reopen offline after one successful online load
- keyboard-only dialog navigation, focus return, reduced motion, and visible focus work
- layouts at 320px, 390px, 768px, and desktop have no accidental overflow
- no console errors occur during the checked journeys

## 12. Explicit non-goals for v1

- Real speech recording, transcription, or AI interpretation
- Backend, accounts, sync, cloud backup, or multi-device use
- Secrets or API keys in frontend code
- Calendar, bank, fitness tracker, or health platform integrations
- Notifications or background scheduling
- Automatic financial categorisation
- Training prescriptions based on health data
- A fabricated FairPlay date
- Social features, streaks, points, leaderboards, or guilt-based nudges

## 13. Implementation order

1. Invoke the design-system procedure, establish tokens/typography/assets, and build the responsive app shell.
2. Add types, seed state, guarded local persistence, and section routing.
3. Implement Today and the global capture sheet, then the pure parser and confirm/undo mutation flow.
4. Implement Plan and its accessible create/edit/reschedule/conflict flows.
5. Implement training goal/date logic, generated phases, weekly view, and session reflections.
6. Implement Journal and Ideas under Studio, including autosave and cost linking.
7. Implement Money and complete cross-links from schedule/ideas.
8. Add PWA manifest, icons, service worker, install guidance, and device-local privacy copy.
9. Complete accessibility/responsive polish, format, build, and execute the acceptance pass.
