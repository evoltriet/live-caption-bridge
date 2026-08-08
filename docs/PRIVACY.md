# Privacy and guest consent

Wedding speeches are personal. Treat live transcription as recording-adjacent even though v0.1 does not save raw audio.

## Data behavior

- The selected audio is sent to Azure Speech only while a cloud session is active.
- The app never writes raw audio to disk.
- Caption text stays in memory unless the operator explicitly exports it.
- Exports are UTF-8 TXT, JSON, or bilingual WebVTT and are saved only to the chosen path.
- The application has no telemetry.
- Operational status excludes caption content, audio, and credentials.
- The display server is loopback-only and cannot be opened by guest devices on the venue LAN.

Electron `safeStorage` can optionally encrypt an Azure key in the Windows user profile. Session-only credentials are the safer choice on a borrowed laptop.

## Consent checklist

Requirements differ by venue and jurisdiction; this is not legal advice.

1. Tell the couple, wedding party, officiant, venue, and speakers that automated cloud captions will be used.
2. Explain that audio is processed by Azure but not recorded by this app.
3. Obtain consent before the event and offer speakers a practical way to opt out.
4. Put a concise notice in the program or near the audience display when appropriate.
5. Decide before the event whether transcript export is allowed, who receives it, and when it is deleted.
6. Avoid exporting by default. If exported, store it in an access-controlled location and delete it on the agreed schedule.

Do not use wedding audio as a benchmark fixture unless every identifiable speaker has explicitly agreed. Prefer purpose-recorded evaluation fixtures.
