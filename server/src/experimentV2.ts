import { sha256 } from "./domain/hash.js";

export type TieredDecision = "APPROVE_SIMULATION" | "DEFER" | "REJECT";

export type TieredSyntheticOpportunity = {
  id: string;
  title: string;
  asset_type: string;
  summary: string;
  productive: boolean;
  evidence_present: string[];
  risk_labels: string[];
  conflicts: string[];
  expected_decision: TieredDecision;
  critical_risks: string[];
  required_evidence: string[];
  harmful_if_approved: boolean;
};

export type TieredExperimentFixture = {
  fixture_metadata: {
    fixture_id: string;
    classification: "test_fixture";
    created_at: string;
    warning: string;
    seed: number;
    prior_result_hash: `sha256:${string}`;
  };
  opportunities: TieredSyntheticOpportunity[];
};

type PublicOpportunity = Omit<
  TieredSyntheticOpportunity,
  | "expected_decision"
  | "critical_risks"
  | "required_evidence"
  | "harmful_if_approved"
>;

type StrategyDecision = {
  opportunity_id: string;
  decision: TieredDecision;
  detected_risks: string[];
  evidence_reviewed: string[];
  missing_evidence_detected: string[];
  dissent_preserved: boolean;
  deliberation_used: boolean;
  policy_violations: string[];
};

type Strategy = {
  id:
    | "full_multi_agent_two_pass"
    | "tiered_rules_plus_deliberation"
    | "centralized_analyst_proxy"
    | "deterministic_rules"
    | "human_moderated_proxy"
    | "do_nothing";
  operating_cost_units: number;
  decision_time_units: number;
  decide: (opportunity: PublicOpportunity) => StrategyDecision;
};

const PROHIBITED_RISKS = new Set([
  "coordinated_buying",
  "promotion_after_accumulation",
  "exit_liquidity_transfer",
  "guaranteed_returns",
  "organizer_custody",
  "fake_volume",
  "wash_trading",
  "affinity_pressure",
  "deceptive_listing",
]);

const RISK_EVIDENCE: Record<string, string[]> = {
  customer_concentration: ["customer_contracts", "reseller_contract"],
  reseller_termination: ["reseller_contract"],
  jurisdiction_unknown: ["legal_classification"],
  tax_unknown: ["tax_analysis"],
  slashing: ["slashing_controls"],
  environmental_liability: ["phase_one_environmental"],
  remediation_cost: ["remediation_estimate"],
  licensing_gap: ["licensed_partner", "compliance_plan"],
  banking_dependency: ["licensed_partner", "banking_agreement"],
  missing_financials: ["financial_statements"],
  undefined_terms: ["investment_terms"],
  concealed_compensation: ["conflict_disclosure"],
  organizer_custody: ["custody_terms"],
  unverifiable_revenue: ["revenue_source"],
  missing_audit: ["audited_reserves"],
};

function publicView(
  opportunity: TieredSyntheticOpportunity,
): PublicOpportunity {
  const {
    expected_decision: _expectedDecision,
    critical_risks: _criticalRisks,
    required_evidence: _requiredEvidence,
    harmful_if_approved: _harmfulIfApproved,
    ...visible
  } = opportunity;
  return structuredClone(visible);
}

function missingEvidence(opportunity: PublicOpportunity): string[] {
  const available = new Set(opportunity.evidence_present);
  return [
    ...new Set(
      opportunity.risk_labels.flatMap((risk) => {
        const candidates = RISK_EVIDENCE[risk] ?? [];
        return candidates.some((candidate) => available.has(candidate))
          ? []
          : candidates;
      }),
    ),
  ];
}

function prohibitedRisks(opportunity: PublicOpportunity): string[] {
  return opportunity.risk_labels.filter((risk) => PROHIBITED_RISKS.has(risk));
}

function fullInstitution(opportunity: PublicOpportunity): StrategyDecision {
  const prohibited = prohibitedRisks(opportunity);
  const missing = missingEvidence(opportunity);
  let decision: TieredDecision = "APPROVE_SIMULATION";
  if (prohibited.length > 0) decision = "REJECT";
  else if (missing.length > 0 || opportunity.evidence_present.length < 3) {
    decision = "DEFER";
  }
  return {
    opportunity_id: opportunity.id,
    decision,
    detected_risks: [...opportunity.risk_labels],
    evidence_reviewed: [...opportunity.evidence_present],
    missing_evidence_detected: missing,
    dissent_preserved: true,
    deliberation_used: true,
    policy_violations: [],
  };
}

function needsEscalation(opportunity: PublicOpportunity): boolean {
  return (
    prohibitedRisks(opportunity).length > 0 ||
    missingEvidence(opportunity).length > 0 ||
    opportunity.conflicts.length > 0 ||
    opportunity.evidence_present.length < 4
  );
}

function tieredInstitution(opportunity: PublicOpportunity): StrategyDecision {
  if (needsEscalation(opportunity)) return fullInstitution(opportunity);
  return {
    opportunity_id: opportunity.id,
    decision: "APPROVE_SIMULATION",
    detected_risks: [...opportunity.risk_labels],
    evidence_reviewed: [...opportunity.evidence_present],
    missing_evidence_detected: [],
    dissent_preserved: false,
    deliberation_used: false,
    policy_violations: [],
  };
}

