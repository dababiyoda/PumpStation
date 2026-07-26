# ADR 0001: Build PumpStation as a Simulation-Only Community Capital Institution

- Decision ID: `PS-ADR-0001`
- Status: accepted for Stage 0 implementation
- Date: 2026-07-26
- Decision owner: Alfonso Lopez
- Deliberation level: Constitutional
- Founder intent references: `PS-INTENT-001` through `PS-INTENT-016`
- Supersedes: active memecoin-coordination product definition in baseline README
- Superseded by: none

## Problem

### Observation

The baseline repository defined real-time memecoin buy coordination, democratic voting, automated exits, and community-driven price movements. The executable code only authenticated wallets with one replayable fixed message and stored identity data.

### Inference

Implementing the README as written would create manipulation, participant-harm, affinity-exploitation, custody, security, and regulatory exposure while depending on later buyers rather than productive value.

### Unresolved claims

- No real-world demand, legal clearance, investment performance, participant benefit, or multi-agent advantage has been proven.
- The canonical UNIIMENTE Kernel repository and executable contracts were not available for inspection.

### Proposed action

Replace the active product definition with a Stage 0 institution that accepts typed opportunities, preserves evidence and dissent, runs deterministic manipulation screening, compiles reproducible simulated decision packets, and records hash-bound stage requests without any external-effect path.

## Baseline and evidence

