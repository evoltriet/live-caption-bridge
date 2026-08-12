#!/usr/bin/env python3
"""Reproducible, evidence-conservative benchmark for the gated v0.2 provider."""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import subprocess
import threading
import time
import wave
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable

import psutil
from jiwer import cer, wer


@dataclass(frozen=True)
class Fixture:
    id: str
    wav: Path
    locale: str
    reference: str
    translation_reference: str | None = None
    meaning_preserved: bool | None = None


@dataclass
class SampleResult:
    id: str
    locale: str
    detected_locale: str
    reference: str
    hypothesis: str
    translation: str | None
    duration_ms: float
    final_latency_ms: float
    real_time_factor: float
    word_error_rate: float
    character_error_rate: float
    meaning_preserved: bool | None


class ResourceMonitor:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self.peak_rss_bytes = 0
        self.peak_system_cpu_percent = 0.0
        self._thread = threading.Thread(target=self._run, daemon=True)

    def __enter__(self) -> "ResourceMonitor":
        psutil.cpu_percent(interval=None)
        self._thread.start()
        return self

    def __exit__(self, *_: object) -> None:
        self._stop.set()
        self._thread.join(timeout=2)

    def _run(self) -> None:
        process = psutil.Process()
        while not self._stop.wait(0.1):
            children = process.children(recursive=True)
            self.peak_rss_bytes = max(
                self.peak_rss_bytes,
                process.memory_info().rss + sum(child.memory_info().rss for child in children),
            )
            self.peak_system_cpu_percent = max(
                self.peak_system_cpu_percent, psutil.cpu_percent(interval=None)
            )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--engine", choices=("faster-whisper", "whisper.cpp"), required=True)
    parser.add_argument("--model", required=True, help="Model name or local model path")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--threads", type=int, default=max(1, (os.cpu_count() or 8) - 2))
    parser.add_argument("--whisper-cli", type=Path)
    parser.add_argument("--translation-en-vi", type=Path)
    parser.add_argument("--translation-vi-en", type=Path)
    parser.add_argument("--tokenizer-en-vi", default="Helsinki-NLP/opus-mt-en-vi")
    parser.add_argument("--tokenizer-vi-en", default="Helsinki-NLP/opus-mt-vi-en")
    parser.add_argument("--external-evidence", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    fixtures = [
        Fixture(
            id=item["id"],
            wav=(args.manifest.parent / item["wav"]).resolve(),
            locale=item["locale"],
            reference=item["reference"],
            translation_reference=item.get("translation_reference"),
            meaning_preserved=item.get("meaning_preserved"),
        )
        for item in manifest["fixtures"]
    ]
    for fixture in fixtures:
        validate_wave(fixture.wav)

    transcribe = build_transcriber(args)
    translate = build_translator(args)
    results: list[SampleResult] = []
    with ResourceMonitor() as monitor:
        for fixture in fixtures:
            duration_ms = wave_duration_ms(fixture.wav)
            started = time.perf_counter()
            hypothesis, detected_locale = transcribe(fixture)
            final_latency_ms = (time.perf_counter() - started) * 1_000
            translation = translate(hypothesis, detected_locale) if translate else None
            results.append(
                SampleResult(
                    id=fixture.id,
                    locale=fixture.locale,
                    detected_locale=detected_locale,
                    reference=fixture.reference,
                    hypothesis=hypothesis,
                    translation=translation,
                    duration_ms=duration_ms,
                    final_latency_ms=final_latency_ms,
                    real_time_factor=final_latency_ms / duration_ms,
                    word_error_rate=wer(fixture.reference, hypothesis),
                    character_error_rate=cer(fixture.reference, hypothesis),
                    meaning_preserved=fixture.meaning_preserved,
                )
            )

    external = (
        json.loads(args.external_evidence.read_text(encoding="utf-8"))
        if args.external_evidence
        else {}
    )
    summary = summarize(results, monitor, external)
    report = {
        "schema_version": 1,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "configuration": {
            "engine": args.engine,
            "model": args.model,
            "compute_type": args.compute_type,
            "device": args.device,
            "threads": args.threads,
        },
        "host": host_details(),
        "summary": summary,
        "samples": [asdict(result) for result in results],
        "external_evidence": external,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


def build_transcriber(args: argparse.Namespace) -> Callable[[Fixture], tuple[str, str]]:
    if args.engine == "faster-whisper":
        from faster_whisper import WhisperModel

        model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)

        def transcribe(fixture: Fixture) -> tuple[str, str]:
            segments, info = model.transcribe(
                str(fixture.wav), language=None, beam_size=5, vad_filter=True
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
            return text, normalize_locale(info.language)

        return transcribe

    if not args.whisper_cli:
        raise SystemExit("--whisper-cli is required for whisper.cpp")

    def transcribe_cpp(fixture: Fixture) -> tuple[str, str]:
        command = [
            str(args.whisper_cli), "-m", args.model, "-f", str(fixture.wav),
            "-l", "auto", "-t", str(args.threads), "-nt", "-np"
        ]
        completed = subprocess.run(command, check=True, capture_output=True, text=True)
        combined = f"{completed.stdout}\n{completed.stderr}"
        detected = re.search(r"auto-detected language:\s*([a-z]{2})", combined, re.IGNORECASE)
        text = " ".join(line.strip() for line in completed.stdout.splitlines() if line.strip())
        return text, normalize_locale(detected.group(1) if detected else "")

    return transcribe_cpp


def build_translator(args: argparse.Namespace) -> Callable[[str, str], str] | None:
    if not args.translation_en_vi or not args.translation_vi_en:
        return None
    import ctranslate2
    from transformers import AutoTokenizer

    models = {
        "en-US": (
            ctranslate2.Translator(str(args.translation_en_vi), device="cpu"),
            AutoTokenizer.from_pretrained(args.tokenizer_en_vi, local_files_only=True),
        ),
        "vi-VN": (
            ctranslate2.Translator(str(args.translation_vi_en), device="cpu"),
            AutoTokenizer.from_pretrained(args.tokenizer_vi_en, local_files_only=True),
        ),
    }

    def translate(text: str, locale: str) -> str:
        translator, tokenizer = models[locale]
        tokens = tokenizer.convert_ids_to_tokens(tokenizer.encode(text))
        result = translator.translate_batch([tokens], beam_size=4)[0]
        ids = tokenizer.convert_tokens_to_ids(result.hypotheses[0])
        return tokenizer.decode(ids, skip_special_tokens=True)

    return translate


def summarize(
    results: list[SampleResult], monitor: ResourceMonitor, external: dict[str, Any]
) -> dict[str, Any]:
    long_results = [result for result in results if result.duration_ms >= 3_000]
    lid_rate = (
        sum(result.detected_locale == result.locale for result in long_results) / len(long_results)
        if long_results
        else None
    )
    reviewed = [result for result in results if result.meaning_preserved is not None]
    meaning_rate = (
        sum(bool(result.meaning_preserved) for result in reviewed) / len(reviewed)
        if reviewed
        else None
    )
    latency_p95 = percentile([result.final_latency_ms for result in results], 0.95)
    headroom = max(0.0, 1 - monitor.peak_system_cpu_percent / 100)
    automated = {
        "final_latency_p95": latency_p95 <= 4_000,
        "language_identification": lid_rate is not None and lid_rate >= 0.9,
        "meaning_preserved": meaning_rate is not None and meaning_rate >= 0.9,
        "memory": monitor.peak_rss_bytes <= 8 * 1024**3,
        "compute_headroom": headroom >= 0.2,
    }
    required_external = {
        "source_partial_p95_ms": lambda value: value <= 2_500,
        "two_hour_run_passed": bool,
        "cloud_or_fallback_recovery_p95_ms": lambda value: value <= 15_000,
        "obs_stable": bool,
        "rehearsals_completed": lambda value: value >= 2,
    }
    external_pass = {
        name: bool(check(external[name])) if name in external else False
        for name, check in required_external.items()
    }
    return {
        "sample_count": len(results),
        "word_error_rate_mean": statistics.fmean(r.word_error_rate for r in results),
        "character_error_rate_mean": statistics.fmean(r.character_error_rate for r in results),
        "final_latency_p95_ms": latency_p95,
        "language_identification_rate_3s_plus": lid_rate,
        "reviewed_meaning_preserved_rate": meaning_rate,
        "peak_rss_bytes": monitor.peak_rss_bytes,
        "minimum_compute_headroom": headroom,
        "automated_gates": automated,
        "external_gates": external_pass,
        "eligible_to_ship": all(automated.values()) and all(external_pass.values()),
    }


def validate_wave(path: Path) -> None:
    with wave.open(str(path), "rb") as audio:
        if audio.getnchannels() != 1 or audio.getsampwidth() != 2 or audio.getframerate() != 16_000:
            raise ValueError(f"{path} must be 16-kHz mono 16-bit PCM WAV")


def wave_duration_ms(path: Path) -> float:
    with wave.open(str(path), "rb") as audio:
        return audio.getnframes() / audio.getframerate() * 1_000


def normalize_locale(value: str) -> str:
    return "vi-VN" if value.lower().startswith("vi") else "en-US"


def percentile(values: list[float], quantile: float) -> float:
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round((len(ordered) - 1) * quantile)))
    return ordered[index]


def host_details() -> dict[str, Any]:
    return {
        "platform": os.name,
        "logical_cpu_count": os.cpu_count(),
        "memory_bytes": psutil.virtual_memory().total,
    }


if __name__ == "__main__":
    main()
