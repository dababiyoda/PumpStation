import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "ethers";
import request from "supertest";
import { createApp } from "../src/app.js";
import { DomainError } from "../src/domain/errors.js";
import { IdentityService } from "../src/domain/identity.js";
import {
  completeRequiredDeliberation,
  humanActor,
  opportunityFixture,
  stagePromotionFixture,
} from "./helpers.js";

test("wallet identity uses a one-time, expiring, identity-only challenge", async () => {
  const wallet = Wallet.createRandom();
  const now = new Date("2026-07-26T12:00:00.000Z");
  const identity = new IdentityService({
    domain: "pumpstation.test",
    origin: "https://pumpstation.test",
    founderAddress: wallet.address,
    now: () => now,
  });
  const challenge = identity.createChallenge({
    address: wallet.address,
    chain_id: 1,
  });

  assert.match(challenge.message, /Nonce:/);
  assert.match(challenge.message, /Expiration Time:/);
  assert.match(challenge.message, /does not authorize an investment/);
  const signature = await wallet.signMessage(challenge.message);
  const session = identity.verifyChallenge({
    address: wallet.address,
    nonce: challenge.nonce,
    signature,
  });
  assert.equal(session.actor.actor_class, "human");
  assert.ok(session.actor.capabilities.includes("stage:decide"));
  assert.equal(
    identity.authenticate(session.token).actor_id,
    session.actor.actor_id,
  );

  assert.throws(
    () =>
      identity.verifyChallenge({
        address: wallet.address,
        nonce: challenge.nonce,
        signature,
      }),
    (error: unknown) =>
      error instanceof DomainError && error.code === "CHALLENGE_INVALID",
  );
});

test("opportunity intake endpoint authenticates identity and remains simulation-only", async () => {
  const wallet = Wallet.createRandom();
  const { app } = createApp({
    founderAddress: wallet.address,
    domain: "pumpstation.test",
    origin: "https://pumpstation.test",
  });
  const challengeResponse = await request(app)
    .post("/api/v1/identity/challenges")
    .send({ address: wallet.address, chain_id: 1 });
  assert.equal(challengeResponse.status, 201);
  const signature = await wallet.signMessage(challengeResponse.body.message);
  const sessionResponse = await request(app)
    .post("/api/v1/identity/sessions")
    .send({
      address: wallet.address,
      nonce: challengeResponse.body.nonce,
      signature,
    });
  assert.equal(sessionResponse.status, 201);

  const response = await request(app)
    .post("/api/v1/opportunities")
    .set("Authorization", `Bearer ${sessionResponse.body.token}`)
    .send(
      opportunityFixture({
        proposer: {
          actor_id: `wallet:${wallet.address}`,
          actor_class: "human",
        },
      }),
    );

  assert.equal(response.status, 201);
  assert.equal(response.body.reality_status, "simulation");
  assert.equal(response.body.external_effect_permitted, false);
});

test("status and legacy wallet surfaces state the operating boundary", async () => {
  const { app } = createApp();
  const status = await request(app).get("/api/v1/status");
  assert.equal(status.status, 200);
  assert.equal(status.body.stage, 0);
  assert.equal(status.body.external_effects_permitted, false);
  assert.equal(status.body.kernel_connection, "not_implemented");
  assert.deepEqual(status.body.warnings, [
    "SIMULATION ONLY",
    "NO REAL MONEY",
    "NO INVESTMENT OFFER",
    "NO COORDINATED MARKET ACTION",
    "NO PUBLIC ASSET PROMOTION",
    "MODEL OUTPUT IS NOT FINANCIAL EVIDENCE",
  ]);

  const legacy = await request(app)
    .post("/api/connect-wallet")
    .send({ address: "0x0", signature: "fixed signature" });
  assert.equal(legacy.status, 410);
  assert.equal(legacy.body.error.code, "LEGACY_REPLAYABLE_SIGNATURE_DISABLED");
});

test("complete typed reviews compile a reproducible proposal, not authority", () => {
  const { institution } = createApp({
    nowIso: () => "2026-07-26T00:00:00.000Z",
    idFactory: (() => {
      let next = 0;
      return () => `fixed-${++next}`;
    })(),
  });
  const actor = humanActor();
  institution.submitOpportunity(opportunityFixture(), actor);
  completeRequiredDeliberation((input) =>
    institution.addDeliberation("opp_productive_fixture", input, actor),
  );

  const first = institution.compileSimulatedDecision(
    "opp_productive_fixture",
    actor,
  );
  const second = institution.compileSimulatedDecision(
    "opp_productive_fixture",
    actor,
  );
  assert.deepEqual(second, first);
  assert.equal(first.recommendation, "simulate");
  assert.equal(first.dissent.length, 1);
  assert.equal(first.authority_status, "proposal_only");
  assert.equal(first.external_effect_permitted, false);
  assert.equal(first.kernel_permit_status, "not_requested");
});

test("founder approval remains necessary but insufficient for promotion", () => {
  const { institution } = createApp({
    nowIso: () => "2026-07-26T00:00:00.000Z",
  });
  const founder = humanActor();
  const requested = institution.requestStagePromotion(
    stagePromotionFixture(),
    founder,
  );
  const decided = institution.recordFounderDecision(
    requested.promotion_id,
    {
      decision: "approved",
      reason: "Founder approves only submission to the future Kernel boundary.",
    },
    founder,
  );

  assert.equal(decided.founder_decision.status, "approved");
  assert.equal(decided.kernel_permit_status, "awaiting_kernel_permit");
  assert.equal(institution.currentStage, 0);
});
