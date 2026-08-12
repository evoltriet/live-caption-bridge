# Privacy and guest consent

Wedding speeches are personal. Treat live transcription as recording-adjacent even though Live Caption Bridge does not save raw audio.

## Data behavior

- The selected audio is sent to Azure Speech only while a cloud session is active.
- The app never writes raw audio to disk.
- Caption text stays in memory unless the operator explicitly exports it.
- Exports are UTF-8 TXT, locale-neutral JSON, or bilingual WebVTT and are saved only to the chosen path.
- The application has no telemetry.
- Operational status, health endpoints, and logs exclude caption content, audio, credentials, and LAN pairing tokens.
- The default display server is loopback-only.
- LAN sharing is off by default. When enabled, captions are sent to authenticated read-only clients over unencrypted local HTTP/WebSocket traffic on the selected trusted private network.

Electron `safeStorage` can optionally encrypt an Azure key in the Windows user profile. Session-only credentials are safer on a borrowed laptop.

## Consent checklist

Requirements differ by venue and jurisdiction; this is not legal advice.

1. Tell the couple, wedding party, officiant, venue, and speakers that automated cloud captions will be used.
2. Explain that audio is processed by Azure but not recorded by this app.
3. Explain whether local receiver sharing will be enabled and that paired devices can read the current caption stream.
4. Obtain consent before the event and offer speakers a practical way to opt out.
5. Put a concise notice in the program or near the audience display when appropriate.
6. Decide before the event whether transcript export is allowed, who receives it, and when it is deleted.
7. Avoid exporting by default. If exported, store it in an access-controlled location and delete it on schedule.

Do not use wedding audio as a benchmark fixture unless every identifiable speaker explicitly agreed. Prefer purpose-recorded evaluation fixtures.

## Third-party fallback difference

Notta is not privacy-equivalent: its official Instant Record workflow saves audio and transcript to the account and retains transcription data until deletion. Use it only after separate explicit recording/cloud-retention consent, then follow the permanent-deletion steps in the [Notta fallback runbook](NOTTA_EVALUATION.md).
