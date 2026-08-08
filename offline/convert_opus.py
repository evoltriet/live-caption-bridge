#!/usr/bin/env python3
"""Convert both Apache-2.0 OPUS-MT directions to CTranslate2 INT8."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

MODELS = ("Helsinki-NLP/opus-mt-en-vi", "Helsinki-NLP/opus-mt-vi-en")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("offline/models"))
    parser.add_argument("--quantization", default="int8_float32")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    for model in MODELS:
        destination = args.output / model.rsplit("/", 1)[1]
        subprocess.run(
            [
                "ct2-transformers-converter",
                "--model", model,
                "--output_dir", str(destination),
                "--quantization", args.quantization,
                "--force",
            ],
            check=True,
        )


if __name__ == "__main__":
    main()
