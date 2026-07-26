import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "ethers";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  completeRequiredDeliberation,
  opportunityFixture,
  stagePromotionFixture,
} from "./helpers.js";

async function founderSession() {
  const wallet = Wallet.createRandom();
  const created = createApp({
    founderAddress: wallet.address,
    domain: "pumpstation.test",
    origin: "https://pumpstation.test",
    nowIso: () => "2026-07-26T03:00:00.000Z",
    idFactory: (() => {
      let sequence = 0;
      return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
    })(),
  });
  const challenge = await request(created.app)
    .post("/api/v1/identity/challenges")
    .send({ address: wallet.address, chain_id: 1 });
  const signature = await wallet.signMessage(challenge.body.message);
  const session = await request(created.app)
    .post("/api/v1/identity/sessions")
    .send({
      address: wallet.address,
      nonce: challenge.body.nonce,
      signature,
    });
  return {
    ...created,
    wallet,
    token: session.body.token as string,
    actor: created.identity.authenticate(session.body.token as string),
  };
}

test("Kernel status exposes pinned contracts and no execution authority", async () => {
  const { app, token } = await founderSession();
  const response = await request(app)
    .get("/api/v1/kernel/status")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.gateway.connected, false);
  assert.equal(response.body.organ_lifecycle_status, "proposed_not_registered");
  assert.equal(response.body.local_wallet_identity_is_kernel_identity, false);
  assert.equal(response.body.local_adapter_can_authorize, false);
  assert.equal(response.body.external_effects_enabled, false);
});

test("complete simulation compiles a Kernel proposal and receives a denial", async () => {
  const { app, institution, store, token, actor, wallet } =
    await founderSession();
  const opportunity = institution.submitOpportunity(
    opportunityFixture({
      proposer: {
        actor_id: `wallet:${wallet.address}`,
        actor_class: "human",
      },
    }),
    actor,
  );
  completeRequiredDeliberation((input) =>
    institution.addDeliberation(opportunity.opportunity_id, input, actor),
  );
  institution.compileSimulatedDecision(opportunity.opportunity_id, actor);

  const response = await request(app)
    .post(
      `/api/v1/kernel/opportunities/${opportunity.opportunity_id}/proposals`,
    )
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(response.status, 202);
  assert.equal(response.body.kernel_adapter_decision.verdict, "deny");
  assert.equal(
    response.body.kernel_adapter_decision.execution_authority,
    false,
  );
  assert.equal(response.body.external_effect_permitted, false);
  assert.equal(
    response.body.proposal.actor,
    "spiffe://uniimente.internal/venture/pumpstation",
  );
  assert.notEqual(response.body.proposal.actor, actor.actor_id);
  assert.equal(store.verify().valid, true);
});

test("founder-approved stage proposal remains denied and active stage unchanged", async () => {
  const { app, institution, token, actor } = await founderSession();
  const promotion = institution.requestStagePromotion(
    stagePromotionFixture(),
    actor,
  );
  const approved = institution.recordFounderDecision(
    promotion.promotion_id,
    {
      decision: "approved",
      reason: "Submit to the Kernel adapter for missing-evidence classification.",
    },
    actor,
  );

  const response = await request(app)
    .post(`/api/v1/kernel/stage-promotions/${approved.promotion_id}/proposals`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(response.status, 202);
  assert.equal(response.body.proposal.consequence_class, "irreversible");
  assert.equal(response.body.kernel_adapter_decision.verdict, "deny");
  assert.equal(response.body.active_stage_changed, false);
  assert.equal(response.body.external_effect_permitted, false);
});
