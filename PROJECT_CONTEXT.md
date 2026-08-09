# Live Caption Bridge — Project Context

**Canonical project source of truth**
**Last updated:** 2026-08-09
**Evidence cutoff:** 2026-08-09

Read this file before planning or changing the project. Update it in the same change whenever a product decision, verified capability, vendor fact, or backlog status changes.

## Status vocabulary

- **Implemented:** present in the local codebase.
- **Automated verified:** covered by a passing automated test or build.
- **Field validation needed:** implemented or planned, but not proven on the wedding rig.
- **Planned:** accepted for the current milestone but not yet complete.
- **Backlog:** intentionally deferred.
- **Rejected:** evaluated and deliberately excluded.
- **Superseded:** an older decision replaced by a later one.

## Mission and audience

Live Caption Bridge is a reusable, open-source live-caption host and delivery protocol. Its first production reference solution is an English–Vietnamese wedding operated by a venue AV technician or technically confident helper. The Windows host owns audio capture, transcription, translation, caption state, and presentation; read-only clients may render the same captions on other local devices.

Only `en-US` and `vi-VN` are production-qualified for the initial release. Switching languages between utterances or speakers is supported; word-level code-switching inside one sentence is best-effort.

## Current verified state

- **Implemented / automated verified:** `feat/platform-foundation` contains the pnpm workspace; generic Live Caption Bridge branding; Electron, React, and strict-TypeScript Windows host; selected-device audio capture and 16 kHz mono PCM conversion; Azure adapter; operator controls; in-memory store; versioned locale-neutral protocol/client packages; opaque fullscreen, transparent OBS, and native always-on-top/non-focusable overlay routes; responsive authenticated LAN receiver; first-message token validation, session invalidation, read-only enforcement, and 50-client bound; explicit TXT/JSON/WebVTT exports; safeStorage credentials; redacted operational logging; Docker development fixtures; unsigned Windows installer, portable executable, ZIP, and SHA-256 checksums.
- **Automated evidence:** `pnpm check` passes 9 test files/19 tests plus lint, strict typechecking across four packages, and production builds. Electron E2E passes with injected PCM and verifies the operator, 720p/1080p/4K screen route, OBS transparency, and native overlay window flags.
- **Field validation needed:** real Azure credentials, bilingual accuracy and latency, direct mixer/USB-interface input, physical mouse click-through over PowerPoint/browser video/VLC, external-display recovery, representative LAN event-to-render latency, OBS load, two-hour thermal and memory stability, network/hotspot recovery, Notta comparison, and venue setup time.
- **Planned:** publication of the draft pull request and `v0.1.0-alpha.1` artifacts after GitHub authentication is available.
- **Not published:** the local repository and release artifacts have not yet been pushed to a public GitHub repository.

Automated success never implies venue readiness. The app must not be described as production-ready until all field gates and two complete rehearsals pass.

## Locked product and safety decisions

- The caption laptop is never inline with the PA. Use a dedicated post-fader, mic-only mixer aux/line/USB output into a class-compliant audio interface; exclude music and room microphones.
- Use a dedicated Windows 11 laptop/NUC at the AV table on AC power. Disable sleep, notifications, and event-time updates. Prefer Ethernet and keep a rehearsed hotspot.
- Never save raw audio. Keep transcript text in memory and write it only after an explicit operator export. Add no application telemetry and never place captions, audio, or credentials in operational logs.
- If the selected audio device disappears, pause and require reselection. Never silently fall back to the laptop microphone.
- Azure Speech Translation is the v0.1 cloud provider. It is selected and implemented, but still requires field qualification.
- Keep English permanently above Vietnamese in the wedding preset. Replace interim text in place, retain the current partial and two latest final segments, and publish a translation on finalization if interim translation is unavailable.
- Presentation paths are: caption-only fullscreen, transparent OBS browser source, and a native click-through Windows overlay. Use the native overlay for visuals on the same composited Windows desktop; use OBS or a hardware compositor for external sources, livestreams, or exclusive-fullscreen applications.
- The loopback display service remains bound to `127.0.0.1:43117`. LAN delivery is a separate, opt-in, read-only service on port `43118` with per-session authentication and a visible unencrypted-LAN warning.
- Docker is for reproducible development, fixture tests, conversion, and benchmarks only. Do not capture wedding audio or ship the event runtime in Docker.

## Public protocol decisions

