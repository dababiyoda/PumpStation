# Unresolved Decisions

These items are deliberately not guessed or implemented.

| Decision | Why unresolved | Cheapest decisive evidence | Owner | Trigger |
| --- | --- | --- | --- | --- |
| Canonical UNIIMENTE Kernel API and package | Kernel internals were not available in the inspected repository or supplied files | inspect the authorized Kernel repository and versioned contracts | Founder + Kernel maintainer | before any cross-repository integration |
| Stage 1 participant identity | Wallet-only identity can exclude users and does not establish legal identity | closed-pilot user research and counsel-reviewed consent design | Product + counsel | Stage 1 request |
| Contract-wallet support | ERC-1271 needs chain-aware verification and session invalidation | threat model plus one supported-chain implementation test | Security | before public wallet auth |
| Production event store | JSONL is simple but not a concurrent, access-controlled production ledger | load, backup, restore, tamper, and operator tests | Operator | closed-pilot architecture review |
| External anchoring | Hash anchoring can improve inspectability but cannot make claims true | verifier requirements and privacy review | Security + evidence | named independent verifier |
| Multilingual disclosure languages | Community need has not been measured | pilot participant language distribution | Community reviewer | Stage 1 design |
| Independent complaint operator | Independence and escalation path are organizational, not software-only | named accountable operator and service-level target | Founder | closed-pilot consent |
| Legal classification by activity and asset | Securities, commodities, adviser, broker, fund, offering, custody, and state-law questions are fact-specific | written advice from qualified counsel on exact proposed activity | Counsel | before Stage 2 and again before Stage 3 |
| Founder wallet and recovery policy | No production founder address or key-recovery process is authorized | founder decision plus security review | Founder | deployment |
| Capital vehicle structure | Stage 5 explicitly requires external legal and operational infrastructure | counsel memo, administrator, custodian, audit, valuation and conflicts policy | Founder + counsel | Stage 5 only |
| Multi-agent complexity | Synthetic fixtures cannot prove superiority | held-out comparison with independent outcome review and participant-harm metrics | Evidence guardian | after enough Stage 0 cases |
| Human-moderated benchmark | The required first experiment compares multi-agent, centralized AI, deterministic rules, and passive behavior but not a human-moderated workflow | preregistered held-out comparison with equal evidence, time, and cost ceilings | Evidence guardian | before claiming institutional advantage |
| Semantic injection and untrusted-content isolation | Typed channels prevent chat from becoming a tool call, but novel prompt injection and multilingual semantic attacks are not measured | adversarial corpus, quarantine design, and measured escape/refusal rates | Security reviewer | before agents ingest open-web or participant-supplied documents |

Until resolved, each item remains fail-closed and creates no authority.
