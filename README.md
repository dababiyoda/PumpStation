# PumpStation

UNIIMENTE's security-first Web3 wealth institution. Every memecoin, NFT, DAO,
DeFi, wallet, smart-contract and agent feature must serve an explicit
protection, coordination, ownership, proof or settlement function.

> **Maximum lawful aggression, minimum trust assumptions, complete attribution
> and bounded consequences.**

Security is not an audit performed before launch here. It is the admission
criterion for every feature, enforced by code in CI.

## Status

Early. The repository currently implements one feature — wallet connection —
plus the governance machinery that decides what may be built next. The eight
security layers described in the product doctrine are **not** built. Features
that do not exist are registered as `PROPOSED` in the matrix with their real
gaps, rather than described as if they were shipped.

## The admission gate

Every feature is a record in `governance/feature-control-matrix.json` declaring
what authority and financial exposure it creates, which named threats it
mitigates, which it introduces, its worst case in dollars, and how it is
recovered. `governance/admission.js` enforces the founder's termination trigger:

> Reject any feature that expands authority or financial exposure without a
> measurable security benefit, bounded failure radius and tested recovery path.

```bash
npm run gate     # evaluate the matrix
npm test         # gate + rule tests + wallet auth security tests
```

Eleven rules, each one clause of that sentence or a guarantee it depends on.
There is no score, no weighting and no override flag — a gate with an override
is a suggestion. A test asserts that adding `approved_by_founder: true` to a
failing feature does not admit it.

A `PROPOSED` feature that fails is reported but does not fail the build: the
gate is telling its author what must exist before it may ship. A `DEPLOYED`
feature that fails is an incident and exits non-zero.

Current state — `treasury-multisig` is refused on four rules, and that is the
gate working:

```
ADMIT   wallet-connect          [DEPLOYED]
ADMIT   shared-challenge-store  [PROPOSED]
REJECT  treasury-multisig       [PROPOSED]
        ✗ R2  blast_radius.bounded is not true
        ✗ R3  recovery procedure has never been exercised
        ✗ R4  role 'treasury-agent' has no finite spending_ceiling_usd
        ✗ R7  expands financial exposure with a null max_at_risk_usd
```

## Wallet authentication

The previous implementation verified signatures over a module-level constant:

```js
const CONNECT_MESSAGE = 'Connect PumpStation';
const recovered = ethers.verifyMessage(CONNECT_MESSAGE, signature);
```

That proves a wallet signed those words at some point in its life — not that it
is connecting now, to this site, with its holder's knowledge. Any signature over
that string, from any source, authenticated as that wallet permanently. It was a
complete authentication bypass rather than a weakness.

It is now an EIP-4361 challenge/response (`server/auth/siwe.js`) with four
binding properties: a **single-use nonce** consumed on first attempt, a
**five-minute expiry**, **domain binding** so the signature is worthless
elsewhere, and **address binding** so a challenge verifies for no other wallet.
The server rebuilds the signed message from its own stored challenge and never
verifies a client-supplied string.

The original file is preserved at `server/superseded/index.static-message.js`.
The bug is preserved as a permanent regression test.

The client carries no third-party scripts. React, ReactDOM, Babel and ethers
were being loaded from two CDNs with no Subresource Integrity onto a page that
triggers wallet signature prompts — the exact wallet-drainer path. None were
necessary; MetaMask's injected provider does all of it. The CSP is now
`script-src 'self'`, and the exact message plus its plain-English limits are
shown before the wallet prompt.

## Layout

```
governance/
  admission.js                  the gate: 11 rules, no overrides
  feature-control-matrix.json   every feature and its threat-to-control record
  check.js                      CI entry point
  test/                         33 tests, mostly attempts to sneak a feature through
contracts/
  feature-control-matrix.schema.json    record shape (rules live in the gate)
server/
  auth/siwe.js                  challenge, bind, verify, consume
  middleware/rate-limit.js      bounded fixed-window limiter
  superseded/                   preserved prior implementations
  test/                         22 tests, real keys and real signatures
client/                         no third-party scripts
docs/RECOVERY.md                per-feature recovery procedures
```

## Development

```bash
npm install                     # installs server deps too
cd server && cp .env.example .env
npm run dev
```

`ALLOWED_ORIGINS` is empty by default, which **denies** all cross-origin
requests. Set it explicitly; the previous `cors()` call reflected any origin.

## What "secure" means here

It does not mean any token will rise, or that nobody loses money. Market risk
remains. It means: no hidden authority; no unrestricted keys; no unilateral
treasury movement; no agent self-authorization; bounded financial blast radius;
attributable decisions; and tested recovery.
