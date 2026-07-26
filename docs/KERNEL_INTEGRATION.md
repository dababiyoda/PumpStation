# PumpStation → UNIIMENTE Kernel Integration

## Current status

**Pinned contracts · proposal-only adapter · disconnected gateway · no execution authority**

PumpStation does not contain a local constitutional authority system. It consumes a pinned description of the canonical UNIIMENTE Kernel and fails closed whenever the Kernel, service identity, grant, policy decision, commit witness, receipt, or reconciliation obligation is missing.

## Pinned source

Kernel repository:

`dababiyoda/uniimente-kernel`

Pinned commit:

`3d9b5779a7093d6ddd07f225c8329ead6d0c6393`

The exact contract, authority, identity, policy-engine, and Consequence-Gate blob SHAs are recorded in:

`kernel/kernel-contract-lock.json`

Any changed commit or blob requires a new lock version and explicit review.

## Ownership boundary

PumpStation owns:

- productive-asset opportunity packets;
- structured deliberation and dissent;
- simulation fixtures and benchmark results;
- semantic-firewall quarantine projections;
- PumpStation-specific proposal projections.

The UNIIMENTE Kernel owns:

- constitutional law;
- legal principal recognition;
- production service identity;
- capability grants;
- policy decisions;
- budget authority;
- commit witnesses;
- the only Consequence Gate;
- effect receipts;
- reconciliation obligations;
- global causal memory.

PumpStation may refuse locally. It may not manufacture a Kernel allow decision.

## Proposed identity

`spiffe://uniimente.internal/venture/pumpstation`

Current status:

`proposed_not_registered`

A wallet signature proves control of one wallet for local authentication. It is not a SPIFFE workload identity, legal principal, capability grant, or institutional authority.

## Proposal flow

```text
local authenticated human
→ complete PumpStation opportunity and deliberation
→ simulation-only decision packet
→ pinned Kernel proposal compiler
→ deny-all gateway while disconnected or unregistered
→ append-only proposal and denial record
```

Stage-promotion requests compile as `irreversible` proposals because they attempt to expand authority. They remain denied and do not change the active stage.

## Local grant validation

The adapter can inspect a presented grant and refuse it when:

- the grantee identity differs;
- the legal principal differs;
- the capability is missing;
- the cost exceeds the grant;
- the grant is expired, not yet valid, or revoked;
- a simulate grant is presented as authority for an external, financial, or irreversible consequence.

A locally valid result still has:

```text
execution_authority = false
```

Only the live Kernel may issue and revalidate a grant.

## Current API

Authenticated routes:

- `GET /api/v1/kernel/status`
- `POST /api/v1/kernel/opportunities/:id/proposals`
- `POST /api/v1/kernel/stage-promotions/:id/proposals`

Every proposal response includes:

```text
external_effect_permitted = false
```

## Missing production evidence

The adapter does not yet have:

- an active Kernel registration;
- cryptographic workload identity;
- authenticated service-to-service transport;
- a Kernel-issued capability grant;
- live policy evaluation;
- budget reservation;
- commit-time revalidation;
- injected execution adapter;
- effect receipt;
- postcondition verification;
- reconciliation;
- external outcome.

## Companion Kernel proposal

Draft Kernel PR #47 defines an inactive registration-proposal contract and PumpStation candidate. It deliberately does not add PumpStation to the active service registry or issue a grant.

## Hard invariant

`UNAUTHORIZED_EXTERNAL_EFFECTS = 0`
