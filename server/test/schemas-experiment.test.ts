import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { AppendOnlyEventStore } from "../src/domain/eventStore.js";
import { PumpStationInstitution } from "../src/domain/institution.js";
import type { ExperimentFixture } from "../src/experiment.js";
import { runStageZeroExperiment } from "../src/experiment.js";
import {
  completeRequiredDeliberation,
  deliberationFixture,
  humanActor,
  opportunityFixture,
  stagePromotionFixture,
} from "./helpers.js";

function readJson<T>(url: URL): T {
  return JSON.parse(readFileSync(url, "utf8")) as T;
}

test("all public JSON schemas compile under draft 2020-12", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const schemaDirectory = new URL("../../schemas/", import.meta.url);
  const names = readdirSync(schemaDirectory)
    .filter((name) => name.endsWith(".schema.json"))
    .sort();

  assert.ok(names.length >= 6);
  for (const name of names) {
    const schema = readJson<Record<string, unknown>>(
      new URL(name, schemaDirectory),
    );
    assert.doesNotThrow(() => ajv.compile(schema), name);
  }
});

test("runtime opportunity fixture matches the public opportunity schema", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const schema = readJson<Record<string, unknown>>(
    new URL("../../schemas/opportunity-packet.schema.json", import.meta.url),
  );
  const validate = ajv.compile(schema);

  assert.equal(
    validate(opportunityFixture()),
    true,
    JSON.stringify(validate.errors),
  );
});

test("runtime institutional artifacts match their public wire schemas", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const store = new AppendOnlyEventStore({
    logPath: ":memory:",
    now: () => "2026-07-26T00:00:00.000Z",
  });
  const institution = new PumpStationInstitution(store, {
    now: () => "2026-07-26T00:00:00.000Z",
  });
  const actor = humanActor();
  institution.submitOpportunity(opportunityFixture(), actor);
  const firstMessage = institution.addDeliberation(
    "opp_productive_fixture",
    deliberationFixture("bear_thesis"),
    actor,
  );
  completeRequiredDeliberation((input) => {
    if (input.channel_type !== "bear_thesis") {
      institution.addDeliberation("opp_productive_fixture", input, actor);
    }
  });
  const decision = institution.compileSimulatedDecision(
    "opp_productive_fixture",
    actor,
  );
  const promotion = institution.requestStagePromotion(
    stagePromotionFixture(),
    actor,
  );

  for (const [schemaName, value] of [
    ["deliberation-message", firstMessage],
    ["simulated-decision-packet", decision],
    ["stage-promotion", promotion],
    ["institutional-event", store.list()[0]],
  ] as const) {
    const schema = readJson<Record<string, unknown>>(
      new URL(`../../schemas/${schemaName}.schema.json`, import.meta.url),
    );
    const validate = ajv.compile(schema);
    assert.equal(
      validate(value),
      true,
      `${schemaName}: ${JSON.stringify(validate.errors)}`,
    );
  }
});

test("the four-system experiment is deterministic and preserves negative results", () => {
  const fixture = readJson<ExperimentFixture>(
    new URL("../../fixtures/synthetic-opportunities.json", import.meta.url),
  );
  const first = runStageZeroExperiment(fixture);
  const second = runStageZeroExperiment(fixture);

  assert.deepEqual(second, first);
  assert.equal(first.systems.length, 4);
  assert.deepEqual(
    first.systems.map((system) => system.system),
    [
      "coordinated_multi_agent",
      "centralized_analyst_proxy",
      "deterministic_rules",
      "passive_benchmark",
    ],
  );
  assert.equal(first.negative_results_preserved, true);
  assert.equal(first.complexity_gate.decision, "NOT_EARNED");
  assert.equal(first.reality_status, "test_fixture");
});