| Claim | Class | Evidence tier | Source | Finding | Limitation |
| --- | --- | --- | --- | --- | --- |
| Baseline promotes coordinated price action and exits | observation | historical artifact | `README.md` at `df6a732` | explicit product definition | prose, not operating behavior |
| Wallet authentication is replayable | observation | inspected code | legacy `server/index.js` and `client/index.html` | one fixed message with no nonce or expiry | no production traffic inspected |
| Coordinated countdown buying and organizer-first exits are recognized pump patterns | external constraint | primary source | [CFTC advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/beware_virtual_currency_pump_dump.html) | directly supports prohibition | general information, not project legal advice |
| Immigrant and ethnic trust can be exploited in affinity fraud | external constraint | primary source | [SEC Investor Alert](https://www.investor.gov/sites/default/files/ia_affinityfraud.pdf) | supports anti-coercion and independent diligence | general information, not legal classification |
| Zero trust rejects implicit trust based only on location or ownership | external evidence | primary source | [NIST SP 800-207](https://doi.org/10.6028/NIST.SP.800-207) | supports per-request identity and authorization | not a claim of complete NIST conformance |
| Multi-agent design beats simpler systems | unresolved claim | no evidence | none | not proven | synthetic comparison cannot resolve it |

## Alternatives

- Current baseline: implement voting, buying, promotion, and automated exits.
- Do nothing: preserve the tiny repository without an active product.
- Simplest viable alternative: rewrite only the README and publish educational content.
- Strongest competing architecture: one centralized analyst service with a normal database and human approval.
- Reversible experiment: implement Stage 0 locally with synthetic fixtures and compare multi-agent, centralized proxy, deterministic rules, and passive benchmark behavior.

Rejected alternatives remain revivable:

- Coordinated-market baseline: rejected as constitutionally prohibited. No evidence can revive manipulation; a different productive product can be proposed.
- Documentation-only rewrite: revive if executable Stage 0 creates more maintenance than measurable evidence quality.
- Centralized analyst: revive if it matches decision quality and participant protection at materially lower cost.
- Full distributed agent platform: defer until simple systems fail on measured held-out work.

## Five-role review

| Role | Position | Material concerns | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| Founder-Intent Steward | Preserve the community ownership mission while replacing price engineering with productive asset capability | overcorrecting into a generic compliance app | master prompt, doctrine, supplied blueprints | `RETAIN` |
| Systems Architect | One local event spine and typed contract set should own Stage 0 truth | duplicated authority and premature infrastructure | repo inventory, Reality Compiler blueprint | `RETAIN` |
| Adversarial Reviewer | Assume coordinated narratives, classifier evasion, key compromise, and evidence laundering | false safety from rules and hashes | CFTC, SEC, W3C, threat model | `EXPERIMENT` |
| Operator and Maintainer | Keep one Node process, one static client, and a reversible JSONL store | governance burden can exceed codebase size | baseline has seven substantive files | `RETAIN` |
| Evidence and Welfare Guardian | Protect immigrants from affinity pressure and preserve dissent | fixtures could be marketed as performance; multi-agent advantage unproven | SEC affinity alert, experiment definition | `EXPERIMENT` |

## Pass 1

### Intended outcome

Give ordinary people institutional-grade research, fraud protection, productive-ownership analysis, and preserved learning without creating capital, promotion, custody, or trading authority.

### Advantages and amplified value

- `A1` Productive-value replacement: shifts the moat from later buyers to evidence, underwriting, operating cash flow, and institutional memory.
- `A2` Canonical authority boundary: one path makes it mechanically clear that a proposal is not a decision and a founder decision is not a Kernel permit.
- `A3` Evidence compounding: append-only packets let corrections, negative results, and prediction errors improve future reviews.
- `A4` Community protection: visible conflicts, counterevidence, dissent, complaints, and affinity-pressure rules make trust depend less on leaders.
- `A5` Capital efficiency: one small executable system tests the architecture before distributed infrastructure.

### Disadvantages, IDs, and redesigns

- `D1` False confidence from deterministic rules, critical. Redesign: classifier failure refuses; rules are documented as incomplete; false-positive and false-negative measurement gates Stage 1.
- `D2` Governance bureaucracy can overwhelm a tiny codebase, high. Redesign: one ADR, one ledger, one deliberation, and machine-readable contracts; no committee workflow engine.
- `D3` Local JSONL can be deleted, truncated, or rolled back, high. Redesign: hash chain, startup disarm, preserved recovery procedure; external anchoring deferred.
- `D4` Wallet identity excludes non-crypto participants and does not prove legal identity, medium. Redesign: identity-only optional boundary for Stage 0; Stage 1 identity remains unresolved.
- `D5` Multi-agent architecture may cost more without better decisions, high. Redesign: deterministic four-system experiment with a complexity gate that stays `NOT_EARNED`.
- `D6` Founder-only decision can centralize failure and create key risk, high. Redesign: founder decision cannot activate a stage; future Kernel and independent review remain mandatory.
- `D7` Public source can be forked to remove safeguards, medium. Redesign: do not claim the license prevents misuse; make canonical operation and receipts independently inspectable in future.

### Comparisons

- Baseline: fastest path to activity, unacceptable manipulation and participant-harm exposure.
- Do nothing: lowest cost and risk, but preserves no useful institutional wedge.
- Simplest viable alternative: education-only documentation lowers risk but cannot test evidence, dissent, replay, or authority behavior.
- Strongest competing architecture: centralized analyst is cheaper and easier to maintain; it remains the benchmark to beat.
- Reversible experiment: Stage 0 has no external effect and can be reverted as one branch or commit.

### Rejected alternatives and revival evidence

- Blockchain-first: reject because no chain is needed for private research or local events. Revive only when a named verifier requires a public hash or ownership record.
- Live-capital pilot: prohibit in this decision. A new constitutional decision, counsel, founder authorization, and Kernel permit are mandatory.
- Agent-swarm platform: defer until a held-out test proves the centralized and rules baselines insufficient.

## Pass 2

### Attack summary

Pass 1 reduced financial danger but created a miniature constitutional system around a tiny prototype. Hashes could be mistaken for truth, the founder boundary could be theatrical without a real Kernel, deterministic rules could be gamed, and a polished dashboard could overstate maturity.

### New weaknesses created by Pass 1

- `N1`, bureaucracy: contributors may update prose instead of executable truth. Strengthening: docs link canonical files; tests validate schemas and required behavior.
- `N2`, centralization: one process and file are a single failure domain. Strengthening: accept this only for Stage 0 and name production persistence as unresolved.
- `N3`, comprehensibility: too many abstract terms can obscure a simple product. Strengthening: README leads with current executable surface and explicit non-capabilities.
- `N4`, gaming: keyword rules can be evaded or trigger on criticism. Strengthening: combine structured disclosures with text rules and exempt bear, legal, security, complaint, and education channels from instruction treatment.
- `N5`, dependency: a future Kernel boundary could become a fictional placeholder. Strengthening: expose `kernel_connection=not_implemented`; no permit endpoint or stage activator exists.
- `N6`, overfit: synthetic fixtures can be shaped to favor multi-agent review. Strengthening: complexity remains `NOT_EARNED` regardless of fixture result.

### Disposition of every Pass 1 disadvantage

- `D1`: accepted for Stage 0. Owner: Security Reviewer. Trigger: first 25 independently labeled cases.
- `D2`: resolved by minimal artifact set. Owner: Operator. Trigger: contributor onboarding exceeds 30 minutes.
- `D3`: accepted for Stage 0. Owner: Operator. Trigger: any multi-user or production deployment.
- `D4`: deferred. Owner: Community Benefit Reviewer. Trigger: Stage 1 participant design.
- `D5`: experiment. Owner: Evidence Guardian. Trigger: held-out comparison with independent labels.
- `D6`: prohibited from expanding authority. Owner: Founder and Kernel maintainer. Trigger: any requested stage activation.
- `D7`: accepted. Owner: Founder. Trigger: first independent verifier or deployment.

### Final strengthened design

Use one Node service, one static dashboard, strict opportunity and deliberation schemas, one hash-chained event store, nonce-bound identity, deterministic fail-closed manipulation screening, a proposal-only decision compiler, and versioned stage packets. Do not implement any execution adapter, stage activator, exchange dependency, private-key setting, deposit route, custody path, or public promotion system. Treat the experiment as fixture evidence only and keep multi-agent complexity unearned.

### Residual risks

- Novel or multilingual manipulation can evade rules. Mitigation: human adversarial review and measured classifier errors. Owner: Security Reviewer. Trigger: every rejected or escaped case.
- Founder wallet compromise can create false approval. Mitigation: approval still cannot activate a stage. Owner: Founder. Trigger: deployment.
- Local event history can be replaced wholesale. Mitigation: preserve hashes and add independent anchoring only when a verifier exists. Owner: Operator. Trigger: closed pilot.
- Legal classification remains unresolved. Mitigation: no money, execution, offer, or public asset promotion. Owner: qualified counsel. Trigger: before Stage 2 and Stage 3.
- A polished interface can imply maturity. Mitigation: permanent warnings and explicit evidence tiers. Owner: Product. Trigger: every public release.

### Recommendation

`RETAIN`

## Dissent

Material dissent remains from the Evidence and Welfare Guardian: multi-agent complexity is not justified by repository size or real outcomes. Resolution threshold: material outperformance over centralized and deterministic baselines on held-out, independently reviewed opportunities, with zero policy violations and measured participant-harm outcomes. Owner: Evidence and Welfare Guardian. Review trigger: sufficient held-out Stage 0 cases.

The implementation proceeds only because the final design records that dissent and keeps the complexity gate `NOT_EARNED`.

## Authority impact

- Changes authority: narrows local authority and explicitly reserves external consequence authority.
- Authorized-human approval required: yes.
- Approval state: approved for Stage 0 implementation through the user's explicit instruction on 2026-07-26.
- Approver: Alfonso Lopez.
- External authority: not approved and not implemented.

## Decision

`RETAIN`

## Migration, rollback, and kill criteria

- Migration: one dedicated branch and one draft PR; preserve Git history and stale branches.
- Rollback: revert the migration commit or close the PR; preserve event logs as evidence.
- Kill criteria: any unauthorized external effect, self-approval, stage activation without Kernel permit, history deletion, replayable identity, classifier-open failure, or fixture-performance claim.
- Material items intentionally unchanged: GPL license, prior Git history, stale open PR branches, external UNIIMENTE repositories.
- Review trigger: first held-out experiment, Stage 1 request, or available canonical Kernel contracts.
