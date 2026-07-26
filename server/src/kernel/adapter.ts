import { randomUUID } from "node:crypto";
import { DomainError } from "../domain/errors.js";
import { sha256 } from "../domain/hash.js";
import type {
  Actor,
  OpportunityPacket,
  SimulatedDecisionPacket,
  StagePromotionPacket,
} from "../domain/model.js";
import {
  KernelAdapterDecisionSchema,
  KernelCapabilityGrantSchema,
  KernelContractLockSchema,
  KernelProposalSchema,
  PumpStationOrganManifestSchema,
  loadKernelContractLock,
  loadPumpStationOrganManifest,
  type KernelAdapterDecision,
  type KernelCapabilityGrant,
  type KernelContractLock,
  type KernelProposal,
  type PumpStationOrganManifest,
} from "./contracts.js";
import {
  DenyAllKernelGateway,
  type KernelGateway,
  type KernelGatewayStatus,
} from "./gateway.js";

type KernelAdapterOptions = {
  lock?: KernelContractLock;
  manifest?: PumpStationOrganManifest;
  gateway?: KernelGateway;
  now?: () => string;
  idFactory?: () => string;
};

export type GrantValidation = {
  valid: boolean;
  reasons: string[];
  execution_authority: false;
};

export class PumpStationKernelAdapter {
  readonly #lock: KernelContractLock;
  readonly #manifest: PumpStationOrganManifest;
  readonly #gateway: KernelGateway;
  readonly #now: () => string;
  readonly #idFactory: () => string;
  readonly #contractLockHash: `sha256:${string}`;

