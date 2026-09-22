import { z } from "zod";

export const ActorClassSchema = z.enum(["human", "agent", "policy", "system"]);
export type ActorClass = z.infer<typeof ActorClassSchema>;

export const ActorSchema = z
  .object({
    actor_id: z.string().min(1),
    actor_class: ActorClassSchema,
    capabilities: z.array(z.string().min(1)).default([]),
    expires_at: z.string().datetime().nullable().default(null),
    purpose: z.string().min(1).default("bounded PumpStation participation"),
    data_scope: z.array(z.string().min(1)).default(["public_research"]),
    resource_ceiling: z.number().nonnegative().default(0),
    revoked: z.boolean().default(false),
  })
  .strict();
export type Actor = z.infer<typeof ActorSchema>;

const DisclosureSchema = z
  .object({
    disclosed: z.boolean(),
    description: z.string().min(1),
  })
  .strict();

const MoneySchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    mode: z.literal("simulated"),
  })
  .strict();

const ReturnRangeSchema = z
  .object({
    minimum: z.number(),
    maximum: z.number(),
    unit: z.enum(["percent", "multiple", "currency"]),
    status: z.literal("simulation"),
  })
  .strict()
  .refine((value) => value.maximum >= value.minimum, {
    message: "maximum must be greater than or equal to minimum",
  });

