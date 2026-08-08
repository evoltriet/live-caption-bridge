# Azure Speech setup

The v0.1 provider uses the Azure Speech SDK and the universal v2 speech endpoint. Azure receives live PCM only while a session is running.

## Create credentials

1. In the Azure portal, create a Speech or compatible Foundry resource in a region that supports both English and Vietnamese speech translation.
2. Open the resource's **Keys and Endpoint** page.
3. Copy one key and the short region name, for example `eastus`.
4. Enter both in the operator app. Leave **Remember key** off for session-only use.

When **Remember key** is enabled, the key is encrypted with Electron `safeStorage` and the encrypted blob is stored in the current Windows user profile. It is not written to project files. Use **Forget saved key** to remove it.

Do not put keys in `.env`, OBS URLs, screenshots, issue reports, or repository secrets unless a CI job explicitly requires them. Rotate a key immediately if it is exposed.

## Recognition modes

- **Auto detect** constrains candidates to `en-US` and `vi-VN` and requests continuous language identification on the universal v2 endpoint.
- **English** fixes the source language to `en-US`.
- **Vietnamese** fixes the source language to `vi-VN`.

Azure documents that intermediate translations are unavailable for multilingual speech translation. In Auto mode, the app therefore shows the detected-language source partial and fills both lanes when the utterance is finalized. Fixed-language mode can provide translated partials when Azure returns them. See Microsoft's [speech translation guide](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-translate-speech) and [language-identification guide](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification).

Word-level code switching is best-effort. Switch languages between speakers or utterances. If automatic detection is unreliable for short vows or names, the operator should choose the speaker's language manually before they begin.

## Preflight

1. Connect Ethernet and start the app.
2. Start a short session in English, then Vietnamese.
3. Confirm source and translated final text appear in the correct fixed lanes.
4. Unplug Ethernet for at least 10 seconds and confirm the unavailable state.
5. connect the rehearsed hotspot and verify recovery.
6. End the session and verify no transcript file exists unless you explicitly exported one.

Real Azure integration tests are opt-in because they incur usage and require a secret. Never use recordings without speaker permission.
