# Notta evaluation and fallback runbook

**Reviewed:** 2026-08-09. Recheck product behavior, plan limits, pricing, and terms before every paid event.

## Decision

Notta is a connected, consent-dependent standalone fallback and a rehearsal comparator. It is not an embedded Live Caption Bridge provider and is not privacy-equivalent to this project.

Official evidence confirms:

- Notta supports bilingual transcription/translation on web and mobile, and lists English and Vietnamese among the 23 supported bilingual languages. [Bilingual transcription and translation](https://support.notta.ai/hc/en-us/articles/23437010425755-Bilingual-transcription-translation-Web)
- Recording and transcription require stable internet because audio is uploaded for server processing. [Offline limitations](https://support.notta.ai/hc/en-us/articles/37293457169051-Can-I-record-and-transcribe-using-the-Notta-mobile-app-offline)
- Instant Record saves both audio and transcript to the account. [Instant Record](https://support.notta.ai/hc/en-us/articles/15388442646939-Instant-Record)
- Transcription data is retained until it is manually deleted, its workspace is deleted, or the account is deleted. [Storage period](https://support.notta.ai/hc/en-us/articles/38209626203931-Is-there-a-storage-period-or-capacity-limit-for-transcription-data)
- The mobile app offers picture-in-picture live subtitles. [Mobile PiP subtitles](https://support.notta.ai/hc/en-us/articles/38459538787099-Live-subtitles-in-Picture-in-Picture-mode)
- Published integrations focus on meeting and note workflows. No official transparent OBS/browser overlay, venue projector mode, or public streaming bilingual SDK was found during this review; treat those capabilities as absent unless Notta documents them. [Published integrations](https://www.notta.ai/en/integrations/)
- Bilingual translation has plan/add-on limits. [Pricing](https://www.notta.ai/en/pricing)
- Notta publishes TLS/AES encryption and compliance controls, but secure cloud storage still conflicts with this project's no-persistence default. [Security](https://www.notta.ai/en/security)

## Appropriate uses

- Emergency connected fallback when the couple has explicitly accepted cloud recording and retention.
- Side-by-side quality, language-switching, latency, and usability comparison during rehearsals.
- Temporary OBS Window Capture with cropping, but only after checking that the captured Notta interface is readable and does not expose private controls or other records.

Do not market Notta as an offline fallback, transparent overlay source, privacy-equivalent substitute, or supported `SpeechProvider` integration.

## Pre-event setup

1. Obtain explicit consent to record and cloud-process speech from the couple and venue stakeholders; include guest notice appropriate to local law.
2. Confirm the paid plan, bilingual add-on, remaining quota/usage count, maximum session duration, account access, and deletion permissions.
3. Select English and Vietnamese bilingual transcription/translation and test language switching with the actual operator account.
4. Select the USB audio interface as the operating-system/browser microphone input. Notta does not document a wedding soundboard workflow, so verify the exact interface and gain path.
5. Use the same dedicated mic-only mixer aux feed as Live Caption Bridge. Never add the fallback laptop or app to the PA signal path.
6. Test Ethernet and the rehearsed hotspot. Notta has no live offline transcription mode.
7. If using OBS Window Capture, crop all account controls and confirm legibility at the projector's actual resolution.

## Rehearsal comparison

Use the same bilingual speakers and direct USB-interface audio used for Live Caption Bridge. Record:

- First source partial and final translated-caption latency at P95.
- Meaning preservation and Vietnamese diacritics.
- English/Vietnamese switching between utterances.
- Names, wedding terminology, laughter, applause, and moderate background noise.
- Network interruption, hotspot recovery, quota behavior, and maximum-session behavior.
- Projector/OBS legibility and recovery after refreshing or changing scenes.

Copy `evaluation/notta-comparison.example.json` to an ignored, private working location and record only aggregate measurements and equipment metadata. Never add transcript content, audio, participant names, credentials, or account identifiers.

Notta is not approved as an event fallback until the operator completes at least one full venue-style rehearsal with the actual account and display workflow.

## End-of-event deletion

1. Stop recording and verify that the fallback is no longer processing audio.
2. Export only if the couple explicitly requested and approved an archival copy.
3. Move the Notta record to Trash.
4. Permanently delete it from Trash or use Empty Trash; merely moving it to Trash does not immediately remove it.
5. Record completion in the event checklist without copying transcript content into operational logs. [Delete and restore data](https://support.notta.ai/hc/en-us/articles/15552432280987-How-to-delete-restore-and-organize-recordings-on-Notta-Web)

## API reconsideration gate

Do not create a Notta adapter unless official vendor documentation and terms provide all of: real-time PCM streaming input; English/Vietnamese bilingual partial and final events; stable source-language metadata; embedding and redistribution rights; published limits and pricing; controllable retention that meets project privacy requirements; and a supported recovery model.
