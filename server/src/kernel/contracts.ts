import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const Sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const GitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const SpiffeSchema = z.string().regex(/^spiffe:\/\/uniimente\.internal\//);

export const KernelContractLockSchema = z
  .object({
    lock_version: z.string().min(1),
    contract_set_id: z.string().min(1),
    repository: z.literal("dababiyoda/uniimente-kernel"),
    commit_sha: GitShaSchema,
    status: z.literal("pinned_source_reviewed_not_runtime_connected"),
    contracts: z.record(z.string().min(1), GitShaSchema),
    authority_sources: z.record(z.string().min(1), GitShaSchema),
    implementation_sources: z.record(z.string().min(1), GitShaSchema),
    sdk_status: z.literal("typescript_sdk_placeholder_phase_10"),
    binding_rules: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type KernelContractLock = z.infer<typeof KernelContractLockSchema>;

export const PumpStationOrganManifestSchema = z
  .object({
    manifest_version: z.string().min(1),
    organ_id: z.literal("pumpstation-community-capital"),
    display_name: z.string().min(1),
    lifecycle_status: z.literal("proposed_not_registered"),
    reality_status: z.literal("sandbox"),
    service_identity: SpiffeSchema,
    service_identity_status: z.literal(
      "proposed_not_present_in_pinned_kernel_registry",
    ),
    legal_principal: z.literal("alfonso_lopez"),
    legal_principal_scope: z.string().min(1),
    autonomy_level: z.literal(0),
    mission: z.string().min(1),
    canonical_state_owned: z.array(z.string().min(1)).min(1),
    canonical_state_prohibited: z.array(z.string().min(1)).min(1),
    contracts_consumed: z.array(z.string().min(1)).min(1),
    proposal_capabilities: z.array(z.string().min(1)).min(1),
    prohibited_capabilities: z.array(z.string().min(1)).min(1),
    authority_envelope: z
      .object({
        maximum_consequence_class: z.literal("internal_write"),
        maximum_cost_usd: z.literal(0),
        human_required: z.literal(true),
        external_targets: z.array(z.string()).max(0),
        initial_stage: z.literal("simulate"),
        self_activation: z.literal(false),
      })
      .strict(),
    shutdown_behavior: z
      .object({
        authorized_shutdown_must_succeed: z.literal(true),
        new_proposals_after_shutdown: z.literal(false),
        open_records_preserved: z.literal(true),
        external_effects_during_shutdown: z.literal(false),
      })
      .strict(),
    recovery_behavior: z.record(z.string().min(1), z.literal("deny")),
    registration_dependencies: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type PumpStationOrganManifest = z.infer<
  typeof PumpStationOrganManifestSchema
>;

export const KernelConsequenceClassSchema = z.enum([
  "read_only",
  "internal_write",
  "external_contact",
  "financial",
  "irreversible",
]);
export type KernelConsequenceClass = z.infer<
  typeof KernelConsequenceClassSchema
>;

export const KernelProposalSchema = z
  .object({
    proposal_id: z.string().uuid(),
    actor: SpiffeSchema,
    legal_principal: z.string().min(1),
    action_class: z.string().min(1),
    objective: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
    target: z.string().min(1),
    consequence_class: KernelConsequenceClassSchema,
    evidence_confidence: z.number().min(0).max(1),
    evidence_refs: z.array(z.string().min(1)),
    estimated_cost_usd: z.number().nonnegative(),
    requested_capability: z.string().min(1),
    expected_outcome: z.string().min(1),
    context: z.record(z.string(), z.unknown()),
    source_revision: GitShaSchema,
    contract_lock_hash: Sha256Schema,
    proposal_hash: Sha256Schema,
  })
  .strict();
export type KernelProposal = z.infer<typeof KernelProposalSchema>;

export const KernelCapabilityGrantSchema = z
  .object({
    grant_id: z.string().uuid(),
    grantee: SpiffeSchema,
    granted_by: SpiffeSchema,
    legal_actor: z.string().min(1),
    permitted_actions: z.array(z.string().min(1)).min(1),
    resource_limits: z
      .object({
        max_cost_usd: z.number().nonnegative(),
        max_calls: z.number().int().nonnegative().optional(),
      })
      .strict(),
    initial_stage: z.enum(["simulate", "shadow"]),
    issued_at: z.string().datetime(),
    expires_at: z.string().datetime(),
    revocable_by: z.array(SpiffeSchema).min(1),
    revoked: z.boolean(),
    revoked_at: z.string().datetime().nullable(),
    revocation_reason: z.string().nullable(),
  })
  .strict();
export type KernelCapabilityGrant = z.infer<
  typeof KernelCapabilityGrantSchema
>;

export const KernelAdapterDecisionSchema = z
  .object({
    verdict: z.enum(["allow", "deny", "require_human"]),
    reasons: z.array(z.string().min(1)).min(1),
    missing: z.array(z.string().min(1)),
    law_applied: z.array(z.string().min(1)),
    execution_authority: z.literal(false),
    gateway_mode: z.enum(["disconnected", "shadow"]),
    proposal_hash: Sha256Schema,
    contract_lock_hash: Sha256Schema,
    decision_hash: Sha256Schema,
    decided_at: z.string().datetime(),
  })
  .strict();
export type KernelAdapterDecision = z.infer<
  typeof KernelAdapterDecisionSchema
>;

function repositoryRootCandidates(): string[] {
  const directory = fileURLToPath(new URL(".", import.meta.url));
  return [
    resolve(directory, "../../../.."),
    resolve(directory, "../../../../.."),
  ];
}

function readPinnedJson(relativePath: string): unknown {
  const path = repositoryRootCandidates()
    .map((root) => resolve(root, relativePath))
    .find((candidate) => existsSync(candidate));
  if (!path) throw new Error(`Pinned Kernel file not found: ${relativePath}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadKernelContractLock(): KernelContractLock {
  return KernelContractLockSchema.parse(
    readPinnedJson("kernel/kernel-contract-lock.json"),
  );
}

export function loadPumpStationOrganManifest(): PumpStationOrganManifest {
  return PumpStationOrganManifestSchema.parse(
    readPinnedJson("kernel/pumpstation-organ-manifest.json"),
  );
}
