import { randomUUID } from "node:crypto";
import {
  CURRENT_STAGE,
  REQUIRED_DECISION_CHANNELS,
  UNAUTHORIZED_EXTERNAL_EFFECTS,
} from "../config.js";
import {
  classifyManipulation,
  classifyManipulationFailClosed,
} from "./antiManipulation.js";
import { DomainError } from "./errors.js";
import { AppendOnlyEventStore } from "./eventStore.js";
import { sha256 } from "./hash.js";
import { requireCapability } from "./identity.js";
import type {
  Actor,
  DeliberationInput,
  DeliberationMessage,
  EventType,
  FounderDecisionInput,
  InstitutionalEvent,
  ManipulationScreen,
  OpportunityPacket,
  SimulatedDecisionPacket,
  StagePromotionPacket,
  StagePromotionRequest,
} from "./model.js";

type InstitutionOptions = {
  now?: () => string;
  idFactory?: () => string;
  classifier?: typeof classifyManipulation;
  codeVersion?: string;
};

type OpportunityRecord = {
  packet: OpportunityPacket;
  submitted_at: string;
};

function actorForEvent(actor: Actor): Pick<Actor, "actor_id" | "actor_class"> {
  return {
    actor_id: actor.actor_id,
    actor_class: actor.actor_class,
  };
}

function assertHumanOrAgent(actor: Actor): asserts actor is Actor & {
  actor_class: "human" | "agent";
} {
  if (actor.actor_class !== "human" && actor.actor_class !== "agent") {
    throw new DomainError(
      403,
      "ACTOR_CLASS_DENIED",
      "Only authenticated humans and bounded agents may participate.",
    );
  }
}

export class PumpStationInstitution {
  readonly #store: AppendOnlyEventStore;
  readonly #now: () => string;
  readonly #idFactory: () => string;
  readonly #classifier: typeof classifyManipulation;
  readonly #codeVersion: string;
  readonly #opportunities = new Map<string, OpportunityRecord>();
  readonly #messages = new Map<string, DeliberationMessage[]>();
  readonly #decisions = new Map<string, SimulatedDecisionPacket[]>();
  readonly #promotions = new Map<string, StagePromotionPacket[]>();

  constructor(store: AppendOnlyEventStore, options: InstitutionOptions = {}) {
    this.#store = store;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#classifier = options.classifier ?? classifyManipulation;
    this.#codeVersion = options.codeVersion ?? "pumpstation-stage0/1.0.0";

    for (const event of store.list()) {
      this.#apply(event);
    }
  }

  submitOpportunity(
    untrustedPacket: OpportunityPacket,
    actor: Actor,
  ): OpportunityPacket {
    requireCapability(actor, "opportunity:submit");
    assertHumanOrAgent(actor);

    if (
      untrustedPacket.proposer.actor_id !== actor.actor_id ||
      untrustedPacket.proposer.actor_class !== actor.actor_class
    ) {
      throw new DomainError(
        403,
        "PROPOSER_IDENTITY_MISMATCH",
        "The authenticated actor must be the declared proposer.",
      );
    }
    if (untrustedPacket.decision_status !== "submitted") {
      throw new DomainError(
        422,
        "DECISION_STATUS_NOT_CALLER_CONTROLLED",
        "New opportunities must enter with decision_status=submitted.",
      );
    }
    if (this.#opportunities.has(untrustedPacket.opportunity_id)) {
      throw new DomainError(
        409,
        "OPPORTUNITY_ALREADY_EXISTS",
        "Opportunity IDs are immutable and cannot be overwritten.",
      );
    }

    const modelOutputAsEvidence = [
      ...untrustedPacket.evidence,
      ...untrustedPacket.counterevidence,
    ].some((evidence) => evidence.source_type === "model_output");
    const manipulation = classifyManipulationFailClosed(
      untrustedPacket,
      [],
      this.#classifier,
    );
    const rejectionReasons: string[] = [];

    if (modelOutputAsEvidence) {
      rejectionReasons.push("MODEL_OUTPUT_SUBMITTED_AS_EVIDENCE");
    }
    if (manipulation.default_action === "refuse") {
      rejectionReasons.push(
        ...manipulation.matches.map((match) => match.rule_id),
      );
    }

    if (rejectionReasons.length > 0) {
      this.#append(
        "opportunity_rejected",
        actor,
        untrustedPacket.opportunity_id,
        {
          opportunity: untrustedPacket,
          rejection_reasons: rejectionReasons,
          manipulation_screen: manipulation,
          evidence_classification: modelOutputAsEvidence
            ? "model_output_is_not_financial_evidence"
            : "accepted_for_simulation_screening",
        },
      );
      throw new DomainError(
        422,
        "OPPORTUNITY_REFUSED",
        "Opportunity failed a constitutional intake control.",
        {
          rejection_reasons: rejectionReasons,
          manipulation_screen: manipulation,
        },
      );
    }

