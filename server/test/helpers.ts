import type {
  Actor,
  DeliberationInput,
  OpportunityPacket,
  StagePromotionRequest,
} from "../src/domain/model.js";

const FIXTURE_HASH = `sha256:${"0".repeat(64)}`;

export function humanActor(overrides: Partial<Actor> = {}): Actor {
  return {
    actor_id: "human:test-founder",
    actor_class: "human",
    capabilities: [
      "opportunity:submit",
      "deliberation:write",
      "simulation:compile",
      "stage:request",
      "stage:decide",
    ],
    expires_at: "2099-01-01T00:00:00.000Z",
    purpose: "Stage 0 test fixture",
    data_scope: ["test_fixture"],
    resource_ceiling: 100,
    revoked: false,
    ...overrides,
  };
}

export function agentActor(overrides: Partial<Actor> = {}): Actor {
  return {
    ...humanActor(),
    actor_id: "agent:test-reviewer",
    actor_class: "agent",
    ...overrides,
  };
}

export function opportunityFixture(
  overrides: Partial<OpportunityPacket> = {},
): OpportunityPacket {
  const actor = humanActor();
  return {
    opportunity_id: "opp_productive_fixture",
    version: 1,
    title: "Synthetic neighborhood bookkeeping service",
    asset_or_business_type: "operating business",
    proposer: {
      actor_id: actor.actor_id,
      actor_class: "human",
    },
    proposer_holdings: {
      disclosed: true,
      description: "The proposer reports no current ownership interest.",
    },
    proposer_compensation: {
      disclosed: true,
      description: "The proposer reports no compensation.",
    },
    beneficiary: ["Synthetic local business operators"],
    affected_participants: ["Synthetic worker-owners"],
    problem_solved: "A test fixture models a bookkeeping capacity gap.",
    productive_value_created: "A test fixture models useful bookkeeping work.",
    buyer_or_customer: "Synthetic small-business customers",
    revenue_source: "Simulated service subscriptions",
    underlying_cash_flow: "Synthetic recurring service revenue",
    valuation_method: "Synthetic discounted cash-flow replay",
    liquidity: "Illiquid private operating asset in simulation",
    holding_period: "Five simulated years",
    capital_required: {
      amount: 100000,
      currency: "USD",
      mode: "simulated",
    },
    maximum_loss: {
      amount: 100000,
      currency: "USD",
      mode: "simulated",
    },
    expected_return_range: {
      minimum: -100,
      maximum: 15,
      unit: "percent",
      status: "simulation",
    },
    critical_assumptions: [
      "The synthetic customer-retention assumption remains testable.",
    ],
    evidence: [
      {
        evidence_id: "ev_fixture_primary",
        claim: "Synthetic recurring revenue exists in the fixture.",
        source_uri: "fixture://productive-opportunity/revenue",
        source_type: "test_fixture",
        evidence_status: "fixture_only",
        captured_at: "2026-07-26T00:00:00.000Z",
        content_hash: FIXTURE_HASH,
      },
    ],
    counterevidence: [
      {
        evidence_id: "ev_fixture_counter",
        claim: "Synthetic customer concentration creates downside.",
        source_uri: "fixture://productive-opportunity/concentration",
        source_type: "test_fixture",
        evidence_status: "fixture_only",
        captured_at: "2026-07-26T00:00:00.000Z",
        content_hash: FIXTURE_HASH,
      },
    ],
    conflicts: [
      {
        conflict_id: "conflict_fixture",
        category: "proposer",
        description: "No conflict is claimed in this synthetic fixture.",
        disclosed: true,
      },
    ],
    legal_questions: ["What laws would apply to a future real structure?"],
    security_risks: ["Synthetic records may be incomplete."],
    community_benefit: "Models useful service capacity without real capital.",
    community_harm_risks: [
      "A fixture could be mistaken for real-world performance.",
    ],
    exit_conditions: ["End the replay after five simulated years."],
    kill_conditions: ["Stop if the fixture is presented as real performance."],
    simulation_plan: {
      fixture_set: "productive-opportunity-v1",
      method: "deterministic historical replay fixture",
      seed: 26072026,
      benchmark: "passive synthetic benchmark",
    },
    screening_answers: {
      coordinated_buying: false,
      price_movement_intent: false,
      wash_trading: false,
      fake_volume: false,
      spoofing: false,
      deceptive_promotion: false,
      guaranteed_returns: false,
      fabricated_partnerships: false,
      fake_accounts: false,
      coordinated_exit: false,
      suppressed_negative_evidence: false,
      affinity_pressure: false,
      organizer_custody: false,
      outside_capital_intake: false,
      public_promotion_owned_asset: false,
    },
    decision_status: "submitted",
    ...overrides,
  };
}

export function deliberationFixture(
  channel_type: DeliberationInput["channel_type"],
  overrides: Partial<DeliberationInput> = {},
): DeliberationInput {
  return {
    channel_type,
    role: "Test Reviewer",
    content: `Synthetic ${channel_type.replaceAll("_", " ")} review.`,
    source_references: ["fixture://review"],
    evidence_status: "test_fixture",
    conflict_disclosure: "No additional conflict is reported in this fixture.",
    supersedes_message_id: null,
    ...overrides,
  };
}

export function completeRequiredDeliberation(
  add: (input: DeliberationInput) => unknown,
): void {
  for (const channel of [
    "bull_thesis",
    "bear_thesis",
    "conflicts",
    "legal_questions",
    "security",
    "community_impact",
  ] as const) {
    add(deliberationFixture(channel));
  }
}

export function stagePromotionFixture(
  overrides: Partial<StagePromotionRequest> = {},
): StagePromotionRequest {
  return {
    current_stage: 0,
    requested_next_stage: 1,
    exact_source_version: "df6a732-stage0-test",
    passed_evidence: ["Synthetic threat model review completed"],
    failed_evidence: [],
    unresolved_risks: ["Legal and security review remain non-production"],
    legal_review_status: "not_started",
    security_review_status: "pending",
    rollback_plan: ["Close the pilot and preserve the evidence packet"],
    kill_criteria: ["Any unauthorized external effect"],
    ...overrides,
  };
}
