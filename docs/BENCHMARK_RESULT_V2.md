# PumpStation Tiered Architecture Benchmark V2

## Status

**Measured synthetic fixture. Simulation only.**

This result is not market performance, legal clearance, an investment recommendation, public-launch authorization, or evidence that PumpStation should manage capital.

## Why V2 exists

The Stage 0 V1 fixture produced an important negative result: the full coordinated multi-agent workflow matched deterministic rules on decision quality and fraud detection while costing ten times more. Its complexity gate was `NOT_EARNED`.

V2 does not erase that result. It asks a narrower follow-up question:

> Can deterministic triage handle routine cases while escalating ambiguity, conflicts, missing evidence, prohibited conduct, and higher-consequence cases into the complete five-role, two-pass institution?

## Systems compared

1. Full five-role, two-pass review on every case.
2. Tiered deterministic triage plus selective deliberation.
3. Centralized analyst proxy.
4. Deterministic rules only.
5. Human-moderated proxy.
6. Do-nothing deferral.

All systems received the same public case representation. Expected decisions, critical-risk labels, required-evidence labels, and harmful-outcome labels were removed before evaluation.

## Result

| System | Decision quality | Harmful approvals | Critical-risk recall | Missing-evidence recall | Required dissent | Deliberation rate | Cost units | Time units |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Full multi-agent | 1.0000 | 0 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 60.00 | 60.00 |
| Tiered institution | 1.0000 | 0 | 1.0000 | 1.0000 | 1.0000 | 0.7500 | 29.55 | 29.55 |
| Centralized analyst proxy | 0.8333 | 0 | 0.2414 | 0.3077 | 0 | 0 | 12.00 | 12.00 |
| Deterministic rules | 1.0000 | 0 | 1.0000 | 1.0000 | 0 | 0 | 2.40 | 2.40 |
| Human-moderated proxy | 1.0000 | 0 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 48.00 | 96.00 |
| Do nothing | 0.3333 | 0 | 0 | 0 | 0 | 0 | 0.60 | 0.60 |

## Decision

**REGRESS full-swarm review as the universal default.**

**RETAIN tiered review as a sandbox experiment.**

Routine, rule-complete cases may use deterministic triage. Full five-role and two-pass deliberation is reserved for:

- conflicts;
- incomplete evidence;
- prohibited-conduct signals;
- ambiguity;
- higher consequence;
- novel or adversarial conditions.

## Critical counterevidence

The tiered workflow still did not beat deterministic rules on the authored synthetic corpus. Deterministic rules produced the same synthetic decisions and risk recall at much lower cost.

Therefore:

- multi-agent advantage is **not earned**;
- the fixture is probably too legible to the authored rules;
- V2 is a post-V1 redesign and not an independent confirmation study;
- perfect synthetic scores must not be used as promotional evidence.

## Required next proof

A stronger study must use:

- independently authored and sealed cases;
- ambiguity-rich evidence rather than explicit risk labels;
- multilingual and indirect manipulation;
- unknown-risk discovery;
- sampled audit of cases that triage does not escalate;
- measured escalation escapes;
- actual model and human costs;
- independent analysts;
- participant-welfare assessment;
- no real capital or market action.

## Evidence chain

- V1 result: `experiments/results/stage0-baseline.json`
- V2 fixture: `fixtures/tiered-opportunities-v2.json`
- V2 engine: `server/src/experimentV2.ts`
- V2 result: `experiments/results/tiered-benchmark-v2.json`
- Recursive decision: `governance/deliberations/ps-adr-0002.json`

The V2 result is bound by:

```text
sha256:68fb9545beac09c2cd4d6a750dc68f1771ccbc719e4b542fef399c95c6f2b20e
```

## Authority boundary

This benchmark creates no authority to:

- move money;
- accept deposits;
- place trades;
- promote owned assets;
- contact counterparties;
- form a fund;
- enter custody;
- advance the active public-launch stage.

`UNAUTHORIZED_EXTERNAL_EFFECTS = 0` remains unchanged.
