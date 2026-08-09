# Security policy

## Supported versions

Until a stable release, only the latest `main` branch receives security fixes.

## Reporting

Do not open a public issue containing credentials, private audio, transcripts, or a vulnerability that could expose them. Use GitHub's private vulnerability reporting for this repository. If that feature is unavailable, contact the maintainer privately through the profile linked from the repository owner.

Include the affected commit/version, reproduction steps using synthetic content, impact, and suggested mitigation. Remove all personal data and secrets.

## Security invariants

- The default display service binds only to `127.0.0.1:43117`.
- LAN sharing is separate, opt-in, private-interface-only, capped at 50 read-only clients, and requires a random session token in the first WebSocket message.
- LAN tokens live in the pairing URL fragment, never health responses or logs, and are invalidated when sharing or the caption session ends.
- LAN traffic is authenticated but not encrypted; the UI must warn operators to use only a trusted venue network.
- No audio is saved.
- Transcript export requires an explicit operator file choice.
- The renderer is sandboxed with context isolation and no Node integration.
- IPC payloads are validated and audio chunk size is bounded.
- Credentials are session-only or encrypted with Electron `safeStorage`.
- Logs and health endpoints contain no captions, audio, credentials, or pairing tokens.
