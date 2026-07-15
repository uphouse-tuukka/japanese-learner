# Review: Spoken Mission Browser Acceptance

This review records browser acceptance for the Spoken Mission epic across desktop and mobile layouts, including permission timing, real microphone capture, live semantic grading, recovery paths, persistence, accessibility, and final evidence labels.
The exact epic commit passed the repository CI gate, with the production-preview and synthesized-speech limitations documented below.

**Reviewed task / branch:** GitHub issue #26 on `origin/epic/spoken-missions`

**Tested application commit:** `1243237f392b5317a9855a9010c8d092d5c7bac3`

**Reviewer:** Codex

**Date:** 2026-07-15

## Files reviewed

- `src/routes/missions/[id]/+page.svelte`
- `src/lib/components/missions/MissionChoices.svelte`
- `src/lib/components/missions/SpokenMission.svelte`
- `src/lib/components/missions/SpokenMissionBriefing.svelte`
- `src/lib/components/missions/SpokenMissionTurn.svelte`
- `src/lib/components/missions/SpokenMissionResult.svelte`
- `src/lib/components/missions/spoken-mission-client.ts`
- `src/lib/server/spoken-missions.ts`
- `src/lib/server/spoken-missions-db.ts`
- `src/routes/api/missions/[id]/spoken/start/+server.ts`
- `src/routes/api/missions/[id]/spoken/turn/+server.ts`
- `src/routes/api/missions/[id]/spoken/support/+server.ts`
- `src/lib/components/missions/spoken-mission-turn-actions.browser.test.ts`
- `src/lib/components/missions/spoken-mission-ui.test.ts`
- `src/lib/server/spoken-missions.test.ts`
- `src/routes/api/missions/[id]/spoken-flow.server.test.ts`

## Environment

- Ubuntu 26.04 LTS on the project host.
- Google Chrome for Testing 147.0.7727.15 in a headed desktop session.
- Desktop viewport: 1440 by 900 CSS pixels.
- Mobile viewport: 390 by 844 CSS pixels with touch and mobile emulation enabled.
- Local SvelteKit development server bound to the host and using a temporary file-backed libsql database.
- Live OpenAI transcription, semantic assessment, and TTS services were enabled through a process-only host credential.
- The real `Built-in Audio Analog Stereo` microphone on the host's ALC257 device captured Japanese played acoustically through the built-in speakers.

## Spec-compliance checklist

- [x] Written Mission and Spoken Mission have equal hierarchy on desktop and mobile.
- [x] The chooser, briefing, active turn, feedback, error, resume, and result states are readable without horizontal overflow.
- [x] Microphone permission remains in the browser `prompt` state through the chooser, briefing, and mission start.
- [x] The application requests permission only after the explicit Record action.
- [x] A real hardware recording exercises visible elapsed time, manual stop, automatic stop, cancel, retry, submission, transcript, semantic feedback, and media-track cleanup.
- [x] Independent and Supported attempts complete atomically with the correct label, all three goal transcripts, all three semantic feedback messages, and the suggested phrase.
- [x] English listening support is visibly disclosed, survives reload and resume, and explains the Supported result.
- [x] An Independent result remains the scenario's best evidence after a later Supported completion.
- [x] Keyboard navigation reaches the mission choices, resume actions, and recorder controls, and focus moves to briefing, resumed turn, support, feedback, error, and result headings or status regions.
- [x] Permission denial and unsupported recording formats preserve the in-progress attempt and expose a safe route to Written Mission.
- [x] No feature changes or unrelated cleanup were introduced during acceptance.

## Acceptance evidence

### Desktop and mobile layout

The 1440 by 900 desktop pass showed the existing Travel Mission catalog with one restaurant scenario and a quiet microphone capability mark.
The Written Mission and Spoken Mission cards used equal visual weight and preserved separate Written completion and Spoken evidence states.
The 390 by 844 mobile pass stacked the two choices, kept their status labels readable, and reported equal document and client widths throughout the chooser, briefing, active turn, feedback, denial, unsupported-format, and result checks.
That mobile viewport also completed a fresh Independent attempt through the real microphone and live semantic-grading services.

### Permission and recorder lifecycle

The browser permission query returned `prompt` before entering Spoken Mission, after opening the briefing, and after starting the attempt.
After Record was activated, the UI announced `Requesting microphone permission...` before capture began.
The granted hardware path exposed `Default` and `Built-in Audio Analog Stereo` inputs and negotiated WebM Opus, WebM, and MP4 support.
The recording UI showed a two-second manual-stop sample and a twelve-second automatic-stop sample.
Cancel returned focus to Record, added no `/spoken/turn` request, and left no PipeWire capture stream.
Manual stop and automatic stop each released the capture stream after their outcome.