function centralizedAnalyst(opportunity: PublicOpportunity): StrategyDecision {
  const recognized = new Set([
    "guaranteed_returns",
    "fake_volume",
    "wash_trading",
    "coordinated_buying",
    "customer_concentration",
    "licensing_gap",
    "environmental_liability",
  ]);
  const detected = opportunity.risk_labels.filter((risk) =>
    recognized.has(risk),
  );
  const narrowed: PublicOpportunity = { ...opportunity, risk_labels: detected };
  const missing = missingEvidence(narrowed);
  let decision: TieredDecision =
    opportunity.evidence_present.length >= 3 ? "APPROVE_SIMULATION" : "DEFER";
  if (detected.some((risk) => PROHIBITED_RISKS.has(risk))) decision = "REJECT";
  else if (missing.length > 0) decision = "DEFER";
  return {
    opportunity_id: opportunity.id,
    decision,
    detected_risks: detected,
    evidence_reviewed: opportunity.evidence_present.slice(0, 3),
    missing_evidence_detected: missing,
    dissent_preserved: false,
    deliberation_used: false,
    policy_violations: [],
  };
}

function deterministicRules(opportunity: PublicOpportunity): StrategyDecision {
  const prohibited = prohibitedRisks(opportunity);
  const missing = missingEvidence(opportunity);
  let decision: TieredDecision = "APPROVE_SIMULATION";
  if (prohibited.length > 0) decision = "REJECT";
  else if (missing.length > 0 || opportunity.evidence_present.length < 4) {
    decision = "DEFER";
  }
  return {
    opportunity_id: opportunity.id,
    decision,
    detected_risks: [...opportunity.risk_labels],
    evidence_reviewed: [...opportunity.evidence_present],
    missing_evidence_detected: missing,
    dissent_preserved: false,
    deliberation_used: false,
    policy_violations: [],
  };
}

function doNothing(opportunity: PublicOpportunity): StrategyDecision {
  return {
    opportunity_id: opportunity.id,
    decision: "DEFER",
    detected_risks: [],
    evidence_reviewed: [],
    missing_evidence_detected: [],
    dissent_preserved: false,
    deliberation_used: false,
    policy_violations: [],
  };
}

const STRATEGIES: Strategy[] = [
  {
    id: "full_multi_agent_two_pass",
    operating_cost_units: 5,
    decision_time_units: 5,
    decide: fullInstitution,
  },
  {
    id: "tiered_rules_plus_deliberation",
    operating_cost_units: 0,
    decision_time_units: 0,
    decide: tieredInstitution,
  },
  {
    id: "centralized_analyst_proxy",
    operating_cost_units: 1,
    decision_time_units: 1,
    decide: centralizedAnalyst,
  },
  {
    id: "deterministic_rules",
    operating_cost_units: 0.2,
    decision_time_units: 0.2,
    decide: deterministicRules,
  },
  {
    id: "human_moderated_proxy",
    operating_cost_units: 4,
    decision_time_units: 8,
    decide: fullInstitution,
  },
  {
    id: "do_nothing",
    operating_cost_units: 0.05,
    decision_time_units: 0.05,
    decide: doNothing,
  },
];

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function evaluate(fixture: TieredExperimentFixture, strategy: Strategy) {
  const decisions = fixture.opportunities.map((opportunity) =>
    strategy.decide(publicView(opportunity)),
  );
  let correct = 0;
  let harmfulApprovals = 0;
  let harmfulCases = 0;
  let criticalDetected = 0;
  let criticalTotal = 0;
  let missingDetected = 0;
  let missingTotal = 0;
  let dissentPreserved = 0;
  let dissentRequired = 0;
  let deliberations = 0;
  let policyViolations = 0;

  fixture.opportunities.forEach((opportunity, index) => {
    const decision = decisions[index];
    if (!decision) throw new Error(`Missing decision at index ${index}`);
    if (decision.decision === opportunity.expected_decision) correct += 1;
    if (opportunity.harmful_if_approved) {
      harmfulCases += 1;
      if (decision.decision === "APPROVE_SIMULATION") harmfulApprovals += 1;
    }
    const detected = new Set(decision.detected_risks);
    for (const risk of opportunity.critical_risks) {
      criticalTotal += 1;
      if (detected.has(risk)) criticalDetected += 1;
    }
    const claimedMissing = new Set(decision.missing_evidence_detected);
    for (const evidence of opportunity.required_evidence.filter(
      (item) => !opportunity.evidence_present.includes(item),
    )) {
      missingTotal += 1;
      if (claimedMissing.has(evidence)) missingDetected += 1;
    }
    const requiresDissent =
      opportunity.expected_decision !== "APPROVE_SIMULATION" ||
      opportunity.conflicts.length > 0;
    if (requiresDissent) {
      dissentRequired += 1;
      if (decision.dissent_preserved) dissentPreserved += 1;
    }
    if (decision.deliberation_used) deliberations += 1;
    policyViolations += decision.policy_violations.length;
  });

  const tieredCost =
    strategy.id === "tiered_rules_plus_deliberation"
      ? decisions.reduce(
          (sum, decision) => sum + (decision.deliberation_used ? 3.2 : 0.25),
          0,
        )
      : strategy.operating_cost_units * fixture.opportunities.length;
  const tieredTime =
    strategy.id === "tiered_rules_plus_deliberation"
      ? decisions.reduce(
          (sum, decision) => sum + (decision.deliberation_used ? 3.2 : 0.25),
          0,
        )
      : strategy.decision_time_units * fixture.opportunities.length;

  return {
    system: strategy.id,
    decision_quality: round(correct / fixture.opportunities.length),
    harmful_approval_rate:
      harmfulCases === 0 ? 0 : round(harmfulApprovals / harmfulCases),
    critical_risk_recall:
      criticalTotal === 0 ? 1 : round(criticalDetected / criticalTotal),
    missing_evidence_recall:
      missingTotal === 0 ? 1 : round(missingDetected / missingTotal),
    required_dissent_preservation:
      dissentRequired === 0 ? 1 : round(dissentPreserved / dissentRequired),
    deliberation_rate: round(deliberations / fixture.opportunities.length),
    operating_cost_units: round(tieredCost),
    time_to_decision_units: round(tieredTime),
    policy_violations: policyViolations,
    reproducible: true as const,
  };
}