- Transport messages use a versioned envelope with session ID, monotonic message sequence, event timestamp, type, and payload.
- Caption segments use locale tags and `texts: Record<string, string>` rather than fixed English/Vietnamese transport fields.
- Receivers choose one of `bilingual`, `english`, `vietnamese`, or `glance` profiles. The protocol remains locale-neutral even though only English and Vietnamese are initially qualified.
- LAN sharing is off by default, limited to 50 read-only clients, and authenticated by a random 128-bit session token. The QR URL stores the token in its fragment so it is not sent in the initial HTTP request; the receiver sends it as the first WebSocket message. Stop-sharing and session-end invalidate the token.
- The responsive web receiver is the portable reference client. Native mobile apps, device-specific smart-glass adapters, and cloud relays must consume the same public protocol rather than speech-provider internals.

## Providers and alternatives

| Option | Classification | Decision |
|---|---|---|
| Live Caption Bridge + Azure | Current v0.1 product path | Owned presentation and privacy behavior; requires internet and field validation. |
| Wordly | Venue-oriented turnkey fallback | Safest supported fallback until this project passes every rehearsal gate; recheck event pricing and behavior before booking. |
| Notta | Connected, consent-dependent fallback and benchmark | Do not embed. Use only after rehearsal, quota check, explicit recording consent, and acknowledgement of its cloud-retention posture. |
| Local Whisper + OPUS-MT | Gated v0.2 candidate | Ship only if every latency, quality, reliability, memory, licensing, and headroom gate passes. |

Notta's official documentation confirms web/mobile bilingual transcription and translation for English and Vietnamese, but also states that transcription requires internet and that Instant Record stores audio and transcript in the account. Treat transparent OBS output, venue-projector output, and a public streaming bilingual API as unavailable unless Notta supplies official documentation. See [the dated evaluation](docs/NOTTA_EVALUATION.md).

Do not implement a Notta `SpeechProvider`. Reconsider only if an official API provides streaming PCM input, bilingual partial/final events, redistribution rights, predictable pricing, and an acceptable retention mode.

## Offline gate

Benchmark `faster-whisper` small/medium CPU INT8 and `whisper.cpp` small/medium quantized CPU/Vulkan where available, paired with Apache-2.0 OPUS-MT English→Vietnamese and Vietnamese→English models. Do not commit weights.

Ship an offline provider only if it uses at most 8 GB of application memory, preserves at least 20% sustained compute headroom with OBS active, passes the same bilingual quality and latency gates, verifies model checksums/licenses, and proves airplane-mode readiness. SeamlessM4T and NLLB remain **rejected** for the distributable application because of licensing, size, and product-fit constraints.

## Acceptance and release gates

- Setup under five minutes after cables are connected.
- Source partial appears within 2.5 seconds at P95.
- Final bilingual caption appears within four seconds of utterance completion at P95.
- Automatic language identification is correct for at least 90% of utterances lasting three seconds or longer.
- A bilingual reviewer judges meaning preserved in at least 90% of final translations.
- Local receiver event-to-render latency is at most 500 ms at P95 on a representative venue LAN.
- Two-hour run without crashes, thermal throttling, unbounded memory growth, or OBS instability, with at least 20% sustained compute headroom.
- Cloud recovery or approved warm-offline failover resumes captions within 15 seconds.
- No audio or transcript reaches disk without explicit operator action.
- Two complete venue-style rehearsals on the exact event rig before primary use.

The first public artifact is `v0.1.0-alpha.1`: unsigned Windows installer and portable ZIP with SHA-256 checksums. Alpha does not mean wedding-production-ready.

## Backlog and exclusions

- **Backlog:** qualified languages beyond English/Vietnamese, native mobile clients, device-specific smart-glass adapters, optional trusted HTTPS, remote/cloud relay, supported macOS binaries, and a gated offline provider.
- **Out of scope for current releases:** hosted accounts, billing, translated speech audio, diarization, public internet overlays, and automatic cloud failback during speech.
- **Superseded 2026-08-09:** wedding-only repository/product framing; fixed English/Vietnamese fields in the public transport; guest/mobile access being entirely out of scope; OBS being the only way to overlay same-laptop visuals.

## Planning rule

Every implementation plan must state its `PROJECT_CONTEXT.md` baseline date, identify affected locked decisions, distinguish implementation from field proof, and include a context update whenever the work changes this file's truth.