export const EvidenceSchema = z
  .object({
    evidence_id: z.string().min(1),
    claim: z.string().min(1),
    source_uri: z.string().min(1),
    source_type: z.enum([
      "primary_source",
      "independent_analysis",
      "test_fixture",
      "model_output",
    ]),
    evidence_status: z.enum([
      "unverified",
      "corroborated",
      "challenged",
      "invalidated",
      "fixture_only",
    ]),
    captured_at: z.string().datetime(),
    content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();

const ConflictSchema = z
  .object({
    conflict_id: z.string().min(1),
    category: z.string().min(1),
    description: z.string().min(1),
    disclosed: z.boolean(),
  })
  .strict();

export const ScreeningAnswersSchema = z
  .object({
    coordinated_buying: z.boolean(),
    price_movement_intent: z.boolean(),
    wash_trading: z.boolean(),
    fake_volume: z.boolean(),
    spoofing: z.boolean(),
    deceptive_promotion: z.boolean(),
    guaranteed_returns: z.boolean(),
    fabricated_partnerships: z.boolean(),
    fake_accounts: z.boolean(),
    coordinated_exit: z.boolean(),
    suppressed_negative_evidence: z.boolean(),
    affinity_pressure: z.boolean(),
    organizer_custody: z.boolean(),
    outside_capital_intake: z.boolean(),
    public_promotion_owned_asset: z.boolean(),
  })
  .strict();

export const OpportunityPacketSchema = z
  .object({
    opportunity_id: z.string().regex(/^opp_[A-Za-z0-9_-]+$/),
    version: z.number().int().positive(),
    title: z.string().min(1),
    asset_or_business_type: z.string().min(1),
    proposer: z
      .object({
        actor_id: z.string().min(1),
        actor_class: z.enum(["human", "agent"]),
      })
      .strict(),
    proposer_holdings: DisclosureSchema,
    proposer_compensation: DisclosureSchema,
    beneficiary: z.array(z.string().min(1)).min(1),
    affected_participants: z.array(z.string().min(1)).min(1),
    problem_solved: z.string().min(1),
    productive_value_created: z.string().min(1),
    buyer_or_customer: z.string().min(1),
    revenue_source: z.string().min(1),
    underlying_cash_flow: z.string().min(1),
    valuation_method: z.string().min(1),
    liquidity: z.string().min(1),
    holding_period: z.string().min(1),
    capital_required: MoneySchema,
    maximum_loss: MoneySchema,
    expected_return_range: ReturnRangeSchema,
    critical_assumptions: z.array(z.string().min(1)).min(1),
    evidence: z.array(EvidenceSchema).min(1),
    counterevidence: z.array(EvidenceSchema).min(1),
    conflicts: z.array(ConflictSchema).min(1),
    legal_questions: z.array(z.string().min(1)).min(1),
    security_risks: z.array(z.string().min(1)).min(1),
    community_benefit: z.string().min(1),
    community_harm_risks: z.array(z.string().min(1)).min(1),
    exit_conditions: z.array(z.string().min(1)).min(1),
    kill_conditions: z.array(z.string().min(1)).min(1),
    simulation_plan: z
      .object({
        fixture_set: z.string().min(1),
        method: z.string().min(1),
        seed: z.number().int(),
        benchmark: z.string().min(1),
      })
      .strict(),
    screening_answers: ScreeningAnswersSchema,
    decision_status: z.enum([
      "submitted",
      "rejected",
      "needs_evidence",
      "simulation_eligible",
      "retired",
    ]),
  })
  .strict();
export type OpportunityPacket = z.infer<typeof OpportunityPacketSchema>;

export const ChannelTypeSchema = z.enum([
  "opportunity_submission",
  "evidence",
  "bull_thesis",
  "bear_thesis",
  "conflicts",
  "legal_questions",
  "security",
  "community_impact",
  "decision_review",
  "simulation_results",
  "outcome_reconciliation",
  "complaints_appeals",
  "education",
]);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const EvidenceStatusSchema = z.enum([
  "claim",
  "model_output",
  "test_fixture",
  "simulation",
  "external_evidence",
  "independently_verified_outcome",
  "commercial_result",
]);

export const DeliberationInputSchema = z
  .object({
    channel_type: ChannelTypeSchema,
    role: z.string().min(1),
    content: z.string().min(1),
    source_references: z.array(z.string().min(1)).default([]),
    evidence_status: EvidenceStatusSchema,
    conflict_disclosure: z.string().min(1),
    supersedes_message_id: z.string().nullable().default(null),
  })
  .strict();
export type DeliberationInput = z.infer<typeof DeliberationInputSchema>;

export const DeliberationMessageSchema = DeliberationInputSchema.extend({
  message_id: z.string().regex(/^msg_[A-Za-z0-9_-]+$/),
  linked_opportunity_id: z.string().regex(/^opp_[A-Za-z0-9_-]+$/),
  author: z
    .object({
      actor_id: z.string().min(1),
      actor_class: z.enum(["human", "agent"]),
      role: z.string().min(1),
    })
    .strict(),
  timestamp: z.string().datetime(),
  moderation_state: z.enum([
    "visible",
    "challenged",
    "corrected",
    "quarantined",
  ]),
}).omit({ role: true });
export type DeliberationMessage = z.infer<typeof DeliberationMessageSchema>;

export const StagePromotionRequestSchema = z
  .object({
    current_stage: z.number().int().min(0).max(5),
    requested_next_stage: z.number().int().min(1).max(5),
    exact_source_version: z.string().min(7),
    passed_evidence: z.array(z.string().min(1)),
    failed_evidence: z.array(z.string().min(1)),
    unresolved_risks: z.array(z.string().min(1)).min(1),
    legal_review_status: z.enum(["not_started", "pending", "passed", "failed"]),
    security_review_status: z.enum([
      "not_started",
      "pending",
      "passed",
      "failed",
    ]),
    rollback_plan: z.array(z.string().min(1)).min(1),
    kill_criteria: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type StagePromotionRequest = z.infer<typeof StagePromotionRequestSchema>;

export const FounderDecisionInputSchema = z
  .object({
    decision: z.enum(["approved", "refused"]),
    reason: z.string().min(1),
  })
  .strict();
export type FounderDecisionInput = z.infer<typeof FounderDecisionInputSchema>;

export type StagePromotionPacket = StagePromotionRequest & {
  promotion_id: string;
  version: number;
  founder_decision: {
    status: "pending" | "approved" | "refused";
    actor_id: string | null;
    reason: string | null;
    decided_at: string | null;
  };
  kernel_permit_status: "not_requested" | "awaiting_kernel_permit" | "refused";
  timestamp: string;
  packet_hash: `sha256:${string}`;
};

export type SimulatedDecisionPacket = {
  decision_id: string;
  opportunity_id: string;
  opportunity_version: number;
  compiled_at: string;
  source_hash: `sha256:${string}`;
  review_hashes: `sha256:${string}`[];
  manipulation_screen: ManipulationScreen;
  evidence_assessment: {
    complete_for_simulation: boolean;
    complete_for_real_world: boolean;
    model_output_used_as_evidence: boolean;
    missing_channels: string[];
  };
  dissent: string[];
  recommendation: "reject" | "needs_evidence" | "simulate";
  authority_status: "proposal_only";
  external_effect_permitted: false;
  kernel_permit_status: "not_requested";
  reproducibility: {
    method: string;
    seed: number;
    code_version: string;
  };
  packet_hash: `sha256:${string}`;
};

export type ManipulationMatch = {
  rule_id: string;
  category: string;
  evidence: string;
};

export type ManipulationScreen = {
  status: "clear" | "blocked" | "error";
  risk_level: "none" | "critical";
  matches: ManipulationMatch[];
  default_action: "continue_simulation_review" | "refuse";
  classifier_version: string;
};

export const EVENT_TYPES = [
  "opportunity_submitted",
  "opportunity_rejected",
  "deliberation_added",
  "evidence_added",
  "evidence_challenged",
  "conflict_disclosed",
  "agent_recommendation",
  "human_dissent",
  "simulation_started",
  "simulation_completed",
  "decision_proposed",
  "decision_approved",
  "decision_refused",
  "stage_promotion_requested",
  "stage_promotion_approved",
  "stage_promotion_refused",
  "incident",
  "correction",
  "reconciliation",
  "retirement",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type InstitutionalEvent = {
  event_id: string;
  sequence: number;
  event_type: EventType;
  actor: Pick<Actor, "actor_id" | "actor_class">;
  occurred_at: string;
  correlation_id: string;
  payload: Record<string, unknown>;
  payload_hash: `sha256:${string}`;
  previous_event_hash: `sha256:${string}` | null;
  event_hash: `sha256:${string}`;
};
