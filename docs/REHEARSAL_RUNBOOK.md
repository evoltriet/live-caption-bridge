# Test and rehearsal runbook

## Automated checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Automated coverage includes partial revision/finalization, two-segment history, locale mapping, versioned envelopes, receiver preference mapping, reconnect state, UTF-8 exports, IPC validation, loopback health, LAN authentication/token expiry, 50 receivers, WebSocket events, and log redaction. Electron E2E injects synthetic PCM and exercises the operator, screen, OBS, and native-overlay routes; it does not call Azure or prove physical click-through behavior.

Real Azure, Notta, network-latency, hardware, and bilingual testing is manual/opt-in. Never put production credentials or personal recordings in the repository.

## Bilingual fixture set

Use consented 16 kHz mono PCM WAV fixtures and live speakers covering:

- English and Vietnamese speakers with varied accents
- Alternating language between utterances
- Names, wedding terminology, vows, laughter, applause, and moderate background noise
- Short utterances and utterances at least three seconds long
- Vietnamese diacritics, long captions, and wrapping at 720p, 1080p, and 4K

Have a bilingual reviewer record whether each finalized translation preserves meaning. Automated metrics alone do not qualify translation quality.

## Presentation and failure matrix

Using the direct mixer/interface, external display, PowerPoint, browser video, VLC, and OBS:

1. Open the native overlay at top, center, and bottom using all four profiles. Confirm it stays above windowed/borderless visuals and never takes focus or pointer input.
2. Enter exclusive fullscreen, confirm the documented limitation, then recover using windowed mode or OBS.
3. Refresh the OBS browser source and change scenes while speech continues.
4. Test opaque fullscreen and native/OBS transparency at 720p, 1080p, and 4K.
5. Unplug/reconnect the USB interface. Confirm pause and explicit reselection with no laptop-mic fallback.
6. Remove Ethernet for more than ten seconds, move to the rehearsed hotspot, and time recovery.
7. Disconnect/reconnect the external display and restore the selected output.
8. Pause, clear, resume, end, and explicitly export each supported format.

## LAN receiver test

On the representative venue network:

1. Confirm sharing is off on startup and the loopback service remains unreachable from another device.
2. Start a session, select the intended private interface, start sharing, and pair English, Vietnamese, bilingual, and glance receivers.
3. Verify the token exists only in the URL fragment and no captions arrive before authentication.
4. Measure caption-envelope receipt to DOM-render time on representative phones/glasses; P95 must be at most 500 ms.
5. Connect 50 read-only clients or an equivalent controlled load harness and confirm bounded memory/CPU and stable host presentation.
6. Attempt a 51st connection and receiver-to-host write; confirm rejection without host instability.
7. Stop sharing and end the session; confirm every client disconnects and the old QR code cannot reconnect.
8. Repeat with Windows Firewall enabled and the actual venue router. Never enable public port forwarding.

## Notta comparison

Follow [the Notta fallback runbook](NOTTA_EVALUATION.md) using the same USB interface, bilingual speakers, fixtures, wired network, and hotspot. Measure source/final latency, translation meaning, language switching, projector/OBS usability, quota/session limits, network failure, and permanent deletion. Notta cannot pass the project's no-persistence gate and must be labeled as a different consent posture.

## Two-hour load test

Run the exact event laptop, interface, adapter, display, OBS collection, LAN receiver set, network, and power supply for two hours. Record every five minutes:

- process and system memory
- sustained CPU/GPU utilization and at least 20% headroom
- temperature and throttling indicators
- OBS dropped frames and render/encoding lag
- partial, final, and receiver-render latency samples
- provider reconnects and device/display/network events

No crash, thermal throttling, unbounded memory growth, or OBS instability is allowed.

## Release gates

| Gate | Required |
|---|---:|
| Setup after cables connected | < 5 minutes |
| Source partial latency P95 | ≤ 2.5 seconds |
| Final bilingual latency after utterance completion P95 | ≤ 4 seconds |
| Auto language ID, utterances ≥3 seconds | ≥ 90% |
| Bilingual meaning-preserved review | ≥ 90% |
| LAN event-to-render latency P95 | ≤ 500 ms |
| Cloud recovery / gated warm fallback | ≤ 15 seconds |
| Offline application memory | ≤ 8 GB |
| Sustained compute headroom with OBS | ≥ 20% |
| Two-hour stability | Pass |
| Venue-style rehearsals | 2 complete passes |
| Audio/transcript written without explicit action | Never |

If any gate fails, use Wordly or another staffed production service as primary and keep Live Caption Bridge in supervised evaluation.
