import { Router, type Request } from "express";
import { DomainError } from "../domain/errors.js";
import type { AppendOnlyEventStore } from "../domain/eventStore.js";
import { requireCapability } from "../domain/identity.js";
import type { PumpStationInstitution } from "../domain/institution.js";
import type { Actor } from "../domain/model.js";
import type { PumpStationKernelAdapter } from "./adapter.js";

type KernelRouterOptions = {
  adapter: PumpStationKernelAdapter;
  institution: PumpStationInstitution;
  store: AppendOnlyEventStore;
};

function actor(request: Request): Actor {
  if (!request.pumpstationActor) {
    throw new DomainError(
      401,
      "AUTHENTICATION_REQUIRED",
      "A local authenticated actor is required to compile a proposal.",
    );
  }
  return request.pumpstationActor;
}

export function createKernelRouter(options: KernelRouterOptions): Router {
  const router = Router();

  router.get("/status", (_request, response) => {
    response.json({
      ...options.adapter.status(),
      local_wallet_identity_is_kernel_identity: false,
      local_adapter_can_authorize: false,
      external_effects_enabled: false,
    });
  });

  router.post("/opportunities/:id/proposals", async (request, response) => {
    const localActor = actor(request);
    requireCapability(localActor, "kernel:propose");
    const record = options.institution.getOpportunity(request.params.id as string);
    const decision = record.simulated_decisions.at(-1);
    if (!decision) {
      throw new DomainError(
        422,
        "SIMULATED_DECISION_REQUIRED",
        "Compile a complete simulation decision before creating a Kernel proposal.",
      );
    }
    const proposal = options.adapter.compileSimulationProposal(
      record.opportunity,
      decision,
      localActor,
    );
    const kernelDecision = await options.adapter.submit(proposal);
    options.store.append({
      event_type: "decision_proposed",
      actor: {
        actor_id: localActor.actor_id,
        actor_class: localActor.actor_class,
      },
      correlation_id: record.opportunity.opportunity_id,
      payload: {
        proposal,
        kernel_adapter_decision: kernelDecision,
        local_wallet_identity_is_kernel_identity: false,
        external_effect_permitted: false,
      },
    });
    response.status(202).json({
      proposal,
      kernel_adapter_decision: kernelDecision,
      external_effect_permitted: false,
    });
  });

  router.post("/stage-promotions/:id/proposals", async (request, response) => {
    const localActor = actor(request);
    requireCapability(localActor, "kernel:propose");
    requireCapability(localActor, "stage:decide");
    const promotion = options.institution.getPromotion(request.params.id as string);
    const proposal = options.adapter.compileStagePromotionProposal(
      promotion,
      localActor,
    );
    const kernelDecision = await options.adapter.submit(proposal);
    options.store.append({
      event_type: "decision_proposed",
      actor: {
        actor_id: localActor.actor_id,
        actor_class: localActor.actor_class,
      },
      correlation_id: promotion.promotion_id,
      payload: {
        proposal,
        kernel_adapter_decision: kernelDecision,
        active_stage_changed: false,
        external_effect_permitted: false,
      },
    });
    response.status(202).json({
      proposal,
      kernel_adapter_decision: kernelDecision,
      active_stage_changed: false,
      external_effect_permitted: false,
    });
  });

  return router;
}
