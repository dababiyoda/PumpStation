# PumpStation

> An immigrant-led, founder-governed community capital institution that helps real people combine knowledge, skills, relationships, and eventually governed capital to identify, acquire, build, improve, and retain productive assets.

## Reality status

**Current implementation: SANDBOX**

This repository no longer implements memecoin coordination, coordinated buy-ins, automated exits, autonomous trading, or market-manipulation workflows. The first executable version records and validates:

1. opportunity intake;
2. five-role deliberation;
3. exactly two recursive strengthening passes;
4. explicit founder authorization;
5. bounded action proposals;
6. evidence objects;
7. simulated outcome reconciliation;
8. an append-only hash-chained institutional event ledger.

It deliberately does **not** move money, contact counterparties, deploy contracts, trade assets, or execute external actions.

```text
models reason
→ agents and members propose
→ reviewers deliberate
→ authorized humans decide
→ the canonical consequence boundary may permit an external effect
→ evidence and reconciliation determine whether the action worked
```

Hard invariant:

```text
UNAUTHORIZED_EXTERNAL_EFFECTS = 0
```

## Why the legacy concept was removed

The original repository described a decentralized memecoin coordination platform. That concept created market-manipulation, consumer-harm, authority, and evidentiary risks that conflict with the founder's current mission. The useful wallet-authentication idea was retained, but redesigned as one-time nonce-based identity proof. A wallet proves control of an address only; it grants no governance or financial authority.

## Run

Requires Node.js 20 or newer.

```bash
cd server
npm install
npm test
npm start
```

Open `http://localhost:3001`.

## API

- `GET /health`
- `GET /api/state`
- `GET /api/events/verify`
- `POST /api/identity/challenge`
- `POST /api/identity/verify`
- `POST /api/opportunities`
- `POST /api/opportunities/:id/deliberation`
- `POST /api/opportunities/:id/authorize`
- `POST /api/opportunities/:id/actions`
- `POST /api/opportunities/:id/evidence`
- `POST /api/opportunities/:id/outcome`

The bundled interface creates proposal records only. Higher-authority routes require an actor role supplied by a trusted adapter in a future Kernel integration. The current header-based actor selector is development scaffolding and must never be exposed as production authentication.

## Canonical boundaries

PumpStation owns its domain state: members, productive-asset opportunities, deliberation records, simulation proposals, evidence packets, and outcome records.

It does not own constitutional authority, production identity, shared governance contracts, settlement execution, or global causal memory. Those belong in `dababiyoda/uniimente-kernel`. PumpStation must consume those contracts before any production consequence is permitted.

## Governance records

- [`docs/FOUNDER_INTENT_LEDGER.md`](docs/FOUNDER_INTENT_LEDGER.md)
- [`docs/FOUNDER_INTENT_LEDGER.json`](docs/FOUNDER_INTENT_LEDGER.json)
- [`docs/DELIBERATION-0001.json`](docs/DELIBERATION-0001.json)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/MIGRATION.md`](docs/MIGRATION.md)
- [`docs/RECURSIVE_COLLABORATION_PROTOCOL.md`](docs/RECURSIVE_COLLABORATION_PROTOCOL.md)
- [`SECURITY.md`](SECURITY.md)