    const packet = structuredClone(untrustedPacket);
    const event = this.#append(
      "opportunity_submitted",
      actor,
      packet.opportunity_id,
      { opportunity: packet },
    );
    this.#opportunities.set(packet.opportunity_id, {
      packet,
      submitted_at: event.occurred_at,
    });
    return structuredClone(packet);
  }

  addDeliberation(
    opportunityId: string,
    input: DeliberationInput,
    actor: Actor,
  ): DeliberationMessage {
    requireCapability(actor, "deliberation:write");
    assertHumanOrAgent(actor);
    const opportunity = this.#requireOpportunity(opportunityId);

    if (
      input.channel_type === "evidence" &&
      input.evidence_status === "model_output"
    ) {
      throw new DomainError(
        422,
        "MODEL_OUTPUT_NOT_EVIDENCE",
        "Model output may be discussed as reasoning but cannot be submitted as evidence.",
      );
    }

    const priorMessages = this.#messages.get(opportunityId) ?? [];
    if (
      input.supersedes_message_id &&
      !priorMessages.some(
        (message) => message.message_id === input.supersedes_message_id,
      )
    ) {
      throw new DomainError(
        422,
        "SUPERSEDED_MESSAGE_NOT_FOUND",
        "Corrections must link to an existing message in the same opportunity.",
      );
    }

    const positiveInstructionChannels = new Set([
      "opportunity_submission",
      "bull_thesis",
      "decision_review",
    ]);
    const screen = classifyManipulationFailClosed(
      opportunity.packet,
      positiveInstructionChannels.has(input.channel_type)
        ? [input.content]
        : [],
      this.#classifier,
    );
    if (
      positiveInstructionChannels.has(input.channel_type) &&
      screen.default_action === "refuse"
    ) {
      this.#append("incident", actor, opportunityId, {
        incident_type: "prohibited_deliberation_instruction",
        channel_type: input.channel_type,
        manipulation_screen: screen,
      });
      throw new DomainError(
        422,
        "DELIBERATION_INSTRUCTION_REFUSED",
        "Chat content cannot become a prohibited capital or promotion instruction.",
        screen,
      );
    }

    const message: DeliberationMessage = {
      message_id: `msg_${this.#idFactory()}`,
      linked_opportunity_id: opportunityId,
      channel_type: input.channel_type,
      author: {
        actor_id: actor.actor_id,
        actor_class: actor.actor_class,
        role: input.role,
      },
      timestamp: this.#now(),
      content: input.content,
      source_references: [...input.source_references],
      evidence_status: input.evidence_status,
      conflict_disclosure: input.conflict_disclosure,
      supersedes_message_id: input.supersedes_message_id,
      moderation_state: "visible",
    };

    let eventType: EventType = "deliberation_added";
    if (input.supersedes_message_id) eventType = "correction";
    else if (input.channel_type === "evidence") eventType = "evidence_added";
    else if (input.channel_type === "conflicts")
      eventType = "conflict_disclosed";
    else if (
      input.channel_type === "bear_thesis" &&
      actor.actor_class === "human"
    )
      eventType = "human_dissent";
    else if (actor.actor_class === "agent") eventType = "agent_recommendation";

    this.#append(eventType, actor, opportunityId, { message });
    this.#messages.set(opportunityId, [...priorMessages, message]);
    return structuredClone(message);
  }

  compileSimulatedDecision(
    opportunityId: string,
    actor: Actor,
  ): SimulatedDecisionPacket {
    requireCapability(actor, "simulation:compile");
    assertHumanOrAgent(actor);
    const opportunity = this.#requireOpportunity(opportunityId);
    const messages = this.#messages.get(opportunityId) ?? [];
    const presentChannels = new Set(
      messages
        .filter((message) => message.moderation_state === "visible")
        .map((message) => message.channel_type),
    );
    const missingChannels = REQUIRED_DECISION_CHANNELS.filter(
      (channel) => !presentChannels.has(channel),
    );
    const instructionText = messages
      .filter((message) =>
        ["opportunity_submission", "bull_thesis", "decision_review"].includes(
          message.channel_type,
        ),
      )
      .map((message) => message.content);
    const manipulation = classifyManipulationFailClosed(
      opportunity.packet,
      instructionText,
      this.#classifier,
    );
    const modelOutputUsedAsEvidence = messages.some(
      (message) =>
        message.channel_type === "evidence" &&
        message.evidence_status === "model_output",
    );
    const completeForSimulation =
      missingChannels.length === 0 && !modelOutputUsedAsEvidence;
    const allEvidence = [
      ...opportunity.packet.evidence,
      ...opportunity.packet.counterevidence,
    ];
    const completeForRealWorld =
      completeForSimulation &&
      allEvidence.every(
        (evidence) =>
          ["primary_source", "independent_analysis"].includes(
            evidence.source_type,
          ) && evidence.evidence_status === "corroborated",
      );
    const dissent = messages
      .filter((message) => message.channel_type === "bear_thesis")
      .map(
        (message) =>
          `${message.message_id}:${sha256({
            content: message.content,
            author: message.author,
          })}`,
      );
    const sourceHash = sha256(opportunity.packet);
    const reviewHashes = messages.map((message) => sha256(message)).sort();
    const latestTimestamp = [
      opportunity.submitted_at,
      ...messages.map((message) => message.timestamp),
    ]
      .sort()
      .at(-1) as string;
    const recommendation =
      manipulation.default_action === "refuse"
        ? "reject"
        : !completeForSimulation
          ? "needs_evidence"
          : "simulate";
    const decisionFingerprint = sha256({
      opportunity_id: opportunityId,
      source_hash: sourceHash,
      review_hashes: reviewHashes,
      seed: opportunity.packet.simulation_plan.seed,
    });
    const packetWithoutHash: Omit<SimulatedDecisionPacket, "packet_hash"> = {
      decision_id: `decision_${decisionFingerprint.slice(7, 23)}`,
      opportunity_id: opportunityId,
      opportunity_version: opportunity.packet.version,
      compiled_at: latestTimestamp,
      source_hash: sourceHash,
      review_hashes: reviewHashes,
      manipulation_screen: manipulation,
      evidence_assessment: {
        complete_for_simulation: completeForSimulation,
        complete_for_real_world: completeForRealWorld,
        model_output_used_as_evidence: modelOutputUsedAsEvidence,
        missing_channels: [...missingChannels],
      },
      dissent,
      recommendation,
      authority_status: "proposal_only",
      external_effect_permitted: false,
      kernel_permit_status: "not_requested",
      reproducibility: {
        method: opportunity.packet.simulation_plan.method,
        seed: opportunity.packet.simulation_plan.seed,
        code_version: this.#codeVersion,
      },
    };
    const packet: SimulatedDecisionPacket = {
      ...packetWithoutHash,
      packet_hash: sha256(packetWithoutHash),
    };

    const existing = (this.#decisions.get(opportunityId) ?? []).find(
      (decision) => decision.packet_hash === packet.packet_hash,
    );
    if (existing) return structuredClone(existing);

    this.#append("simulation_started", actor, opportunityId, {
      source_hash: sourceHash,
      review_hashes: reviewHashes,
      mode: "simulation_only",
    });
    this.#append("simulation_completed", actor, opportunityId, {
      decision_packet: packet,
      fixture_warning:
        "A simulation or fixture result is not financial evidence or market performance.",
    });
    this.#append("decision_proposed", actor, opportunityId, {
      decision_packet: packet,
      authority_status: "proposal_only",
    });
    this.#decisions.set(opportunityId, [
      ...(this.#decisions.get(opportunityId) ?? []),
      packet,
    ]);
    return structuredClone(packet);
  }

  requestStagePromotion(
    request: StagePromotionRequest,
    actor: Actor,
  ): StagePromotionPacket {
    requireCapability(actor, "stage:request");
    assertHumanOrAgent(actor);
    if (
      request.current_stage !== CURRENT_STAGE ||
      request.requested_next_stage !== CURRENT_STAGE + 1
    ) {
      throw new DomainError(
        422,
        "INVALID_STAGE_SEQUENCE",
        "A promotion request must start at the active stage and advance exactly one stage.",
      );
    }

    const basePacket = {
      ...structuredClone(request),
      promotion_id: `promotion_${this.#idFactory()}`,
      version: 1,
      founder_decision: {
        status: "pending" as const,
        actor_id: null,
        reason: null,
        decided_at: null,
      },
      kernel_permit_status: "not_requested" as const,
      timestamp: this.#now(),
    };
    const packet: StagePromotionPacket = {
      ...basePacket,
      packet_hash: sha256(basePacket),
    };
    this.#append("stage_promotion_requested", actor, packet.promotion_id, {
      promotion_packet: packet,
    });
    this.#promotions.set(packet.promotion_id, [packet]);
    return structuredClone(packet);
  }

  recordFounderDecision(
    promotionId: string,
    input: FounderDecisionInput,
    actor: Actor,
  ): StagePromotionPacket {
    if (actor.actor_class !== "human") {
      throw new DomainError(
        403,
        "AGENT_SELF_APPROVAL_PROHIBITED",
        "No agent may approve itself, a decision, or a stage transition.",
      );
    }
    requireCapability(actor, "stage:decide");
    const versions = this.#promotions.get(promotionId);
    const current = versions?.at(-1);
    if (!versions || !current) {
      throw new DomainError(
        404,
        "PROMOTION_NOT_FOUND",
        "Promotion request not found.",
      );
    }
    if (current.founder_decision.status !== "pending") {
      throw new DomainError(
        409,
        "FOUNDER_DECISION_ALREADY_RECORDED",
        "Founder decisions are append-only and cannot be overwritten.",
      );
    }

    const { packet_hash: _previousPacketHash, ...currentWithoutHash } =
      structuredClone(current);
    const packetWithoutHash = {
      ...currentWithoutHash,
      version: current.version + 1,
      founder_decision: {
        status: input.decision,
        actor_id: actor.actor_id,
        reason: input.reason,
        decided_at: this.#now(),
      },
      kernel_permit_status:
        input.decision === "approved"
          ? ("awaiting_kernel_permit" as const)
          : ("refused" as const),
      timestamp: this.#now(),
    };
    const packet: StagePromotionPacket = {
      ...packetWithoutHash,
      packet_hash: sha256(packetWithoutHash),
    };

    this.#append(
      input.decision === "approved"
        ? "stage_promotion_approved"
        : "stage_promotion_refused",
      actor,
      promotionId,
      {
        promotion_packet: packet,
        active_stage_unchanged: CURRENT_STAGE,
        kernel_boundary:
          "Founder approval is necessary but not sufficient. PumpStation contains no Kernel permit method.",
      },
    );
    this.#promotions.set(promotionId, [...versions, packet]);
    return structuredClone(packet);
  }

  getOpportunity(opportunityId: string): {
    opportunity: OpportunityPacket;
    deliberations: DeliberationMessage[];
    simulated_decisions: SimulatedDecisionPacket[];
  } {
    const opportunity = this.#requireOpportunity(opportunityId);
    return {
      opportunity: structuredClone(opportunity.packet),
      deliberations: structuredClone(this.#messages.get(opportunityId) ?? []),
      simulated_decisions: structuredClone(
        this.#decisions.get(opportunityId) ?? [],
      ),
    };
  }

  getPromotion(promotionId: string): StagePromotionPacket[] {
    const versions = this.#promotions.get(promotionId);
    if (!versions) {
      throw new DomainError(
        404,
        "PROMOTION_NOT_FOUND",
        "Promotion request not found.",
      );
    }
    return structuredClone(versions);
  }

  getDashboard(): Record<string, unknown> {
    const events = this.#store.list();
    const decisions = [...this.#decisions.values()].flat();
    const completeDecisions = decisions.filter(
      (decision) =>
        decision.evidence_assessment.complete_for_simulation &&
        decision.dissent.length > 0 &&
        decision.manipulation_screen.status === "clear" &&
        decision.external_effect_permitted === false,
    ).length;
    const singleBottleneckMetric =
      decisions.length === 0
        ? 0
        : Math.round((completeDecisions / decisions.length) * 10_000) / 100;

    return {
      operating_mode: "PUMPSTATION_LABS_SIMULATION_ONLY",
      current_stage: CURRENT_STAGE,
      unauthorized_external_effects: UNAUTHORIZED_EXTERNAL_EFFECTS,
      single_bottleneck_metric: {
        name: "Percentage of simulated opportunity decisions with complete evidence, preserved dissent, reproducible results, and zero prohibited coordination",
        percentage: singleBottleneckMetric,
        numerator: completeDecisions,
        denominator: decisions.length,
      },
      metrics: {
        opportunities_accepted: this.#opportunities.size,
        opportunities_rejected: events.filter(
          (event) => event.event_type === "opportunity_rejected",
        ).length,
        manipulation_detections: events.filter(
          (event) =>
            event.event_type === "opportunity_rejected" &&
            Array.isArray(event.payload.rejection_reasons),
        ).length,
        unresolved_conflicts: [...this.#opportunities.values()].reduce(
          (total, record) =>
            total +
            record.packet.conflicts.filter((conflict) => conflict.disclosed)
              .length,
          0,
        ),
        simulated_decisions: decisions.length,
        institutional_events: this.#store.size,
        event_chain_valid: this.#store.verify().valid,
        founder_interventions: events.filter(
          (event) =>
            event.event_type === "stage_promotion_approved" ||
            event.event_type === "stage_promotion_refused",
        ).length,
      },
      opportunities: [...this.#opportunities.values()].map((record) => ({
        opportunity_id: record.packet.opportunity_id,
        title: record.packet.title,
        asset_or_business_type: record.packet.asset_or_business_type,
        decision_status:
          this.#decisions.get(record.packet.opportunity_id)?.at(-1)
            ?.recommendation ?? "not_compiled",
        source_status: record.packet.evidence.every(
          (evidence) => evidence.source_type === "test_fixture",
        )
          ? "fixture_only"
          : "mixed_or_external",
      })),
      promotion_requests: [...this.#promotions.values()].map((versions) =>
        versions.at(-1),
      ),
    };
  }

  get currentStage(): number {
    return CURRENT_STAGE;
  }

  #requireOpportunity(opportunityId: string): OpportunityRecord {
    const opportunity = this.#opportunities.get(opportunityId);
    if (!opportunity) {
      throw new DomainError(
        404,
        "OPPORTUNITY_NOT_FOUND",
        "Opportunity not found or was constitutionally refused.",
      );
    }
    return opportunity;
  }

  #append(
    eventType: EventType,
    actor: Actor,
    correlationId: string,
    payload: Record<string, unknown>,
  ): InstitutionalEvent {
    const event = this.#store.append({
      event_type: eventType,
      actor: actorForEvent(actor),
      correlation_id: correlationId,
      payload,
    });
    return event;
  }

  #apply(event: InstitutionalEvent): void {
    const payload = event.payload;
    if (event.event_type === "opportunity_submitted") {
      const packet = payload.opportunity as OpportunityPacket;
      this.#opportunities.set(packet.opportunity_id, {
        packet,
        submitted_at: event.occurred_at,
      });
      return;
    }
    if (
      [
        "deliberation_added",
        "evidence_added",
        "conflict_disclosed",
        "agent_recommendation",
        "human_dissent",
        "correction",
      ].includes(event.event_type) &&
      payload.message
    ) {
      const message = payload.message as DeliberationMessage;
      this.#messages.set(message.linked_opportunity_id, [
        ...(this.#messages.get(message.linked_opportunity_id) ?? []),
        message,
      ]);
      return;
    }
    if (event.event_type === "decision_proposed" && payload.decision_packet) {
      const decision = payload.decision_packet as SimulatedDecisionPacket;
      this.#decisions.set(decision.opportunity_id, [
        ...(this.#decisions.get(decision.opportunity_id) ?? []),
        decision,
      ]);
      return;
    }
    if (
      [
        "stage_promotion_requested",
        "stage_promotion_approved",
        "stage_promotion_refused",
      ].includes(event.event_type) &&
      payload.promotion_packet
    ) {
      const promotion = payload.promotion_packet as StagePromotionPacket;
      this.#promotions.set(promotion.promotion_id, [
        ...(this.#promotions.get(promotion.promotion_id) ?? []),
        promotion,
      ]);
    }
  }
}
