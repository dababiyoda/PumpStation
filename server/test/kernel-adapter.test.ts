import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../src/domain/hash.js";
import type {
  Actor,
  SimulatedDecisionPacket,
  StagePromotionPacket,
} from "../src/domain/model.js";
import {
  KernelAdapterDecisionSchema,
  KernelCapabilityGrantSchema,
  loadKernelContractLock,
  loadPumpStationOrganManifest,
  type KernelGateway,
  type KernelProposal,
} from "../src/kernel/contracts.js";
import { PumpStationKernelAdapter } from "../src/kernel/adapter.js";
import { opportunityFixture } from "./helpers.js";

const actor: Actor = {
  actor_id: "wallet:0x0000000000000000000000000000000000000001",
  actor_class: "human",
  capabilities: ["kernel:propose"],
  expires_at: "2099-01-01T00:00:00.000Z",
  purpose: "sandbox proposal compilation",
  data_scope: ["public_research"],
  resource_ceiling: 0,
  revoked: false,
};

function decisionFixture(): SimulatedDecisionPacket {
  const withoutHash = {
    decision_id: "decision_fixture",
    opportunity_id: "opp_productive_fixture",
    opportunity_version: 1,
    compiled_at: "2026-07-26T03:00:00.000Z",
    source_hash: sha256({ opportunity: "fixture" }),
    review_hashes: [sha256({ review: "bear" })],
    manipulation_screen: {
      status: "clear" as const,
      risk_level: "none" as const,
      matches: [],
      default_action: "continue_simulation_review" as const,
      classifier_version: "fixture/1.0.0",
    },
    evidence_assessment: {
      complete_for_simulation: true,
      complete_for_real_world: false,
      model_output_used_as_evidence: false,
      missing_channels: [],
    },
    dissent: ["bear-thesis-hash"],
    recommendation: "simulate" as const,
    authority_status: "proposal_only" as const,
    external_effect_permitted: false as const,
    kernel_permit_status: "not_requested" as const,
    reproducibility: {
      method: "deterministic fixture",
      seed: 42,
      code_version: "fixture/1.0.0",
    },
  };
  return { ...withoutHash, packet_hash: sha256(withoutHash) };
}

function approvedPromotionFixture(): StagePromotionPacket {
  const withoutHash = {
    current_stage: 0,
    requested_next_stage: 1,
    exact_source_version: "abcdef1234567",
    passed_evidence: ["ci_green", "negative_tests"],
    failed_evidence: [],
    unresolved_risks: ["kernel_identity_unregistered"],
    legal_review_status: "not_started" as const,
    security_review_status: "pending" as const,
    rollback_plan: ["close draft PR"],
    kill_criteria: ["any unauthorized external effect"],
    promotion_id: "promotion_fixture",
    version: 2,
    founder_decision: {
      status: "approved" as const,
      actor_id: actor.actor_id,
      reason: "Submit for Kernel refusal and missing-evidence classification.",
      decided_at: "2026-07-26T03:00:00.000Z",
    },
    kernel_permit_status: "awaiting_kernel_permit" as const,
    timestamp: "2026-07-26T03:00:00.000Z",
  };
  return { ...withoutHash, packet_hash: sha256(withoutHash) };
}

function adapter(options: ConstructorParameters<typeof PumpStationKernelAdapter>[0] = {}) {
  return new PumpStationKernelAdapter({
    now: () => "2026-07-26T03:00:00.000Z",
    idFactory: () => "00000000-0000-4000-8000-000000000001",
    ...options,
  });
}

test("pinned Kernel lock and organ manifest are proposal-only", () => {
  const lock = loadKernelContractLock();
  const manifest = loadPumpStationOrganManifest();
  assert.equal(
    lock.commit_sha,
    "3d9b5779a7093d6ddd07f225c8329ead6d0c6393",
  );
  assert.equal(manifest.lifecycle_status, "proposed_not_registered");
  assert.equal(manifest.legal_principal, "alfonso_lopez");
  assert.equal(manifest.autonomy_level, 0);
  assert.equal(manifest.authority_envelope.maximum_cost_usd, 0);
  assert.deepEqual(manifest.authority_envelope.external_targets, []);
  assert.equal(manifest.authority_envelope.self_activation, false);
});

test("simulation proposal is hash-bound and never treats wallet identity as Kernel identity", () => {
  const kernel = adapter();
  const proposal = kernel.compileSimulationProposal(
    opportunityFixture(),
    decisionFixture(),
    actor,
  );
  assert.equal(
    proposal.actor,
    "spiffe://uniimente.internal/venture/pumpstation",
  );
  assert.notEqual(proposal.actor, actor.actor_id);
  assert.equal(proposal.legal_principal, "alfonso_lopez");
  assert.equal(proposal.consequence_class, "internal_write");
  assert.equal(proposal.estimated_cost_usd, 0);
  assert.equal(proposal.context.external_effect_requested, false);
  assert.equal(proposal.context.local_wallet_identity_is_not_kernel_identity, true);
});

test("disconnected gateway denies a valid proposal with no execution authority", async () => {
  const kernel = adapter();
  const proposal = kernel.compileSimulationProposal(
    opportunityFixture(),
    decisionFixture(),
    actor,
  );
  const result = await kernel.submit(proposal);
  assert.equal(result.verdict, "deny");
  assert.equal(result.execution_authority, false);
  assert.ok(result.missing.includes("live_kernel_gateway"));
  assert.equal(kernel.status().gateway.connected, false);
  assert.equal(kernel.status().external_effects_enabled, false);
});

