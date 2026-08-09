# Release process

## `v0.1.0-alpha.1` prerequisites

1. Read and reconcile [`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md).
2. Run `pnpm check` and `pnpm test:e2e` on Windows 11.
3. Confirm protocol, overlay, and LAN authentication tests pass.
4. Confirm privacy, model-license, Notta, and build-vs-buy documents remain accurate.
5. Confirm no fixture audio, credential, transcript, pairing token, model weight, or personal benchmark result is tracked.

The alpha may ship before physical qualification, but its release notes must explicitly list real Azure, mixer/interface, PowerPoint/VLC click-through, OBS load, LAN latency, two-hour, and bilingual rehearsal work as incomplete. Do not call the alpha wedding-production-ready.

## Build unsigned Windows artifacts

```powershell
pnpm install --frozen-lockfile
pnpm dist:win
Get-FileHash apps\desktop-host\release\*.exe -Algorithm SHA256
Get-FileHash apps\desktop-host\release\*.zip -Algorithm SHA256
```

Electron Builder produces an unsigned NSIS installer and portable executable in `apps/desktop-host/release/`; the packaging script wraps the portable executable in a ZIP. Windows SmartScreen warnings are expected. Never present these artifacts as signed.

The release workflow builds on a `v*` tag, generates `SHA256SUMS.txt`, and uploads artifacts to a draft GitHub release. A maintainer reviews the context and automated evidence before publishing.

## Production qualification

Production wedding use additionally requires the manual Azure/hardware matrix, receiver-latency measurement, two-hour load test, and two complete venue-style rehearsals in the [runbook](REHEARSAL_RUNBOOK.md). Publish those results without audio, transcript content, credentials, or personal data.

## Versioning

- `0.1.x`: Azure-backed Windows host, presentation, protocol, and local receiver fixes
- `0.2.0`: only if the offline provider and model manager pass every gate

Do not expose an Offline option, publish model downloads, or advertise offline readiness based only on fixtures.
