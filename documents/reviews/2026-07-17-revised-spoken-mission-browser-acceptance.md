# Review: Revised Spoken Mission Browser Acceptance

This review records final end-to-end acceptance for the audio-first restaurant Spoken Mission, including written and English support, retry coaching, skip recovery, successful evidence, incomplete results, accessibility, layout, persistence, and raw-audio privacy.

**Reviewed task / PR / branch:** GitHub issue #37, part of #34, on `agent/validate-revised-spoken-mission`

**Reviewer:** Codex

**Date:** 2026-07-17

## Files reviewed

- `src/lib/components/missions/SpokenMission.svelte`
- `src/lib/components/missions/SpokenMissionTurn.svelte`
- `src/lib/components/missions/spoken-mission-audio-first.browser.test.ts`
- `src/lib/server/spoken-missions.ts`
- `src/lib/server/spoken-missions-db.ts`
- `src/routes/api/missions/[id]/spoken/**`
- `src/routes/missions/[id]/+page.svelte`
- `documents/spoken-missions.md`

## Spec-compliance checklist

- [x] The implementation matches issue #37 and its parent plan in issue #34.
- [x] No feature creep was introduced.
- [x] File paths and scope are correct.
- [x] The validation work did not add unrelated user-facing behavior.

## Code-quality checklist

- [x] The learner-visible retry defect is fixed at its rendering source.
- [x] Names and existing component boundaries remain clear.
- [x] Mounted tests and the dated acceptance record cover the change.
- [x] Logging avoids secrets and user content.

## Security/privacy checklist

- [x] Secrets, tokens, and authentication data are not exposed.
- [x] Learner recordings and full learning content are not logged.
- [x] Raw audio remains transient behind the existing server boundary.
- [x] Public route and API behavior did not widen.

## Tests reviewed / run

