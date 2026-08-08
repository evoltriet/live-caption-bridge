# Release process

## v0.1 prerequisites

1. Run `pnpm check` and `pnpm test:e2e` on Windows 11.
2. Complete the Azure/manual hardware matrix and attach anonymized results.
3. Complete the two-hour test and two venue-style rehearsals.
4. Confirm the privacy, model-license, and build-vs-buy documents remain accurate.
5. Confirm no fixture audio, credential, transcript, model weight, or benchmark result with personal content is tracked.

## Build unsigned Windows artifacts

```powershell
pnpm install --frozen-lockfile
pnpm dist:win
Get-FileHash release\*.exe -Algorithm SHA256
```

Electron Builder produces an unsigned NSIS installer and portable executable in `release/`; the packaging script wraps the portable executable in a ZIP. Windows SmartScreen warnings are expected for unsigned binaries. Never present them as signed.

The release workflow builds on a `v*` tag, generates SHA-256 checksums, and uploads artifacts to a draft GitHub release. A maintainer must review the runbook evidence and publish the release manually.

## Versioning

- `0.1.x`: Azure-backed Windows MVP and fixes
- `0.2.0`: only if the offline provider and model manager pass all gates

Do not add an Offline option to the operator UI, publish model downloads, or advertise offline readiness based only on fixture benchmarks.
