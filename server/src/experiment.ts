import { sha256 } from "./domain/hash.js";

export type SyntheticOpportunity = {
  id: string;
  title: string;
  productive: boolean;
  evidence_completeness: number;
  conflicts_disclosed: boolean;
  bear_thesis_present: boolean;
  fraud_labels: string[];
  expected_return: number;
  realized_returns: number[];
};

export type ExperimentFixture = {
  fixture_metadata: {
    fixture_id: string;
    classification: "test_fixture";
    created_at: string;
    warning: string;
    seed: number;
  };
  opportunities: SyntheticOpportunity[];
};

type StrategyDecision = {
  opportunity_id: string;
  accept_for_simulation: boolean;
  fraud_detected: boolean;
  evidence_completeness: number;
  dissent_preserved: boolean;
};

type Strategy = {
  id:
    | "coordinated_multi_agent"
    | "centralized_analyst_proxy"
    | "deterministic_rules"
    | "passive_benchmark";
  operating_cost_units: number;
  decision_time_units: number;
  decide: (opportunity: SyntheticOpportunity) => StrategyDecision;
};

function coordinatedMultiAgent(
  opportunity: SyntheticOpportunity,
): StrategyDecision {
  const fraudDetected = opportunity.fraud_labels.length > 0;
  return {
    opportunity_id: opportunity.id,
    accept_for_simulation:
      opportunity.productive &&
      opportunity.evidence_completeness >= 0.8 &&
      opportunity.conflicts_disclosed &&
      opportunity.bear_thesis_present &&
      !fraudDetected,
    fraud_detected: fraudDetected,
    evidence_completeness: opportunity.evidence_completeness,
    dissent_preserved: opportunity.bear_thesis_present,
  };
}

function centralizedAnalystProxy(
  opportunity: SyntheticOpportunity,
): StrategyDecision {
  const limitedFraudDetection = opportunity.fraud_labels.some((label) =>
    ["guaranteed_returns", "organizer_custody", "fake_volume"].includes(label),
  );
  return {
    opportunity_id: opportunity.id,
    accept_for_simulation:
      opportunity.productive &&
      opportunity.expected_return >= 5 &&
      !limitedFraudDetection,
    fraud_detected: limitedFraudDetection,
    evidence_completeness: Math.min(opportunity.evidence_completeness, 0.72),
    dissent_preserved: false,
  };
}

function deterministicRules(
  opportunity: SyntheticOpportunity,
): StrategyDecision {
  const fraudDetected = opportunity.fraud_labels.length > 0;
  return {
    opportunity_id: opportunity.id,
    accept_for_simulation:
      opportunity.productive &&
      opportunity.evidence_completeness >= 0.6 &&
      opportunity.conflicts_disclosed &&
      !fraudDetected,
    fraud_detected: fraudDetected,
    evidence_completeness: opportunity.evidence_completeness,
    dissent_preserved: false,
  };
}

function passiveBenchmark(opportunity: SyntheticOpportunity): StrategyDecision {
  return {
    opportunity_id: opportunity.id,
    accept_for_simulation: true,
    fraud_detected: false,
    evidence_completeness: 0,
    dissent_preserved: false,
  };
}