| Command or check                                                                        | Result                                                                                            |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npx vitest run src/lib/components/missions/spoken-mission-audio-first.browser.test.ts` | 8 mounted learner-flow tests passed.                                                              |
| `npm run validate:ci`                                                                   | Formatting, Svelte checks, ESLint, 70 test files with 603 tests, and the production build passed. |
| Headed Chrome acceptance at 1440 by 900 with host microphone                            | Audio-first controls, permission timing, real recording, playback, focus, and results passed.     |
| Headed Chrome mobile emulation at 390 by 844 with device scale factor 3                 | Retry, skip, successful and incomplete results passed without horizontal overflow.                |

## Environment

- Ubuntu 26.04 LTS on the project host.
- Google Chrome for Testing 147.0.7727.15 in headed Wayland and XWayland sessions.
- Desktop viewport: 1440 by 900 CSS pixels.
- Mobile viewport: 390 by 844 CSS pixels with device scale factor 3, mobile emulation, and touch emulation.
- Local SvelteKit development server bound to the host with a temporary file-backed libsql database and all Travel Missions unlocked.
- Real `Built-in Audio Analog Stereo` microphone on the host ALC257 device, captured through PipeWire and the browser MediaRecorder boundary.
- Synthesized Japanese audio routed through the same server-preferred response and Web Audio playback boundary used by Spoken Mission turns.

## Automated acceptance

The mounted `SpokenMission` interaction seam stubs only network, recorder, and TTS boundaries while exercising the real component state machine and rendered controls.
It now covers Japanese and romaji remaining hidden before written reveal, written reveal preserving Independent eligibility, English reveal producing Supported evidence, all three accepted goals, semantic retry coaching, Skip goal, Incomplete completion, and technical `could_not_assess` recovery without language coaching or Skip.
The mounted semantic-retry journey also prevents a stray learner-visible character from reappearing beside Skip goal.

Focused route and persistence suites cover selected-user checks, ownership, unlock state, definition version, current turn, disclosure restoration, semantic skip eligibility, idempotency, skipped history, resume, terminal Incomplete state, previous-best-evidence preservation, and exclusion of incomplete attempts from best-evidence selection.
Those tests exercise the real API and repository boundaries rather than the deterministic browser assessment responses described below.

## Headed browser acceptance

### Audio-first presentation and support

The briefing showed only the general Can-do and neutral Order, Respond, and Repair stages.
The active turn contained no Japanese or romaji before written reveal.
Listen entered loading and playing states, exposed Stop audio during playback, and changed to Replay Japanese after playback stopped.
Replay started the same Japanese line again, and stopping playback produced the announced stopped state.
The failure path exposed Retry audio and announced that audio was unavailable.

Reveal written text showed Japanese and romaji together and moved focus to the written hint.
Reveal English support remained separate, showed its evidence consequence, and moved focus to the English support region.
Reload and resume restored both disclosures and the retained `could_not_assess` history for the current goal.

### Permission and real recording

A clean browser profile reported microphone permission as `prompt` at the mission chooser, briefing, resumed active turn, Japanese listening action, written support, and English support.
Only Record changed the interface to `Requesting microphone permission...` and opened the browser permission request.

A separate headed browser profile with permission granted captured the real ALC257 input through MediaRecorder.
PipeWire showed an active Chromium input connected to both ALC257 capture channels while recording.
The interface announced requesting, recording, stopping, and assessment states, moved focus to Stop and assess while recording, and released the active capture stream after submission.
An automatic 12-second stop reached `could_not_assess`, focused the recovery heading, and exposed Record again without a semantic suggestion or Skip goal.

### Retry, skip, evidence, and results

The headed browser used deterministic assessment responses at the network boundary because no live OpenAI credential was available in this session.
The semantic retry displayed concise feedback, Japanese and romaji coaching without an English gloss, a primary Record again action, and a lower-emphasis Skip goal action.
The learner-visible stray `>` that had appeared after Skip goal was absent after the fix.

Skip goal restored a history that distinguished Tried again from Skipped, advanced focus to Respond, and kept the evidence consequence visible.
Two later accepted goals reached Incomplete, focused the result heading, identified Order as Skipped and Respond and Repair as Accepted, preserved the previous-best-evidence message, and exposed Try again.

A fresh three-accepted-goal journey reached Independent evidence and focused the result heading.
A separate fresh journey revealed English support before recording and reached Supported evidence with the correct explanation.

### Mobile layout and keyboard accessibility

The 390 by 844 pass exercised semantic retry, Record again, Skip goal, restored history, next-goal focus, accepted feedback, Incomplete, Independent, and Supported results.
At each inspected state, the document client width and scroll width were both 390 CSS pixels.
No inspected descendant under the main content had a scroll width greater than its client width.

Keyboard-reachable native buttons or links were present for Listen, Replay, Stop audio, both support actions, Record, Stop and assess, Cancel, Record again, Skip goal, Continue, Try again, and returning to Travel Missions.
Focus moved to the briefing heading, current goal, written support, English support, retry or technical feedback, next goal, Incomplete result, Independent result, and Supported result as each state appeared.
Status regions announced loading, playing, stopped, recording, assessment, skip, and result transitions.

## Privacy and persistence evidence

Browser local storage and session storage contained no audio or recording keys after real captures and all result paths.
The temporary database schema contained no raw-audio column in `user_spoken_missions`.
Stored conversation logs contained only JSON text for retained transcript, assessment, disclosure, and history data.
The temporary database, generated acceptance audio, and browser profiles remained outside the repository.
Application logs contained sanitized operational messages and no raw audio, credentials, full prompts, or complete provider payloads.

## Acceptance checklist

- [x] The mounted learner flow covers Independent, Supported, semantic Retry and Skip, Incomplete, and `could_not_assess` behavior.
- [x] Route and persistence integration suites cover resume, disclosure restoration, skipped history, idempotency, terminal Incomplete state, and previous-best-evidence preservation.
- [x] Headed desktop acceptance covers the revised audio-first and real microphone boundaries.
- [x] Headed 390 by 844 acceptance covers the complete retry, skip, successful evidence, and incomplete-result interface without horizontal overflow.
- [x] Microphone permission remains unrequested until Record in a clean browser profile.
- [x] Keyboard targets, focus destinations, and live status announcements cover every revised state.
- [x] Raw audio remains transient and absent from browser storage, database schema and state, API responses, diagnostics, and logs.
- [x] The repository full CI gate passes after the acceptance fix and documentation updates.

## Residual limitations

No live OpenAI credential was available during this final pass.
The browser therefore used deterministic network-boundary responses for semantic Retry, Skip continuation, Independent, Supported, and Incomplete presentation, while the real route and repository suites validated the corresponding server mutations and persistence.
The Japanese playback sample was generated locally and played through the production Web Audio boundary, so this pass validated audible playback and UI control but did not revalidate OpenAI TTS generation.
The earlier [2026-07-15 Spoken Mission browser acceptance](2026-07-15-spoken-mission-browser-acceptance.md) records live provider transcription, semantic grading, TTS, and real microphone evidence for the underlying Spoken Mission service boundaries.

## Verdict

Approved with the residual provider limitation recorded above.

## Blocking issues

- None.

## Non-blocking suggestions

- Repeat the full headed journey with a live OpenAI credential when one is available to refresh provider-boundary evidence in the same pass.
