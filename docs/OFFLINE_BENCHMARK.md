# Offline provider benchmark

Offline support is a release gate, not a promised v0.2 feature. A provider is shipped only when one configuration passes every automated, bilingual-review, live-failover, resource, and rehearsal criterion.

## Candidates

- `faster-whisper` small and medium multilingual on CPU INT8
- `whisper.cpp` small and medium quantized on CPU and Vulkan where available
- `Helsinki-NLP/opus-mt-en-vi` and `Helsinki-NLP/opus-mt-vi-en`, converted to CTranslate2 INT8

`whisper.cpp` documents a live microphone example and CPU/GPU backends including Vulkan in its [project README](https://github.com/ggml-org/whisper.cpp). Both OPUS-MT directions declare Apache-2.0 on their model cards: [English→Vietnamese](https://huggingface.co/Helsinki-NLP/opus-mt-en-vi) and [Vietnamese→English](https://huggingface.co/Helsinki-NLP/opus-mt-vi-en).

SeamlessM4T/SeamlessStreaming and NLLB are intentionally excluded from distribution. Seamless models have noncommercial restrictions in their [license](https://github.com/facebookresearch/seamless_communication/blob/main/SEAMLESS_LICENSE). NLLB-600M is a text-translation research model under CC-BY-NC 4.0, not a speech transcriber; see its [model card](https://huggingface.co/facebook/nllb-200-distilled-600M).

## Test host

Use a Windows 11 x64 eight-core laptop or NUC with integrated graphics and 16 GB RAM. Run OBS with the real 1080p scene collection during resource and two-hour tests. Record exact CPU, GPU, RAM, driver, model hashes, compiler flags, and application commit.

## Fixture manifest

Copy `offline/benchmark-manifest.example.json`. Add consented 16-kHz mono 16-bit PCM WAV files under the ignored `offline/fixtures` directory. Include reference transcription, reference translation, and the bilingual review result. Do not commit recordings.

## Run

```powershell
python -m venv .venv-offline
.venv-offline\Scripts\pip install -r offline\requirements-benchmark.txt
.venv-offline\Scripts\python offline\benchmark.py `
  --manifest offline\benchmark-manifest.json `
  --engine faster-whisper `
  --model small `
  --compute-type int8 `
  --external-evidence offline\external-evidence.json `
  --output offline\results\faster-whisper-small-int8.json
```

For `whisper.cpp`, also pass `--whisper-cli` and a local model path. Build separate CPU and `GGML_VULKAN=1` binaries and identify them in the report filename.

Convert both OPUS models:

```powershell
.venv-offline\Scripts\python offline\convert_opus.py --output offline\models
```

Then pass `--translation-en-vi` and `--translation-vi-en` to the benchmark. Downloads occur before the event; no model weight is committed.

## Interpretation

The harness refuses to mark a configuration eligible when human review or live evidence is missing. Batch fixture timing alone cannot establish partial latency, failover time, OBS stability, or two-hour reliability. Populate the external-evidence JSON only from the venue-style runbook.

Choose the smallest passing ASR configuration. Break ties using bilingual quality, then final latency, then memory. If none pass, publish the report and do not expose or market offline mode.

If a candidate passes, the implementation still needs a checksum-verifying model manager, license display, airplane-mode readiness check, cloud/offline/warm-fallback modes, a ten-second switch threshold, and operator-confirmed return to cloud at a speech pause.
