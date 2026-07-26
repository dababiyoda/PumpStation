# Stage 0 Threat Model

## Protected invariants

1. `UNAUTHORIZED_EXTERNAL_EFFECTS = 0`.
2. No real-money, order, transfer, deposit, custody, campaign, or pooled-capital surface.
3. Wallet signatures authenticate identity only.
4. Agents and models cannot approve decisions or stages.
5. Founder approval does not equal a UNIIMENTE Kernel permit.
6. Institutional history is append-only and hash-chained.
7. Negative evidence and dissent remain visible.
8. Classifier failure refuses progression.

## Trust boundaries

| Boundary | Untrusted input | Control | Residual risk |
| --- | --- | --- | --- |
| Browser to identity service | address, chain, signature | nonce, expiry, one-time use, domain and URI binding | phishing, compromised wallet, contract-wallet support not implemented |
| Browser/API to opportunity intake | packet text and structured claims | strict schema, identity binding, manipulation classifier | evasion, multilingual novelty, false positives |
| Deliberation to decision compiler | human and agent messages | typed channel, source status, no tool-call path | coordinated narratives, source fabrication |
| Event append to projection | event payload | canonical hashing, prior hash, startup verification | host-level file deletion or rollback |
| Founder decision to stage state | decision request | founder capability plus Kernel boundary | founder key compromise, no independent co-signature |
| Source code to deployment | dependencies and build | lockfile, audit, surface scan, review | supply-chain compromise, CI not yet installed |

NIST zero trust rejects implicit trust based solely on network location or ownership and calls for authentication and authorization around each resource request: [NIST SP 800-207](https://doi.org/10.6028/NIST.SP.800-207). This implementation applies the principle narrowly; it does not claim complete NIST conformance.

## High-priority abuse cases

### Replayable wallet authentication

The legacy fixed message could be signed once and replayed. It is disabled with `410 Gone`. The new message follows the Sign-In with Ethereum field shape, including domain, URI, chain ID, nonce, issuance, and expiration. ERC-4361 describes a per-session nonce as protection against replay: [ERC-4361](https://ercs.ethereum.org/ERCS/erc-4361).

Residual limitation: ERC-1271 contract-wallet verification is not implemented. Production HTTPS, origin verification, rate limiting, CSRF analysis, and secure cookie handling remain Stage 1 work.

### Manipulation disguised as community coordination

Controls:

- structured conflict, holdings, compensation, and strategy answers;
- deterministic text screening;
- affinity-pressure prohibition;
- independent bear thesis;
- complaints and appeal channel;
- no financial tool surface.

Residual limitation: rules are not a complete fraud detector. False-positive and false-negative measurement is required before Stage 1.

### Agent self-approval

Controls:

- actor class and capability checks;
- `stage:decide` can belong only to a configured human wallet session;
- no method exists to activate a stage;
- all approved packets remain `awaiting_kernel_permit`.

### Evidence laundering

Controls:

- model output submitted as evidence is rejected;
- fixture evidence remains `fixture_only`;
- every decision exposes whether real-world evidence is complete;
- W3C credential integrity is never treated as claim truth.

### History alteration

Controls:

- event hashes bind canonical payload, metadata, and prior event;
- startup fails closed on a broken chain;
- no delete or update method;
- corrections link additively.

Residual limitation: a local attacker could delete the tail or replace the entire file and application snapshot. External anchoring, signed checkpoints, backup policy, and independent storage are deferred.

### Hidden execution adapter

Controls:

- no private-key, exchange, swap, transfer, order, or custody dependency;
- prohibited prefixes return `403`;
- source scan rejects dangerous transaction tokens and exchange SDKs;
- initial server environment contains no chain RPC or private-key setting.

## Kill criteria

Disarm the service and stop stage advancement if:

- event-chain verification fails;
- any unauthorized external effect is observed;
- a transaction, order, transfer, custody, deposit, or campaign path appears;
- an agent or model can approve itself;
- dissent can be deleted or overwritten;
- classifier failure progresses rather than refuses;
- a wallet signature can be replayed;
- fixtures are presented as market performance;
- a dependency introduces high-severity unmitigated vulnerabilities;
- legal review rejects the intended next-stage activity.

## Incident response

1. Stop the service and preserve the event log.
2. Revoke sessions and rotate affected credentials.
3. Record an additive `incident` event in a clean recovery environment.
4. Identify the last verified source version and event-chain checkpoint.
5. Reproduce the failure with a bounded test.
6. Correct additively; do not rewrite the record.
7. Require founder review for constitutional changes.
8. Resume only after the named kill criterion is cleared.
