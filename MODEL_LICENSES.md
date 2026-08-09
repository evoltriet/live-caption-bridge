# Model and service licenses

No model weights are distributed in v0.1 or committed to this repository.

| Component | Intended use | License / terms | Distribution status |
|---|---|---|---|
| Azure Speech SDK/service | v0.1 cloud speech translation | Microsoft package/service terms | SDK dependency only; service credentials supplied by operator |
| Notta | Explicit-consent external fallback/comparator | Notta subscription and service terms | Not integrated or redistributed; operator-managed account only |
| Whisper model weights via faster-whisper | v0.2 benchmark candidate | Verify upstream code and each selected checkpoint before release | Not distributed |
| whisper.cpp and compatible weights | v0.2 benchmark candidate | MIT code; verify model-weight provenance separately | Not distributed |
| Helsinki-NLP/opus-mt-en-vi | v0.2 translation candidate | Apache-2.0 model card | Not distributed |
| Helsinki-NLP/opus-mt-vi-en | v0.2 translation candidate | Apache-2.0 model card | Not distributed |
| Seamless models | Excluded | Noncommercial restrictions / CC-BY-NC depending model | Never distributed |
| NLLB-200 distilled 600M | Excluded | CC-BY-NC 4.0; research-oriented text translation | Never distributed |

Before any offline release, record immutable model URLs, revisions, sizes, SHA-256 checksums, full license texts, attributions, conversion commands, and resulting artifact checksums. The model manager must show these licenses before download and verify every artifact before declaring airplane-mode readiness.
