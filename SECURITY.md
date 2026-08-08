# Security policy

## Supported versions

Until a stable release, only the latest `main` branch receives security fixes.

## Reporting

Do not open a public issue containing credentials, private audio, transcripts, or a vulnerability that could expose them. Use GitHub's private vulnerability reporting for this repository. If that feature is unavailable, contact the maintainer privately through the profile linked from the repository owner.

Include the affected commit/version, reproduction steps using synthetic content, impact, and suggested mitigation. Remove all personal data and secrets.

## Security invariants

- Display services bind only to `127.0.0.1`.
- No audio is saved.
- Transcript export requires an explicit operator file choice.
- The renderer is sandboxed with context isolation and no Node integration.
- IPC payloads are validated and audio chunk size is bounded.
- Credentials are session-only or encrypted with Electron `safeStorage`.
- Logs and health endpoints contain no captions, audio, or credentials.