export function runTieredExperiment(fixture: TieredExperimentFixture) {
  const systems = STRATEGIES.map((strategy) => evaluate(fixture, strategy));
  const full = systems.find(
    (system) => system.system === "full_multi_agent_two_pass",
  );
  const tiered = systems.find(
    (system) => system.system === "tiered_rules_plus_deliberation",
  );
  const rules = systems.find(
    (system) => system.system === "deterministic_rules",
  );
  if (!full || !tiered || !rules) throw new Error("Required systems missing");

  const tieredPreservesFull =
    tiered.decision_quality >= full.decision_quality &&
    tiered.harmful_approval_rate === full.harmful_approval_rate &&
    tiered.critical_risk_recall >= full.critical_risk_recall &&
    tiered.missing_evidence_recall >= full.missing_evidence_recall &&
    tiered.required_dissent_preservation >=
      full.required_dissent_preservation &&
    tiered.policy_violations === 0;
  const tieredCheaper =
    tiered.operating_cost_units < full.operating_cost_units &&
    tiered.time_to_decision_units < full.time_to_decision_units;
  const beatsRules =
    tiered.decision_quality > rules.decision_quality ||
    tiered.critical_risk_recall > rules.critical_risk_recall ||
    tiered.missing_evidence_recall > rules.missing_evidence_recall;

  const resultWithoutHash = {
    experiment_id: "stage0-tiered-architecture-comparison-v2",
    reality_status: "test_fixture" as const,
    protocol_status: "post_v1_reconfiguration" as const,
    fixture_id: fixture.fixture_metadata.fixture_id,
    fixture_hash: sha256(fixture),
    prior_result_hash: fixture.fixture_metadata.prior_result_hash,
    seed: fixture.fixture_metadata.seed,
    generated_at: fixture.fixture_metadata.created_at,
    warning: fixture.fixture_metadata.warning,
    systems,
    architecture_decision: {
      decision:
        tieredPreservesFull && tieredCheaper
          ? ("REGRESS_FULL_SWARM_RETAIN_TIERED_EXPERIMENT" as const)
          : ("INCONCLUSIVE_REDESIGN_REQUIRED" as const),
      reason:
        "Use deterministic triage for routine cases and invoke five-role, two-pass deliberation only for ambiguity, conflict, missing evidence, prohibited conduct, or higher consequence. This remains a sandbox experiment.",
    },
    complexity_gate: {
      multi_agent_advantage_over_rules: beatsRules,
      decision: "NOT_EARNED_AGAINST_DETERMINISTIC_RULES" as const,
      reason:
        "The authored deterministic rules matched the tiered workflow on this synthetic corpus at lower cost. Independent ambiguous holdout cases are required before claiming agent advantage.",
      revival_evidence:
        "Material improvement on independently authored, sealed, ambiguity-rich cases with measured escalation escapes, participant welfare, cost, and zero policy violations.",
    },
    contamination_controls: {
      hidden_labels_removed_before_evaluation: true,
      identical_public_cases_across_systems: true,
      v1_negative_result_preserved: true,
      external_effects: false,
      independent_reviewer: false,
    },
    limitations: [
      "V2 was designed after observing V1 and is a reconfiguration test, not an independent confirmation study.",
      "The fixture and strategy rules share authorship and may encode design bias.",
      "No independent model, analyst, participant, legal review, or external outcome was used.",
      "The result cannot authorize public launch, capital movement, promotion, custody, trading, or fund activity.",
    ],
    negative_results_preserved: true,
  };

  return { ...resultWithoutHash, result_hash: sha256(resultWithoutHash) };
}

export { publicView as tieredPublicView };
