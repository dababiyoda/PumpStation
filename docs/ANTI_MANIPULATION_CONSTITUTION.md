# Anti-Manipulation Constitution

## Hard prohibitions

PumpStation refuses and preserves an incident or rejection record for:

1. pump-and-dump activity;
2. coordinated purchases intended to move price;
3. wash trading;
4. fake or manufactured volume;
5. spoofing or deceptive order placement;
6. undisclosed proposer holdings;
7. deceptive or undisclosed promotion;
8. guaranteed returns or risk-free-profit claims;
9. fabricated partnerships or adoption;
10. fake community accounts or sockpuppets;
11. concealed organizer compensation;
12. coordinated exits designed to transfer losses to later participants;
13. suppression of material negative evidence, liabilities, losses, or dissent;
14. pressure based on nationality, family, religion, ethnicity, or community loyalty;
15. organizer custody of participant funds in initial stages;
16. outside-capital intake before a legally authorized stage;
17. public promotion tied to an owned position.

No claim that an asset is strong, useful, productive, decentralized, or community-owned creates an exception.

## Structural enforcement

- `server/src/domain/antiManipulation.ts` implements deterministic screening rules.
- Structured screening answers are mandatory in every opportunity packet.
- Undisclosed holdings, compensation, or conflicts are independently blocked.
- Classifier error produces `AM-FAIL-CLOSED` and refusal.
- Prohibited execution, order, trade, transfer, deposit, custody, pooled-capital, and campaign paths return `403`.
- Positive-thesis chat that contains prohibited capital instructions is refused. Bear, legal, security, complaint, and education channels may preserve discussion of harmful conduct without becoming instructions.
- No exchange SDK, private-key store, order adapter, transfer method, swap route, or custody component exists.
- `server/scripts/check-prohibited-surfaces.ts` fails when a transaction or exchange surface appears in executable source.

The classifier is a protective screening layer, not a legal determination and not proof that unflagged content is safe. Evasion, ambiguity, multilingual phrasing, and novel manipulation patterns remain residual risks.

## Evidence basis

The CFTC describes social groups announcing a countdown, naming an asset and venue, recruiting outsiders, and organizers exiting first as a virtual-currency pump-and-dump pattern. It advises that market manipulation is unlawful and that no investment or trading strategy is guaranteed: [CFTC customer advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/beware_virtual_currency_pump_dump.html).

The SEC identifies affinity fraud as exploitation of trust within identifiable groups, including immigrant and ethnic communities, and warns against group-only recommendations, guaranteed returns, secrecy, and pressure: [SEC Investor Alert on Affinity Fraud](https://www.investor.gov/sites/default/files/ia_affinityfraud.pdf).

These sources inform the safety boundary. They do not constitute project-specific legal advice or clearance.

## Refusal semantics

A refusal:

- does not delete the attempted packet;
- creates an append-only `opportunity_rejected` or `incident` event;
- reports machine-readable rule IDs;
- does not activate a tool;
- does not create a transaction;
- can be challenged through additive evidence and a new version, never by rewriting history.

## Test map

The required adversarial cases are in `server/test/required-negative.test.ts`. Any classifier failure, unknown authority condition, or unexpected internal error defaults toward refusal and zero external effects.
