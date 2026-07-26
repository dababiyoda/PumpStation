# PumpStation Labs

> **SIMULATION ONLY · NO REAL MONEY · NO INVESTMENT OFFER · NO COORDINATED MARKET ACTION · NO PUBLIC ASSET PROMOTION**
>
> **MODEL OUTPUT IS NOT FINANCIAL EVIDENCE**

PumpStation is an immigrant-led, agent-operated community capital research institution. It helps people combine knowledge, skills, relationships, and eventually governed capital to identify, underwrite, build, acquire, improve, and retain productive assets.

This release is Stage 0, a research sandbox. It accepts structured opportunities, preserves evidence and dissent, runs adversarial manipulation screening, compiles reproducible simulated decision packets, and records every material transition in an append-only hash chain. It cannot place orders, transfer assets, accept investor deposits, coordinate market buying, promote owned assets, activate a higher stage, or move money.

## Permanent authority rule

**Models reason. Agents propose. Policies and authorized humans decide. The UNIIMENTE Kernel determines what may become real. Reality determines what was correct.**

Agent agreement never creates authority. A founder decision recorded here is not a Kernel permit, and this standalone Venture Cell has no external-effect adapter.

## Current executable surface

- nonce-bound wallet authentication for identity only;
- opportunity intake against a machine-readable packet;
- deterministic manipulation-risk classification that fails closed;
- typed deliberation channels for bull, bear, conflicts, legal, security, community impact, complaints, education, and reconciliation;
- simulated decision packet compilation;
- append-only, hash-chained institutional events;
- hash-bound stage-promotion packets that remain `awaiting_kernel_permit` after founder approval;
- a founder-visible dashboard;
- a reproducible synthetic experiment comparing multi-agent, centralized-analyst proxy, deterministic rules, and passive benchmark approaches.

There are intentionally no exchange SDKs, private-key stores, transaction methods, custody endpoints, order routes, deposit routes, or settlement adapters.

## Run locally

Requirements: Node.js 22 or newer and npm 10 or newer.

```bash
npm run install:server
npm test
npm run build
npm run experiment
npm run dev
```

Open `http://localhost:3001`. Local append-only events are written to `server/data/institutional-events.jsonl` unless `PUMPSTATION_EVENT_LOG_PATH=:memory:` is set.

Copy `server/.env.example` to `server/.env` only when local overrides are needed. Wallet authentication is identity-only. The founder address is optional and grants only the ability to record a founder stage decision; it does not activate a stage or authorize a transaction.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/status` | Simulation and authority status |
| `POST` | `/api/v1/identity/challenges` | Create a one-time identity challenge |
| `POST` | `/api/v1/identity/sessions` | Verify a signed challenge |
| `POST` | `/api/v1/opportunities` | Submit a structured opportunity |
| `GET` | `/api/v1/opportunities/:id` | Read one opportunity and its review record |
| `POST` | `/api/v1/opportunities/:id/deliberations` | Add a typed, attributable review |
| `POST` | `/api/v1/opportunities/:id/simulated-decisions` | Compile a proposal-only decision packet |
| `POST` | `/api/v1/stage-promotions` | Create a hash-bound promotion request |
| `POST` | `/api/v1/stage-promotions/:id/founder-decision` | Record a founder decision; never activates the stage |
| `GET` | `/api/v1/dashboard` | Founder-visible Stage 0 projection |

Requests to execution, order, trade, transfer, deposit, pooled-capital, promotion-campaign, or custody paths are refused.

## Evidence and governance

- [Institutional charter](docs/INSTITUTIONAL_CHARTER.md)
- [Anti-manipulation constitution](docs/ANTI_MANIPULATION_CONSTITUTION.md)
- [Public launch ladder](docs/PUBLIC_LAUNCH_LADDER.md)
- [Agent role contracts](docs/AGENT_ROLE_CONTRACTS.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Migration record](docs/MIGRATION.md)
- [Architecture ownership](docs/ARCHITECTURE_OWNERSHIP.md)
- [Founder intent ledger](governance/FOUNDER_INTENT_LEDGER.md)
- [Constitutional deliberation](docs/adr/0001-community-capital-institution.md)
- [Unresolved decisions](docs/UNRESOLVED_DECISIONS.md)

Tests and synthetic results prove code behavior only. They do not prove investment quality, legal clearance, participant welfare, market demand, or commercial performance.

## Stage 0 experiment result

The deterministic fixture did not justify multi-agent complexity. Multi-agent review and deterministic rules both scored `1.0` for fixture decision quality and fraud detection, while deterministic rules used one-tenth of the modeled operating-cost units. The committed result therefore sets the complexity gate to `NOT_EARNED`.

This is a synthetic software experiment, not investment performance. See the [complete hash-bound result](experiments/results/stage0-baseline.json).

## License

GPL-3.0-only. See [LICENSE](LICENSE).
