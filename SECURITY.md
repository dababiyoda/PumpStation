# PumpStation Security Model

## Current classification

Sandbox research software. No real-money, trading, custody, public promotion, or external execution authority.

## Threats addressed in this phase

- replayable static wallet signatures;
- coordinated-buy and coordinated-exit instructions;
- promotion after accumulation;
- fake volume and guaranteed returns;
- affinity pressure and concealed conflicts;
- agent self-approval;
- stale or mismatched founder decision hashes;
- external-effect action requests in simulation mode;
- model output treated as admissible evidence;
- silent loss of dissent or Pass-1 disadvantages;
- event-history tampering.

## Known limitations

- `x-actor-id` and `x-actor-role` are development scaffolding, not production authentication.
- The JSON event file is not suitable for concurrent production writes.
- Deterministic screening is incomplete against paraphrases, multilingual attacks, obfuscation, and cross-message manipulation.
- There is no production session system, secret broker, workload identity, backup, or incident automation.
- No legal or compliance classification is encoded as authoritative advice.

## Production prerequisites

Production identity, short-lived capability grants, UNIIMENTE Kernel and Consequence Gate integration, transactional append-only persistence, secret management, abuse controls, semantic quarantine, independent security review, privacy assessment, backup/restore drills, monitoring, and signed deployment provenance.

Never disclose secrets or participant financial information in public issues.