  constructor(options: KernelAdapterOptions = {}) {
    this.#lock = KernelContractLockSchema.parse(
      options.lock ?? loadKernelContractLock(),
    );
    this.#manifest = PumpStationOrganManifestSchema.parse(
      options.manifest ?? loadPumpStationOrganManifest(),
    );
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#gateway =
      options.gateway ??
      new DenyAllKernelGateway({
        now: this.#now,
        mode: "disconnected",
        registeredServiceIdentity: false,
        kernelCommit: null,
      });
    this.#contractLockHash = sha256(this.#lock);
    this.#assertPinnedOwnershipBoundary();
  }

  status(): {
    contract_set_id: string;
    contract_lock_hash: `sha256:${string}`;
    source_revision: string;
    organ_lifecycle_status: PumpStationOrganManifest["lifecycle_status"];
    service_identity: string;
    gateway: KernelGatewayStatus;
    external_effects_enabled: false;
  } {
    return {
      contract_set_id: this.#lock.contract_set_id,
      contract_lock_hash: this.#contractLockHash,
      source_revision: this.#lock.commit_sha,
      organ_lifecycle_status: this.#manifest.lifecycle_status,
      service_identity: this.#manifest.service_identity,
      gateway: this.#gateway.status(),
      external_effects_enabled: false,
    };
  }

  compileSimulationProposal(
    opportunity: OpportunityPacket,
    decision: SimulatedDecisionPacket,
    actor: Actor,
  ): KernelProposal {
    if (decision.opportunity_id !== opportunity.opportunity_id) {
      throw new DomainError(
        422,
        "KERNEL_PROPOSAL_SOURCE_MISMATCH",
        "The decision and opportunity must reference the same immutable opportunity.",
      );
    }
    if (
      decision.authority_status !== "proposal_only" ||
      decision.external_effect_permitted !== false
    ) {
      throw new DomainError(
        422,
        "KERNEL_PROPOSAL_AUTHORITY_INVALID",
        "Only proposal-only, nonexecuting decisions may enter the adapter.",
      );
    }

    const evidenceRefs = [
      ...opportunity.evidence,
      ...opportunity.counterevidence,
    ]
      .filter((evidence) => evidence.source_type !== "model_output")
      .map((evidence) => evidence.evidence_id)
      .sort();
    const proposalWithoutHash = {
      proposal_id: this.#idFactory(),
      actor: this.#manifest.service_identity,
      legal_principal: this.#manifest.legal_principal,
      action_class: "pumpstation_internal_simulation_record",
      objective: `Record a bounded simulation decision for ${opportunity.opportunity_id}.`,
      payload: {
        opportunity_id: opportunity.opportunity_id,
        opportunity_version: opportunity.version,
        decision_id: decision.decision_id,
        decision_packet_hash: decision.packet_hash,
        source_hash: decision.source_hash,
        recommendation: decision.recommendation,
        external_effect_requested: false,
      },
      target: `pumpstation://simulation/${opportunity.opportunity_id}/${decision.decision_id}`,
      consequence_class: "internal_write" as const,
      evidence_confidence: decision.evidence_assessment.complete_for_simulation
        ? 0.5
        : 0,
      evidence_refs: evidenceRefs,
      estimated_cost_usd: 0,
      requested_capability: "pumpstation.simulation.record",
      expected_outcome:
        "A hash-bound simulation record is stored without contacting a counterparty, moving money, publishing promotion, or changing active stage.",
      context: {
        local_requesting_actor: actor.actor_id,
        local_actor_class: actor.actor_class,
        local_wallet_identity_is_not_kernel_identity: true,
        model_output_is_not_evidence: true,
        foreseeable_physical_harm: false,
        deception: false,
        authority_expansion: false,
        external_effect_requested: false,
        unauthorized_external_effects: 0,
      },
      source_revision: this.#lock.commit_sha,
      contract_lock_hash: this.#contractLockHash,
    };
    return KernelProposalSchema.parse({
      ...proposalWithoutHash,
      proposal_hash: sha256(proposalWithoutHash),
    });
  }

  compileStagePromotionProposal(
    promotion: StagePromotionPacket,
    actor: Actor,
  ): KernelProposal {
    if (promotion.founder_decision.status !== "approved") {
      throw new DomainError(
        422,
        "FOUNDER_APPROVAL_REQUIRED",
        "A refused or pending stage request cannot be proposed to the Kernel.",
      );
    }
    const proposalWithoutHash = {
      proposal_id: this.#idFactory(),
      actor: this.#manifest.service_identity,
      legal_principal: this.#manifest.legal_principal,
      action_class: "pumpstation_stage_promotion",
      objective: `Request review of PumpStation stage ${promotion.current_stage} to ${promotion.requested_next_stage}.`,
      payload: {
        promotion_id: promotion.promotion_id,
        promotion_packet_hash: promotion.packet_hash,
        current_stage: promotion.current_stage,
        requested_next_stage: promotion.requested_next_stage,
        founder_decision: promotion.founder_decision,
        external_effect_requested: false,
      },
      target: `pumpstation://stage/${promotion.requested_next_stage}`,
      consequence_class: "irreversible" as const,
      evidence_confidence: 0,
      evidence_refs: [...promotion.passed_evidence].sort(),
      estimated_cost_usd: 0,
      requested_capability: "pumpstation.stage.promote",
      expected_outcome:
        "The Kernel refuses or requests additional human, legal, security, identity, grant, and consequence evidence. PumpStation does not change its active stage locally.",
      context: {
        local_requesting_actor: actor.actor_id,
        local_actor_class: actor.actor_class,
        authority_expansion: true,
        legal_review_status: promotion.legal_review_status,
        security_review_status: promotion.security_review_status,
        unresolved_risks: promotion.unresolved_risks,
        failed_evidence: promotion.failed_evidence,
        registered_service_identity: false,
        external_effect_requested: false,
        unauthorized_external_effects: 0,
      },
      source_revision: this.#lock.commit_sha,
      contract_lock_hash: this.#contractLockHash,
    };
    return KernelProposalSchema.parse({
      ...proposalWithoutHash,
      proposal_hash: sha256(proposalWithoutHash),
    });
  }

  async submit(proposal: KernelProposal): Promise<KernelAdapterDecision> {
    const parsed = KernelProposalSchema.parse(proposal);
    this.#assertProposalBinding(parsed);
    const gatewayDecision = KernelAdapterDecisionSchema.parse(
      await this.#gateway.submit(parsed),
    );

    if (
      gatewayDecision.verdict === "allow" ||
      gatewayDecision.execution_authority !== false ||
      this.#manifest.lifecycle_status !== "proposed_not_registered" ||
      this.#gateway.status().registered_service_identity
    ) {
      return this.#localDeny(parsed, [
        "LOCAL_AUTHORITY_INVARIANT",
        "The current PumpStation adapter is proposal-only and may not convert any response into execution authority.",
      ]);
    }
    return gatewayDecision;
  }

  validateGrant(
    untrustedGrant: KernelCapabilityGrant,
    proposal: KernelProposal,
    now = this.#now(),
  ): GrantValidation {
    const grant = KernelCapabilityGrantSchema.parse(untrustedGrant);
    const parsedProposal = KernelProposalSchema.parse(proposal);
    const reasons: string[] = [];

    if (grant.grantee !== this.#manifest.service_identity)
      reasons.push("GRANTEE_IDENTITY_MISMATCH");
    if (grant.legal_actor !== parsedProposal.legal_principal)
      reasons.push("LEGAL_PRINCIPAL_MISMATCH");
    if (!grant.permitted_actions.includes(parsedProposal.requested_capability))
      reasons.push("CAPABILITY_NOT_GRANTED");
    if (parsedProposal.estimated_cost_usd > grant.resource_limits.max_cost_usd)
      reasons.push("BUDGET_EXCEEDED");
    if (grant.revoked) reasons.push("GRANT_REVOKED");
    if (new Date(grant.expires_at).getTime() <= new Date(now).getTime())
      reasons.push("GRANT_EXPIRED");
    if (new Date(grant.issued_at).getTime() > new Date(now).getTime())
      reasons.push("GRANT_NOT_YET_VALID");
    if (
      grant.initial_stage === "simulate" &&
      !["read_only", "internal_write"].includes(
        parsedProposal.consequence_class,
      )
    )
      reasons.push("SIMULATION_GRANT_CANNOT_AUTHORIZE_CONSEQUENCE");
    if (parsedProposal.legal_principal === "UNIIMENTE")
      reasons.push("UNIIMENTE_CANNOT_BE_LEGAL_PRINCIPAL");

    return {
      valid: reasons.length === 0,
      reasons,
      execution_authority: false,
    };
  }

  #assertPinnedOwnershipBoundary(): void {
    if (this.#lock.sdk_status !== "typescript_sdk_placeholder_phase_10") {
      throw new DomainError(
        500,
        "KERNEL_LOCK_INVALID",
        "Unexpected Kernel SDK status in the pinned contract set.",
      );
    }
    if (this.#manifest.legal_principal === "UNIIMENTE") {
      throw new DomainError(
        500,
        "ILLEGAL_PRINCIPAL",
        "UNIIMENTE may not be configured as a legal principal.",
      );
    }
    if (
      this.#manifest.authority_envelope.maximum_cost_usd !== 0 ||
      this.#manifest.authority_envelope.external_targets.length !== 0 ||
      this.#manifest.authority_envelope.self_activation !== false
    ) {
      throw new DomainError(
        500,
        "ORGAN_AUTHORITY_ENVELOPE_INVALID",
        "PumpStation must begin with zero spend, no external targets, and no self-activation.",
      );
    }
  }

  #assertProposalBinding(proposal: KernelProposal): void {
    const { proposal_hash: _proposalHash, ...withoutHash } = proposal;
    if (sha256(withoutHash) !== proposal.proposal_hash) {
      throw new DomainError(
        422,
        "PROPOSAL_HASH_MISMATCH",
        "The proposal changed after compilation.",
      );
    }
    if (proposal.contract_lock_hash !== this.#contractLockHash) {
      throw new DomainError(
        422,
        "CONTRACT_LOCK_MISMATCH",
        "The proposal is not bound to the active pinned Kernel contract set.",
      );
    }
    if (proposal.source_revision !== this.#lock.commit_sha) {
      throw new DomainError(
        422,
        "KERNEL_REVISION_MISMATCH",
        "The proposal references a different Kernel source revision.",
      );
    }
    if (proposal.actor !== this.#manifest.service_identity) {
      throw new DomainError(
        422,
        "KERNEL_ACTOR_MISMATCH",
        "PumpStation proposals must use the proposed bounded service identity.",
      );
    }
    if (proposal.legal_principal !== this.#manifest.legal_principal) {
      throw new DomainError(
        422,
        "LEGAL_PRINCIPAL_MISMATCH",
        "The proposal legal principal differs from the organ manifest.",
      );
    }
    if (
      proposal.estimated_cost_usd >
      this.#manifest.authority_envelope.maximum_cost_usd
    ) {
      throw new DomainError(
        422,
        "ORGAN_BUDGET_EXCEEDED",
        "The proposal exceeds PumpStation's local zero-spend envelope.",
      );
    }
  }

  #localDeny(
    proposal: KernelProposal,
    reasons: string[],
  ): KernelAdapterDecision {
    const withoutHash = {
      verdict: "deny" as const,
      reasons,
      missing: [
        "registered_service_identity",
        "live_kernel_decision",
        "kernel_issued_grant",
        "commit_witness",
        "receipt",
        "reconciliation",
      ],
      law_applied: [
        "local_adapter_may_refuse_but_never_authorize",
        "one_canonical_kernel_and_consequence_gate",
      ],
      execution_authority: false as const,
      gateway_mode: this.#gateway.status().mode,
      proposal_hash: proposal.proposal_hash,
      contract_lock_hash: proposal.contract_lock_hash,
      decided_at: this.#now(),
    };
    return KernelAdapterDecisionSchema.parse({
      ...withoutHash,
      decision_hash: sha256(withoutHash),
    });
  }
}
