# Migration Record: Speculative Coordination to Community Capital Research

## Inspected baseline

Source commit: `df6a732f44412c626098ee9591b9d19f420d02dd`

The default branch contained:

- a README defining PumpStation as a real-time decentralized memecoin coordination platform with buy-ins, voting, automated exits, and community-driven price movement;
- a static browser page that requested a wallet, signed the fixed message `Connect PumpStation`, and sent address, optional email, and signature to an API;
- an Express/Mongo server that verified the fixed signature and stored the wallet;
- package scripts that referenced Next.js even though Next.js was not installed;
- no tests, decision model, anti-manipulation control, stage system, append-only event record, or simulation engine.

Repository metadata and all six prior pull requests were enumerated through GitHub. PR 6, the structurally closest open alternative, was inspected at patch level. It introduced a generic Next.js scaffold, automatically requested wallet access on page load, and added placeholder vote and dashboard pages; it did not solve the authority, manipulation, evidence, or simulation problem. PRs 1, 2, 4, and 5 were inspected at metadata level and left unchanged as historical branches. PR 3 is the merged wallet-signature change already represented in `main`.

No `AGENTS.md` or repository-specific implementation instruction file existed.

## Concurrent branch reconciliation

While this migration was being implemented, the target branch advanced by five commits through `4e55d939c55d78bf9180ce53033eb86c38fe025e`. Those commits were fetched and inspected before publication.

Their GitHub Actions workflow was retained and strengthened to use the lockfile, the full check suite, a compiled build, deterministic experiment drift detection, and a high-severity dependency audit. Their useful architecture and benchmark ideas are represented in the current charter, ownership map, experiment, and unresolved-decision record.

The parallel CommonJS runtime and duplicate contract/doc set were not retained as a second canonical implementation. In particular, that runtime represented founder stage approval as final `APPROVE` rather than `awaiting_kernel_permit`, and its identity record did not cryptographically verify the challenge signature. Keeping both implementations would create ambiguous authority and schema ownership. The five commits remain in Git ancestry; no branch or commit history is deleted.

## Why the original concept was unsafe and strategically weak

The original README positioned synchronized market action and automated exits as product features. That creates participant-harm, manipulation, affinity-exploitation, regulatory, custody, security, and reputation exposure without a durable productive-value engine.

The CFTC describes countdown purchases, social hype, recruiting outsiders, organizers exiting first, and losses transferred to later participants as a pump-and-dump pattern: [CFTC advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/beware_virtual_currency_pump_dump.html).

The deeper strategic weakness was dependency on price momentum and later buyers. It did not improve the underlying asset, increase customer value, create operating cash flow, or build an institutional proof rail.

## Retained

| Baseline element | Retained value | New boundary |
| --- | --- | --- |
| Client/server split | Small understandable application surface | Static dashboard plus typed API |
| Wallet message signing | Portable identity authentication | Nonce-bound, one-time identity only; no transaction authority |
| `ethers.verifyMessage` | Signature verification primitive | Domain, URI, chain, issuance, expiry, and nonce bound |
| Express server | Lightweight API host | Strict schemas, fail-closed errors, security headers |
| Git history | Source lineage | No history deletion or force rewrite |

## Prohibited or disabled

- memecoin pumping and intentional price movement;
- synchronized market buying;
- automated or coordinated exits;
- fake volume, wash trading, and spoofing;
- undisclosed promotion, holdings, or compensation;
- fixed-message replayable wallet authentication;
- optional email collection without a current need;
- any exchange, order, swap, transaction, private-key, deposit, custody, pooled-capital, or campaign surface.

The legacy `/api/connect-wallet` endpoint now returns `410 Gone`.

## Productive replacement

The replacement is a simulation-only evidence pipeline:

```text
opportunity packet
→ manipulation screen
→ typed bull, bear, conflict, legal, security, and community review
→ evidence classification
→ reproducible simulated decision packet
→ founder-visible proposal
→ stage packet awaiting Kernel permit
```

The current implementation ends there.

## Source conflict preserved

Two supplied historical Egregore artifacts proposed sovereign intent, autonomous treasury management, direct trading, self-modification, autonomous social posting, and self-preservation. They remain preserved as historical artifacts outside this repository. Their execution mechanisms conflict with the newer human-sovereign Reality Compiler and the explicit PumpStation master prompt, so they are classified as prohibited for this Venture Cell in the Founder Intent Ledger.

## Migration stages

1. This PR: governance, contracts, Stage 0 code, test fixtures, dashboard, and adversarial tests.
2. Future separate PR: production persistence and deployment controls, only if Stage 0 evidence supports it.
3. Future separate PR: multilingual disclosures, complaint operations, and closed-pilot identity, only after approved promotion.
4. No real-capital PR until counsel, a new founder decision, and a Kernel consequence path exist.

## Rollback

Revert this single migration commit or close the draft PR. The default branch and Git history remain intact. If the Stage 0 event format has been used locally, preserve the JSONL file as evidence before rollback.