test("proposal mutation after compilation is refused", async () => {
  const kernel = adapter();
  const proposal = kernel.compileSimulationProposal(
    opportunityFixture(),
    decisionFixture(),
    actor,
  );
  const tampered = structuredClone(proposal);
  tampered.payload.recommendation = "external_execute";
  await assert.rejects(() => kernel.submit(tampered), /changed after compilation/);
});

test("stale contract lock and source revision are refused", async () => {
  const kernel = adapter();
  const proposal = kernel.compileSimulationProposal(
    opportunityFixture(),
    decisionFixture(),
    actor,
  );
  const stale = structuredClone(proposal);
  stale.contract_lock_hash = sha256({ stale: true });
  const { proposal_hash: _oldHash, ...withoutHash } = stale;
  stale.proposal_hash = sha256(withoutHash);
  await assert.rejects(() => kernel.submit(stale), /active pinned Kernel contract/);
});

test("pending or refused stage requests cannot become Kernel proposals", () => {
  const kernel = adapter();
  const pending = approvedPromotionFixture();
  pending.founder_decision.status = "pending";
  assert.throws(
    () => kernel.compileStagePromotionProposal(pending, actor),
    /cannot be proposed to the Kernel/,
  );
});

test("approved stage request compiles as irreversible and is still denied", async () => {
  const kernel = adapter();
  const proposal = kernel.compileStagePromotionProposal(
    approvedPromotionFixture(),
    actor,
  );
  assert.equal(proposal.consequence_class, "irreversible");
  assert.equal(proposal.context.authority_expansion, true);
  const result = await kernel.submit(proposal);
  assert.equal(result.verdict, "deny");
  assert.equal(result.execution_authority, false);
});

test("local grant validation refuses revoked, expired, mismatched, or excessive grants", () => {
  const kernel = adapter();
  const proposal = kernel.compileSimulationProposal(
    opportunityFixture(),
    decisionFixture(),
    actor,
  );
  const baseGrant = KernelCapabilityGrantSchema.parse({
    grant_id: "00000000-0000-4000-8000-000000000002",
    grantee: "spiffe://uniimente.internal/venture/pumpstation",
    granted_by: "spiffe://uniimente.internal/service/kernel-gateway",
    legal_actor: "alfonso_lopez",
    permitted_actions: ["pumpstation.simulation.record"],
    resource_limits: { max_cost_usd: 0, max_calls: 1 },
    initial_stage: "simulate",
    issued_at: "2026-07-26T02:00:00.000Z",
    expires_at: "2026-07-26T04:00:00.000Z",
    revocable_by: ["spiffe://uniimente.internal/service/kernel-gateway"],
    revoked: false,
    revoked_at: null,
    revocation_reason: null,
  });
  const valid = kernel.validateGrant(baseGrant, proposal);
  assert.equal(valid.valid, true);
  assert.equal(valid.execution_authority, false);

  for (const mutated of [
    { ...baseGrant, revoked: true },
    { ...baseGrant, expires_at: "2026-07-26T02:59:59.000Z" },
    { ...baseGrant, legal_actor: "IVIO_NEMT_LLC" },
    { ...baseGrant, permitted_actions: ["trade.place"] },
  ]) {
    const result = kernel.validateGrant(mutated, proposal);
    assert.equal(result.valid, false);
    assert.ok(result.reasons.length > 0);
    assert.equal(result.execution_authority, false);
  }
});

test("simulate grant cannot authorize an irreversible stage proposal", () => {
  const kernel = adapter();
  const proposal = kernel.compileStagePromotionProposal(
    approvedPromotionFixture(),
    actor,
  );
  const grant = KernelCapabilityGrantSchema.parse({
    grant_id: "00000000-0000-4000-8000-000000000003",
    grantee: "spiffe://uniimente.internal/venture/pumpstation",
    granted_by: "spiffe://uniimente.internal/service/kernel-gateway",
    legal_actor: "alfonso_lopez",
    permitted_actions: ["pumpstation.stage.promote"],
    resource_limits: { max_cost_usd: 0 },
    initial_stage: "simulate",
    issued_at: "2026-07-26T02:00:00.000Z",
    expires_at: "2026-07-26T04:00:00.000Z",
    revocable_by: ["spiffe://uniimente.internal/service/kernel-gateway"],
    revoked: false,
    revoked_at: null,
    revocation_reason: null,
  });
  const validation = kernel.validateGrant(grant, proposal);
  assert.equal(validation.valid, false);
  assert.ok(
    validation.reasons.includes(
      "SIMULATION_GRANT_CANNOT_AUTHORIZE_CONSEQUENCE",
    ),
  );
});

test("malicious allow response is converted into a local denial", async () => {
  const maliciousGateway: KernelGateway = {
    status: () => ({
      mode: "shadow",
      connected: false,
      registered_service_identity: false,
      kernel_commit: null,
      external_effects_enabled: false,
    }),
    submit: async (proposal: KernelProposal) => {
      const withoutHash = {
        verdict: "allow" as const,
        reasons: ["malicious fixture allow"],
        missing: [],
        law_applied: ["fixture"],
        execution_authority: false as const,
        gateway_mode: "shadow" as const,
        proposal_hash: proposal.proposal_hash,
        contract_lock_hash: proposal.contract_lock_hash,
        decided_at: "2026-07-26T03:00:00.000Z",
      };
      return KernelAdapterDecisionSchema.parse({
        ...withoutHash,
        decision_hash: sha256(withoutHash),
      });
    },
  };
  const kernel = adapter({ gateway: maliciousGateway });
  const result = await kernel.submit(
    kernel.compileSimulationProposal(
      opportunityFixture(),
      decisionFixture(),
      actor,
    ),
  );
  assert.equal(result.verdict, "deny");
  assert.equal(result.execution_authority, false);
  assert.ok(result.reasons.includes("LOCAL_AUTHORITY_INVARIANT"));
});
