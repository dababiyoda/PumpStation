# Repository Rationalization Plan

## Repository role card

- Repository: `dababiyoda/PumpStation`
- Lifecycle: transitional Stage 0
- Unique responsibility: simulation-only community capital research Venture Cell
- Canonically owns: PumpStation opportunity, deliberation, local event, decision, and promotion packet semantics
- Consumes: future UNIIMENTE authority and consequence contracts
- Explicitly must not own: global constitutional authority, Kernel permits, money movement, trading, custody, settlement, public asset promotion
- External-effect boundary: no adapter exists
- Testing boundary: schema, domain, API, event integrity, experiment reproducibility, prohibited-surface scan
- Deployment boundary: local Node process only; production deployment is not authorized by this PR
- Maintainer and decision owner: Alfonso Lopez

## Inspection result

The baseline had eight inventory entries including `.git`, seven scanned files, two authored-source candidates, no exact byte duplicates, and no shared contracts or tests. Exact duplicate detection reported zero duplicate groups. The inventory and duplicate reports were generated outside the repository because they are inspection evidence, not product source.

## Path classification after migration

| Path | Classification |
| --- | --- |
| `server/src/**` | canonical authored Stage 0 source |
| `schemas/**` | shared wire contracts |
| `client/**` | projection interface, no authority |
| `server/test/**` | evidence artifacts expressed as executable tests |
| `fixtures/**` | explicitly labeled test fixtures |
| `experiments/results/**` | deterministic generated evidence artifact |
| `governance/**` | intent and deliberation records |
| `docs/**` | documentation linked to executable truth |
| `server/index.js` | temporary compatibility shim |
| `server/dist`, `server/data`, `node_modules` | generated output or runtime state, ignored |

## Rationalization decisions

- Keep one server process and one static client.
- Use one append-only event store; do not add Mongo, Redis, a message bus, or blockchain at Stage 0.
- Keep JSON Schema for external contracts and Zod for runtime validation; add parity tests to prevent silent drift.
- Keep the future execution-grant schema dormant. Do not create an issuer or adapter.
- Do not merge stale open pull requests into this migration.
- Do not delete historical branches, pull requests, commits, or the GPL license.

## Reversal evidence

Reconsider the single-process design when measured load, availability requirements, or independent security review proves it insufficient. Reconsider the JSONL store when a closed pilot requires durable concurrent writes, access control, backup, or independent anchoring. Reconsider multi-agent runtime complexity only after held-out outcomes beat both a centralized analyst and deterministic rules by a material pre-registered margin.