const STRATEGIES: Strategy[] = [
  {
    id: "coordinated_multi_agent",
    operating_cost_units: 10,
    decision_time_units: 8,
    decide: coordinatedMultiAgent,
  },
  {
    id: "centralized_analyst_proxy",
    operating_cost_units: 4,
    decision_time_units: 3,
    decide: centralizedAnalystProxy,
  },
  {
    id: "deterministic_rules",
    operating_cost_units: 1,
    decision_time_units: 1,
    decide: deterministicRules,
  },
  {
    id: "passive_benchmark",
    operating_cost_units: 0.2,
    decision_time_units: 0.1,
    decide: passiveBenchmark,
  },
];

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function portfolioReturns(
  opportunities: SyntheticOpportunity[],
  decisions: StrategyDecision[],
): number[] {
  const accepted = opportunities.filter(
    (opportunity) =>
      decisions.find((decision) => decision.opportunity_id === opportunity.id)
        ?.accept_for_simulation,
  );
  if (accepted.length === 0) return [0];
  const periods = Math.max(
    ...accepted.map((opportunity) => opportunity.realized_returns.length),
  );
  return Array.from({ length: periods }, (_, index) => {
    const values = accepted.map(
      (opportunity) => opportunity.realized_returns[index] ?? 0,
    );
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

function maximumDrawdown(returns: number[]): number {
  let value = 100;
  let peak = 100;
  let maxDrawdown = 0;
  for (const periodReturn of returns) {
    value *= 1 + periodReturn / 100;
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
  }
  return round(maxDrawdown * 100);
}

function riskAdjustedReturn(returns: number[]): number {
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    returns.length;
  const deviation = Math.sqrt(variance);
  return deviation === 0 ? 0 : round(mean / deviation);
}

export function runStageZeroExperiment(fixture: ExperimentFixture) {
  const evaluated = STRATEGIES.map((strategy) => {
    const decisions = fixture.opportunities.map(strategy.decide);
    const fraudCases = fixture.opportunities.filter(
      (opportunity) => opportunity.fraud_labels.length > 0,
    );
    const correct = fixture.opportunities.filter((opportunity) => {
      const decision = decisions.find(
        (candidate) => candidate.opportunity_id === opportunity.id,
      ) as StrategyDecision;
      const shouldAccept =
        opportunity.productive &&
        opportunity.evidence_completeness >= 0.8 &&
        opportunity.conflicts_disclosed &&
        opportunity.bear_thesis_present &&
        opportunity.fraud_labels.length === 0;
      return decision.accept_for_simulation === shouldAccept;
    }).length;
    const detected = fraudCases.filter(
      (opportunity) =>
        decisions.find((decision) => decision.opportunity_id === opportunity.id)
          ?.fraud_detected,
    ).length;
    const acceptedDecisions = decisions.filter(
      (decision) => decision.accept_for_simulation,
    );
    const returns = portfolioReturns(fixture.opportunities, decisions);
    const policyViolations = fixture.opportunities.filter(
      (opportunity) =>
        opportunity.fraud_labels.length > 0 &&
        decisions.find((decision) => decision.opportunity_id === opportunity.id)
          ?.accept_for_simulation,
    ).length;

    return {
      system: strategy.id,
      decision_quality: round(correct / fixture.opportunities.length),
      evidence_completeness:
        acceptedDecisions.length === 0
          ? 0
          : round(
              acceptedDecisions.reduce(
                (sum, decision) => sum + decision.evidence_completeness,
                0,
              ) / acceptedDecisions.length,
            ),
      fraud_detection:
        fraudCases.length === 0 ? 1 : round(detected / fraudCases.length),
      maximum_drawdown_percent: maximumDrawdown(returns),
      risk_adjusted_return: riskAdjustedReturn(returns),
      operating_cost_units: strategy.operating_cost_units,
      time_to_decision_units: strategy.decision_time_units,
      dissent_preservation:
        acceptedDecisions.length === 0
          ? 0
          : round(
              acceptedDecisions.filter((decision) => decision.dissent_preserved)
                .length / acceptedDecisions.length,
            ),
      policy_violations: policyViolations,
      reproducible: true,
      accepted_opportunities: acceptedDecisions.map(
        (decision) => decision.opportunity_id,
      ),
    };
  });

  const multiAgent = evaluated.find(
    (result) => result.system === "coordinated_multi_agent",
  ) as (typeof evaluated)[number];
  const simpler = evaluated.filter(
    (result) =>
      result.system === "centralized_analyst_proxy" ||
      result.system === "deterministic_rules",
  );
  const bestSimplerQuality = Math.max(
    ...simpler.map((result) => result.decision_quality),
  );
  const fixtureOutperformance =
    multiAgent.decision_quality >= bestSimplerQuality + 0.1 &&
    multiAgent.policy_violations === 0;
  const resultWithoutHash = {
    experiment_id: "stage0-architecture-comparison-v1",
    reality_status: "test_fixture",
    fixture_id: fixture.fixture_metadata.fixture_id,
    fixture_hash: sha256(fixture),
    seed: fixture.fixture_metadata.seed,
    generated_at: fixture.fixture_metadata.created_at,
    warning: fixture.fixture_metadata.warning,
    systems: evaluated,
    complexity_gate: {
      fixture_outperformance: fixtureOutperformance,
      decision: "NOT_EARNED",
      reason:
        "Synthetic fixtures can test code and expose tradeoffs but cannot justify added institutional complexity. A held-out pilot with independently reviewed outcomes is required.",
      revival_evidence:
        "Material outperformance against simpler systems on held-out, independently reviewed opportunities with zero policy violations and measured participant-harm outcomes.",
    },
    negative_results_preserved: true,
  };

  return {
    ...resultWithoutHash,
    result_hash: sha256(resultWithoutHash),
  };
}
