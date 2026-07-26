import { sha256 } from "../domain/hash.js";
import type {
  KernelAdapterDecision,
  KernelProposal,
} from "./contracts.js";

export type KernelGatewayStatus = {
  mode: "disconnected" | "shadow";
  connected: boolean;
  registered_service_identity: boolean;
  kernel_commit: string | null;
  external_effects_enabled: false;
};

export interface KernelGateway {
  status(): KernelGatewayStatus;
  submit(proposal: KernelProposal): Promise<KernelAdapterDecision>;
}

type DenyAllGatewayOptions = {
  now?: () => string;
  mode?: "disconnected" | "shadow";
  registeredServiceIdentity?: boolean;
  kernelCommit?: string | null;
};

export class DenyAllKernelGateway implements KernelGateway {
  readonly #now: () => string;
  readonly #status: KernelGatewayStatus;

  constructor(options: DenyAllGatewayOptions = {}) {
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#status = {
      mode: options.mode ?? "disconnected",
      connected: false,
      registered_service_identity:
        options.registeredServiceIdentity ?? false,
      kernel_commit: options.kernelCommit ?? null,
      external_effects_enabled: false,
    };
  }

  status(): KernelGatewayStatus {
    return structuredClone(this.#status);
  }

  async submit(proposal: KernelProposal): Promise<KernelAdapterDecision> {
    const decidedAt = this.#now();
    const missing = [
      "live_kernel_gateway",
      "registered_pumpstation_service_identity",
      "kernel_issued_capability_grant",
      "kernel_policy_decision",
      "commit_witness",
      "effect_receipt",
      "reconciliation_obligation",
    ];
    const decisionWithoutHash = {
      verdict: "deny" as const,
      reasons: [
        "PumpStation is not connected to the pinned UNIIMENTE Kernel.",
        "A local adapter may refuse a proposal but may never manufacture an allow decision.",
      ],
      missing,
      law_applied: [
        "models_reason_agents_propose_humans_and_policies_authorize",
        "one_canonical_consequence_gate",
        "unknown_or_unregistered_identity_refused",
        "no_external_effect_without_receipt_and_reconciliation",
      ],
      execution_authority: false as const,
      gateway_mode: this.#status.mode,
      proposal_hash: proposal.proposal_hash,
      contract_lock_hash: proposal.contract_lock_hash,
      decided_at: decidedAt,
    };
    return {
      ...decisionWithoutHash,
      decision_hash: sha256(decisionWithoutHash),
    };
  }
}
