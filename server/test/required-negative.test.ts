import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { ManipulationScreen } from "../src/domain/model.js";
import { DomainError } from "../src/domain/errors.js";
import { AppendOnlyEventStore } from "../src/domain/eventStore.js";
import { PumpStationInstitution } from "../src/domain/institution.js";
import {
  agentActor,
  deliberationFixture,
  humanActor,
  opportunityFixture,
  stagePromotionFixture,
} from "./helpers.js";

function freshInstitution(classifier?: () => ManipulationScreen): {
  institution: PumpStationInstitution;
  store: AppendOnlyEventStore;
} {
  const store = new AppendOnlyEventStore({ logPath: ":memory:" });
  const institution = new PumpStationInstitution(store, {
    ...(classifier ? { classifier } : {}),
  });
  return { institution, store };
}

function expectDomainCode(action: () => unknown, code: string): DomainError {
  let captured: DomainError | null = null;
  assert.throws(action, (error: unknown) => {
    if (error instanceof DomainError && error.code === code) {
      captured = error;
      return true;
    }
    return false;
  });
  return captured as unknown as DomainError;
}

test("1. refuses synchronized-buy instructions", () => {
  const { institution } = freshInstitution();
  expectDomainCode(
    () =>
      institution.submitOpportunity(
        opportunityFixture({
          title: "Everyone will execute a synchronized buy at noon",
        }),
        humanActor(),
      ),
    "OPPORTUNITY_REFUSED",
  );
});

test("2. refuses promotion after coordinated accumulation", () => {
  const { institution } = freshInstitution();
  institution.submitOpportunity(opportunityFixture(), humanActor());

  expectDomainCode(
    () =>
      institution.addDeliberation(
        "opp_productive_fixture",
        deliberationFixture("bull_thesis", {
          content:
            "Accumulate first, then promote our owned asset through a public campaign.",
        }),
        humanActor(),
      ),
    "DELIBERATION_INSTRUCTION_REFUSED",
  );
});

test("3. refuses coordinated exit plans", () => {
  const { institution } = freshInstitution();
  const packet = opportunityFixture();
  packet.screening_answers.coordinated_exit = true;

  expectDomainCode(
    () => institution.submitOpportunity(packet, humanActor()),
    "OPPORTUNITY_REFUSED",
  );
});

test("4. refuses undisclosed proposer holdings", () => {
  const { institution } = freshInstitution();
  const packet = opportunityFixture({
    proposer_holdings: {
      disclosed: false,
      description: "The proposer declined to disclose holdings.",
    },
  });

  expectDomainCode(
    () => institution.submitOpportunity(packet, humanActor()),
    "OPPORTUNITY_REFUSED",
  );
});

test("5. refuses guaranteed-return claims", () => {
  const { institution } = freshInstitution();
  const packet = opportunityFixture();
  packet.screening_answers.guaranteed_returns = true;

  expectDomainCode(
    () => institution.submitOpportunity(packet, humanActor()),
    "OPPORTUNITY_REFUSED",
  );
});

test("6. refuses fake-volume strategies", () => {
  const { institution } = freshInstitution();
  const packet = opportunityFixture();
  packet.screening_answers.fake_volume = true;

  expectDomainCode(
    () => institution.submitOpportunity(packet, humanActor()),
    "OPPORTUNITY_REFUSED",
  );
});

test("7. refuses agent self-approval", () => {
  const { institution } = freshInstitution();
  const requestPacket = institution.requestStagePromotion(
    stagePromotionFixture(),
    agentActor(),
  );

  expectDomainCode(
    () =>
      institution.recordFounderDecision(
        requestPacket.promotion_id,
        { decision: "approved", reason: "Agents agree." },
        agentActor(),
      ),
    "AGENT_SELF_APPROVAL_PROHIBITED",
  );
});

test("8. keeps stage promotion pending without founder authority", () => {
  const { institution } = freshInstitution();
  const requestPacket = institution.requestStagePromotion(
    stagePromotionFixture(),
    humanActor(),
  );
  const nonFounder = humanActor({
    actor_id: "human:non-founder",
    capabilities: ["stage:request"],
  });

  expectDomainCode(
    () =>
      institution.recordFounderDecision(
        requestPacket.promotion_id,
        { decision: "approved", reason: "Unauthorized approval attempt." },
        nonFounder,
      ),
    "CAPABILITY_DENIED",
  );
  assert.equal(institution.currentStage, 0);
  assert.equal(
    institution.getPromotion(requestPacket.promotion_id).at(-1)
      ?.founder_decision.status,
    "pending",
  );
});

test("9. refuses real-money execution in simulation mode", async () => {
  const { app } = createApp();
  const response = await request(app)
    .post("/api/v1/orders")
    .send({ side: "buy", amount: 1 });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "EXTERNAL_EFFECT_SURFACE_PROHIBITED");
  assert.equal(response.body.error.unauthorized_external_effects, 0);
});

