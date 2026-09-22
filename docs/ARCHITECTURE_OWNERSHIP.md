# Architecture Ownership

## Decision scope

- Decision: `PS-ADR-0001`
- Founder intent: `PS-INTENT-001` through `PS-INTENT-016`
- Deliberation level: Constitutional
- Authorized decision owner: Alfonso Lopez
- Repository inspected: `dababiyoda/PumpStation`
- Upstream Kernel internals: unavailable and intentionally not fabricated
- Effective trigger: merge of this migration after review

## System role map

| System | Unique responsibility | Canonically owns | Consumes | Must not own | Lifecycle |
| --- | --- | --- | --- | --- | --- |
| PumpStation repository | Stage 0 community capital research Venture Cell | opportunity, deliberation, local event, simulation decision, and promotion-packet contracts | future versioned Kernel authority contracts | UNIIMENTE constitutional authority, external consequence permits, money movement | transitional Stage 0 |
| Server domain | Enforce typed intake, screens, identity, append-only records, and simulation boundaries | executable Stage 0 policy behavior | local JSON schemas and environment | trading, custody, settlement, legal clearance | active |
| Static dashboard | Project governed state and request identity | no authority-bearing state | read-only dashboard and identity APIs | decisions, permissions, evidence mutation, hidden state | active projection |
| UNIIMENTE Kernel | Canonical authority and consequence gate | global constitutional law, external-effect permission, shared authority semantics | bounded Venture Cell proposals | PumpStation-specific underwriting behavior | external dependency, not inspected |

## Canonical contract map

| Contract | Canonical source | Consumers | Version rule | Parity test |
| --- | --- | --- | --- | --- |
| Opportunity packet | `schemas/opportunity-packet.schema.json` | API, tests, future agents | additive major-version review | Ajv fixture validation and Zod API validation |
| Deliberation message | `schemas/deliberation-message.schema.json` | API, dashboard projection, decision compiler | correction is additive | schema and required-channel tests |
| Institutional event | `schemas/institutional-event.schema.json` | append store and projection | event semantics append-only | hash-chain and replay tests |
| Simulated decision | `schemas/simulated-decision-packet.schema.json` | founder dashboard and experiment | packet hash binds exact version | reproducibility test |
| Promotion packet | `schemas/stage-promotion.schema.json` | founder review and future Kernel adapter | every decision creates a new version and hash | founder/Kernel boundary tests |
| Future execution grant | `schemas/zero-trust-capability.schema.json` | no Stage 0 runtime consumer | dormant until new constitutional decision | prohibited-surface test |

The Zod implementation in `server/src/domain/model.ts` is the canonical executable validation for this version. JSON Schema is the external wire contract. Tests must detect parity drift before either changes.

## Authority and event map

| Authority or event | Authorized writer | Reader | Consequence gate | External effect |
| --- | --- | --- | --- | --- |
| Opportunity proposal | authenticated human or bounded agent | reviewers | intake policy | none |
| Deliberation | authenticated human or bounded agent | decision compiler | typed channel and moderation | none |
| Simulated decision | simulation compiler | founder dashboard | proposal-only invariant | none |
| Founder stage decision | configured human founder wallet | future Kernel | awaiting Kernel permit | none |
| External consequence | no writer in this repository | none | unavailable UNIIMENTE Kernel | structurally impossible |

## Boundaries

| System | Inbound | Outbound | State | External-effect boundary | Test boundary |
| --- | --- | --- | --- | --- | --- |
| Identity service | address, chain, signature | bounded session | ephemeral nonce/session | identity only | replay, expiry, mismatch |
| Institution | typed packet and message | proposal packets and projections | event-derived maps | no adapter | required negative suite |
| Event store | typed internal event | hash-verified replay | JSONL or memory | filesystem only | tamper and restart |
| Dashboard | public projections and wallet challenge | same-origin API request | session token in session storage | no transaction method | static surface scan |

## Compatibility and deprecation

| Legacy path | Canonical source | Removal condition |
| --- | --- | --- |
| `server/index.js` | `server/src/index.ts`, compiled to `server/dist/src/index.js` | all deployment references consume `dist/src/index.js` |
| `/api/connect-wallet` | `/api/v1/identity/challenges` and `/api/v1/identity/sessions` | clients have migrated and replay protection is verified |

## Decision

- Final state: `RETAIN`
- Rationale: one local event spine and one proposal-only domain close the immediate manipulation and authority gaps with the smallest executable system.
- Material dissent: multi-agent complexity has not earned superiority; the experiment therefore returns `NOT_EARNED` even if synthetic fixtures favor it.
- Rollback: revert the migration commit and preserve any event log separately.
- Kill criteria: any unauthorized effect, self-approval, history rewrite, replayable identity, classifier-open failure, or fixture performance claim.
- Review trigger: first held-out pilot result, any proposed Stage 1 promotion, or a canonical Kernel contract becoming available.
