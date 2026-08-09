# Build vs. buy

**Reviewed: 2026-08-09. Recheck vendor capabilities, pricing, limits, and terms before every paid event.**

| Option | Strengths | Risks / costs | Best use |
|---|---|---|---|
| Wordly | Venue-oriented multilingual captions, attendee-device/display workflows, and vendor support | Recurring service cost, internet/vendor dependency, less control over fixed bilingual presentation and data flow | Primary turnkey option when operational certainty matters most |
| Notta | Easy web/mobile bilingual English–Vietnamese transcription and translation; quick standalone setup | Internet required; records and retains audio/transcript; plan/add-on limits; no documented transparent OBS source, venue display mode, or public streaming bilingual API | Explicit-consent connected backup and rehearsal comparator only |
| Live Caption Bridge + Azure | Owned UI/protocol; native, fullscreen, OBS, and local receiver outputs; no app telemetry or raw-audio recording | Azure setup/usage, internet dependency, trained operator, current field-validation gap | Rehearsed events with a technical AV operator |
| Gated local provider | Potential airplane-mode operation and predictable marginal cost | Unproven quality/latency on modest hardware, model packaging/licenses, combined OBS load | Only after every v0.2 gate passes |

Wordly remains the safer venue-oriented turnkey fallback. Its published materials describe Vietnamese use, multilingual captions/audio, attendee devices, and display workflows, but public pricing and event-specific behavior should be confirmed directly before booking. See Wordly's [USC case study](https://offers.wordly.ai/hubfs/Assets/USC-case-study.pdf) and [government translation guide](https://offers.wordly.ai/hubfs/Assets/Government-Translation-Guide.pdf).

Notta is meaningfully easier as a meeting-style standalone backup, but it is not privacy-equivalent or integration-equivalent. Official documentation confirms English/Vietnamese bilingual use, requires internet, and states that Instant Record stores both audio and transcript. See the dated [Notta evaluation and deletion runbook](NOTTA_EVALUATION.md).

Building remains worthwhile for fixed simultaneous bilingual presentation, direct AV integration, privacy controls, reusable device protocol, offline experimentation, and ownership of recurring costs. It is not automatically cheaper after hardware, Azure use, engineering, bilingual review, and trained operation are counted.

Decision rule: until Live Caption Bridge completes the full acceptance suite and two venue-style rehearsals on the exact event rig, use a supported turnkey solution as the primary path and run this project only as a supervised parallel test. Notta may be the emergency backup only when its separate cloud-recording consent and deletion workflow have been accepted.