test("10. refuses wallet-transfer requests in simulation mode", async () => {
  const { app } = createApp();
  const response = await request(app)
    .post("/api/v1/transfers")
    .send({ to: "0x0000000000000000000000000000000000000000" });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "EXTERNAL_EFFECT_SURFACE_PROHIBITED");
});

test("11. refuses model output submitted as evidence", () => {
  const { institution } = freshInstitution();
  const packet = opportunityFixture();
  packet.evidence[0] = {
    ...packet.evidence[0],
    source_type: "model_output",
    evidence_status: "unverified",
  };

  const error = expectDomainCode(
    () => institution.submitOpportunity(packet, humanActor()),
    "OPPORTUNITY_REFUSED",
  );
  assert.match(
    JSON.stringify(error.details),
    /MODEL_OUTPUT_SUBMITTED_AS_EVIDENCE/,
  );
});

test("12. refuses simulation eligibility when the bear thesis is missing", () => {
  const { institution } = freshInstitution();
  institution.submitOpportunity(opportunityFixture(), humanActor());
  for (const channel of [
    "bull_thesis",
    "conflicts",
    "legal_questions",
    "security",
    "community_impact",
  ] as const) {
    institution.addDeliberation(
      "opp_productive_fixture",
      deliberationFixture(channel),
      humanActor(),
    );
  }

  const decision = institution.compileSimulatedDecision(
    "opp_productive_fixture",
    humanActor(),
  );
  assert.equal(decision.recommendation, "needs_evidence");
  assert.deepEqual(decision.evidence_assessment.missing_channels, [
    "bear_thesis",
  ]);
  assert.equal(decision.external_effect_permitted, false);
});

test("13. refuses a missing conflict disclosure", () => {
  const { institution } = freshInstitution();
  const packet = opportunityFixture();
  packet.conflicts[0] = {
    ...packet.conflicts[0],
    disclosed: false,
    description: "A material relationship exists but was not disclosed.",
  };

  const error = expectDomainCode(
    () => institution.submitOpportunity(packet, humanActor()),
    "OPPORTUNITY_REFUSED",
  );
  assert.match(JSON.stringify(error.details), /AM-018/);
});

test("14. provides no endpoint to delete dissent", async () => {
  const { app, institution } = createApp();
  institution.submitOpportunity(opportunityFixture(), humanActor());
  const dissent = institution.addDeliberation(
    "opp_productive_fixture",
    deliberationFixture("bear_thesis", {
      content: "The synthetic downside thesis must remain visible.",
    }),
    humanActor(),
  );

  const response = await request(app).delete(
    `/api/v1/opportunities/opp_productive_fixture/deliberations/${dissent.message_id}`,
  );
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "API_ROUTE_NOT_FOUND");
  assert.equal(
    institution.getOpportunity("opp_productive_fixture").deliberations[0]
      .content,
    "The synthetic downside thesis must remain visible.",
  );
});

test("15. prevents callers from altering historical decision records", () => {
  const { institution, store } = freshInstitution();
  institution.submitOpportunity(opportunityFixture(), humanActor());
  const callerCopy = store.list();
  const originalHash = callerCopy[0]?.event_hash;
  if (!callerCopy[0]) throw new Error("Expected a submitted event");
  callerCopy[0].payload.opportunity = { title: "altered" };

  assert.equal(store.list()[0]?.event_hash, originalHash);
  assert.equal(store.verify().valid, true);
  assert.notDeepEqual(store.list()[0]?.payload.opportunity, {
    title: "altered",
  });
});

test("16. refuses public promotion of an owned asset", () => {
  const { institution } = freshInstitution();
  const packet = opportunityFixture();
  packet.screening_answers.public_promotion_owned_asset = true;

  const error = expectDomainCode(
    () => institution.submitOpportunity(packet, humanActor()),
    "OPPORTUNITY_REFUSED",
  );
  assert.match(JSON.stringify(error.details), /AM-015/);
});

test("17. refuses outside-capital intake before authorization", () => {
  const { institution } = freshInstitution();
  const packet = opportunityFixture();
  packet.screening_answers.outside_capital_intake = true;

  const error = expectDomainCode(
    () => institution.submitOpportunity(packet, humanActor()),
    "OPPORTUNITY_REFUSED",
  );
  assert.match(JSON.stringify(error.details), /AM-014/);
});

test("18. classifier failure defaults to refusal", () => {
  const { institution, store } = freshInstitution(() => {
    throw new Error("synthetic classifier failure");
  });

  const error = expectDomainCode(
    () => institution.submitOpportunity(opportunityFixture(), humanActor()),
    "OPPORTUNITY_REFUSED",
  );
  assert.match(JSON.stringify(error.details), /AM-FAIL-CLOSED/);
  assert.equal(store.list().at(-1)?.event_type, "opportunity_rejected");
  assert.equal(institution.getDashboard().metrics instanceof Object, true);
});
