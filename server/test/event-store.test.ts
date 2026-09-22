import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DomainError } from "../src/domain/errors.js";
import {
  AppendOnlyEventStore,
  verifyEventChain,
} from "../src/domain/eventStore.js";
import { PumpStationInstitution } from "../src/domain/institution.js";
import {
  deliberationFixture,
  humanActor,
  opportunityFixture,
} from "./helpers.js";

test("event chain is deterministic, sequential, and valid", () => {
  let nextId = 0;
  const store = new AppendOnlyEventStore({
    logPath: ":memory:",
    now: () => "2026-07-26T00:00:00.000Z",
    idFactory: () => `fixed-${++nextId}`,
  });
  const actor = humanActor();
  const first = store.append({
    event_type: "opportunity_submitted",
    actor,
    correlation_id: "opp_fixture",
    payload: { classification: "test_fixture", value: 1 },
  });
  const second = store.append({
    event_type: "correction",
    actor,
    correlation_id: "opp_fixture",
    payload: { supersedes: first.event_id, value: 2 },
  });

  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.equal(second.previous_event_hash, first.event_hash);
  assert.deepEqual(store.verify(), {
    valid: true,
    invalid_sequence: null,
  });
});

test("sequence gaps invalidate a copied event chain", () => {
  const store = new AppendOnlyEventStore({ logPath: ":memory:" });
  store.append({
    event_type: "incident",
    actor: humanActor(),
    correlation_id: "test",
    payload: { reason: "test fixture" },
  });
  const copied = store.list();
  if (!copied[0]) throw new Error("Expected one event");
  copied[0].sequence = 2;

  assert.equal(verifyEventChain(copied).valid, false);
});

test("persisted event tampering disarms startup", () => {
  const directory = mkdtempSync(join(tmpdir(), "pumpstation-events-"));
  const logPath = join(directory, "events.jsonl");
  const store = new AppendOnlyEventStore({ logPath });
  store.append({
    event_type: "incident",
    actor: humanActor(),
    correlation_id: "test",
    payload: { state: "original" },
  });
  const event = JSON.parse(readFileSync(logPath, "utf8")) as {
    payload: { state: string };
  };
  event.payload.state = "silently altered";
  writeFileSync(logPath, `${JSON.stringify(event)}\n`, "utf8");

  assert.throws(
    () => new AppendOnlyEventStore({ logPath }),
    (error: unknown) =>
      error instanceof DomainError && error.code === "EVENT_CHAIN_INVALID",
  );
});

test("corrections add records and preserve the superseded statement", () => {
  const store = new AppendOnlyEventStore({ logPath: ":memory:" });
  const institution = new PumpStationInstitution(store);
  institution.submitOpportunity(opportunityFixture(), humanActor());
  const original = institution.addDeliberation(
    "opp_productive_fixture",
    deliberationFixture("bear_thesis", {
      content: "Original downside statement.",
    }),
    humanActor(),
  );
  institution.addDeliberation(
    "opp_productive_fixture",
    deliberationFixture("bear_thesis", {
      content: "Corrected downside statement with added context.",
      supersedes_message_id: original.message_id,
    }),
    humanActor(),
  );

  const messages = institution.getOpportunity(
    "opp_productive_fixture",
  ).deliberations;
  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.content, "Original downside statement.");
  assert.equal(messages[1]?.supersedes_message_id, original.message_id);
  assert.equal(store.list().at(-1)?.event_type, "correction");
});
