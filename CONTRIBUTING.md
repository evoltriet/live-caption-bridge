# Contributing

Thank you for helping people share live speech across languages and devices. Weddings are the first production reference solution.

Before planning or changing code, read [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md). It is the canonical record of locked decisions, verified behavior, field gaps, and backlog. Update it in the same pull request whenever your work changes that truth.

## Development

1. Fork and clone the repository.
2. Create a focused branch.
3. Run `pnpm install`, `pnpm check`, and relevant Electron end-to-end tests.
4. Add tests for behavior changes.
5. Open a pull request describing user impact, privacy impact, and verification.

Use strict TypeScript. Keep renderer privileges minimal and validate every IPC and public-protocol payload. Never log or commit credentials, pairing tokens, audio, captions, transcripts, model weights, or personal benchmark data.

Changes to capture, provider recovery, credentials, exports, display binding, or model licenses require corresponding documentation and failure tests. Accessibility and Vietnamese-diacritic regressions are release blockers.

Protocol changes belong in `packages/caption-protocol`, must retain explicit versioning, and require client compatibility tests. Receiver changes must preserve read-only semantics, first-message authentication, token invalidation, and the 50-client bound.

Real Azure tests must be opt-in and use local credentials. Offline work must follow `docs/OFFLINE_BENCHMARK.md`; a fixture-only success is not sufficient to expose a user-facing feature.

By contributing, you agree that your contribution is licensed under MIT.