### Live transcription and semantic assessment

The Independent attempt produced these accepted transcripts:

1. `ラーメンを一つお願いします。`
2. `お水でお願いします。`
3. `いいえ、普通のラーメンを一つお願いします。`

The result reported Independent evidence, retained concise semantic feedback for all three goals, focused the result heading, and showed `すみません、ラーメンは一つです。` as the suggested phrase.

The Supported attempt revealed English support on Order, reloaded the page, resumed Goal 1 with the disclosure restored, and completed all three goals with the same accepted transcripts.
The result reported Supported evidence and explained that English listening support caused the label.
Reloading the scenario afterward still showed Independent as the best completed evidence.

The mobile-viewport completion repeated the Independent flow with the real microphone and live grading.
It exercised automatic stop on Order, manual stop on Respond and Repair, the three accepted transcripts above, and the complete per-goal result without horizontal overflow.

The live Supported pass also exercised two non-advancing outcomes on Respond.
A transcript of `お茶でいいです。` produced a semantic retry because tea did not satisfy the water goal.
An unclear low-quality synthesis produced Could not assess rather than incorrect evidence.
The next accepted retry advanced normally.

### Recovery and persistence

Permission denial focused the alert `Microphone permission was denied. Retry recording or use Written Mission.` and exposed both retry and Written Mission actions.
Forcing all MediaRecorder MIME candidates to unsupported focused the format error and exposed Use Written Mission.
Both fallback paths returned to the unchanged Written Mission setup.
The local database retained the replacement attempt as `in_progress` with no evidence before live completion, while Start over marked only the previous attempt `abandoned`.
Reloading the mobile viewport exposed `Resume goal 1` on the Spoken Mission choice.
Keyboard Enter opened its briefing, keyboard Enter activated `Resume goal 1`, and focus moved to the restored Order heading before the mobile completion continued.

## Code-quality checklist

- [x] The browser pass did not require implementation changes to the accepted epic branch.
- [x] Existing component, route, and server boundaries remained clear during the exercised flows.
- [x] Automated tests and this browser-acceptance record cover the reviewed behavior.
- [x] Logging avoided secrets, raw audio, full prompts, and complete provider payloads.

## Security/privacy checklist

- [x] No raw audio was written to the repository, browser storage, or the temporary database.
- [x] Temporary recordings existed only in browser memory and the multipart request lifecycle.
- [x] The browser and server displayed or stored transcripts and structured assessments only after submission.
- [x] Logs retained sanitized metadata and did not expose the OpenAI credential, raw audio, full prompts, or complete provider payloads.
- [x] The temporary database and generated TTS files remained outside the repository.

## Tests reviewed / run

| Command or check                              | Result                                                         |
| --------------------------------------------- | -------------------------------------------------------------- |
| `npm run check`                               | Passed with 0 errors and 0 warnings before browser acceptance. |
| Desktop headed-browser pass                   | Passed at 1440 by 900 CSS pixels.                              |
| Mobile headed-browser pass                    | Passed at 390 by 844 CSS pixels with no horizontal overflow.   |
| Desktop real microphone and live-grading pass | Passed for Independent and Supported completion.               |
| Mobile real microphone and live-grading pass  | Passed at 390 by 844 through Independent completion.           |
| `npm run validate:ci`                         | Passed: 66 test files, 532 tests, and production build.        |

## Limitations

The Vercel preview was protected by Vercel authentication, so the pass ran the exact epic commit through the local SvelteKit server with live OpenAI services and a temporary local database.
The Japanese learner responses were generated by speech synthesis, played through the physical speakers, and captured acoustically by the real built-in microphone rather than spoken by a human tester.
The hardware-capture run auto-accepted the browser prompt after a separate pass had verified the permission remained unrequested until Record.
Permission denial and unsupported-format behavior were exercised by replacing the corresponding browser boundary after the real hardware path had passed.
The mobile pass used Chrome's touch-enabled 390 by 844 device emulation on the desktop host, so it did not validate a native mobile operating system or mobile browser's media stack.

## Verdict

Approved.

## Blocking issues

None observed in the browser acceptance pass.

## Non-blocking suggestions

Repeat the completed flow with a human learner's natural speech during product validation, as planned in issue #6.
