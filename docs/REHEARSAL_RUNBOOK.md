# Test and rehearsal runbook

## Automated checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Unit coverage includes partial revision, finalization, two-segment display history, fixed English/Vietnamese lanes, reconnect state, UTF-8 exports, IPC validation, WebSocket events, and log redaction. Electron E2E uses a synthetic WAV and a development-only provider; it does not call Azure.

Real Azure testing is manual/opt-in. Never put production credentials or personal recordings in the repository.

## Bilingual fixture set

Use consented 16-kHz mono PCM WAV fixtures and live speakers covering:

- English and Vietnamese speakers with varied accents
- Alternating language between utterances
- Names, wedding terminology, vows, laughter, applause, and moderate background noise
- Short utterances and utterances at least three seconds long
- Vietnamese diacritics, long captions, and line wrapping at 720p, 1080p, and 4K

Have a bilingual reviewer record whether each finalized translation preserves meaning. Automated metrics alone do not qualify translation quality.

## Failure matrix

During direct mixer/interface/OBS/external-display testing:

1. Unplug and reconnect the USB interface. Confirm pause and explicit reselection.
2. Remove Ethernet for more than ten seconds, move to the rehearsed hotspot, and time recovery.
3. Refresh the OBS browser source and change scenes while speech continues.
4. Disconnect/reconnect the external display and restore fullscreen.
5. Pause, clear, resume, end, and explicitly export each supported format.

## Two-hour load test

Run the exact event laptop, interface, adapter, display, OBS collection, network, and power supply for two hours. Record every 5 minutes:

- process and system memory
- sustained CPU/GPU utilization and at least 20% headroom
- temperature/throttling indicators
- OBS dropped frames and render/encoding lag
- partial and final caption latency samples
- provider reconnects and device/display events

No crash, thermal throttling, unbounded memory growth, or OBS instability is allowed.

## Release gates

| Gate | Required |
|---|---:|
| Setup after cables connected | < 5 minutes |
| Source partial latency P95 | ≤ 2.5 seconds |
| Final bilingual latency after utterance completion P95 | ≤ 4 seconds |
| Auto language ID, utterances ≥3 seconds | ≥ 90% |
| Bilingual meaning-preserved review | ≥ 90% |
| Cloud recovery / gated warm fallback | ≤ 15 seconds |
| Offline application memory | ≤ 8 GB |
| Sustained compute headroom with OBS | ≥ 20% |
| Two-hour stability | Pass |
| Venue-style rehearsals | 2 complete passes |
| Audio/transcript written without explicit action | Never |

If any gate fails, use Wordly or another staffed production service as primary and keep this app in supervised evaluation.
