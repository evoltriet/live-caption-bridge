# Contributing

Thank you for helping bilingual families share wedding speeches.

## Development

1. Fork and clone the repository.
2. Create a focused branch.
3. Run `pnpm install` and `pnpm check`.
4. Add tests for behavior changes.
5. Open a pull request describing user impact, privacy impact, and verification.

Use strict TypeScript. Keep renderer privileges minimal and validate every IPC payload. Never log or commit credentials, audio, captions, transcripts, model weights, or personal benchmark data.

Changes to capture, provider recovery, credentials, exports, display binding, or model licenses require corresponding documentation and failure tests. Accessibility and Vietnamese-diacritic regressions are release blockers.

Real Azure tests must be opt-in and use local credentials. Offline work must follow `docs/OFFLINE_BENCHMARK.md`; a fixture-only success is not sufficient to expose a user-facing feature.

By contributing, you agree that your contribution is licensed under MIT.
